// Extract the text of every page of a PDF using Mozilla's pdf.js.
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPages(path: string): Promise<string[]> {
  const data = new Uint8Array(await readFile(path));
  const task = getDocument({ data, useSystemFonts: true, disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      if (item.hasEOL) text += "\n";
    }
    pages.push(text);
  }
  await task.destroy();
  return pages;
}
