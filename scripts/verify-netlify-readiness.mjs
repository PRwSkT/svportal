#!/usr/bin/env node

/**
 * ==============================================================================
 * Netlify Full Cutover Readiness Verification Script
 * File: scripts/verify-netlify-readiness.mjs
 *
 * Verifies:
 *   1. All 33 Netlify database migrations (timestamps, bounds, balance, safety)
 *   2. Data cutover snapshot (.netlify/data-cutover-snapshot.json: 84 tables, 4205 rows, 30 auth_users)
 *   3. Storage blobs & manifest (.netlify/storage-cutover-manifest.json + local binaries)
 *   4. Dependencies in package.json (@netlify/database, @netlify/blobs, pg)
 *   5. Session secrets in .env.local (PARENT_SESSION_SECRET, STAFF_SESSION_SECRET)
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ ${message}`);
  } else {
    failedChecks++;
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

console.log('================================================================================');
console.log('NETLIFY FULL CUTOVER READINESS VERIFICATION');
console.log(`Workspace Root: ${ROOT_DIR}`);
console.log('================================================================================\n');

// ------------------------------------------------------------------------------
// CHECK 1: Netlify Database Migrations
// ------------------------------------------------------------------------------
console.log('--- 1. Database Migrations Verification ---');
const migrationsDir = path.join(ROOT_DIR, 'netlify', 'database', 'migrations');
assert(fs.existsSync(migrationsDir), `Migrations directory exists: ${migrationsDir}`);

const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

assert(migrationFiles.length === 33, `Found exactly 33 migration files (found: ${migrationFiles.length})`);

const filenameRegex = /^\d{14}_[a-z0-9_]+\.sql$/;
let allFilenamesValid = true;
const timestamps = new Set();
let duplicatesFound = false;

for (const file of migrationFiles) {
  if (!filenameRegex.test(file)) {
    allFilenamesValid = false;
    console.error(`    Invalid migration filename: ${file}`);
  }
  const ts = file.slice(0, 14);
  if (timestamps.has(ts)) {
    duplicatesFound = true;
    console.error(`    Duplicate migration timestamp: ${ts} (${file})`);
  }
  timestamps.add(ts);
}

assert(allFilenamesValid, 'All migration files match naming pattern ^\\d{14}_[a-z0-9_]+\\.sql$');
assert(!duplicatesFound, 'All migration files have unique 14-digit timestamp prefixes');
assert(
  migrationFiles[0] === '00000000000000_supabase_compat_bootstrap.sql',
  `First migration is 00000000000000_supabase_compat_bootstrap.sql (was: ${migrationFiles[0]})`
);
assert(
  migrationFiles[migrationFiles.length - 1] === '20261114000004_academic_history_and_rollover.sql',
  `Last migration is 20261114000004_academic_history_and_rollover.sql (was: ${migrationFiles[migrationFiles.length - 1]})`
);
assert(
  !migrationFiles.includes('create_admin_user.sql'),
  'Excludes non-standard create_admin_user.sql from migrations directory'
);

// Verify SQL block balance and unguarded supabase_realtime
let allSqlWellFormed = true;
let unguardedRealtimeFound = false;

for (const file of migrationFiles) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Check dollar-quoting balance ($$...$$ or $tag$...$tag$)
  const dollarMatches = content.match(/\$[a-zA-Z0-9_]*\$/g) || [];
  if (dollarMatches.length % 2 !== 0) {
    allSqlWellFormed = false;
    console.error(`    Unbalanced dollar quotes in ${file}: count = ${dollarMatches.length}`);
  }

  // Check for bare, unguarded ALTER PUBLICATION supabase_realtime
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.toUpperCase().startsWith('ALTER PUBLICATION SUPABASE_REALTIME') &&
      !content.includes('DO $$') &&
      !content.includes('pg_publication')
    ) {
      unguardedRealtimeFound = true;
      console.error(`    Unguarded supabase_realtime in ${file} at line ${i + 1}`);
    }
  }
}

assert(allSqlWellFormed, 'All 33 SQL migration files have balanced code blocks and quotes');
assert(!unguardedRealtimeFound, 'No unguarded supabase_realtime publication statements found');

// ------------------------------------------------------------------------------
// CHECK 2: Data Cutover Snapshot
// ------------------------------------------------------------------------------
console.log('\n--- 2. Data Cutover Snapshot Verification ---');
const snapshotPath = path.join(ROOT_DIR, '.netlify', 'data-cutover-snapshot.json');
assert(fs.existsSync(snapshotPath), `Snapshot exists at ${snapshotPath}`);

if (fs.existsSync(snapshotPath)) {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const counts = snapshot.counts || {};
  const tableKeys = Object.keys(counts).filter(k => k.startsWith('public.') || k.startsWith('family.'));
  const totalRows = tableKeys.reduce((acc, k) => acc + (counts[k] || 0), 0);
  const authUsersCount = counts['auth_users'] ?? snapshot.schemas?.auth_users?.length ?? 0;

  assert(tableKeys.length === 84, `Snapshot contains 84 database tables (found: ${tableKeys.length})`);
  assert(totalRows === 4205, `Snapshot contains exactly 4,205 data rows across tables (found: ${totalRows})`);
  assert(authUsersCount === 30, `Snapshot contains exactly 30 auth_users (found: ${authUsersCount})`);
}

// ------------------------------------------------------------------------------
// CHECK 3: Storage Cutover Manifest & Local Blobs
// ------------------------------------------------------------------------------
console.log('\n--- 3. Storage Blobs & Manifest Verification ---');
const storageManifestPath = path.join(ROOT_DIR, '.netlify', 'storage-cutover-manifest.json');
assert(fs.existsSync(storageManifestPath), `Storage manifest exists at ${storageManifestPath}`);

if (fs.existsSync(storageManifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(storageManifestPath, 'utf8'));
  const files = manifest.files || [];
  assert(files.length > 0, `Manifest defines exported storage objects (found: ${files.length})`);

  let missingBlobs = 0;
  let missingMetas = 0;
  let sizeMismatches = 0;

  for (const item of files) {
    const blobPath = path.join(ROOT_DIR, item.localPath);
    const metaPath = path.join(ROOT_DIR, item.localMetaPath);

    if (!fs.existsSync(blobPath)) {
      missingBlobs++;
    } else {
      const stats = fs.statSync(blobPath);
      if (stats.size !== item.size) {
        sizeMismatches++;
      }
    }

    if (!fs.existsSync(metaPath)) {
      missingMetas++;
    }
  }

  assert(missingBlobs === 0, `All ${files.length} blob binary files exist in .netlify/blobs-local/`);
  assert(missingMetas === 0, `All ${files.length} sibling .meta.json files exist`);
  assert(sizeMismatches === 0, `All local blob file sizes match manifest entries`);
}

// ------------------------------------------------------------------------------
// CHECK 4: Package Dependencies
// ------------------------------------------------------------------------------
console.log('\n--- 4. Package Dependencies Verification ---');
const packageJsonPath = path.join(ROOT_DIR, 'package.json');
assert(fs.existsSync(packageJsonPath), 'package.json exists');

if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  assert(Boolean(allDeps['@netlify/database']), `@netlify/database is present (${allDeps['@netlify/database']})`);
  assert(Boolean(allDeps['@netlify/blobs']), `@netlify/blobs is present (${allDeps['@netlify/blobs']})`);
  assert(Boolean(allDeps['pg']), `pg is present (${allDeps['pg']})`);
}

// ------------------------------------------------------------------------------
// CHECK 5: Session Secrets in .env.local
// ------------------------------------------------------------------------------
console.log('\n--- 5. Session Secrets Configuration Verification ---');
const envLocalPath = path.join(ROOT_DIR, '.env.local');
assert(fs.existsSync(envLocalPath), '.env.local exists');

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  const lines = envContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const envMap = new Map();
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      envMap.set(key, val);
    }
  }

  const hasParentSecret = envMap.has('PARENT_SESSION_SECRET') && envMap.get('PARENT_SESSION_SECRET').length > 0;
  const hasStaffSecret = envMap.has('STAFF_SESSION_SECRET') && envMap.get('STAFF_SESSION_SECRET').length > 0;

  assert(hasParentSecret, 'PARENT_SESSION_SECRET is configured in .env.local');
  assert(hasStaffSecret, 'STAFF_SESSION_SECRET is configured in .env.local');
}

// ------------------------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`VERIFICATION SUMMARY: ${passedChecks}/${totalChecks} checks passed`);
console.log(`Failed checks: ${failedChecks}`);
console.log('================================================================================\n');

if (failedChecks > 0) {
  console.error(`FAILED: ${failedChecks} verification check(s) did not pass.`);
  process.exit(1);
} else {
  console.log('PASSED: All Netlify cutover readiness checks succeeded.');
  process.exit(0);
}
