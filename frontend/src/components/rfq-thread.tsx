"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export type RfqThreadMessage = {
  id: number;
  body: string;
  createdAt: string;
  author: { name: string; role: string; company?: string | null };
};

export function RfqThread({
  rfqId,
  messages,
  token,
  onPosted,
}: {
  rfqId: number;
  messages: RfqThreadMessage[];
  token: string;
  onPosted: () => Promise<void> | void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/rfqs/${rfqId}/messages`, {
        method: "POST",
        token,
        body: { body: body.trim() },
      });
      setBody("");
      await onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Conversation</div>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-[11px] text-slate-500">No notes yet. Buyer and sales can write here.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="rounded-lg bg-white border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-900">
                  {message.author.name}
                  <span className="ml-1 font-normal text-slate-500">{message.author.role.replace(/_/g, " ")}</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(message.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{message.body}</p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={send} className="space-y-2">
        <textarea
          className="w-full rounded-md border px-3 py-2 text-xs min-h-[64px] bg-white"
          placeholder="Write a note the other party will see..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send note"}
        </button>
      </form>
    </div>
  );
}
