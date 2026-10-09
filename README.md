# ReadyRAG: Disaster Preparedness Q&A from FEMA Guides

**Live app:** https://YOUR-APP.vercel.app  ← _replace after deploying_

ReadyRAG is a chat app that answers questions about getting ready for, and recovering from, disasters. It answers **only** from six official FEMA publications and cites the document and page for every point. Clicking a citation opens that exact PDF page.

Built for the Week 14 "Ship Your Own RAG" mini-project, starting from the Week 14A starter (Next.js 15 + Vercel AI SDK + Upstash Vector).

## The corpus

All documents are US federal government publications (public domain).

| Document | Publisher, year | Type | PDF pages indexed |
|---|---|---|---|
| Are You Ready? An In-depth Guide to Citizen Preparedness | FEMA, 2004 | Household guide | 101 of 108 |
| Help After a Disaster: Applicant's Guide to the Individuals & Households Program | FEMA, 2004 | Assistance policy | 19 of 24 |
| Preparing for Disaster for People with Disabilities and Other Special Needs | FEMA and Red Cross, 2004 | Brief | 18 of 20 |
| Emergency Financial First Aid Kit: Checklists and Forms | FEMA and Operation HOPE, 2019 | Checklist | 13 of 22 |
| Be Prepared for a Hurricane (FEMA P-2143) | FEMA, 2023 | Brief | 1 of 1 |
| National Disaster Recovery Framework, 3rd ed. (amended) | FEMA, 2024 | National policy | 35 of 61 |

About 187 indexed pages, producing **629 chunks**. Pages left out (covers, tables of contents, blank fill-in forms, 16 pages of agency tables and acronyms, and link lists) are listed per document in `data/sources.json`, under `skipPages`.

## How it works

```
PDFs in data/ ──► lib/seed.ts ──► OpenAI text-embedding-3-small ──► Upstash Vector (629 chunks + metadata)
                                                                          ▲
Browser (app/page.tsx, useChat) ──► app/api/chat/route.ts (streamText) ───┘
                                     the model calls the searchDocuments tool,
                                     then streams an answer with [Doc p. N] citations
```

- **RAG as a tool call:** `searchDocuments` is a tool the model calls, with `maxSteps: 4`, so it can search, optionally search again with new wording, and then answer. The model can also limit a search to a single document with `docId`.
- **Streaming:** `streamText` → `toDataStreamResponse()` → `useChat`.
- **Sources under answers:** every passage the tool returned is shown under the answer, with title, page, section, year and match score. Sources the answer actually cites are highlighted and listed first. Each one links to `/docs/<file>.pdf#page=N`.
- **Secrets stay on the server:** `OPENAI_API_KEY` and the Upstash credentials are read only in `app/api/chat/route.ts`, `lib/search.ts` and the seed script. Nothing uses the `NEXT_PUBLIC_` prefix, so nothing is put in the browser bundle.

### Chunking and metadata decisions

