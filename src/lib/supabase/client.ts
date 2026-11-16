import { createBrowserClient } from '@supabase/ssr';

class BridgeQueryBuilder implements PromiseLike<any> {
  private _table: string;
  private _schema: string;
  private _action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private _columns: string = '*';
  private _selectOptions?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };
  private _values?: any;
  private _upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean };
  private _returning: boolean = false;
  private _filters: Array<{ method: string; args: any[] }> = [];
  private _order: Array<{ col: string; ascending?: boolean; nullsFirst?: boolean }> = [];
  private _limit?: number;
  private _range?: [number, number];
  private _single: boolean = false;
  private _maybeSingle: boolean = false;
  private _promise: Promise<{ data: any; error: any; count: number | null }> | null = null;

  constructor(table: string, schema: string = 'public') {
    this._table = table;
    this._schema = schema;
  }

  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    if (this._action === 'select') {
      this._columns = columns || '*';
      this._selectOptions = options;
    } else {
      this._returning = true;
      this._columns = columns || '*';
    }
    return this;
  }

  insert(values: any) {
    this._action = 'insert';
    this._values = values;
    return this;
  }

  update(values: any) {
    this._action = 'update';
    this._values = values;
    return this;
  }

  upsert(values: any, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this._action = 'upsert';
    this._values = values;
    this._upsertOptions = options;
    return this;
  }

  delete() {
    this._action = 'delete';
    return this;
  }

  eq(col: string, val: any) {
    this._filters.push({ method: 'eq', args: [col, val] });
    return this;
  }

  neq(col: string, val: any) {
    this._filters.push({ method: 'neq', args: [col, val] });
    return this;
  }

  gt(col: string, val: any) {
    this._filters.push({ method: 'gt', args: [col, val] });
    return this;
  }

  gte(col: string, val: any) {
    this._filters.push({ method: 'gte', args: [col, val] });
    return this;
  }

  lt(col: string, val: any) {
    this._filters.push({ method: 'lt', args: [col, val] });
    return this;
  }

  lte(col: string, val: any) {
    this._filters.push({ method: 'lte', args: [col, val] });
    return this;
  }

  like(col: string, pattern: string) {
    this._filters.push({ method: 'like', args: [col, pattern] });
    return this;
  }

  ilike(col: string, pattern: string) {
    this._filters.push({ method: 'ilike', args: [col, pattern] });
    return this;
  }

  is(col: string, val: any) {
    this._filters.push({ method: 'is', args: [col, val] });
    return this;
  }

  in(col: string, vals: any[]) {
    this._filters.push({ method: 'in', args: [col, vals] });
    return this;
  }

  contains(col: string, val: any) {
    this._filters.push({ method: 'contains', args: [col, val] });
    return this;
  }

  or(filters: string) {
    this._filters.push({ method: 'or', args: [filters] });
    return this;
  }

  not(col: string, operator: string, val: any) {
    this._filters.push({ method: 'not', args: [col, operator, val] });
    return this;
  }

  filter(col: string, operator: string, val: any) {
    this._filters.push({ method: 'filter', args: [col, operator, val] });
    return this;
  }

  match(query: Record<string, any>) {
    this._filters.push({ method: 'match', args: [query] });
    return this;
  }

  order(col: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this._order.push({
      col,
      ascending: options?.ascending,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(limit: number) {
    this._limit = limit;
    return this;
  }

  range(from: number, to: number) {
    this._range = [from, to];
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this;
  }

  private _execute(): Promise<{ data: any; error: any; count: number | null }> {
    if (!this._promise) {
      this._promise = (async () => {
        try {
          const res = await fetch('/api/db/bridge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'query',
              schema: this._schema,
              table: this._table,
              action: this._action,
              columns: this._columns,
              selectOptions: this._selectOptions,
              values: this._values,
              upsertOptions: this._upsertOptions,
              returning: this._returning,
              filters: this._filters,
              order: this._order,
              limit: this._limit,
              range: this._range,
              single: this._single,
              maybeSingle: this._maybeSingle,
            }),
          });
          const json = await res.json();
          return {
            data: json.data ?? null,
            error: json.error ?? null,
            count: json.count ?? null,
          };
        } catch (err: any) {
          return {
            data: null,
            error: { message: err?.message || 'Network error communicating with DB bridge' },
            count: null,
          };
        }
      })();
    }
    return this._promise;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<any | TResult> {
    return this._execute().catch(onrejected);
  }
}

