// Turns raw PDF page text into clean, overlapping chunks with metadata.
// Pure functions only (no network), so `npm run seed:dry` can test them.

import type { ChunkMetadata, SourceDoc } from "./types";

/** Clean one page of extracted text. */
export function cleanPageText(raw: string, doc: SourceDoc): string {
  const strip = doc.stripPatterns.map((p) => new RegExp(p));

  let lines = raw
    .replace(/\u00a0/g, " ")
    .replace(/[\uf000-\uf0ff\u25aa\u25cf]/g, "•") // symbol-font bullet glyphs -> •
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
    .filter((l) => !strip.some((re) => re.test(l)))
    .filter((l) => !/^[_\s]+$/.test(l)); // blank "fill in" lines

  // Re-attach drop caps: "D" + "isasters disrupt..." -> "Disasters disrupt..."
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^[A-Z]$/.test(lines[i]) && i + 1 < lines.length && /^[a-z]/.test(lines[i + 1])) {
      merged.push(lines[i] + lines[i + 1]);
      i++;
    } else {
      merged.push(lines[i]);
    }
  }
  lines = merged;

  // Join lines into paragraphs. Keep a line break before bullets and
  // numbered steps so lists stay readable; otherwise join with a space.
  let out = "";
  for (const line of lines) {
    const startsItem = /^(•|-|\d{1,2}[.)]\s|[a-z][.)]\s)/.test(line);
    if (out === "") out = line;
    else if (out.endsWith("-") && /^[a-z]/.test(line)) out = out.slice(0, -1) + line; // re-join hyphenated words
    else if (startsItem) out += "\n" + line;
    else out += " " + line;
  }
  return out.replace(/[ \t]+/g, " ").trim();
}

/** Which section a PDF page belongs to (last section starting on or before it). */
export function sectionForPage(doc: SourceDoc, page: number): string {
  let title = doc.shortTitle;
  for (const s of doc.sections) {
    if (s.page <= page) title = s.title;
  }
  return title;
}

/**
 * Split text into ~size-character chunks with `overlap` characters of overlap.
 * Prefers to break at a line break, then a sentence end, then a space.
 */
export function splitText(text: string, size: number, overlap: number): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const minBreak = Math.floor(size * 0.5); // never make a chunk smaller than half size
      const candidates = [window.lastIndexOf("\n"), window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf(" ")];
      const best = candidates.find((i) => i >= minBreak);
      if (best !== undefined && best > 0) end = start + best + 1;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    // Step back by `overlap`, then forward to the next word boundary.
    let next = Math.max(end - overlap, start + 1);
    const space = text.indexOf(" ", next);
    if (space !== -1 && space < end) next = space + 1;
    start = next;
  }
  return chunks.filter(Boolean);
}

export type Chunk = { id: string; embedText: string; metadata: ChunkMetadata };

/**
 * Build all chunks for one document. Chunks never cross a page, so every
 * chunk has exactly one page number to cite.
 */
export function chunkDocument(
  doc: SourceDoc,
  pages: string[], // pages[0] is PDF page 1
  opts: { size: number; overlap: number; minChars: number },
): Chunk[] {
  const chunks: Chunk[] = [];
  const skip = new Set(doc.skipPages);
  const seen = new Set<string>(); // drop exact duplicate chunks

  pages.forEach((raw, i) => {
    const page = i + 1;
    if (skip.has(page)) return;
    const text = cleanPageText(raw, doc);
    if (text.length < opts.minChars) return;
    const section = sectionForPage(doc, page);

    splitText(text, opts.size, opts.overlap).forEach((piece, chunkIndex) => {
      if (piece.length < opts.minChars) return;
      const key = piece.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      chunks.push({
        id: `${doc.id}-p${page}-c${chunkIndex}`,
        // A short header (document + section) is embedded with the chunk so
        // that a question like "flood insurance" also matches by topic.
        embedText: `${doc.shortTitle} (${doc.year}) - ${section}\n${piece}`,
        metadata: {
          docId: doc.id,
          docTitle: doc.title,
          shortTitle: doc.shortTitle,
          year: doc.year,
          kind: doc.kind,
          file: doc.file,
          page,
          section,
          chunkIndex,
          text: piece,
        },
      });
    });
  });
  return chunks;
}
