// Floating chatbot widget available on every authenticated page. Reuses the
// same /api/chat backend as the full chat page (with Honesty Score, sources,
// user-data grounding). Collapsible; doesn't block key UI on mobile. Hides
// itself on the /chat route (the full page already provides the experience).
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useRouterState, Link } from "@tanstack/react-router";
import { MessageSquare, X, Send, Sparkles, ExternalLink, ShieldCheck, Volume2, Loader2, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  honesty_score?: number | null;
  sources?: string[] | null;
  streaming?: boolean;
};

// Route path → short human hint injected into the backend prompt.
const PAGE_TOPIC: Record<string, string> = {
  "/dashboard": "Dashboard (financial overview)",
  "/budget": "Budgets (category limits vs actuals)",
  "/transactions": "Transactions (income & expenses)",
  "/investment": "Investment basics & calculator",
  "/compliance": "Compliance deadlines (GST/TDS/ROC)",
  "/schemes": "Government schemes for MSMEs",
  "/settings": "Account settings",
};

export function ChatWidget() {
  const { t, lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setSpeakingId(null);
    setLoadingAudioId(null);
  }

  async function speak(id: string, text: string) {
    if (speakingId === id || loadingAudioId === id) { stopAudio(); return; }
    stopAudio();
    const clean = text.replace(/```[\s\S]*?```/g, "").replace(/[#>*_`\[\]()]/g, "").trim();
    if (!clean) return;
    setLoadingAudioId(id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { setLoadingAudioId(null); return; }
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) { setLoadingAudioId(null); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      setLoadingAudioId(null);
      setSpeakingId(id);
      await audio.play();
    } catch {
      setLoadingAudioId(null);
    }
  }

  useEffect(() => () => stopAudio(), []);

  // Hide the floating widget on the full chat page.
  const hidden = pathname.startsWith("/chat");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function ensureConvo(): Promise<string | null> {
    if (convoId) return convoId;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data } = await supabase
      .from("chat_conversations")
      .insert({ user_id: u.user.id, title: "Quick chat" })
      .select()
      .single();
    if (!data) return null;
    setConvoId(data.id);
    return data.id;
  }

  async function send() {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");
    const cid = await ensureConvo();
    if (!cid) { setSending(false); return; }

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: msg };
    const asstMsg: Msg = { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true };
    setMessages((m) => [...m, userMsg, asstMsg]);

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { setSending(false); return; }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversation_id: cid,
          message: msg,
          language: lang,
          page_context: PAGE_TOPIC[pathname] ?? undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setMessages((m) => m.map((x) => x.id === asstMsg.id ? { ...x, content: `⚠️ ${res.status === 429 ? "Rate limited — please retry in a moment." : res.status === 402 ? "AI credits exhausted." : errText || "Something went wrong."}`, streaming: false } : x));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const p of parts) {
          const line = p.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim());
            if (json.type === "delta") {
              acc += json.text;
              setMessages((m) => m.map((x) => x.id === asstMsg.id ? { ...x, content: acc } : x));
            } else if (json.type === "done") {
              setMessages((m) => m.map((x) => x.id === asstMsg.id ? { ...x, streaming: false, honesty_score: json.honesty_score, sources: json.sources } : x));
            }
          } catch { /* ignore */ }
        }
      }
    } finally {
      setSending(false);
    }
  }

  if (hidden) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("chat_title")}
          className="fixed bottom-4 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-teal text-white shadow-lg hover:bg-teal/90 transition-colors md:bottom-6 md:right-6"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div className="fixed inset-x-2 bottom-2 z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:w-96 md:h-[560px] h-[80vh]">
          <div className="flex items-center justify-between border-b border-border bg-navy px-4 py-3 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-teal shrink-0" />
              <span className="font-semibold text-sm truncate">{t("chat_title")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/chat"
                className="rounded p-1.5 text-white/80 hover:bg-white/10"
                aria-label={t("app_chat")}
                onClick={() => setOpen(false)}
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1.5 text-white/80 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-teal/15 text-teal">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p>{t("chat_empty_sub")}</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] text-sm ${m.role === "user" ? "bg-navy text-white rounded-2xl rounded-br-md px-3 py-2" : "text-foreground"}`}>
                  {m.role === "user" ? (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <div>
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-a:text-teal prose-code:text-teal">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ""}</ReactMarkdown>
                        {m.streaming && <span className="inline-block w-1.5 h-3 bg-teal ml-1 animate-pulse align-middle" />}
                      </div>
                      {!m.streaming && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {typeof m.honesty_score === "number" && (
                            <div className="inline-flex items-center gap-1 rounded-full bg-teal/10 border border-teal/30 px-2 py-0.5 text-xs text-teal font-medium">
                              <ShieldCheck className="h-3 w-3" /> {m.honesty_score}/100
                            </div>
                          )}
                          {m.content && (
                            <button
                              onClick={() => speak(m.id, m.content)}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                              aria-label={speakingId === m.id ? "Stop audio" : "Listen"}
                              title={speakingId === m.id ? "Stop" : "Listen"}
                            >
                              {loadingAudioId === m.id ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Loading</>
                              ) : speakingId === m.id ? (
                                <><Square className="h-3 w-3" /> Stop</>
                              ) : (
                                <><Volume2 className="h-3 w-3" /> Listen</>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                      {!m.streaming && m.sources && m.sources.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {m.sources.slice(0, 3).map((s, i) => (
                            <li key={i}>
                              <a href={s.startsWith("http") ? s : `https://${s}`} target="_blank" rel="noreferrer" className="text-xs text-teal hover:underline">
                                {s}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-2">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-teal">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder={t("chat_placeholder")}
                className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:text-muted-foreground max-h-28"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="rounded-lg bg-teal text-white p-2 disabled:opacity-50 hover:bg-teal/90"
                aria-label={t("chat_send")}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
