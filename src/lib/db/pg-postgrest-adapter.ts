import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getPgPool } from './netlify-bridge';
import {
  getStaffSessionFromCookies,
  clearStaffSessionCookie,
} from '@/lib/auth/staff-session';
import { authenticateStaffWithPg } from '@/lib/auth/staff-auth-pg';

export interface PostgrestError {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

export interface PostgrestResponse<T = any> {
  data: T;
  error: PostgrestError | null;
  count: number | null;
}

interface ForeignKeyInfo {
  table_schema: string;
  table_name: string;
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
  constraint_name: string;
}

interface TableMetadataCache {
  fks: ForeignKeyInfo[];
  pks: Map<string, string>; // "schema.table" -> primary key column name
  columns: Map<string, Set<string>>; // "schema.table" -> column names
}

declare global {
  // eslint-disable-next-line no-var
  var __svportal_fk_cache: TableMetadataCache | undefined;
  // eslint-disable-next-line no-var
  var __svportal_rpc_meta_cache: Map<string, boolean> | undefined;
}

/**
 * Maps a Postgres or JavaScript Error to PostgREST error shape.
 */
function mapPgError(err: any): PostgrestError {
  if (!err) {
    return {
      code: 'UNKNOWN',
      message: 'Unknown error occurred',
      details: null,
      hint: null,
    };
  }
  return {
    code: err.code || 'PGRST500',
    message: err.message || 'Database query error',
    details: err.detail || null,
    hint: err.hint || null,
  };
}

/**
 * Loads or returns cached FK metadata across 'public' and 'family' schemas.
 */
export async function getTableMetadata(pool: Pool): Promise<TableMetadataCache> {
  if (globalThis.__svportal_fk_cache) {
    return globalThis.__svportal_fk_cache;
  }

  const fkSql = `
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema IN ('public', 'family');
  `;

  const pkSql = `
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name AS pk_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema IN ('public', 'family');
  `;

  const colSql = `
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'family');
  `;

  try {
    const [fkRes, pkRes, colRes] = await Promise.all([
      pool.query(fkSql),
      pool.query(pkSql),
      pool.query(colSql),
    ]);

    const pks = new Map<string, string>();
    for (const r of pkRes.rows) {
      pks.set(`${r.table_schema}.${r.table_name}`, r.pk_column);
    }

    const columns = new Map<string, Set<string>>();
    for (const r of colRes.rows) {
      const key = `${r.table_schema}.${r.table_name}`;
      if (!columns.has(key)) {
        columns.set(key, new Set());
      }
      columns.get(key)!.add(r.column_name);
    }

    globalThis.__svportal_fk_cache = {
      fks: fkRes.rows as ForeignKeyInfo[],
      pks,
      columns,
    };
  } catch (err) {
    console.warn('Failed to introspect table metadata, using fallback cache:', err);
    globalThis.__svportal_fk_cache = {
      fks: [],
      pks: new Map(),
      columns: new Map(),
    };
  }

  return globalThis.__svportal_fk_cache;
}

/**
 * Splits a string by delimiter only when depth of parentheses is 0 and outside quotes.
 */
function splitAtDepthZero(str: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let depth = 0;
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
    } else if (!inDoubleQuote && !inSingleQuote) {
      if (char === '(') depth++;
      else if (char === ')') depth = Math.max(0, depth - 1);

      if (char === delimiter && depth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    result.push(current.trim());
  }

  return result;
}

interface ParsedRelation {
  alias: string;
  targetName: string;
  fkHint: string | null;
  nestedSelect: string;
  isCount: boolean;
}

interface ParsedDirectColumn {
  column: string;
  alias: string | null;
}

interface ParsedSelect {
  directColumns: ParsedDirectColumn[];
  relations: ParsedRelation[];
  isSelectAll: boolean;
}

/**
 * Parses a PostgREST select string into direct columns and embedded relations.
 */
function parseSelectString(columns: string): ParsedSelect {
  const tokens = splitAtDepthZero(columns, ',');
  const directColumns: ParsedDirectColumn[] = [];
  const relations: ParsedRelation[] = [];
  let isSelectAll = false;

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const openParenIdx = trimmed.indexOf('(');
    if (openParenIdx !== -1 && trimmed.endsWith(')')) {
      const rawHeader = trimmed.slice(0, openParenIdx).trim();
      const rawInner = trimmed.slice(openParenIdx + 1, -1).trim();

      let alias = rawHeader;
      let rawTarget = rawHeader;

      const colonIdx = rawHeader.indexOf(':');
      if (colonIdx !== -1) {
        alias = rawHeader.slice(0, colonIdx).trim();
        rawTarget = rawHeader.slice(colonIdx + 1).trim();
      }

      let targetName = rawTarget;
      let fkHint: string | null = null;
      if (rawTarget.includes('!')) {
        const parts = rawTarget.split('!');
        targetName = parts[0].trim();
        fkHint = parts[1].trim();
        if (colonIdx === -1) {
          alias = targetName;
        }
      }

      relations.push({
        alias,
        targetName,
        fkHint,
        nestedSelect: rawInner,
        isCount: rawInner.toLowerCase() === 'count',
      });
    } else {
      if (trimmed === '*') {
        isSelectAll = true;
      } else if (trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':');
        directColumns.push({
          alias: trimmed.slice(0, colonIdx).trim(),
          column: trimmed.slice(colonIdx + 1).trim(),
        });
      } else {
        directColumns.push({
          column: trimmed,
          alias: null,
        });
      }
    }
  }

  return { directColumns, relations, isSelectAll };
}

