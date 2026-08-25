import { describe, expect, it } from "vitest";

import { prepareDatabaseConnection } from "@/lib/database-url";

function testDatabaseUrl(host: string) {
  const url = new URL(`postgresql://${host}/app`);
  url.username = "user";
  url.password = "placeholder";
  return url;
}

describe("conexión PostgreSQL", () => {
  it("adapta Neon para postgres.js y exige verificación TLS", () => {
    const source = testDatabaseUrl("ep-example-pooler.example.neon.tech");
    source.searchParams.set("sslmode", "require");
    source.searchParams.set("channel_binding", "require");
    source.searchParams.set("application_name", "hegelflow");
    const connection = prepareDatabaseConnection(source.toString());
    const parsed = new URL(connection.url);

    expect(connection.ssl).toBe("verify-full");
    expect(connection.pooled).toBe(true);
    expect(parsed.searchParams.has("channel_binding")).toBe(false);
    expect(parsed.searchParams.get("sslmode")).toBe("require");
    expect(parsed.searchParams.get("application_name")).toBe("hegelflow");
  });

  it("desactiva TLS solo para hosts locales exactos", () => {
    const local = testDatabaseUrl("127.0.0.1:5432");
    const remote = testDatabaseUrl("db.example.com");
    local.password = "localhost";
    remote.password = "localhost";

    expect(prepareDatabaseConnection(local.toString()).ssl).toBe(false);
    expect(prepareDatabaseConnection(remote.toString())).toMatchObject({ ssl: "verify-full", pooled: false });
  });

  it("rechaza protocolos ajenos a PostgreSQL sin reflejar la credencial", () => {
    const source = new URL("https://example.com/app");
    source.username = "user";
    source.password = "private";

    expect(() => prepareDatabaseConnection(source.toString())).toThrow(
      "DATABASE_URL no es una URL PostgreSQL válida.",
    );
  });
});
