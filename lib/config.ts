// The knobs you tune in Phase 5. Change a number, re-run `npm run seed`
// (for chunk settings) or just restart `npm run dev` (for TOP_K), then
// ask the same test questions again and compare.

// Target characters per chunk (~250 tokens). Small enough that one chunk is
// about one idea (one checklist, one "what to do during a flood" list), big
// enough to keep a numbered list together.
export const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 1000);

// Characters repeated between neighbouring chunks so a sentence cut at a
// boundary still appears whole in one of them.
export const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP ?? 150);

// Chunks shorter than this are dropped (page numbers, stray headings).
export const MIN_CHUNK_CHARS = 120;

// How many chunks the search tool returns per call.
export const TOP_K = Number(process.env.TOP_K ?? 6);

// OpenAI chat model used to write answers.
export const CHAT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// OpenAI embedding model (1536 dimensions). Your Upstash index must be
// created with dimension 1536 and the COSINE metric to match.
export const EMBEDDING_MODEL = "text-embedding-3-small";