/**
 * Resolves relationship type and join columns between parent table and target relation.
 */
function resolveRelationInfo(
  currentSchema: string,
  currentTable: string,
  relation: ParsedRelation,
  meta: TableMetadataCache
): {
  type: 'many_to_one' | 'one_to_many';
  targetSchema: string;
  targetTable: string;
  localCol: string;
  targetCol: string;
} {
  const { targetName, fkHint } = relation;

  // 1. By FK constraint hint
  if (fkHint) {
    const fk = meta.fks.find(
      (f) =>
        f.constraint_name === fkHint ||
        f.constraint_name.toLowerCase() === fkHint.toLowerCase()
    );
    if (fk) {
      if (fk.table_name === currentTable) {
        return {
          type: 'many_to_one',
          targetSchema: fk.foreign_table_schema,
          targetTable: fk.foreign_table_name,
          localCol: fk.column_name,
          targetCol: fk.foreign_column_name,
        };
      } else if (fk.foreign_table_name === currentTable) {
        return {
          type: 'one_to_many',
          targetSchema: fk.table_schema,
          targetTable: fk.table_name,
          localCol: fk.foreign_column_name,
          targetCol: fk.column_name,
        };
      }
    }
  }

  // 2. Target name matches an explicit FK column on current table (e.g. evaluator:evaluator_id(*))
  const colFk = meta.fks.find(
    (f) =>
      f.table_name === currentTable &&
      f.column_name === targetName
  );
  if (colFk) {
    return {
      type: 'many_to_one',
      targetSchema: colFk.foreign_table_schema,
      targetTable: colFk.foreign_table_name,
      localCol: colFk.column_name,
      targetCol: colFk.foreign_column_name,
    };
  }

  // 3. Many-to-One where foreign_table_name === targetName
  const m2oFk = meta.fks.find(
    (f) =>
      f.table_name === currentTable &&
      (f.foreign_table_name === targetName ||
        f.foreign_table_name === targetName.replace(/s$/, '') ||
        f.foreign_table_name === `${targetName}s`)
  );
  if (m2oFk) {
    return {
      type: 'many_to_one',
      targetSchema: m2oFk.foreign_table_schema,
      targetTable: m2oFk.foreign_table_name,
      localCol: m2oFk.column_name,
      targetCol: m2oFk.foreign_column_name,
    };
  }

  // 4. One-to-Many where child table === targetName
  const o2mFk = meta.fks.find(
    (f) =>
      f.foreign_table_name === currentTable &&
      (f.table_name === targetName ||
        f.table_name === targetName.replace(/s$/, '') ||
        f.table_name === `${targetName}s`)
  );
  if (o2mFk) {
    return {
      type: 'one_to_many',
      targetSchema: o2mFk.table_schema,
      targetTable: o2mFk.table_name,
      localCol: o2mFk.foreign_column_name,
      targetCol: o2mFk.column_name,
    };
  }

  // 5. Fallback heuristics: check if current table has column `${targetName}_id` or similar
  const currentCols = meta.columns.get(`${currentSchema}.${currentTable}`) || new Set<string>();
  const singularTarget = targetName.endsWith('s') ? targetName.slice(0, -1) : targetName;
  const candidateFkCol = [
    `${targetName}_id`,
    `${singularTarget}_id`,
    `${targetName}Id`,
    `${singularTarget}Id`,
  ].find((c) => currentCols.has(c));

  if (candidateFkCol) {
    return {
      type: 'many_to_one',
      targetSchema: currentSchema,
      targetTable: targetName,
      localCol: candidateFkCol,
      targetCol: 'id',
    };
  }

  // Fallback: assume One-to-Many with child having `${currentTable}_id` or `${singular(currentTable)}_id`
  const singularParent = currentTable.endsWith('s') ? currentTable.slice(0, -1) : currentTable;
  const childCol = `${singularParent}_id`;

  return {
    type: 'one_to_many',
    targetSchema: currentSchema,
    targetTable: targetName,
    localCol: meta.pks.get(`${currentSchema}.${currentTable}`) || 'id',
    targetCol: childCol,
  };
}

/**
 * Parses PostgREST filter string into a SQL expression (used by .or() and nested and()).
 */
