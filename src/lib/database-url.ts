export type PreparedDatabaseConnection = {
  url: string;
  ssl: false | "verify-full";
  pooled: boolean;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function prepareDatabaseConnection(databaseUrl: string): PreparedDatabaseConnection {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL no es una URL PostgreSQL válida.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL no es una URL PostgreSQL válida.");
  }

  // postgres.js 3.x no implementa SCRAM channel binding y, si recibe este
  // parámetro de Neon, lo envía incorrectamente como parámetro de inicio.
  // TLS verify-full conserva cifrado y validación de identidad del servidor.
  parsed.searchParams.delete("channel_binding");

  const hostname = parsed.hostname.toLowerCase();
  return {
    url: parsed.toString(),
    ssl: LOCAL_HOSTS.has(hostname) ? false : "verify-full",
    pooled: hostname.includes("-pooler."),
  };
}
