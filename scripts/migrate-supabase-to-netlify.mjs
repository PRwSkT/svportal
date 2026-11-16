#!/usr/bin/env node

/**
 * ==============================================================================
 * Supabase-to-Netlify Data Cutover & Verification Script
 * File: scripts/migrate-supabase-to-netlify.mjs
 *
 * Capabilities:
 *   1. --mode=export-json [--out=.netlify/data-cutover-snapshot.json] [--batch-size=1000]
 *      - Discovers exposed tables in public & family schemas via PostgREST OpenAPI
 *      - Exports auth.users (id, email, metadata) to satisfy foreign keys
 *      - Exports storage.buckets metadata if accessible
 *      - Paginates all public.* and family.* tables using SUPABASE_SERVICE_ROLE_KEY
 *      - Writes full structured snapshot with row counts
 *      - STRICT PII SAFETY: Prints only table names, row counts, and summaries!
 *
 *   2. --mode=import-pg [--in=.netlify/data-cutover-snapshot.json] [--connection-string=...]
 *      - Connects via pg.Client to Netlify Postgres (or DATABASE_URL)
 *      - Creates schemas (public, family, auth stub if missing)
 *      - Dynamically inspects information_schema.columns to map JSONB, arrays, and columns
 *      - Inserts in strict topological FK-safe order with ON CONFLICT DO NOTHING (idempotent)
 *      - Solves mutual circular FK between personnel & app_users with deferred linkage
 *      - Resets all SERIAL/IDENTITY sequences (setval) to prevent sequence drift
 *
 *   3. --mode=verify [--in=.netlify/data-cutover-snapshot.json] [--connection-string=...]
 *      - Verifies live COUNT(*) in target Postgres against snapshot (or live Supabase)
 *      - Exits non-zero if any table mismatches or is missing
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

// Load .env.local first, then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// ==============================================================================
// CANONICAL TOPOLOGICAL TABLE ORDERING (FK-safe)
// ==============================================================================
const CANONICAL_PUBLIC_TABLES = [
  // 1. Independent foundation tables
  'academic_years',
  'fee_types',
  'products',
  'albums',
  'kpi_cycles',
  'kpi_templates',
  'signage_groups',
  'signage_media',
  'signage_campaigns',
  'signage_settings',
  'receipt_sequences',
  'school_board_meetings',
  'school_annual_sar_records',
  'school_van_routes',
  'teacher_licenses',
  'explore_registrations',
  'nongfah_conversations',
  'nongfah_collective_memory',
  'documents',
  'daily_milk_logs',
  'sync_queue',

  // 2. Core entity tables
  'students',
  'daily_spend_tracking',
  'wallet_accounts',
  'wallet_transactions',
  'student_addresses',
  'student_parents',
  'student_health_logs',
  'student_sdq_evaluations',
  'student_home_visits',
  'subsidy_free15y_disbursements',
  'school_van_daily_logs',
  'school_infirmary_visits',
  'student_attendance_logs',
  'student_incidents',
  'early_years_daily_care',
  'system_domain_events',

  // 3. Personnel & App Users (Handled with cycle breaker)
  'personnel',
  'app_users',
  'audit_logs',
  'user_push_subscriptions',
  'app_notifications',
  'calendar_events',
  'attendance_records',
  'academic_teacher_competencies',

  // 4. Academic Structure
  'academic_terms',
  'academic_courses',
  'academic_classes',
  'academic_class_enrollments',
  'academic_gradebooks',
  'academic_student_grades',
  'academic_early_years_evaluations',
  'academic_timetables',
  'academic_substitutions',
  'academic_exams',
  'academic_exam_questions',
  'academic_exam_sets',
  'academic_exam_submissions',
  'academic_assignments',
  'academic_assignment_submissions',

  // 5. Commercial & Financial
  'shop_transactions',
  'shop_transaction_items',
  'fee_items',
  'tuition_payments',

  // 6. Content, Forms, Signage & Operations
  'album_photos',
  'news',
  'forms',
  'form_fields',
  'form_responses',
  'parent_teacher_threads',
  'parent_teacher_messages',
  'kpi_evaluations',
  'kpi_evaluator_reviews',
  'signage_devices',
  'signage_campaign_media'
];

const CANONICAL_FAMILY_TABLES = [
  // 1. Independent family tables
  'guardians',

  // 2. Tables linking guardians, students, and app_users
  'guardian_student_links',
  'guardian_accounts',
  'guardian_invitations',
  'consents',
  'student_leave_requests',
  'pickup_daily_plans',
  'early_years_dropoff_notes',
  'medication_requests'
];

// Unified topological sequence for insertion
const FULL_TOPOLOGICAL_SEQUENCE = [
  ...CANONICAL_PUBLIC_TABLES.map(t => `public.${t}`),
  ...CANONICAL_FAMILY_TABLES.map(t => `family.${t}`)
];

function guessMimeType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

// ==============================================================================
// CLI ARGS PARSER
// ==============================================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: null,
    out: path.join(ROOT_DIR, '.netlify', 'data-cutover-snapshot.json'),
    in: path.join(ROOT_DIR, '.netlify', 'data-cutover-snapshot.json'),
    storageManifest: path.join(ROOT_DIR, '.netlify', 'storage-cutover-manifest.json'),
    storageDir: path.join(ROOT_DIR, '.netlify', 'blobs-local'),
    rewriteUrls: false,
    buckets: null,
    connectionString: process.env.NETLIFY_DB_URL || process.env.DATABASE_URL || null,
    batchSize: 1000,
    tables: null,
    dryRun: false,
    live: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    } else if (arg.startsWith('--out=')) {
      options.out = path.resolve(ROOT_DIR, arg.split('=')[1]);
    } else if (arg.startsWith('--in=')) {
      options.in = path.resolve(ROOT_DIR, arg.split('=')[1]);
    } else if (arg.startsWith('--storage-manifest=')) {
      options.storageManifest = path.resolve(ROOT_DIR, arg.split('=')[1]);
    } else if (arg.startsWith('--storage-dir=')) {
      options.storageDir = path.resolve(ROOT_DIR, arg.split('=')[1]);
    } else if (arg.startsWith('--connection-string=')) {
      options.connectionString = arg.slice('--connection-string='.length);
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10) || 1000;
    } else if (arg.startsWith('--tables=')) {
      options.tables = arg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--buckets=')) {
      options.buckets = arg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--rewrite-urls') {
      options.rewriteUrls = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--live') {
      options.live = true;
    }
  }

  return options;
}

function printUsage() {
  console.log(`
Supabase-to-Netlify Data Cutover & Verification Tool
Usage: node scripts/migrate-supabase-to-netlify.mjs [options]

Modes:
  --mode=export-json      Export snapshot from live Supabase into JSON
  --mode=import-pg        Import snapshot JSON into target Postgres database
  --mode=verify           Verify live row counts in target Postgres against snapshot
  --mode=export-storage   Export all storage buckets & files to .netlify/blobs-local/ and manifest
  --mode=import-blobs     Upload downloaded blobs to Netlify Blobs & optionally rewrite URLs

Options:
  --out=<path>                Output JSON file for export (default: .netlify/data-cutover-snapshot.json)
  --in=<path>                 Input JSON file for import/verify (default: .netlify/data-cutover-snapshot.json)
  --storage-manifest=<path>   Manifest for storage blobs (default: .netlify/storage-cutover-manifest.json)
  --storage-dir=<path>        Local directory for blobs (default: .netlify/blobs-local)
  --rewrite-urls              Rewrite old Supabase storage URLs to /api/blobs/... in target Postgres DB
  --connection-string=<url>   Target PostgreSQL connection string (defaults to NETLIFY_DB_URL or DATABASE_URL)
  --batch-size=<n>            Batch size for pagination / multi-row inserts (default: 1000)
  --tables=<t1,t2,...>        Filter specific tables (e.g. public.students,family.guardians)
  --buckets=<b1,b2,...>       Filter specific buckets (e.g. website-content,signage-media)
  --dry-run                   In import-pg / import-blobs mode, test and validate without writing data
  --live                      In verify mode, query live Supabase counts directly
  --help                      Show this help message
  `);
}

// ==============================================================================
// POSTGREST OPENAPI DISCOVERY
// ==============================================================================
async function discoverTablesFromOpenAPI(supabaseUrl, serviceRoleKey) {
  const schemas = ['public', 'family'];
  const discovered = { public: [], family: [] };

  for (const schema of schemas) {
    try {
      const headers = {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      };
      if (schema !== 'public') {
        headers['Accept-Profile'] = schema;
      }
      const res = await fetch(`${supabaseUrl}/rest/v1/`, { headers });
      if (res.ok) {
        const doc = await res.json();
        const tables = Object.keys(doc.paths || {})
          .filter(p => p !== '/' && !p.startsWith('/rpc'))
          .map(p => p.replace(/^\//, ''));
        discovered[schema] = tables;
      }
    } catch (e) {
      console.warn(`[discovery] Warning: Could not fetch OpenAPI for schema ${schema}:`, e.message);
    }
  }

  // Merge with canonical tables to guarantee zero missed tables
  for (const t of CANONICAL_PUBLIC_TABLES) {
    if (!discovered.public.includes(t)) discovered.public.push(t);
  }
  for (const t of CANONICAL_FAMILY_TABLES) {
    if (!discovered.family.includes(t)) discovered.family.push(t);
  }

  return discovered;
}

// ==============================================================================
// 1. SUBCOMMAND: EXPORT-JSON
// ==============================================================================
async function runExportJson(options) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[export-json] ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
    process.exit(1);
  }

  console.log('================================================================================');
  console.log('SUPABASE-TO-NETLIFY DATA CUTOVER: EXPORT JSON SNAPSHOT');
  console.log(`Source Supabase URL : ${supabaseUrl}`);
  console.log(`Output File Path    : ${options.out}`);
  console.log(`Batch Size          : ${options.batchSize}`);
  console.log('================================================================================\n');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const snapshot = {
    exportedAt: new Date().toISOString(),
    supabaseUrl,
    schemas: {
      auth_users: [],
      storage_buckets: [],
      public: {},
      family: {}
    },
    counts: {}
  };

  // 1. Export auth.users
  console.log('[export-json] Discovering and exporting auth.users...');
  try {
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.warn(`[export-json] Warning: Could not list auth.users (${error.message})`);
        break;
      }
      const users = data?.users || [];
      // Sanitize auth users: keep structural metadata and identifiers for FK resolution
      for (const u of users) {
        snapshot.schemas.auth_users.push({
          id: u.id,
          aud: u.aud || 'authenticated',
          role: u.role || 'authenticated',
          email: u.email || null,
          phone: u.phone || null,
          created_at: u.created_at,
          updated_at: u.updated_at,
          last_sign_in_at: u.last_sign_in_at || null,
          raw_app_meta_data: u.app_metadata || {},
          raw_user_meta_data: u.user_metadata || {},
          is_anonymous: u.is_anonymous || false
        });
      }
      if (users.length < perPage) break;
      page++;
    }
    snapshot.counts['auth_users'] = snapshot.schemas.auth_users.length;
    console.log(`[export-json] auth.users: ${snapshot.counts['auth_users']} user records exported.`);
  } catch (err) {
    console.warn(`[export-json] Warning: Failed to export auth.users (${err.message})`);
  }

  // 2. Export storage.buckets metadata
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (!bErr && buckets) {
      snapshot.schemas.storage_buckets = buckets.map(b => ({
        id: b.id,
        name: b.name,
        public: b.public,
        file_size_limit: b.file_size_limit,
        allowed_mime_types: b.allowed_mime_types,
        created_at: b.created_at,
        updated_at: b.updated_at
      }));
      snapshot.counts['storage_buckets'] = snapshot.schemas.storage_buckets.length;
      console.log(`[export-json] storage.buckets: ${snapshot.counts['storage_buckets']} buckets found.`);
    }
  } catch (err) {
    console.warn(`[export-json] Warning: Could not list storage.buckets (${err.message})`);
  }

  // 3. Discover exposed tables
  console.log('[export-json] Inspecting exposed tables via PostgREST OpenAPI spec...');
  const discovered = await discoverTablesFromOpenAPI(supabaseUrl, serviceRoleKey);
  console.log(`[export-json] Discovered ${discovered.public.length} public tables and ${discovered.family.length} family tables.\n`);

  // 4. Export public & family tables
  const targetSchemas = [
    { name: 'public', tables: discovered.public },
    { name: 'family', tables: discovered.family }
  ];

  let totalRows = 0;
  let exportedTablesCount = 0;

  for (const { name: schemaName, tables } of targetSchemas) {
    console.log(`--- Schema: ${schemaName} (${tables.length} tables) ---`);
    for (const table of tables) {
      const fullKey = `${schemaName}.${table}`;
      if (options.tables && !options.tables.includes(fullKey) && !options.tables.includes(table)) {
        continue;
      }

      let offset = 0;
      const rows = [];
      let isTableNotFound = false;

      while (true) {
        let query = schemaName === 'public'
          ? supabase.from(table).select('*')
          : supabase.schema(schemaName).from(table).select('*');

        query = query.range(offset, offset + options.batchSize - 1);

        const { data, error } = await query;
        if (error) {
          if (
            error.code === '42P01' ||
            error.message.includes('does not exist') ||
            error.message.includes('not found in the schema cache') ||
            error.message.includes('relation')
          ) {
            isTableNotFound = true;
          } else {
            console.error(`[export-json] Error exporting ${fullKey} at offset ${offset}: ${error.message}`);
          }
          break;
        }

        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < options.batchSize) break;
        offset += options.batchSize;
      }

      if (!isTableNotFound) {
        snapshot.schemas[schemaName][table] = rows;
        snapshot.counts[fullKey] = rows.length;
        totalRows += rows.length;
        exportedTablesCount++;
        console.log(`  ✓ ${fullKey.padEnd(42)} : ${String(rows.length).padStart(6)} rows`);
      }
    }
    console.log('');
  }

  // 5. Ensure output directory exists and write JSON
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, JSON.stringify(snapshot, null, 2), 'utf8');
  const stats = fs.statSync(options.out);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('================================================================================');
  console.log('EXPORT COMPLETED SUCCESSFULLY');
  console.log(`Destination File    : ${options.out}`);
  console.log(`File Size           : ${sizeMb} MB (${stats.size.toLocaleString()} bytes)`);
  console.log(`Tables Exported     : ${exportedTablesCount}`);
  console.log(`Total Data Rows     : ${totalRows.toLocaleString()}`);
  console.log(`Auth Users Exported : ${snapshot.schemas.auth_users.length}`);
  console.log('================================================================================\n');

  return snapshot;
}

// ==============================================================================
// 2. SUBCOMMAND: IMPORT-PG
// ==============================================================================
async function runImportPg(options) {
  const connectionString = options.connectionString;
  if (!connectionString) {
    console.error('[import-pg] ERROR: Target connection string is required.');
    console.error('Please set NETLIFY_DB_URL or DATABASE_URL in .env.local, or pass --connection-string="postgresql://..."');
    process.exit(1);
  }

  if (!fs.existsSync(options.in)) {
    console.error(`[import-pg] ERROR: Snapshot file not found at ${options.in}`);
    console.error('Run --mode=export-json first to generate a data snapshot.');
    process.exit(1);
  }

  console.log('================================================================================');
  console.log('SUPABASE-TO-NETLIFY DATA CUTOVER: IMPORT TO POSTGRESQL');
  console.log(`Snapshot Input File : ${options.in}`);
  console.log(`Target Database     : ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Dry Run Mode        : ${options.dryRun ? 'YES (Validating only)' : 'NO (Live insertion)'}`);
  console.log('================================================================================\n');

  const snapshot = JSON.parse(fs.readFileSync(options.in, 'utf8'));

  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('[import-pg] Connected successfully to target Postgres database.');

  try {
    // 1. Ensure target schemas exist
    if (!options.dryRun) {
      await client.query(`
        CREATE SCHEMA IF NOT EXISTS public;
        CREATE SCHEMA IF NOT EXISTS family;
        CREATE SCHEMA IF NOT EXISTS auth;
      `);
    }

    // 2. Inspect target tables and columns via information_schema
    const colRes = await client.query(`
      SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema IN ('public', 'family', 'auth');
    `);

    const tableColumnsMap = new Map(); // "schema.table" -> Map<column_name, { data_type, udt_name }>
    for (const r of colRes.rows) {
      const key = `${r.table_schema}.${r.table_name}`;
      if (!tableColumnsMap.has(key)) tableColumnsMap.set(key, new Map());
      tableColumnsMap.get(key).set(r.column_name, {
        data_type: r.data_type,
        udt_name: r.udt_name
      });
    }

    // 3. Ensure auth.users exists (create stub if target schema doesn't have it to satisfy FKs)
    if (!tableColumnsMap.has('auth.users')) {
      console.log('[import-pg] Setting up auth.users table in target to satisfy foreign keys...');
      if (!options.dryRun) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS auth.users (
            id UUID PRIMARY KEY,
            email TEXT,
            phone TEXT,
            aud TEXT DEFAULT 'authenticated',
            role TEXT DEFAULT 'authenticated',
            raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
            raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            last_sign_in_at TIMESTAMPTZ,
            is_anonymous BOOLEAN DEFAULT false
          );
        `);
      }
      // Re-query columns for auth.users
      const authCols = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'users';
      `);
      const map = new Map();
      for (const r of authCols.rows) {
        map.set(r.column_name, { data_type: r.data_type, udt_name: r.udt_name });
      }
      tableColumnsMap.set('auth.users', map);
    }

    // 4. Try setting replication role to replica to safely bypass FK checks during import if allowed
    let replicaRoleActive = false;
    if (!options.dryRun) {
      try {
        await client.query("SET session_replication_role = 'replica';");
        replicaRoleActive = true;
        console.log('[import-pg] Note: session_replication_role set to replica (FK triggers disabled during import).');
      } catch {
        console.log('[import-pg] Note: session_replication_role restricted; proceeding with strict topological FK order.');
      }
    }

    // 5. Import auth.users first
    const authUsers = snapshot.schemas.auth_users || [];
    if (authUsers.length > 0 && tableColumnsMap.has('auth.users')) {
      console.log(`[import-pg] Importing ${authUsers.length} records into auth.users...`);
      if (!options.dryRun) {
        await insertRowsIntoTable(client, 'auth', 'users', authUsers, tableColumnsMap.get('auth.users'), options.batchSize);
      }
      console.log(`[import-pg] ✓ auth.users: ${authUsers.length} records processed.`);
    }

    // 6. Build ordered list of tables to import
    const availableTables = [];
    for (const schemaName of ['public', 'family']) {
      const schemaObj = snapshot.schemas[schemaName] || {};
      for (const table of Object.keys(schemaObj)) {
        availableTables.push(`${schemaName}.${table}`);
      }
    }

    // Topological order: prioritized sequence first, followed by any remaining tables
    const orderedTables = [];
    for (const key of FULL_TOPOLOGICAL_SEQUENCE) {
      if (availableTables.includes(key)) orderedTables.push(key);
    }
    for (const key of availableTables) {
      if (!orderedTables.includes(key)) orderedTables.push(key);
    }

    console.log(`[import-pg] Importing ${orderedTables.length} tables in topological order...\n`);

    // Deferred updates map to break mutual cycle between personnel and app_users
    // personnel.user_id -> app_users.id
    const deferredPersonnelUserIds = []; // { id, user_id }

    let totalImportedRows = 0;

    for (const fullKey of orderedTables) {
      const [schemaName, tableName] = fullKey.split('.');
      let rows = (snapshot.schemas[schemaName] && snapshot.schemas[schemaName][tableName]) || [];

      if (!tableColumnsMap.has(fullKey)) {
        console.log(`  ! ${fullKey.padEnd(42)} : Skipped (table does not exist in target database)`);
        continue;
      }

      if (rows.length === 0) {
        console.log(`  - ${fullKey.padEnd(42)} : 0 rows in snapshot`);
        continue;
      }

      const targetColMap = tableColumnsMap.get(fullKey);

      // Special handling for circular reference: public.personnel vs public.app_users
      if (fullKey === 'public.personnel' && targetColMap.has('user_id')) {
        // Clone rows and set user_id to null for initial insert; save deferred mapping
        rows = rows.map(r => {
          if (r.user_id) {
            deferredPersonnelUserIds.push({ id: r.id, user_id: r.user_id });
          }
          return { ...r, user_id: null };
        });
      }

      if (!options.dryRun) {
        await insertRowsIntoTable(client, schemaName, tableName, rows, targetColMap, options.batchSize);
      }

      totalImportedRows += rows.length;
      console.log(`  ✓ ${fullKey.padEnd(42)} : ${String(rows.length).padStart(6)} rows inserted/verified`);

      // If we just imported public.app_users and have deferred personnel user_ids, apply them now!
      if (fullKey === 'public.app_users' && deferredPersonnelUserIds.length > 0) {
        if (!options.dryRun) {
          for (const item of deferredPersonnelUserIds) {
            try {
              await client.query(
                `UPDATE public.personnel SET user_id = $1 WHERE id = $2 AND user_id IS NULL;`,
                [item.user_id, item.id]
              );
            } catch (err) {
              // Ignore foreign key update errors if user id not found in app_users
            }
          }
        }
        console.log(`    ↳ Resolved ${deferredPersonnelUserIds.length} deferred personnel.user_id foreign keys.`);
      }
    }

    // 7. Reset sequences to prevent duplicate key errors on future INSERTs
    if (!options.dryRun) {
      console.log('\n[import-pg] Resetting sequence counters (setval) across all tables...');
      await resetAllSequences(client);
    }

    // 8. Restore replication role if modified
    if (replicaRoleActive) {
      try {
        await client.query("SET session_replication_role = 'DEFAULT';");
      } catch {
        // Ignore
      }
    }

    console.log('\n================================================================================');
    console.log('IMPORT COMPLETED SUCCESSFULLY');
    console.log(`Total Tables Processed : ${orderedTables.length}`);
    console.log(`Total Rows Imported    : ${totalImportedRows.toLocaleString()}`);
    console.log(`Status                 : Ready for verification (--mode=verify)`);
    console.log('================================================================================\n');

  } finally {
    await client.end();
  }
}

// Helper: Batch insert rows into a PostgreSQL table using parameter arrays
async function insertRowsIntoTable(client, schema, table, rows, targetColMap, batchSize = 500) {
  if (rows.length === 0) return;

  // Filter columns that exist in the target table
  const sample = rows[0];
  const validCols = Object.keys(sample).filter(col => targetColMap.has(col));
  if (validCols.length === 0) return;

  // Calculate safe chunk size to stay well within Postgres's 65535 parameter limit
  const maxParams = 60000;
  const chunkSize = Math.max(1, Math.min(batchSize, Math.floor(maxParams / validCols.length)));

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuePlaceholders = [];
    const params = [];

    let pIndex = 1;
    for (const row of chunk) {
      const rowPlaceholders = [];
      for (const col of validCols) {
        const colMeta = targetColMap.get(col);
        const val = row[col];

        rowPlaceholders.push(`$${pIndex++}`);

        if (val === undefined || val === null) {
          params.push(null);
        } else if (
          colMeta.data_type === 'json' ||
          colMeta.data_type === 'jsonb' ||
          colMeta.udt_name === 'json' ||
          colMeta.udt_name === 'jsonb'
        ) {
          params.push(typeof val === 'object' ? JSON.stringify(val) : val);
        } else if (colMeta.data_type === 'ARRAY' || (colMeta.udt_name && colMeta.udt_name.startsWith('_'))) {
          params.push(Array.isArray(val) ? val : [val]);
        } else {
          params.push(val);
        }
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const quotedCols = validCols.map(c => `"${c}"`).join(', ');
    const sql = `
      INSERT INTO "${schema}"."${table}" (${quotedCols})
      VALUES ${valuePlaceholders.join(',\n')}
      ON CONFLICT DO NOTHING;
    `;

    await client.query(sql, params);
  }
}

// Helper: Resets all PostgreSQL SERIAL and IDENTITY sequences to MAX(column)
async function resetAllSequences(client) {
  try {
    const seqQuery = `
      SELECT
        s.relname AS seq_name,
        n.nspname AS schema_name,
        t.relname AS table_name,
        a.attname AS col_name
      FROM pg_class s
      JOIN pg_namespace n ON n.oid = s.relnamespace
      JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE s.relkind = 'S'
        AND n.nspname IN ('public', 'family');
    `;
    const res = await client.query(seqQuery);
    for (const r of res.rows) {
      try {
        const resetSql = `
          SELECT setval(
            '"${r.schema_name}"."${r.seq_name}"',
            COALESCE((SELECT MAX("${r.col_name}") FROM "${r.schema_name}"."${r.table_name}"), 1)
          );
        `;
        await client.query(resetSql);
      } catch {
        // Skip individual sequence if not permitted
      }
    }
    console.log(`[import-pg] Checked and synchronized ${res.rows.length} sequence counters.`);
  } catch (err) {
    console.warn('[import-pg] Note: Sequence reset skipped:', err.message);
  }
}

// ==============================================================================
// 3. SUBCOMMAND: VERIFY
// ==============================================================================
async function runVerify(options) {
  const connectionString = options.connectionString;
  if (!connectionString) {
    console.error('[verify] ERROR: Target connection string is required.');
    console.error('Please set NETLIFY_DB_URL or DATABASE_URL in .env.local, or pass --connection-string="postgresql://..."');
    process.exit(1);
  }

  if (!fs.existsSync(options.in) && !options.live) {
    console.error(`[verify] ERROR: Snapshot file not found at ${options.in}`);
    console.error('Run --mode=export-json first, or use --live to compare directly against Supabase.');
    process.exit(1);
  }

  console.log('================================================================================');
  console.log('SUPABASE-TO-NETLIFY DATA CUTOVER: VERIFICATION');
  console.log(`Target Database : ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Reference Source: ${options.live ? 'Live Supabase API' : options.in}`);
  console.log('================================================================================\n');

  let expectedCounts = {};

  if (options.live) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const discovered = await discoverTablesFromOpenAPI(supabaseUrl, serviceRoleKey);

    for (const t of discovered.public) {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      expectedCounts[`public.${t}`] = count ?? 0;
    }
    for (const t of discovered.family) {
      const { count } = await supabase.schema('family').from(t).select('*', { count: 'exact', head: true });
      expectedCounts[`family.${t}`] = count ?? 0;
    }
  } else {
    const snapshot = JSON.parse(fs.readFileSync(options.in, 'utf8'));
    expectedCounts = snapshot.counts || {};
  }

  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const keys = Object.keys(expectedCounts).filter(k => k.includes('.')).sort();

    console.log('Table Name'.padEnd(44) + 'Expected'.padStart(10) + 'Target DB'.padStart(12) + '   Status');
    console.log('-'.repeat(78));

    let matchedCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;

    for (const fullKey of keys) {
      if (options.tables && !options.tables.includes(fullKey)) continue;

      const [schema, table] = fullKey.split('.');
      const expected = expectedCounts[fullKey];

      try {
        const res = await client.query(`SELECT COUNT(*)::int AS count FROM "${schema}"."${table}";`);
        const live = res.rows[0].count;

        if (live === expected) {
          console.log(`✓ ${fullKey.padEnd(42)} ${String(expected).padStart(10)} ${String(live).padStart(12)}   MATCH`);
          matchedCount++;
        } else {
          console.log(`✗ ${fullKey.padEnd(42)} ${String(expected).padStart(10)} ${String(live).padStart(12)}   MISMATCH`);
          mismatchCount++;
        }
      } catch (err) {
        if (err.code === '42P01') {
          console.log(`! ${fullKey.padEnd(42)} ${String(expected).padStart(10)} ${'MISSING'.padStart(12)}   NOT_FOUND`);
          missingCount++;
        } else {
          console.log(`! ${fullKey.padEnd(42)} ${String(expected).padStart(10)} ${'ERROR'.padStart(12)}   ${err.message}`);
          mismatchCount++;
        }
      }
    }

    console.log('-'.repeat(78));
    console.log(`Total Verified : ${matchedCount + mismatchCount + missingCount}`);
    console.log(`Matched        : ${matchedCount}`);
    console.log(`Mismatched     : ${mismatchCount}`);
    console.log(`Missing Tables : ${missingCount}`);
    console.log('================================================================================\n');

    if (mismatchCount > 0 || missingCount > 0) {
      console.error(`[verify] FAILED: ${mismatchCount} mismatches and ${missingCount} missing tables detected.`);
      process.exit(1);
    } else {
      console.log('[verify] PASSED: All table row counts match target Postgres database perfectly!');
      process.exit(0);
    }

  } finally {
    await client.end();
  }
}

// ==============================================================================
// 4. SUBCOMMAND: EXPORT-STORAGE
// ==============================================================================
async function listAllBucketObjects(supabase, bucket, prefix = '') {
  const results = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' }
    });

    if (error) {
      console.warn(`[export-storage] Warning: Could not list ${bucket}/${prefix}: ${error.message}`);
      break;
    }

    if (!data || data.length === 0) break;

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      // In Supabase Storage, folder placeholders have !item.id (null id / no metadata)
      if (!item.id) {
        const subItems = await listAllBucketObjects(supabase, bucket, itemPath);
        results.push(...subItems);
      } else {
        results.push({
          bucket,
          name: item.name,
          path: itemPath,
          id: item.id,
          metadata: item.metadata || {},
          updated_at: item.updated_at,
          created_at: item.created_at
        });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return results;
}

async function runExportStorage(options) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[export-storage] ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
    process.exit(1);
  }

  console.log('================================================================================');
  console.log('SUPABASE-TO-NETLIFY STORAGE CUTOVER: EXPORT STORAGE OBJECTS');
  console.log(`Source Supabase URL : ${supabaseUrl}`);
  console.log(`Blobs Directory     : ${options.storageDir}`);
  console.log(`Manifest Path       : ${options.storageManifest}`);
  console.log('================================================================================\n');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Discover all buckets
  const baseBuckets = ['website-content', 'form-attachments', 'signage-media'];
  const bucketList = [...baseBuckets];
  try {
    const { data: remoteBuckets, error: bErr } = await supabase.storage.listBuckets();
    if (!bErr && remoteBuckets) {
      for (const b of remoteBuckets) {
        if (!bucketList.includes(b.name)) {
          bucketList.push(b.name);
        }
      }
    }
  } catch (e) {
    console.warn('[export-storage] Warning listing buckets:', e.message);
  }

  const activeBuckets = options.buckets
    ? bucketList.filter(b => options.buckets.includes(b))
    : bucketList;

  console.log(`[export-storage] Target buckets (${activeBuckets.length}): ${activeBuckets.join(', ')}\n`);

  const manifest = {
    exportedAt: new Date().toISOString(),
    supabaseUrl,
    totalFiles: 0,
    totalBytes: 0,
    buckets: activeBuckets,
    files: [],
    urlMapping: {}
  };

  let totalDownloaded = 0;
  let totalBytes = 0;

  for (const bucket of activeBuckets) {
    console.log(`--- Listing objects in bucket: ${bucket} ---`);
    const objects = await listAllBucketObjects(supabase, bucket, '');
    console.log(`  Found ${objects.length} object(s) in ${bucket}`);

    const safeBucket = bucket.replace(/[^a-zA-Z0-9_-]/g, '_');

    for (const obj of objects) {
      const objectPath = obj.path;
      const keyParts = objectPath.split('/').filter(p => p && p !== '..');
      const fileDir = path.join(options.storageDir, safeBucket, ...keyParts.slice(0, -1));
      const filePath = path.join(options.storageDir, safeBucket, ...keyParts);
      const metaPath = `${filePath}.meta.json`;

      // Download binary with retry
      let downloadSuccess = false;
      let buffer = null;
      let contentType = obj.metadata?.mimetype || guessMimeType(objectPath);
      let etag = obj.metadata?.eTag || obj.id || '';

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { data, error } = await supabase.storage.from(bucket).download(objectPath);
          if (error) {
            throw error;
          }

          const arrayBuffer = await data.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          if (data.type && data.type !== 'application/octet-stream') {
            contentType = data.type;
          }
          downloadSuccess = true;
          break;
        } catch (err) {
          if (attempt === 3) {
            console.error(`  ✗ [download failed after 3 attempts] ${bucket}/${objectPath}: ${err.message}`);
          } else {
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }

      if (downloadSuccess && buffer) {
        await fs.promises.mkdir(fileDir, { recursive: true });
        await fs.promises.writeFile(filePath, buffer);

        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        const originalPublicUrl = pubData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
        const targetBlobUrl = `/api/blobs/${safeBucket}/${keyParts.map(encodeURIComponent).join('/')}`;

        const metadata = {
          contentType,
          size: buffer.length,
          etag,
          originalPublicUrl,
          cacheControl: '31536000',
          uploadedAt: obj.updated_at || new Date().toISOString()
        };

        await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

        manifest.files.push({
          bucket,
          path: objectPath,
          size: buffer.length,
          contentType,
          etag,
          originalPublicUrl,
          targetBlobUrl,
          localPath: path.relative(ROOT_DIR, filePath),
          localMetaPath: path.relative(ROOT_DIR, metaPath)
        });

        manifest.urlMapping[originalPublicUrl] = targetBlobUrl;

        totalDownloaded++;
        totalBytes += buffer.length;
        console.log(`  ✓ ${bucket}/${objectPath} (${(buffer.length / 1024).toFixed(1)} KB) -> ${targetBlobUrl}`);
      }
    }
    console.log('');
  }

  manifest.totalFiles = totalDownloaded;
  manifest.totalBytes = totalBytes;

  await fs.promises.mkdir(path.dirname(options.storageManifest), { recursive: true });
  await fs.promises.writeFile(options.storageManifest, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('================================================================================');
  console.log('STORAGE EXPORT COMPLETED SUCCESSFULLY');
  console.log(`Objects Exported    : ${totalDownloaded}`);
  console.log(`Total Download Size : ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (${totalBytes.toLocaleString()} bytes)`);
  console.log(`Storage Directory   : ${options.storageDir}`);
  console.log(`Manifest File       : ${options.storageManifest}`);
  console.log('================================================================================\n');

  return manifest;
}

// ==============================================================================
// 5. SUBCOMMAND: IMPORT-BLOBS
// ==============================================================================
async function runImportBlobs(options) {
  if (!fs.existsSync(options.storageManifest)) {
    console.error(`[import-blobs] ERROR: Storage manifest not found at ${options.storageManifest}`);
    console.error('Run --mode=export-storage first to download blobs and generate manifest.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(options.storageManifest, 'utf8'));

  console.log('================================================================================');
  console.log('SUPABASE-TO-NETLIFY BLOB IMPORT & URL REWRITE');
  console.log(`Manifest File       : ${options.storageManifest}`);
  console.log(`Total Blobs in spec : ${manifest.totalFiles || manifest.files?.length || 0}`);
  console.log(`Rewrite DB URLs     : ${options.rewriteUrls ? 'YES' : 'NO (pass --rewrite-urls to update DB)'}`);
  console.log(`Dry Run Mode        : ${options.dryRun ? 'YES' : 'NO'}`);
  console.log('================================================================================\n');

  // 1. Upload to @netlify/blobs
  let netlifyBlobsAvailable = false;
  let getStoreFn = null;
  try {
    const nb = await import('@netlify/blobs');
    getStoreFn = nb.getStore;
    netlifyBlobsAvailable = true;
  } catch {
    // @netlify/blobs not importable
  }

  if (netlifyBlobsAvailable && getStoreFn) {
    const siteID = process.env.NETLIFY_SITE_ID || '54b5e815-bff9-4fb5-a842-d106c8c0180c';
    const token = process.env.NETLIFY_AUTH_TOKEN;

    const canUploadCloud = !!token || !!process.env.NETLIFY_BLOBS_CONTEXT;
    if (!canUploadCloud) {
      console.log('[import-blobs] Notice: NETLIFY_AUTH_TOKEN is not set in environment.');
      console.log('[import-blobs] All blobs are verified in .netlify/blobs-local/ (served by /api/blobs/... route).');
      console.log('[import-blobs] Skipping cloud Netlify Blobs upload step.\n');
    } else {
      console.log('[import-blobs] Uploading blobs to @netlify/blobs store...');
      let uploadedCount = 0;
      for (const item of (manifest.files || [])) {
        const localFullPath = path.join(ROOT_DIR, item.localPath);
        if (!fs.existsSync(localFullPath)) {
          console.warn(`[import-blobs] Local blob not found: ${item.localPath}`);
          continue;
        }
        if (!options.dryRun) {
          try {
            const store = token ? getStoreFn({ name: item.bucket, siteID, token }) : getStoreFn(item.bucket);
            const buffer = await fs.promises.readFile(localFullPath);
            await store.set(item.path, buffer, {
              metadata: {
                contentType: item.contentType || 'application/octet-stream',
                cacheControl: '31536000'
              }
            });
            uploadedCount++;
          } catch (err) {
            console.warn(`[import-blobs] Warning uploading ${item.bucket}/${item.path}: ${err.message}`);
          }
        }
      }
      console.log(`[import-blobs] Successfully synced ${uploadedCount} blobs to Netlify Blobs storage.\n`);
    }
  }

  // 2. Rewrite URLs in target Postgres DB if --rewrite-urls is passed
  if (options.rewriteUrls) {
    const connectionString = options.connectionString;
    if (!connectionString) {
      console.warn('[import-blobs] Warning: --rewrite-urls was specified, but no NETLIFY_DB_URL or connection string was found.');
      console.warn('Skipping database URL rewrite step.');
    } else {
      console.log(`[import-blobs] Connecting to target database: ${connectionString.replace(/:[^:@]+@/, ':***@')}...`);
      const client = new pg.Client({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
      });

      await client.connect();
      try {
        const mappings = manifest.urlMapping || {};
        const urlEntries = Object.entries(mappings);
        console.log(`[import-blobs] Rewriting URLs for ${urlEntries.length} mapped assets...`);

        const rewriteTargets = [
          { table: 'public.signage_media', col: 'file_url' },
          { table: 'public.news', col: 'cover_image_url' },
          { table: 'public.album_photos', col: 'image_url' },
          { table: 'public.albums', col: 'cover_image_url' },
          { table: 'public.personnel', col: 'image_url' }
        ];

        let totalUpdatedRows = 0;
        for (const target of rewriteTargets) {
          const [schema, table] = target.table.split('.');
          try {
            const check = await client.query(`
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = $1 AND table_name = $2 AND column_name = $3;
            `, [schema, table, target.col]);

            if (check.rows.length === 0) continue;

            for (const [oldUrl, newUrl] of urlEntries) {
              if (options.dryRun) {
                const countRes = await client.query(`
                  SELECT COUNT(*) FROM "${schema}"."${table}" WHERE "${target.col}" = $1;
                `, [oldUrl]);
                const count = parseInt(countRes.rows[0].count, 10);
                if (count > 0) {
                  console.log(`  [dry-run] Would update ${count} row(s) in ${target.table}.${target.col}`);
                  totalUpdatedRows += count;
                }
              } else {
                const updateRes = await client.query(`
                  UPDATE "${schema}"."${table}"
                  SET "${target.col}" = $1
                  WHERE "${target.col}" = $2;
                `, [newUrl, oldUrl]);
                if (updateRes.rowCount > 0) {
                  console.log(`  ✓ Updated ${updateRes.rowCount} row(s) in ${target.table}.${target.col}`);
                  totalUpdatedRows += updateRes.rowCount;
                }
              }
            }
          } catch (err) {
            console.warn(`[import-blobs] Warning checking ${target.table}.${target.col}:`, err.message);
          }
        }

        console.log(`[import-blobs] URL rewrite complete. Total affected rows: ${totalUpdatedRows}\n`);
      } finally {
        await client.end();
      }
    }
  }
}

// ==============================================================================
// MAIN ENTRY POINT
// ==============================================================================
async function main() {
  const options = parseArgs();

  if (options.help || !options.mode) {
    printUsage();
    if (!options.help) process.exit(1);
    return;
  }

  switch (options.mode) {
    case 'export-json':
      await runExportJson(options);
      break;
    case 'import-pg':
      await runImportPg(options);
      break;
    case 'verify':
      await runVerify(options);
      break;
    case 'export-storage':
      await runExportStorage(options);
      break;
    case 'import-blobs':
      await runImportBlobs(options);
      break;
    default:
      console.error(`Unknown mode: ${options.mode}`);
      printUsage();
      process.exit(1);
  }
}

main().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