function parsePostgrestFilterExpression(
  expr: string,
  paramValues: unknown[]
): string {
  const tokens = splitAtDepthZero(expr, ',');
  const clauses: string[] = [];

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    if (/^and\s*\(/i.test(trimmed) && trimmed.endsWith(')')) {
      const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
      const innerSql = parsePostgrestAndExpression(inner, paramValues);
      if (innerSql) clauses.push(`(${innerSql})`);
      continue;
    }

    if (/^or\s*\(/i.test(trimmed) && trimmed.endsWith(')')) {
      const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
      const innerSql = parsePostgrestFilterExpression(inner, paramValues);
      if (innerSql) clauses.push(`(${innerSql})`);
      continue;
    }

    let isNot = false;
    let normalized = trimmed;
    if (normalized.includes('.not.')) {
      isNot = true;
      normalized = normalized.replace('.not.', '.');
    }

    const firstDot = normalized.indexOf('.');
    if (firstDot === -1) continue;
    const col = normalized.slice(0, firstDot);
    const rest = normalized.slice(firstDot + 1);

    const secondDot = rest.indexOf('.');
    const op = secondDot === -1 ? rest : rest.slice(0, secondDot);
    const valStr = secondDot === -1 ? '' : rest.slice(secondDot + 1);

    let predicate = '';
    if (op === 'is') {
      if (valStr.toLowerCase() === 'null') {
        predicate = `"${col}" IS NULL`;
      } else if (valStr.toLowerCase() === 'not.null' || valStr.toLowerCase() === 'not null') {
        predicate = `"${col}" IS NOT NULL`;
      } else if (valStr.toLowerCase() === 'true') {
        predicate = `"${col}" IS TRUE`;
      } else if (valStr.toLowerCase() === 'false') {
        predicate = `"${col}" IS FALSE`;
      }
    } else if (op === 'in') {
      let inContent = valStr;
      if (inContent.startsWith('(') && inContent.endsWith(')')) {
        inContent = inContent.slice(1, -1);
      }
      const inList = splitAtDepthZero(inContent, ',').map((v) => {
        let s = v.trim();
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
          s = s.slice(1, -1);
        }
        return s;
      });
      if (inList.length === 0) {
        predicate = 'FALSE';
      } else {
        paramValues.push(inList);
        predicate = `"${col}" = ANY($${paramValues.length}::text[])`;
      }
    } else {
      let sqlOp = '=';
      if (op === 'eq') sqlOp = '=';
      else if (op === 'neq') sqlOp = '<>';
      else if (op === 'gt') sqlOp = '>';
      else if (op === 'gte') sqlOp = '>=';
      else if (op === 'lt') sqlOp = '<';
      else if (op === 'lte') sqlOp = '<=';
      else if (op === 'like') sqlOp = 'LIKE';
      else if (op === 'ilike') sqlOp = 'ILIKE';
      else if (op === 'cs') sqlOp = '@>';
      else if (op === 'cd') sqlOp = '<@';

      let parsedVal: any = valStr;
      if (
        (parsedVal.startsWith('"') && parsedVal.endsWith('"')) ||
        (parsedVal.startsWith("'") && parsedVal.endsWith("'"))
      ) {
        parsedVal = parsedVal.slice(1, -1);
      }
      paramValues.push(parsedVal);
      predicate = `"${col}" ${sqlOp} $${paramValues.length}`;
    }

    if (predicate) {
      clauses.push(isNot ? `NOT (${predicate})` : predicate);
    }
  }

  return clauses.join(' OR ');
}

function parsePostgrestAndExpression(
  expr: string,
  paramValues: unknown[]
): string {
  const tokens = splitAtDepthZero(expr, ',');
  const clauses: string[] = [];

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const clause = parsePostgrestFilterExpression(trimmed, paramValues);
    if (clause) clauses.push(clause);
  }

  return clauses.join(' AND ');
}

/**
 * Supabase-compatible Query Builder backed directly by PostgreSQL.
 */
export class PgQueryBuilder<T = any> implements PromiseLike<PostgrestResponse<T>> {
  private pool: Pool;
  private schemaName: string;
  private tableName: string;

  private operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'UPSERT' | 'DELETE' = 'SELECT';
  private selectString: string = '*';
  private countMode: 'exact' | 'planned' | 'estimated' | null = null;
  private isHead: boolean = false;
  private isSingleRow: boolean = false;
  private isMaybeSingleRow: boolean = false;

