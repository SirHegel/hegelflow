import postgres from "postgres";
import { prepareDatabaseConnection } from "@/lib/database-url";
import { getServerEnv } from "@/lib/env";

type SqlClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as typeof globalThis & {
  hegelflowSql?: SqlClient;
};

export function db(): SqlClient {
  if (!globalForDb.hegelflowSql) {
    const { DATABASE_URL } = getServerEnv();
    const connection = prepareDatabaseConnection(DATABASE_URL);

    globalForDb.hegelflowSql = postgres(connection.url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      ssl: connection.ssl,
      transform: { undefined: null },
    });
  }

  return globalForDb.hegelflowSql;
}
