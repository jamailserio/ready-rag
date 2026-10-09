// Shared types used by the seed script, the API route and the UI.

export type SourceDoc = {
  id: string;
  file: string; // file name inside data/ (also served from /docs/)
  title: string;
  shortTitle: string;
  publisher: string;
  year: number;
  kind: string; // e.g. "Household guide", "National policy", "Brief"
  sourceUrl: string; // where the original PDF came from
  skipPages: number[]; // PDF pages we deliberately do not index (covers, TOCs, blank forms)
  stripPatterns: string[]; // regexes for repeated headers/footers to remove, line by line
  sections: { page: number; title: string }[]; // first PDF page of each section
};

// Metadata stored next to every vector in Upstash.
export type ChunkMetadata = {
  docId: string;
  docTitle: string;
  shortTitle: string;
  year: number;
  kind: string;
  file: string;
  page: number; // PDF page number (matches the page counter in any PDF viewer)
  section: string;
  chunkIndex: number; // position of this chunk within its page
  text: string; // the chunk text shown to the model and in the UI
};

// What the search tool returns to the model and the UI.
export type RetrievedSource = {
  ref: string; // short citation label, e.g. "Are You Ready? p. 35"
  docTitle: string;
  shortTitle: string;
  year: number;
  kind: string;
  section: string;
  page: number;
  url: string; // opens the PDF at the right page
  score: number;
  text: string;
};