  private insertRows: Record<string, unknown>[] = [];
  private updatePatch: Record<string, unknown> | null = null;
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } | null = null;

  private whereClauses: string[] = [];
  private orderClauses: string[] = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private queryParams: unknown[] = [];

  private hasChainedSelectAfterMutation: boolean = false;

  constructor(pool: Pool, schemaName: string, tableName: string) {
    this.pool = pool;
    this.schemaName = schemaName;
    this.tableName = tableName;
  }

  select(
    columns: string = '*',
    opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }
  ): this {
    this.selectString = columns;
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.isHead = Boolean(opts.head);

    if (
      this.operation === 'INSERT' ||
      this.operation === 'UPDATE' ||
      this.operation === 'UPSERT' ||
      this.operation === 'DELETE'
    ) {
      this.hasChainedSelectAfterMutation = true;
    }

    return this;
  }

  insert(
    values: Record<string, unknown> | Record<string, unknown>[],
    _opts?: { count?: 'exact'; defaultToNull?: boolean }
  ): this {
    this.operation = 'INSERT';
    this.insertRows = Array.isArray(values) ? values : [values];
    return this;
  }

  update(
    values: Record<string, unknown>,
    _opts?: { count?: 'exact' }
  ): this {
    this.operation = 'UPDATE';
    this.updatePatch = values;
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' }
  ): this {
    this.operation = 'UPSERT';
    this.insertRows = Array.isArray(values) ? values : [values];
    this.upsertOptions = opts || {};
    return this;
  }

  delete(_opts?: { count?: 'exact' }): this {
    this.operation = 'DELETE';
    return this;
  }

  eq(column: string, value: unknown): this {
    if (value === null || value === undefined) {
      this.whereClauses.push(`"${column}" IS NULL`);
    } else {
      this.queryParams.push(value);
      this.whereClauses.push(`"${column}" = $${this.queryParams.length}`);
    }
    return this;
  }

  neq(column: string, value: unknown): this {
    if (value === null || value === undefined) {
      this.whereClauses.push(`"${column}" IS NOT NULL`);
    } else {
      this.queryParams.push(value);
      this.whereClauses.push(`"${column}" <> $${this.queryParams.length}`);
    }
    return this;
  }

  gt(column: string, value: unknown): this {
    this.queryParams.push(value);
    this.whereClauses.push(`"${column}" > $${this.queryParams.length}`);
    return this;
  }

  gte(column: string, value: unknown): this {
    this.queryParams.push(value);
    this.whereClauses.push(`"${column}" >= $${this.queryParams.length}`);
    return this;
  }

  lt(column: string, value: unknown): this {
    this.queryParams.push(value);
    this.whereClauses.push(`"${column}" < $${this.queryParams.length}`);
    return this;
  }

  lte(column: string, value: unknown): this {
    this.queryParams.push(value);
    this.whereClauses.push(`"${column}" <= $${this.queryParams.length}`);
    return this;
  }

  like(column: string, pattern: string): this {
    this.queryParams.push(pattern);
    this.whereClauses.push(`"${column}" LIKE $${this.queryParams.length}`);
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.queryParams.push(pattern);
    this.whereClauses.push(`"${column}" ILIKE $${this.queryParams.length}`);
    return this;
  }

  is(column: string, value: null | boolean | string): this {
    if (value === null) {
      this.whereClauses.push(`"${column}" IS NULL`);
    } else if (value === true) {
      this.whereClauses.push(`"${column}" IS TRUE`);
    } else if (value === false) {
      this.whereClauses.push(`"${column}" IS FALSE`);
    } else {
      this.queryParams.push(value);
      this.whereClauses.push(`"${column}" IS $${this.queryParams.length}`);
    }
    return this;
  }

  in(column: string, values: unknown[]): this {
    if (!values || !Array.isArray(values) || values.length === 0) {
      this.whereClauses.push('FALSE');
      return this;
    }
    this.queryParams.push(values);
    this.whereClauses.push(`"${column}" = ANY($${this.queryParams.length})`);
    return this;
  }

  contains(column: string, value: unknown): this {
    const val = typeof value === 'object' ? JSON.stringify(value) : value;
    this.queryParams.push(val);
    this.whereClauses.push(`"${column}" @> $${this.queryParams.length}`);
    return this;
  }

  containedBy(column: string, value: unknown): this {
    const val = typeof value === 'object' ? JSON.stringify(value) : value;
    this.queryParams.push(val);
    this.whereClauses.push(`"${column}" <@ $${this.queryParams.length}`);
    return this;
  }

  or(expression: string): this {
    const sql = parsePostgrestFilterExpression(expression, this.queryParams);
    if (sql) {
      this.whereClauses.push(`(${sql})`);
    }
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    const tempParams: unknown[] = [];
    const sql = parsePostgrestFilterExpression(
      `${column}.${operator}.${value}`,
      tempParams
    );
    if (sql) {
      this.queryParams.push(...tempParams);
      this.whereClauses.push(`NOT (${sql})`);
    }
    return this;
  }

  filter(column: string, operator: string, value: unknown): this {
    const tempParams: unknown[] = [];
    const sql = parsePostgrestFilterExpression(
      `${column}.${operator}.${value}`,
      tempParams
    );
    if (sql) {
      this.queryParams.push(...tempParams);
      this.whereClauses.push(sql);
    }
    return this;
  }

  match(values: Record<string, unknown>): this {
    for (const [col, val] of Object.entries(values)) {
      this.eq(col, val);
    }
    return this;
  }

  order(
    column: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean }
  ): this {
    const direction = opts?.ascending === false ? 'DESC' : 'ASC';
    const nulls = opts?.nullsFirst === true ? 'NULLS FIRST' : 'NULLS LAST';
    this.orderClauses.push(`"${column}" ${direction} ${nulls}`);
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetValue = Math.max(0, from);
    this.limitValue = Math.max(0, to - from + 1);
    return this;
  }

  single(): this {
    this.isSingleRow = true;
    this.limitValue = 1;
    return this;
  }

  maybeSingle(): this {
    this.isMaybeSingleRow = true;
    this.limitValue = 1;
    return this;
  }

  /**
   * Executes the query and hydrates any requested relations.
   */
  async execute(): Promise<PostgrestResponse<T>> {
    try {
      const meta = await getTableMetadata(this.pool);

      // Handle empty insert array
      if (
        (this.operation === 'INSERT' || this.operation === 'UPSERT') &&
        this.insertRows.length === 0
      ) {
        return { data: [] as any, error: null, count: 0 };
      }

      // Handle count query if requested
      let totalCount: number | null = null;
      if (this.countMode) {
        const countWhere =
          this.whereClauses.length > 0
            ? `WHERE ${this.whereClauses.join(' AND ')}`
            : '';
        const countRes = await this.pool.query(
          `SELECT COUNT(*)::int AS count FROM "${this.schemaName}"."${this.tableName}" ${countWhere}`,
          this.queryParams
        );
        totalCount = countRes.rows[0]?.count ?? 0;

        if (this.isHead) {
          return { data: null as any, error: null, count: totalCount };
        }
      }

      // 1. SELECT query
      if (this.operation === 'SELECT') {
        const parsed = parseSelectString(this.selectString);

        // Ensure join columns needed for relation hydration are selected
        const neededCols = new Set<string>();
        for (const rel of parsed.relations) {
          const relInfo = resolveRelationInfo(
            this.schemaName,
            this.tableName,
            rel,
            meta
          );
          if (relInfo.localCol) {
            neededCols.add(relInfo.localCol);
          }
        }

        let selectClause = '*';
        if (!parsed.isSelectAll && parsed.directColumns.length > 0) {
          const colParts = parsed.directColumns.map((c) =>
            c.alias ? `"${c.column}" AS "${c.alias}"` : `"${c.column}"`
          );
          neededCols.forEach((needed) => {
            if (!parsed.directColumns.some((c) => c.column === needed)) {
              colParts.push(`"${needed}"`);
            }
          });
          selectClause = colParts.join(', ');
        }

        let sql = `SELECT ${selectClause} FROM "${this.schemaName}"."${this.tableName}"`;
        if (this.whereClauses.length > 0) {
          sql += ` WHERE ${this.whereClauses.join(' AND ')}`;
        }
        if (this.orderClauses.length > 0) {
          sql += ` ORDER BY ${this.orderClauses.join(', ')}`;
        }
        if (this.limitValue != null) {
          sql += ` LIMIT ${this.limitValue}`;
        }
        if (this.offsetValue != null) {
          sql += ` OFFSET ${this.offsetValue}`;
        }

        const res = await this.pool.query(sql, this.queryParams);
        const rows = res.rows;

        // Hydrate relations
        if (rows.length > 0 && parsed.relations.length > 0) {
          await this.hydrateRelations(rows, parsed.relations, meta);
        }

        return this.formatResult(rows, totalCount);
      }

      // 2. INSERT query
      if (this.operation === 'INSERT') {
        const keys = Array.from(
          new Set(this.insertRows.flatMap((r) => Object.keys(r)))
        );
        const colList = keys.map((k) => `"${k}"`).join(', ');

        const valueTuples: string[] = [];
        const params: unknown[] = [];

        for (const row of this.insertRows) {
          const tuplePlaceholders: string[] = [];
          for (const key of keys) {
            params.push(row[key] !== undefined ? row[key] : null);
            tuplePlaceholders.push(`$${params.length}`);
          }
          valueTuples.push(`(${tuplePlaceholders.join(', ')})`);
        }

        let sql = `INSERT INTO "${this.schemaName}"."${this.tableName}" (${colList}) VALUES ${valueTuples.join(', ')}`;
        if (this.hasChainedSelectAfterMutation) {
          sql += ' RETURNING *';
        }

        const res = await this.pool.query(sql, params);
        const rows = res.rows;

        if (this.hasChainedSelectAfterMutation) {
          const parsed = parseSelectString(this.selectString);
          if (rows.length > 0 && parsed.relations.length > 0) {
            await this.hydrateRelations(rows, parsed.relations, meta);
          }
          return this.formatResult(rows, res.rowCount);
        }

        return { data: null as any, error: null, count: res.rowCount };
      }

      // 3. UPSERT query
      if (this.operation === 'UPSERT') {
        const keys = Array.from(
          new Set(this.insertRows.flatMap((r) => Object.keys(r)))
        );
        const colList = keys.map((k) => `"${k}"`).join(', ');

        const valueTuples: string[] = [];
        const params: unknown[] = [];

        for (const row of this.insertRows) {
          const tuplePlaceholders: string[] = [];
          for (const key of keys) {
            params.push(row[key] !== undefined ? row[key] : null);
            tuplePlaceholders.push(`$${params.length}`);
          }
          valueTuples.push(`(${tuplePlaceholders.join(', ')})`);
        }

        const conflictCol =
          this.upsertOptions?.onConflict ||
          meta.pks.get(`${this.schemaName}.${this.tableName}`) ||
          'id';

        let sql = `INSERT INTO "${this.schemaName}"."${this.tableName}" (${colList}) VALUES ${valueTuples.join(', ')}`;
        if (this.upsertOptions?.ignoreDuplicates) {
          sql += ` ON CONFLICT ("${conflictCol}") DO NOTHING`;
        } else {
          const updateAssignments = keys
            .filter((k) => k !== conflictCol)
            .map((k) => `"${k}" = EXCLUDED."${k}"`)
            .join(', ');
          if (updateAssignments.length > 0) {
            sql += ` ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateAssignments}`;
          } else {
            sql += ` ON CONFLICT ("${conflictCol}") DO NOTHING`;
          }
        }

        if (this.hasChainedSelectAfterMutation) {
          sql += ' RETURNING *';
        }

        const res = await this.pool.query(sql, params);
        const rows = res.rows;

        if (this.hasChainedSelectAfterMutation) {
          const parsed = parseSelectString(this.selectString);
          if (rows.length > 0 && parsed.relations.length > 0) {
            await this.hydrateRelations(rows, parsed.relations, meta);
          }
          return this.formatResult(rows, res.rowCount);
        }

        return { data: null as any, error: null, count: res.rowCount };
      }

      // 4. UPDATE query
      if (this.operation === 'UPDATE') {
        const patch = this.updatePatch || {};
        const entries = Object.entries(patch);
        if (entries.length === 0) {
          return { data: null as any, error: null, count: 0 };
        }

        const setClauses: string[] = [];
        const params: unknown[] = [];

        for (const [col, val] of entries) {
          params.push(val);
          setClauses.push(`"${col}" = $${params.length}`);
        }

        // Add WHERE clause with adjusted param indices
        let whereSql = '';
        if (this.whereClauses.length > 0) {
          const whereParts: string[] = [];
          for (const wc of this.whereClauses) {
            const renumbered = wc.replace(/\$(\d+)/g, (_, num) => {
              const oldIdx = parseInt(num, 10);
              const val = this.queryParams[oldIdx - 1];
              params.push(val);
              return `$${params.length}`;
            });
            whereParts.push(renumbered);
          }
          whereSql = ` WHERE ${whereParts.join(' AND ')}`;
        }

        let sql = `UPDATE "${this.schemaName}"."${this.tableName}" SET ${setClauses.join(', ')}${whereSql}`;
        if (this.hasChainedSelectAfterMutation) {
          sql += ' RETURNING *';
        }

        const res = await this.pool.query(sql, params);
        const rows = res.rows;

        if (this.hasChainedSelectAfterMutation) {
          const parsed = parseSelectString(this.selectString);
          if (rows.length > 0 && parsed.relations.length > 0) {
            await this.hydrateRelations(rows, parsed.relations, meta);
          }
          return this.formatResult(rows, res.rowCount);
        }

        return { data: null as any, error: null, count: res.rowCount };
      }

      // 5. DELETE query
      if (this.operation === 'DELETE') {
        let whereSql = '';
        if (this.whereClauses.length > 0) {
          whereSql = ` WHERE ${this.whereClauses.join(' AND ')}`;
        }

        let sql = `DELETE FROM "${this.schemaName}"."${this.tableName}"${whereSql}`;
        if (this.hasChainedSelectAfterMutation) {
          sql += ' RETURNING *';
        }

        const res = await this.pool.query(sql, this.queryParams);
        const rows = res.rows;

        if (this.hasChainedSelectAfterMutation) {
          return this.formatResult(rows, res.rowCount);
        }

        return { data: null as any, error: null, count: res.rowCount };
      }

      return { data: null as any, error: null, count: 0 };
    } catch (err: any) {
      return {
        data: null as any,
        error: mapPgError(err),
        count: null,
      };
    }
  }

  /**
   * Recursively hydrates nested relations on parent rows via batch IN / ANY queries.
   */
  private async hydrateRelations(
    rows: any[],
    relations: ParsedRelation[],
    meta: TableMetadataCache
  ): Promise<void> {
    if (rows.length === 0 || relations.length === 0) return;

    for (const rel of relations) {
      const relInfo = resolveRelationInfo(
        this.schemaName,
        this.tableName,
        rel,
        meta
      );

      // 1. (count) queries (e.g. form_fields(count))
      if (rel.isCount) {
        const localValues = Array.from(
          new Set(rows.map((r) => r[relInfo.localCol]).filter((v) => v != null))
        );
        if (localValues.length === 0) {
          for (const r of rows) r[rel.alias] = [{ count: 0 }];
          continue;
        }

        const countRes = await this.pool.query(
          `SELECT "${relInfo.targetCol}", COUNT(*)::int AS count
           FROM "${relInfo.targetSchema}"."${relInfo.targetTable}"
           WHERE "${relInfo.targetCol}" = ANY($1)
           GROUP BY "${relInfo.targetCol}"`,
          [localValues]
        );

        const countMap = new Map<any, number>();
        for (const cr of countRes.rows) {
          countMap.set(cr[relInfo.targetCol], cr.count);
        }

        for (const r of rows) {
          const c = countMap.get(r[relInfo.localCol]) || 0;
          r[rel.alias] = [{ count: c }];
        }
        continue;
      }

      // 2. Many-to-One: target is an object or null
      if (relInfo.type === 'many_to_one') {
        const fkValues = Array.from(
          new Set(rows.map((r) => r[relInfo.localCol]).filter((v) => v != null))
        );
        if (fkValues.length === 0) {
          for (const r of rows) r[rel.alias] = null;
          continue;
        }

        const targetBuilder = new PgQueryBuilder(
          this.pool,
          relInfo.targetSchema,
          relInfo.targetTable
        );
        targetBuilder.select(rel.nestedSelect || '*');
        targetBuilder.in(relInfo.targetCol, fkValues);

        const targetRes = await targetBuilder.execute();
        const targetRows = targetRes.data || [];

        const targetMap = new Map<any, any>();
        for (const tr of targetRows) {
          targetMap.set(tr[relInfo.targetCol], tr);
        }

        for (const r of rows) {
          r[rel.alias] = targetMap.get(r[relInfo.localCol]) ?? null;
        }
        continue;
      }

      // 3. One-to-Many: target is an array of objects
      if (relInfo.type === 'one_to_many') {
        const parentIds = Array.from(
          new Set(rows.map((r) => r[relInfo.localCol]).filter((v) => v != null))
        );
        if (parentIds.length === 0) {
          for (const r of rows) r[rel.alias] = [];
          continue;
        }

        const childBuilder = new PgQueryBuilder(
          this.pool,
          relInfo.targetSchema,
          relInfo.targetTable
        );
        childBuilder.select(rel.nestedSelect || '*');
        childBuilder.in(relInfo.targetCol, parentIds);

        const childRes = await childBuilder.execute();
        const childRows = childRes.data || [];

        const childGroup = new Map<any, any[]>();
        for (const cr of childRows) {
          const key = cr[relInfo.targetCol];
          if (!childGroup.has(key)) {
            childGroup.set(key, []);
          }
          childGroup.get(key)!.push(cr);
        }

        for (const r of rows) {
          r[rel.alias] = childGroup.get(r[relInfo.localCol]) || [];
        }
        continue;
      }
    }
  }

  private formatResult(
    rows: any[],
    count: number | null
  ): PostgrestResponse<any> {
    if (this.isSingleRow) {
      if (rows.length === 0) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: 'The result contains 0 rows',
            hint: null,
          },
          count: null,
        };
      }
      if (rows.length > 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: `The result contains ${rows.length} rows`,
            hint: null,
          },
          count: null,
        };
      }
      return { data: rows[0], error: null, count: null };
    }

    if (this.isMaybeSingleRow) {
      if (rows.length === 0) {
        return { data: null, error: null, count: null };
      }
      return { data: rows[0], error: null, count: null };
    }

    return { data: rows, error: null, count };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: PostgrestResponse<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Netlify Blobs storage adapter mimicking Supabase Storage API.
 */
