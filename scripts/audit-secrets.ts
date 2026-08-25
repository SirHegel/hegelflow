import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
).split("\n").filter(Boolean);

const rules = [
  { name: "clave privada", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "token GitHub", pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/ },
  { name: "token Vercel", pattern: /\b(?:vercel_)?[A-Za-z0-9]{48,}\b/ },
  {
    name: "URL PostgreSQL con credencial",
    pattern: /postgres(?:ql)?:\/\/(?!USER:PASSWORD|user:password|<)[^:/\s]+:[^@\s]+@/i,
  },
  { name: "JWT completo", pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{16,}\b/ },
  { name: "secreto asignado", pattern: /(?:^|\n)\s*[A-Z][A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*["']?(?!change-me|placeholder|example|<)[^\s"']{12,}/ },
] as const;

const ignored = new Set(["scripts/audit-secrets.ts", "package-lock.json"]);
const findings: Array<{ file: string; rule: string }> = [];

for (const file of files) {
  if (ignored.has(file) || file.startsWith(".next/") || file.startsWith("node_modules/")) continue;
  let content: string;
  try {
    content = readFileSync(path.join(process.cwd(), file), "utf8");
  } catch {
    continue;
  }
  if (content.includes("\u0000")) continue;
  for (const rule of rules) {
    if (rule.pattern.test(content)) findings.push({ file, rule: rule.name });
  }
}

if (findings.length) {
  console.error("La auditoría encontró patrones sensibles:");
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.rule}`);
  process.exitCode = 1;
} else {
  console.info(`Auditoría de secretos correcta (${files.length} archivos revisados).`);
}
