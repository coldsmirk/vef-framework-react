import type { CodeSetKeyEntry } from "@vef-framework-react/dev";

import { createRequire } from "node:module";

import { defineCodeGenerationConfig } from "@vef-framework-react/dev";

interface PostgresCodeSetKeyRow {
  key: string;
  comment: string | null;
}

interface PostgresPool {
  query: (sql: string) => Promise<{ rows: PostgresCodeSetKeyRow[] }>;
  end: () => Promise<void>;
}

type PostgresPoolConstructor = new (options: Record<string, unknown>) => PostgresPool;

interface PostgresModule {
  Pool: PostgresPoolConstructor;
}

const nodeRequire = createRequire(import.meta.url);

const CODE_SET_SOURCE_POSTGRES = "postgres";

const POSTGRES_CODE_SET_KEYS_SQL = `
select
  d.key,
  nullif(d.remark, '') as comment
from sys_dictionary d
where d.type = 'T'
  and d.is_active is true
order by d.key
`;

const DEMO_CODE_SET_KEYS = [
  { key: "common.gender", comment: "通用性别" },
  { key: "md.department.level", comment: "科室级别" },
  { key: "md.department.type", comment: "科室类型" },
  { key: "md.district.level", comment: "行政区级别" },
  { key: "md.gender_limit", comment: "性别限制" },
  { key: "md.id_mapping.external_app", comment: "外部应用" },
  { key: "md.organization.hospital_level", comment: "医院等级" },
  { key: "md.organization.type", comment: "机构类型" },
  { key: "md.staff.category", comment: "员工类别" },
  { key: "md.staff.gender", comment: "员工性别" },
  { key: "md.staff.id_type", comment: "员工证件类型" },
  { key: "md.staff.position", comment: "员工职务" },
  { key: "md.staff.professional_role", comment: "员工专业角色" },
  { key: "md.staff.professional_title", comment: "员工职称" },
  { key: "md.staff.status", comment: "员工状态" },
  { key: "sys.config_definition.category", comment: "配置分类" },
  { key: "sys.config_definition.value_type", comment: "配置值类型" },
  { key: "sys.data_source.type", comment: "数据源类型" },
  { key: "sys.menu.type", comment: "菜单类型" },
  { key: "sys.serial_no_rule.date_format", comment: "流水号日期格式" },
  { key: "sys.serial_no_rule.reset_cycle", comment: "流水号重置周期" },
  { key: "sys.user.gender", comment: "系统用户性别" }
] satisfies readonly CodeSetKeyEntry[];

/**
 * Playground code generation config. The default code-set-keys fetcher mocks
 * a backend response so the demo runs without a live server.
 *
 * Real projects can set `VEF_CODE_SET_SOURCE=postgres` and `DATABASE_URL`
 * to read code set keys directly from PostgreSQL. The SQL below mirrors the
 * playground dictionary model; adjust table and column names to match the
 * production schema.
 *
 * Future generators (i18n, apiSchema, ...) live alongside `codeSetKeys`
 * in this same file — one code generation entry point per project.
 */
export default defineCodeGenerationConfig({
  codeSetKeys: {
    output: "src/types/code-set-keys.gen.ts",
    fetchCodeSetKeys: resolveCodeSetKeyFetcher()
  }
});

function resolveCodeSetKeyFetcher(): () => Promise<readonly CodeSetKeyEntry[]> {
  const { VEF_CODE_SET_SOURCE } = process.env;

  if (VEF_CODE_SET_SOURCE === CODE_SET_SOURCE_POSTGRES) {
    return fetchPostgresCodeSetKeys;
  }

  return fetchDemoCodeSetKeys;
}

function fetchDemoCodeSetKeys(): Promise<readonly CodeSetKeyEntry[]> {
  return Promise.resolve(DEMO_CODE_SET_KEYS);
}

async function fetchPostgresCodeSetKeys(): Promise<readonly CodeSetKeyEntry[]> {
  const { DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required when VEF_CODE_SET_SOURCE=postgres.");
  }

  const Pool = loadPostgresPool();
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ...resolvePostgresSslOptions()
  });

  try {
    const { rows } = await pool.query(POSTGRES_CODE_SET_KEYS_SQL);
    return rows.map(row => toCodeSetKeyEntry(row));
  } finally {
    await pool.end();
  }
}

function toCodeSetKeyEntry({ key, comment }: PostgresCodeSetKeyRow): CodeSetKeyEntry {
  return {
    key,
    ...comment && { comment }
  };
}

function resolvePostgresSslOptions(): Record<string, unknown> {
  const { PGSSLMODE } = process.env;

  if (PGSSLMODE === "require") {
    return { ssl: true };
  }

  return {};
}

function loadPostgresPool(): PostgresPoolConstructor {
  try {
    const pg = nodeRequire("pg") as PostgresModule;
    return pg.Pool;
  } catch (error) {
    if (isModuleNotFoundError(error)) {
      throw new Error("PostgreSQL code set generation requires `pg`. Install it with `pnpm add -D pg`.", {
        cause: error
      });
    }

    throw error;
  }
}

function isModuleNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND";
}