export class NetlifyBlobStorageAdapter {
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  private getStoreInstance() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getStore } = require('@netlify/blobs');
      return getStore(this.bucketName);
    } catch {
      return null;
    }
  }

  private getLocalPath(filePath: string): { dir: string; file: string; meta: string } {
    const safeBucket = this.bucketName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const keyParts = filePath.split('/').filter((p) => p && p !== '..');
    const dir = path.join(process.cwd(), '.netlify', 'blobs-local', safeBucket, ...keyParts.slice(0, -1));
    const file = path.join(process.cwd(), '.netlify', 'blobs-local', safeBucket, ...keyParts);
    const meta = `${file}.meta.json`;
    return { dir, file, meta };
  }

  async upload(
    filePath: string,
    body: any,
    options?: { contentType?: string; cacheControl?: string; upsert?: boolean }
  ): Promise<{ data: { path: string } | null; error: PostgrestError | null }> {
    try {
      const buffer = Buffer.isBuffer(body)
        ? body
        : body instanceof ArrayBuffer
        ? Buffer.from(body)
        : typeof body?.arrayBuffer === 'function'
        ? Buffer.from(await body.arrayBuffer())
        : typeof body === 'string'
        ? Buffer.from(body)
        : Buffer.from(body);

      const contentType = options?.contentType || 'application/octet-stream';
      const cacheControl = options?.cacheControl || '31536000';

      const store = this.getStoreInstance();
      if (store) {
        try {
          await store.set(filePath, buffer, {
            metadata: { contentType, cacheControl },
          });
          return { data: { path: filePath }, error: null };
        } catch {
          // Fall through to local fallback
        }
      }

      // Local disk fallback
      const { dir, file, meta } = this.getLocalPath(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(file, buffer);
      await fs.promises.writeFile(
        meta,
        JSON.stringify({ contentType, cacheControl, uploadedAt: new Date().toISOString() })
      );

      return { data: { path: filePath }, error: null };
    } catch (err: any) {
      return { data: null, error: mapPgError(err) };
    }
  }

  async remove(paths: string[]): Promise<{ data: { name: string }[] | null; error: PostgrestError | null }> {
    try {
      const store = this.getStoreInstance();
      for (const p of paths) {
        if (store) {
          try {
            await store.delete(p);
          } catch {
            // ignore
          }
        }
        const { file, meta } = this.getLocalPath(p);
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file).catch(() => {});
        }
        if (fs.existsSync(meta)) {
          await fs.promises.unlink(meta).catch(() => {});
        }
      }
      return { data: paths.map((name) => ({ name })), error: null };
    } catch (err: any) {
      return { data: null, error: mapPgError(err) };
    }
  }

  getPublicUrl(filePath: string): { data: { publicUrl: string } } {
    const encodedBucket = encodeURIComponent(this.bucketName);
    const encodedKey = filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return {
      data: {
        publicUrl: `/api/blobs/${encodedBucket}/${encodedKey}`,
      },
    };
  }

  async download(filePath: string): Promise<{ data: Blob | null; error: PostgrestError | null }> {
    try {
      const store = this.getStoreInstance();
      if (store) {
        try {
          const res = await store.getWithMetadata(filePath, { type: 'arrayBuffer' });
          if (res?.data) {
            const blob = new Blob([res.data], {
              type: (res.metadata as any)?.contentType || 'application/octet-stream',
            });
            return { data: blob, error: null };
          }
        } catch {
          // ignore
        }
      }

      const { file, meta } = this.getLocalPath(filePath);
      if (fs.existsSync(file)) {
        const buf = await fs.promises.readFile(file);
        let ct = 'application/octet-stream';
        if (fs.existsSync(meta)) {
          try {
            const m = JSON.parse(await fs.promises.readFile(meta, 'utf-8'));
            if (m.contentType) ct = m.contentType;
          } catch {
            // ignore
          }
        }
        return { data: new Blob([buf], { type: ct }), error: null };
      }

      return {
        data: null,
        error: {
          code: '404',
          message: 'Object not found',
          details: null,
          hint: null,
        },
      };
    } catch (err: any) {
      return { data: null, error: mapPgError(err) };
    }
  }
}

