import postgres from "postgres";
import { getServerEnv } from "@/lib/env";

type SqlClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as typeof globalThis & {
  hegelflowSql?: SqlClient;
};

export function db(): SqlClient {
  if (!globalForDb.hegelflowSql) {
    const { DATABASE_URL } = getServerEnv();
    const isLocal = /localhost|127\.0\.0\.1/.test(DATABASE_URL);

    globalForDb.hegelflowSql = postgres(DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      ssl: isLocal ? false : "require",
      transform: { undefined: null },
    });
  }

  return globalForDb.hegelflowSql;
}

