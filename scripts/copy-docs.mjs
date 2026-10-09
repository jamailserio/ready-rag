// Copies the PDFs from data/ to public/docs/ so citation links can open them.
// Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, mkdirSync, readdirSync } from "node:fs";

mkdirSync("public/docs", { recursive: true });
const pdfs = readdirSync("data").filter((f) => f.toLowerCase().endsWith(".pdf"));
for (const f of pdfs) cpSync(`data/${f}`, `public/docs/${f}`);
console.log(`Copied ${pdfs.length} PDFs to public/docs/`);