/**
 * Creates a PostgREST-compatible client backed by Postgres Pool.
 */
export function createPgPostgrestClient(defaultSchema: string = 'public') {
  const pool = getPgPool();
  if (!pool) {
    throw new Error('Database pool not available (NETLIFY_DB_URL / DATABASE_URL missing)');
  }

  let currentSchema = defaultSchema;

  const client = {
    schema(schemaName: string) {
      return createPgPostgrestClient(schemaName);
    },

    from(table: string) {
      return new PgQueryBuilder(pool, currentSchema, table);
    },

    async rpc(
      fnName: string,
      args?: Record<string, unknown>
    ): Promise<PostgrestResponse<any>> {
      try {
        const paramNames = args ? Object.keys(args) : [];
        const paramValues = args ? Object.values(args) : [];

        let callSql = `"${currentSchema}"."${fnName}"()`;
        if (paramNames.length > 0) {
          const namedArgs = paramNames
            .map((name, i) => `"${name}" => $${i + 1}`)
            .join(', ');
          callSql = `"${currentSchema}"."${fnName}"(${namedArgs})`;
        }

        const sql = `SELECT * FROM ${callSql}`;
        const res = await pool.query(sql, paramValues);
        const rows = res.rows;

        // Check if function returns set
        if (!globalThis.__svportal_rpc_meta_cache) {
          globalThis.__svportal_rpc_meta_cache = new Map();
        }

        let isSetof = globalThis.__svportal_rpc_meta_cache.get(fnName);
        if (isSetof === undefined) {
          try {
            const procRes = await pool.query(
              `SELECT p.proretset
               FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE p.proname = $1 AND n.nspname = $2
               LIMIT 1`,
              [fnName, currentSchema]
            );
            isSetof = Boolean(procRes.rows[0]?.proretset);
            globalThis.__svportal_rpc_meta_cache.set(fnName, isSetof);
          } catch {
            isSetof = false;
          }
        }

        if (isSetof) {
          if (
            rows.length > 0 &&
            Object.keys(rows[0]).length === 1 &&
            Object.keys(rows[0])[0] === fnName
          ) {
            return { data: rows.map((r) => r[fnName]), error: null, count: rows.length };
          }
          return { data: rows, error: null, count: rows.length };
        }

        // Single result / scalar function
        if (rows.length === 0) {
          return { data: null, error: null, count: 0 };
        }

        if (
          rows.length === 1 &&
          Object.keys(rows[0]).length === 1 &&
          Object.keys(rows[0])[0] === fnName
        ) {
          return { data: rows[0][fnName], error: null, count: 1 };
        }

        if (rows.length === 1) {
          return { data: rows[0], error: null, count: 1 };
        }

        return { data: rows, error: null, count: rows.length };
      } catch (err: any) {
        return { data: null, error: mapPgError(err), count: null };
      }
    },

    storage: {
      from(bucketName: string) {
        return new NetlifyBlobStorageAdapter(bucketName);
      },
    },

    auth: {
      async getUser() {
        try {
          const session = await getStaffSessionFromCookies();
          if (session) {
            return {
              data: {
                user: {
                  id: session.id,
                  email: session.email,
                  user_metadata: { full_name: session.full_name },
                  app_metadata: {},
                  aud: 'authenticated',
                  created_at: '',
                },
              },
              error: null,
            };
          }
        } catch {
          // ignore
        }
        return { data: { user: null }, error: null };
      },

      async getSession() {
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          return {
            data: {
              session: {
                user,
                access_token: 'sv_staff_pg_session',
                refresh_token: '',
                expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
              },
            },
            error: null,
          };
        }
        return { data: { session: null }, error: null };
      },

      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          const staffUser = await authenticateStaffWithPg(email, password);
          if (staffUser) {
            return {
              data: {
                user: {
                  id: staffUser.id,
                  email: staffUser.email,
                  user_metadata: { full_name: staffUser.full_name },
                },
                session: {
                  access_token: 'sv_staff_pg_session',
                  user: staffUser,
                },
              },
              error: null,
            };
          }
          return {
            data: { user: null, session: null },
            error: {
              code: '400',
              message: 'Invalid login credentials',
              details: null,
              hint: null,
            },
          };
        } catch (err: any) {
          return {
            data: { user: null, session: null },
            error: mapPgError(err),
          };
        }
      },

      async signOut() {
        try {
          const { NextResponse } = await import('next/server');
          const res = NextResponse.next();
          clearStaffSessionCookie(res);
        } catch {
          // ignore
        }
        return { error: null };
      },

      admin: {
        async createUser(opts: {
          email: string;
          password?: string;
          user_metadata?: Record<string, unknown>;
          email_confirm?: boolean;
        }) {
          try {
            const rawMeta = JSON.stringify(opts.user_metadata || {});
            const pass = opts.password || crypto.randomUUID();
            const res = await pool.query(
              `INSERT INTO auth.users (
                 id, email, encrypted_password, raw_user_meta_data, email_confirmed_at, created_at, updated_at
               ) VALUES (
                 gen_random_uuid(), $1, crypt($2, gen_salt('bf')), $3::jsonb, NOW(), NOW(), NOW()
               ) RETURNING id, email, raw_user_meta_data`,
              [opts.email.toLowerCase(), pass, rawMeta]
            );
            return { data: { user: res.rows[0] }, error: null };
          } catch (err: any) {
            return { data: { user: null }, error: mapPgError(err) };
          }
        },

        async deleteUser(id: string) {
          try {
            await pool.query(`DELETE FROM auth.users WHERE id = $1`, [id]);
            return { data: { user: { id } }, error: null };
          } catch (err: any) {
            return { data: null, error: mapPgError(err) };
          }
        },

        async listUsers() {
          try {
            const res = await pool.query(
              `SELECT id, email, raw_user_meta_data, created_at FROM auth.users ORDER BY created_at DESC`
            );
            return { data: { users: res.rows }, error: null };
          } catch (err: any) {
            return { data: { users: [] }, error: mapPgError(err) };
          }
        },
      },
    },
  };

  return client;
}
