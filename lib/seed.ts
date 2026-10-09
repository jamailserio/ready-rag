/**
 * Seed Upstash Vector with chunks from every PDF listed in data/sources.json.
 *
 *   npm run seed       -> wipe the index, chunk + embed every PDF, upload
 *   npm run seed:dry   -> chunk only and print stats (no API calls, no cost)
 *
 * Re-run `npm run seed` whenever you change a PDF, sources.json, or the
 * chunk settings in lib/config.ts.
 */
import { config as loadEnv } from "dotenv";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// Next.js reads .env.local automatically; this script does not.
loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { openai } from "@ai-sdk/openai";
import { Index } from "@upstash/vector";
import { embedMany } from "ai";
import sourcesJson from "../data/sources.json";
import { chunkDocument, type Chunk } from "./chunking";
import { CHUNK_OVERLAP, CHUNK_SIZE, EMBEDDING_MODEL, MIN_CHUNK_CHARS } from "./config";
import { extractPages } from "./pdf-text";
import type { ChunkMetadata, SourceDoc } from "./types";

const sources = sourcesJson as SourceDoc[];
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 100;

async function main() {
  if (!DRY_RUN) {
    for (const key of ["OPENAI_API_KEY", "UPSTASH_VECTOR_REST_URL", "UPSTASH_VECTOR_REST_TOKEN"]) {
      if (!process.env[key]) {
        console.error(`Missing ${key}. Add it to .env.local (see .env.example).`);
        process.exit(1);
      }
    }
  }

  console.log(`Chunk size ${CHUNK_SIZE}, overlap ${CHUNK_OVERLAP}${DRY_RUN ? "   (DRY RUN: nothing is embedded or uploaded)" : ""}\n`);

  // 1. Read + chunk every PDF
  const all: Chunk[] = [];
  for (const doc of sources) {
    const pages = await extractPages(path.join(process.cwd(), "data", doc.file));
    const chunks = chunkDocument(doc, pages, { size: CHUNK_SIZE, overlap: CHUNK_OVERLAP, minChars: MIN_CHUNK_CHARS });
    const avg = Math.round(chunks.reduce((s, c) => s + c.metadata.text.length, 0) / Math.max(chunks.length, 1));
    console.log(
      `${doc.shortTitle.padEnd(34)} ${String(pages.length).padStart(3)} pages  ${String(chunks.length).padStart(4)} chunks  avg ${avg} chars`,
    );
    all.push(...chunks);
  }
  console.log(`\nTOTAL: ${all.length} chunks`);

  // 2. Save every chunk to a file you can open and check (Phase 4 "verify")
  await writeFile("chunks-preview.json", JSON.stringify(all.map((c) => ({ id: c.id, ...c.metadata })), null, 2));
  console.log("Wrote chunks-preview.json. Open it to check the text and metadata.\n");

  if (all.length === 0) {
    console.error("No chunks were produced. Check the file names in data/sources.json.");
    process.exit(1);
  }
  const sample = all[Math.floor(all.length * 0.3)];
  console.log(`Sample chunk ${sample.id}  |  section: ${sample.metadata.section}  |  page ${sample.metadata.page}`);
  console.log(sample.metadata.text.slice(0, 400) + " ...\n");

  if (DRY_RUN) return;

  // 3. Start from an empty index so chunks from old settings don't linger
  const index = new Index<ChunkMetadata>(); // reads UPSTASH_VECTOR_REST_URL / _TOKEN
  console.log("Clearing the index...");
  await index.reset();

  // 4. Embed + upload in batches
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const { embeddings } = await embedMany({
      model: openai.embedding(EMBEDDING_MODEL),
      values: batch.map((c) => c.embedText),
    });
    await index.upsert(batch.map((c, j) => ({ id: c.id, vector: embeddings[j], metadata: c.metadata })));
    process.stdout.write(`Embedded and uploaded ${Math.min(i + BATCH, all.length)}/${all.length}\r`);
  }

  // 5. Verify
  console.log("\nWaiting a few seconds for Upstash to finish indexing...");
  await new Promise((r) => setTimeout(r, 5000));
  const info = await index.info();
  console.log(`Upstash reports ${info.vectorCount} vectors (+${info.pendingVectorCount} pending). Expected ${all.length}.`);
  if (info.dimension !== 1536) {
    console.warn(`WARNING: index dimension is ${info.dimension}, but ${EMBEDDING_MODEL} produces 1536. Recreate the index with 1536.`);
  }
  console.log("Done. Next: npm run ask \"what goes in a disaster supplies kit?\"  or  npm run dev");
}

main().catch((e) => {
  console.error("\nSEED FAILED:", e?.message ?? e);
  process.exit(1);
});
