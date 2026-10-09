/**
 * Chat endpoint: streaming answers with RAG implemented as a tool call.
 *
 * The model decides when to call `searchDocuments`. The tool embeds the
 * query, searches Upstash, and returns passages with a citation ref, title,
 * year, section and page. The UI renders those as sources under the answer.
 *
 * Runs only on the server: OPENAI_API_KEY and the Upstash token are never
 * sent to the browser (none of them use the NEXT_PUBLIC_ prefix).
 */
import { openai } from "@ai-sdk/openai";
import { streamText, tool, type Message } from "ai";
import { z } from "zod";
import sourcesJson from "@/data/sources.json";
import { CHAT_MODEL } from "@/lib/config";
import { SEARCH_TOOL_DESCRIPTION, SYSTEM_PROMPT } from "@/lib/prompt";
import { searchDocuments } from "@/lib/search";
import type { SourceDoc } from "@/lib/types";

export const maxDuration = 30; // seconds

const docIds = (sourcesJson as SourceDoc[]).map((d) => d.id) as [string, ...string[]];

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json();

  // If the user pressed Stop mid-search, the history contains a tool call
  // with no result, which streamText rejects. Drop unfinished tool calls.
  const history = messages.slice(-12).map((m) => ({
    ...m,
    toolInvocations: m.toolInvocations?.filter((t) => t.state === "result"),
    parts: m.parts?.filter((p) => p.type !== "tool-invocation" || p.toolInvocation.state === "result"),
  }));

  const result = streamText({
    model: openai(CHAT_MODEL),
    system: SYSTEM_PROMPT,
    messages: history, // last 12 messages only: keeps cost and latency down
    temperature: 0.2,
    tools: {
      searchDocuments: tool({
        description: SEARCH_TOOL_DESCRIPTION,
        parameters: z.object({
          query: z.string().describe("A specific natural-language search phrase."),
          docId: z.enum(docIds).optional().describe("Only search this one document."),
        }),
        execute: async ({ query, docId }) => {
          const results = await searchDocuments(query, docId);
          return { query, results };
        },
      }),
    },
    // search -> (optional second search) -> answer
    maxSteps: 4,
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error) => {
      console.error(error);
      return "Sorry, something went wrong while answering. Please try again.";
    },
  });
}
