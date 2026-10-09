// Checks that none of your secret keys ended up in the code sent to browsers.
// Usage: npm run build   then   npm run check-secrets
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SECRET_NAMES = ["OPENAI_API_KEY", "UPSTASH_VECTOR_REST_TOKEN", "UPSTASH_VECTOR_REST_URL"];

if (!existsSync(".env.local")) {
  console.error("No .env.local found. Run this from the project folder.");
  process.exit(1);
}
if (!existsSync(".next/static")) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}

// Read the secret values from .env.local
const secrets = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#\s]+)"?/);
  if (m && SECRET_NAMES.includes(m[1])) secrets[m[1]] = m[2];
}

// Walk every file the browser can download (.next/static)
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

let leaks = 0;
let scanned = 0;
for (const file of files(".next/static")) {
  scanned++;
  const content = readFileSync(file, "utf8");
  for (const [name, value] of Object.entries(secrets)) {
    if (value.length > 8 && content.includes(value)) {
      console.log(`LEAK: ${name} found in ${file}`);
      leaks++;
    }
  }
}

console.log(`Scanned ${scanned} browser files for ${Object.keys(secrets).length} secrets.`);
console.log(leaks === 0 ? "PASS: no secrets in the client bundle." : `FAIL: ${leaks} leak(s) found.`);
process.exit(leaks === 0 ? 0 : 1);
