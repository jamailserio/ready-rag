"use client";

import { useChat } from "@ai-sdk/react";
import type { Message } from "ai";
import { useEffect, useRef, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { EXAMPLE_QUESTIONS, LIBRARY } from "@/lib/library";
import type { RetrievedSource } from "@/lib/types";

type SearchResult = { query: string; results: RetrievedSource[] };
type SourceWithCite = RetrievedSource & { cited: boolean };

/** All searchDocuments calls made while writing this answer. */
function searches(m: Message) {
  return (m.toolInvocations ?? []).filter((t) => t.toolName === "searchDocuments");
}

/** Unique sources across all searches in one answer; cited ones first. */
function collectSources(m: Message): SourceWithCite[] {
  const byRef = new Map<string, RetrievedSource>();
  for (const t of searches(m)) {
    if (t.state !== "result") continue;
    for (const s of (t.result as SearchResult).results ?? []) {
      const existing = byRef.get(s.ref);
      if (!existing || s.score > existing.score) byRef.set(s.ref, s);
    }
  }
  return [...byRef.values()]
    .map((s) => ({ ...s, cited: m.content.includes(`[${s.ref}]`) }))
    .sort((a, b) => Number(b.cited) - Number(a.cited) || b.score - a.score);
}

/** Turn "[Are You Ready? p. 35]" into a markdown link that opens that PDF page. */
function linkCitations(text: string, sources: RetrievedSource[]) {
  let out = text;
  for (const s of sources) out = out.split(`[${s.ref}]`).join(`[${s.ref}](${s.url})`);
  return out;
}

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, append, status, error, stop, reload, setMessages } = useChat({
    api: "/api/chat",
  });
  const busy = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function ask(q: string) {
    if (!busy) append({ role: "user", content: q });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter makes a new line
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (input.trim() && !busy) handleSubmit();
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ⛑️
          </span>
          <div>
            <h1>ReadyRAG</h1>
            <p>Disaster preparedness answers from official FEMA guides</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button className="ghost" onClick={() => setMessages([])} disabled={busy}>
            New chat
          </button>
        )}
      </header>

      <main className="thread">
        {messages.length === 0 ? (
          <EmptyState onPick={ask} />
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="row user">
                <div className="bubble">{m.content}</div>
              </div>
            ) : (
              <AssistantMessage key={m.id} message={m} />
            ),
          )
        )}

        {status === "submitted" && <p className="status">Thinking…</p>}

        {error && messages.length > 0 && (
          <div className="error" role="alert">
            Something went wrong. <button onClick={() => reload()}>Try again</button>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          placeholder="Ask about emergency plans, a specific hazard, or FEMA assistance…"
          rows={1}
          aria-label="Your question"
        />
        {busy ? (
          <button type="button" onClick={() => stop()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()}>
            Ask
          </button>
        )}
      </form>
      <p className="footnote">
        In an emergency, call 911. Answers can be wrong and some guides date from 2004. Check the cited page and{" "}
        <a href="https://www.ready.gov" target="_blank" rel="noreferrer">
          ready.gov
        </a>
        .
      </p>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <section className="empty">
      <h2>Ask a question about getting ready for, or recovering from, a disaster.</h2>
      <p className="lead">
        I search six FEMA publications and answer only from what they say, citing the page for every point. Click a citation to open
        that exact page of the PDF.
      </p>

      <h3>Try one of these</h3>
      <div className="chips">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button key={q} className="chip" onClick={() => onPick(q)}>
            {q}
          </button>
        ))}
      </div>

      <h3>What I&apos;ve read</h3>
      <ul className="library">
        {LIBRARY.map((d) => (
          <li key={d.id}>
            <a href={d.url} target="_blank" rel="noreferrer">
              {d.title}
            </a>
            <span className="meta">
              {d.kind} · {d.year}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">
        Not covered: local evacuation routes, live weather alerts, or current FEMA aid amounts. For those, check your local emergency
        management office or fema.gov.
      </p>
    </section>
  );
}

function AssistantMessage({ message }: { message: Message }) {
  const sources = collectSources(message);

  return (
    <div className="row assistant">
      <div className="answer">
        {searches(message).map((t) => (
          <p key={t.toolCallId} className="status">
            {t.state === "result"
              ? `🔎 Searched for “${(t.result as SearchResult).query}”: ${(t.result as SearchResult).results.length} passages`
              : `🔎 Searching FEMA documents${t.args?.query ? ` for “${t.args.query}”` : ""}…`}
          </p>
        ))}

        {message.content && (
          <div className="markdown">
            <ReactMarkdown
              components={{
                // open citation links (and any other link) in a new tab
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {linkCitations(message.content, sources)}
            </ReactMarkdown>
          </div>
        )}

        {sources.length > 0 && <Sources sources={sources} />}
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: SourceWithCite[] }) {
  const cited = sources.filter((s) => s.cited).length;
  return (
    <section className="sources" aria-label="Sources">
      <h4>
        Sources
        <span>{cited > 0 ? `${cited} cited · ${sources.length} retrieved` : `${sources.length} retrieved`}</span>
      </h4>
      <ol>
        {sources.map((s) => (
          <li key={s.ref} className={s.cited ? "cited" : ""}>
            <div className="source-head">
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.shortTitle}, p. {s.page}
              </a>
              <span className="badge">{s.year}</span>
              {s.cited && <span className="badge strong">cited</span>}
              <span className="score">match {s.score.toFixed(2)}</span>
            </div>
            <div className="source-section">{s.section}</div>
            <details>
              <summary>{s.text.slice(0, 150)}…</summary>
              <p>{s.text}</p>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