| Decision | Choice | Why |
|---|---|---|
| Chunk size / overlap | 1000 / 150 characters | Holds one checklist or one "what to do during…" list. Smaller chunks split numbered steps apart. |
| Chunk boundaries | Never cross a page; prefer breaking at a line, then a sentence | Every chunk gets exactly one page number to cite |
| Cleaning | Remove repeated headers and footers, re-join hyphenated words and drop caps, keep bullets on their own lines | The FEMA guide repeats "FEDERAL EMERGENCY MANAGEMENT AGENCY / ARE YOU READY?" on every page, which polluted the embeddings |
| Metadata | doc id and title, year, type, **PDF page**, **section** (from each document's table of contents), chunk text | Page for citations; section and year so the model can tell 2004 guidance from 2024 policy |
| Embedded text | `"<Doc> (<year>) - <Section>"` + chunk text | Adds topic context, so a question about a hurricane matches the Hurricanes section |
| Skipped pages | Tables of contents, covers, blank forms | They matched almost every query but held no answers |
| topK | 6 | Answers often need 2–3 neighbouring chunks; 6 leaves room for a second document |

## Run it locally

You need Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local      # then paste your 3 keys into .env.local
npm run seed:dry                # optional: check the chunking (free, no API calls)
npm run seed                    # embed + upload all chunks to Upstash
npm run ask "what goes in a disaster supplies kit?"   # optional: test retrieval only
npm run dev                     # open http://localhost:3000
npm run build && npm run check-secrets   # confirms no key is in the browser bundle
```

The Upstash Vector index must use **1536 dimensions** and the **COSINE** metric, and must **not** use a built-in embedding model.

| Variable | Where it's used |
|---|---|
| `OPENAI_API_KEY` | Chat model (`gpt-4o-mini`) and embeddings |
| `UPSTASH_VECTOR_REST_URL` | Vector search and seeding |
| `UPSTASH_VECTOR_REST_TOKEN` | Vector search and seeding |

Optional tuning variables: `CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`, `OPENAI_MODEL` (see `lib/config.ts`).

### Add or change documents

1. Put the PDF in `data/`.
2. Add an entry to `data/sources.json`: title, year, which pages to skip, which header lines to strip, and each section's first page.
3. Run `npm run seed:dry`, open `chunks-preview.json`, and check the text looks clean.
4. Run `npm run seed`.

## Deploy

Deployed on Vercel, with the same three environment variables added under **Project → Settings → Environment Variables**. The index is seeded from a laptop once; the deployed app only reads from it.

## Demo questions

| Question | What should happen |
|---|---|
| What should go in a basic disaster supplies kit? | Good: lists items, cites *Are You Ready?* pp. 10–16 |
| What should I do if I'm driving and a flash flood hits? | Good: cites the Floods section, p. 37 |
| How do I appeal a FEMA decision? | Good: cites *Help After a Disaster*, pp. 14 and 19 |
| How can someone who uses a wheelchair prepare to evacuate? | Good: cites *Disability Preparedness*, pp. 7–12 |
| Which financial documents should I keep safe? | Good: combines the Financial First Aid Kit and *Are You Ready?* |
| What do Long-Term Recovery Groups do? | Good: cites the Recovery Framework, p. 26 |
| What does the orange threat level mean? | Weak spot: the 2004 color-coded system was retired in 2011. The bot should flag that the guidance is dated. |
| Can I bring my dog to an emergency shelter? | Weak spot: the 2004 guide says pets are not allowed (service animals only); this has since changed |
| What's the evacuation route for my town? | Should say this isn't covered and point to local officials |

_Update this table with what you actually observe._

## Project structure

```
app/page.tsx              chat UI: empty state, streaming answers, sources panel
app/api/chat/route.ts     streamText + searchDocuments tool (RAG as a tool call)
app/layout.tsx            title, description, Open Graph metadata
lib/seed.ts               PDF → clean → chunk → embed → upsert
lib/chunking.ts           cleaning + chunking (pure functions)
lib/search.ts             embed query → Upstash query → citation-ready results
lib/prompt.ts             system prompt + tool description
lib/config.ts             chunk size, overlap, topK, models
data/sources.json         per-document metadata, skipped pages, sections
data/*.pdf                the corpus
scripts/ask.ts            command-line retrieval test
scripts/copy-docs.mjs     copies PDFs to public/docs so citations can link to them
steps/                    original workshop snapshots (not part of the build)
```

## Limitations

- Three of the six documents are from 2004. Phone numbers, aid amounts, and some policies (pets in shelters, the threat advisory system) are out of date. The prompt tells the model to flag this, but it doesn't always.
- PDF page numbers are used for citations, not the printed page numbers. In *Are You Ready?*, PDF page 35 is printed page 29.
- No live data: no weather alerts, local shelters, or current FEMA declarations.
- Not for emergencies. Call 911.
