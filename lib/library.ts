// Public, browser-safe information about the document library and the
// example questions shown in the empty state. Contains no secrets.
import sourcesJson from "@/data/sources.json";
import type { SourceDoc } from "./types";

export const LIBRARY = (sourcesJson as SourceDoc[]).map((d) => ({
  id: d.id,
  title: d.title,
  shortTitle: d.shortTitle,
  year: d.year,
  kind: d.kind,
  url: `/docs/${d.file}`,
}));

export const EXAMPLE_QUESTIONS = [
  "What should go in a basic disaster supplies kit?",
  "What should I do if I'm driving and a flash flood hits?",
  "How do I apply for FEMA help after a disaster, and can I appeal?",
  "How can someone who uses a wheelchair prepare to evacuate?",
  "Which financial documents should I keep safe before a hurricane?",
  "What do Long-Term Recovery Groups and nonprofits do after a disaster?",
];
