/**
 * Test retrieval from the terminal, without the chat UI or the LLM.
 *   npm run ask "what should I do during a flood?"
 * Prints the chunks the bot would see, with page, section and score.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { searchDocuments } from "../lib/search";

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.log('Usage: npm run ask "your question here"');
    process.exit(1);
  }
  const results = await searchDocuments(query);
  console.log(`\nTop ${results.length} chunks for: "${query}"\n`);
  results.forEach((r, i) => {
    console.log(`${i + 1}. [${r.ref}]  score ${r.score}  |  ${r.section} (${r.year})`);
    console.log(`   ${r.text.slice(0, 220).replace(/\n/g, " ")}...\n`);
  });
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
