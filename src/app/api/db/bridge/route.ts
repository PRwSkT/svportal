import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedGuardianId } from '@/lib/parents/session';

export const dynamic = 'force-dynamic';

const ALLOWED_SCHEMAS = new Set(['public', 'family']);

const PUBLIC_SELECT_TABLES = new Set([
  'news',
  'albums',
  'album_photos',
  'calendar_events',
  'documents',
  'personnel',
  'forms',
  'form_fields',
  'signage_devices',
  'signage_groups',
  'signage_media',
  'signage_campaigns',
  'signage_campaign_media',
  'signage_settings',
  'room_configs',
  'room_bookings',
]);

const PUBLIC_INSERT_TABLES = new Set([
  'form_responses',
  'explore_registrations',
]);

const ALLOWED_FILTER_METHODS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'contains',
  'or',
  'not',
  'filter',
  'match',
]);

interface FilterItem {
  method: string;
  args: any[];
}

interface OrderItem {
  col: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

interface QueryPayload {
  type: 'query';
  schema?: string;
  table: string;
  action: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  columns?: string;
  selectOptions?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };
  values?: any;
  upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean };
  returning?: boolean;
  filters?: FilterItem[];
  order?: OrderItem[];
  limit?: number;
  range?: [number, number];
  single?: boolean;
  maybeSingle?: boolean;
}

interface RpcPayload {
  type: 'rpc';
  schema?: string;
  fn: string;
  args?: Record<string, any>;
}

type BridgePayload = QueryPayload | RpcPayload;

export async function POST(req: NextRequest) {
  try {
    const payload: BridgePayload = await req.json();

    if (!payload || typeof payload !== 'object' || !payload.type) {
      return NextResponse.json(
        { error: { message: 'Invalid payload: missing type' } },
        { status: 400 }
      );
    }

    const targetSchema = payload.schema || 'public';
    if (!ALLOWED_SCHEMAS.has(targetSchema)) {
      return NextResponse.json(
        { error: { message: `Disallowed schema: ${targetSchema}` } },
        { status: 400 }
      );
    }

    const staffUser = await getServerUser();
    const guardianId = getAuthenticatedGuardianId(req);

    // =========================================================================
    // 1. QUERY HANDLING
    // =========================================================================
    if (payload.type === 'query') {
      const { table, action } = payload;

      if (!table || typeof table !== 'string' || !/^[a-zA-Z0-9_]+$/.test(table)) {
        return NextResponse.json(
          { error: { message: `Invalid table name: ${table}` } },
          { status: 400 }
        );
      }

      if (!['select', 'insert', 'update', 'upsert', 'delete'].includes(action)) {
        return NextResponse.json(
          { error: { message: `Invalid action: ${action}` } },
          { status: 400 }
        );
      }

      // Zero-Trust Authorization Check for Unauthenticated Callers
      if (!staffUser) {
        const isPublicSelect = action === 'select' && PUBLIC_SELECT_TABLES.has(table);
        const isPublicInsert = action === 'insert' && PUBLIC_INSERT_TABLES.has(table);

        if (!isPublicSelect && !isPublicInsert) {
          return NextResponse.json(
            { error: { message: 'Unauthorized table or action' } },
            { status: 401 }
          );
        }
      }

      // Validate filter methods
      if (Array.isArray(payload.filters)) {
        for (const f of payload.filters) {
          if (!f || !ALLOWED_FILTER_METHODS.has(f.method)) {
            return NextResponse.json(
              { error: { message: `Disallowed filter method: ${f?.method}` } },
              { status: 400 }
            );
          }
        }
      }

      // Reconstruct and execute query via getAdminClient()
      const adminClient = getAdminClient();
      const scopedClient: any = targetSchema !== 'public' ? adminClient.schema(targetSchema) : adminClient;
      let builder: any = scopedClient.from(table);

      switch (action) {
        case 'select':
          builder = builder.select(payload.columns || '*', payload.selectOptions);
          break;
        case 'insert':
          builder = builder.insert(payload.values);
          if (payload.returning) {
            builder = builder.select(payload.columns || '*');
          }
          break;
        case 'update':
          builder = builder.update(payload.values);
          if (payload.returning) {
            builder = builder.select(payload.columns || '*');
          }
          break;
        case 'upsert':
          builder = builder.upsert(payload.values, payload.upsertOptions);
          if (payload.returning) {
            builder = builder.select(payload.columns || '*');
          }
          break;
        case 'delete':
          builder = builder.delete();
          if (payload.returning) {
            builder = builder.select(payload.columns || '*');
          }
          break;
      }

      // Apply Filters
      if (Array.isArray(payload.filters)) {
        for (const f of payload.filters) {
          if (typeof builder[f.method] === 'function') {
            builder = builder[f.method](...(f.args || []));
          }
        }
      }

      // Apply Order
      if (Array.isArray(payload.order)) {
        for (const ord of payload.order) {
          if (ord && typeof ord.col === 'string') {
            builder = builder.order(ord.col, {
              ascending: ord.ascending,
              nullsFirst: ord.nullsFirst,
            });
          }
        }
      }

      // Apply Range / Limit
      if (Array.isArray(payload.range) && payload.range.length === 2) {
        builder = builder.range(payload.range[0], payload.range[1]);
      } else if (typeof payload.limit === 'number') {
        builder = builder.limit(payload.limit);
      }

      // Single / MaybeSingle modifiers
      if (payload.single) {
        builder = builder.single();
      } else if (payload.maybeSingle) {
        builder = builder.maybeSingle();
      }

      const result = await builder;

      return NextResponse.json({
        data: result.data ?? null,
        error: result.error
          ? {
              message: result.error.message,
              code: result.error.code,
              details: result.error.details,
              hint: result.error.hint,
            }
          : null,
        count: result.count ?? null,
      });
    }

    // =========================================================================
    // 2. RPC HANDLING
    // =========================================================================
    if (payload.type === 'rpc') {
      const { fn, args } = payload;

      if (!fn || typeof fn !== 'string' || !/^[a-zA-Z0-9_]+$/.test(fn)) {
        return NextResponse.json(
          { error: { message: `Invalid function name: ${fn}` } },
          { status: 400 }
        );
      }

      // Zero-Trust: RPC calls require staff authentication
      if (!staffUser) {
        return NextResponse.json(
          { error: { message: 'Unauthorized RPC call' } },
          { status: 401 }
        );
      }

      const adminClient = getAdminClient();
      const scopedClient: any = targetSchema !== 'public' ? adminClient.schema(targetSchema) : adminClient;
      const result = await scopedClient.rpc(fn, args || {});

      return NextResponse.json({
        data: result.data ?? null,
        error: result.error
          ? {
              message: result.error.message,
              code: result.error.code,
              details: result.error.details,
              hint: result.error.hint,
            }
          : null,
      });
    }

    return NextResponse.json(
      { error: { message: `Unsupported payload type: ${(payload as any).type}` } },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('DB Bridge execution error:', err);
    return NextResponse.json(
      {
        data: null,
        error: { message: err?.message || 'Internal DB Bridge error' },
      },
      { status: 500 }
    );
  }
}
