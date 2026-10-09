// Retrieval: embed the question, find the closest chunks in Upstash.
// Only imported by server code (the API route and scripts/ask.ts), so the
// OpenAI and Upstash keys it uses never reach the browser.
import { openai } from "@ai-sdk/openai";
import { Index } from "@upstash/vector";
import { embed } from "ai";
import { EMBEDDING_MODEL, TOP_K } from "./config";
import type { ChunkMetadata, RetrievedSource } from "./types";

let index: Index<ChunkMetadata> | null = null;

export async function searchDocuments(query: string, docId?: string, topK = TOP_K): Promise<RetrievedSource[]> {
  index ??= new Index<ChunkMetadata>(); // reads UPSTASH_VECTOR_REST_URL / _TOKEN

  const { embedding } = await embed({ model: openai.embedding(EMBEDDING_MODEL), value: query });

  const hits = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    ...(docId ? { filter: `docId = '${docId.replace(/'/g, "")}'` } : {}),
  });

  return hits
    .filter((h) => h.metadata)
    .map((h) => {
      const m = h.metadata!;
      return {
        ref: `${m.shortTitle} p. ${m.page}`,
        docTitle: m.docTitle,
        shortTitle: m.shortTitle,
        year: m.year,
        kind: m.kind,
        section: m.section,
        page: m.page,
        url: `/docs/${m.file}#page=${m.page}`,
        score: Math.round(h.score * 1000) / 1000,
        text: m.text,
      };
    });
}
