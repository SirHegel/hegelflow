import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { prepareDatabaseConnection } from "../src/lib/database-url";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL es obligatorio para ejecutar migraciones.");
}

const connection = prepareDatabaseConnection(databaseUrl);
if (connection.pooled) {
  throw new Error(
    "Las migraciones requieren una conexión directa; use DATABASE_URL_UNPOOLED como DATABASE_URL para este comando.",
  );
}
const sql = postgres(connection.url, {
  max: 1,
  prepare: false,
  ssl: connection.ssl,
});

async function main() {
let migrationLockAcquired = false;
try {
  await sql`SELECT pg_advisory_lock(hashtext('hegelflow'), hashtext('schema-migrations'))`;
  migrationLockAcquired = true;

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const migrationDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const [existing] = await sql<{ name: string }[]>`
      SELECT name FROM schema_migrations WHERE name = ${file}
    `;
    if (existing) continue;

    const migration = await readFile(path.join(migrationDir, file), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration);
      await transaction`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    console.info(`Migración aplicada: ${file}`);
  }
} finally {
  if (migrationLockAcquired) {
    await sql`SELECT pg_advisory_unlock(hashtext('hegelflow'), hashtext('schema-migrations'))`;
  }
  await sql.end();
}
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "La migración falló.");
  process.exitCode = 1;
});
