"use client";

import { useRef, useState } from "react";

type Role = "user" | "assistant";

type Msg = { role: Role; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    scrollDown();

    let assistant = "";
    setMessages([...next, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        throw new Error(errText || res.statusText);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += dec.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: assistant }]);
        scrollDown();
      }
      void fetch("/api/vocab/ingest-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: assistant }),
      }).catch(() => {});
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "Impossible de joindre le tuteur pour le moment. Réessaie dans un instant.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollDown();
    }
  }

  return (
    <div className="flex min-h-[min(70dvh,calc(100dvh-10rem))] flex-col">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
          Conversation
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          Écris en français (ou mélange) — le tuteur répond en streaming.
        </p>
      </div>

      <div className="card-glass flex max-h-[min(52dvh,32rem)] flex-1 flex-col gap-3 overflow-y-auto rounded-2xl p-3 sm:max-h-[min(58dvh,36rem)] sm:rounded-3xl sm:p-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-[var(--muted)]">
            Dis bonjour ou pose une question sur la grammaire.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[min(95%,22rem)] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm sm:max-w-[min(95%,26rem)] sm:rounded-3xl sm:text-base ${
              m.role === "user"
                ? "ml-auto bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] font-medium text-white ring-1 ring-white/25"
                : "mr-auto border border-[color-mix(in_oklab,var(--accent)_15%,transparent)] bg-[color-mix(in_oklab,var(--accent-soft)_55%,var(--paper))] text-[var(--ink)]"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ton message…"
          className="card-glass min-h-[3.25rem] flex-1 rounded-2xl border-2 border-[color-mix(in_oklab,var(--accent)_22%,transparent)] px-4 text-[15px] outline-none ring-0 transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_35%,transparent)] sm:min-h-[3.5rem] sm:rounded-3xl sm:text-base"
          disabled={loading}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary min-h-[3.25rem] shrink-0 rounded-2xl px-6 text-base font-bold disabled:opacity-45 sm:min-h-[3.5rem] sm:rounded-3xl sm:px-8"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