async function bridgeRpc(fn: string, args?: Record<string, any>, schema: string = 'public') {
  try {
    const res = await fetch('/api/db/bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'rpc',
        schema,
        fn,
        args,
      }),
    });
    const json = await res.json();
    return {
      data: json.data ?? null,
      error: json.error ?? null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: { message: err?.message || 'Network error in RPC bridge' },
    };
  }
}

function createNetlifyBrowserClient() {
  return {
    schema(s: string) {
      return {
        from(table: string) {
          return new BridgeQueryBuilder(table, s);
        },
        rpc(fn: string, args?: Record<string, any>) {
          return bridgeRpc(fn, args, s);
        },
      };
    },
    from(table: string) {
      return new BridgeQueryBuilder(table, 'public');
    },
    rpc(fn: string, args?: Record<string, any>) {
      return bridgeRpc(fn, args, 'public');
    },
    auth: {
      async getUser() {
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (!res.ok) {
            return { data: { user: null }, error: { message: 'Not authenticated' } };
          }
          const data = await res.json();
          return { data: { user: data.user || null }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: { message: err?.message || 'Failed to get user' } };
        }
      },
      async getSession() {
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (!res.ok) {
            return { data: { session: null, user: null }, error: null };
          }
          const data = await res.json();
          const user = data.user || null;
          return {
            data: {
              session: user ? ({ user } as any) : null,
              user,
            },
            error: null,
          };
        } catch (err: any) {
          return { data: { session: null, user: null }, error: { message: err?.message || 'Failed to get session' } };
        }
      },
      async signInWithPassword({ email, password }: { email: string; password?: string }) {
        try {
          const res = await fetch('/api/auth/staff-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.error) {
            return {
              data: { user: null, session: null },
              error: { message: data?.error || data?.message || 'Invalid login credentials' },
            };
          }
          const user = data.user || null;
          return {
            data: {
              user,
              session: user ? ({ user } as any) : null,
            },
            error: null,
          };
        } catch (err: any) {
          return {
            data: { user: null, session: null },
            error: { message: err?.message || 'Network error during login' },
          };
        }
      },
      async signOut() {
        try {
          await fetch('/api/auth/staff-login', { method: 'DELETE' });
        } catch {
          // Ignore network errors on signout
        }
        return { error: null };
      },
      async signInWithOAuth(_options: any) {
        return {
          data: { provider: 'google' as const, url: null },
          error: { message: 'โหมดฐานข้อมูล Netlify กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านโรงเรียน' },
        };
      },
      onAuthStateChange(_callback: any) {
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        };
      },
    },
    storage: {
      from(bucket: string) {
        return {
          upload: async (path: string, _file: any, _options?: any) => {
            return { data: { path }, error: null };
          },
          getPublicUrl: (path: string) => {
            return { data: { publicUrl: `/uploads/${path}` } };
          },
        };
      },
    },
    channel(_name: string) {
      return {
        on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        subscribe: () => ({ unsubscribe: () => {} }),
      };
    },
  };
}

let supabaseClient: any = null;

export function createClient(): any {
  if (!supabaseClient) {
    const isSupabase =
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      process.env.NEXT_PUBLIC_DB_PROVIDER !== 'netlify';

    if (isSupabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      supabaseClient = createBrowserClient(url, anonKey);
    } else {
      supabaseClient = createNetlifyBrowserClient();
    }
  }
  return supabaseClient;
}
