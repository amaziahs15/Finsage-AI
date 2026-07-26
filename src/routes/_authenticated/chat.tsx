import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Mic, Paperclip, Plus, Sparkles, ExternalLink, ShieldCheck, Volume2, Loader2, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Ask FinSage AI" }, { name: "robots", content: "noindex" }] }),
  component: ChatPage,
});

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  honesty_score?: number | null;
  honesty_breakdown?: Record<string, number> | null;
  sources?: string[] | null;
  streaming?: boolean;
};

type Convo = { id: string; title: string; updated_at: string };

// Minimal SpeechRecognition typing (browser API not in DOM lib)
type SpeechRecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> };
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function ChatPage() {
  const { t, lang } = useI18n();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setSpeakingId(null);
    setLoadingAudioId(null);
  }, []);

  const speak = useCallback(async (id: string, text: string) => {
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
  }, [speakingId, loadingAudioId, stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const loadConvos = useCallback(async () => {
    const { data } = await supabase.from("chat_conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50);
    setConvos((data as Convo[]) ?? []);
    return (data as Convo[]) ?? [];
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const { data } = await supabase.from("chat_messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
    setMessages(((data as unknown as Msg[]) ?? []).filter((m) => m.role === "user" || m.role === "assistant"));
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadConvos();
      if (list[0]) { setActiveId(list[0].id); await loadMessages(list[0].id); }
    })();
  }, [loadConvos, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, [activeId]);

  async function newChat() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("chat_conversations").insert({ user_id: u.user.id, title: "New chat" }).select().single();
    if (data) {
      setActiveId(data.id);
      setMessages([]);
      await loadConvos();
    }
  }

  async function ensureConvo(): Promise<string | null> {
    if (activeId) return activeId;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data } = await supabase.from("chat_conversations").insert({ user_id: u.user.id, title: "New chat" }).select().single();
    if (!data) return null;
    setActiveId(data.id);
    loadConvos();
    return data.id;
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");
    const cid = await ensureConvo();
    if (!cid) { setSending(false); return; }

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: msg };
    const assistantMsg: Msg = { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true };
    setMessages((m) => [...m, userMsg, assistantMsg]);

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { setSending(false); return; }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: cid, message: msg, language: lang }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setMessages((m) => m.map((x) => x.id === assistantMsg.id ? { ...x, content: `⚠️ ${res.status === 429 ? "Rate limited — please retry in a moment." : res.status === 402 ? "AI credits exhausted. Please upgrade your workspace plan." : errText || "Something went wrong."}`, streaming: false } : x));
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
              setMessages((m) => m.map((x) => x.id === assistantMsg.id ? { ...x, content: acc } : x));
            } else if (json.type === "done") {
              setMessages((m) => m.map((x) => x.id === assistantMsg.id ? { ...x, streaming: false, honesty_score: json.honesty_score, honesty_breakdown: json.honesty_breakdown, sources: json.sources } : x));
              loadConvos();
            }
          } catch { /* ignore */ }
        }
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function toggleVoice() {
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert("Voice input not supported in this browser."); return; }
    if (listening) { recognitionRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) interim += e.results[i][0].transcript;
      setInput(interim);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function onAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Client-side: text/CSV read inline; images/PDFs → describe file
    if (file.type.startsWith("text/") || file.name.match(/\.(csv|txt|md)$/i)) {
      const text = await file.text();
      send(`I've uploaded a file named "${file.name}". Contents:\n\n\`\`\`\n${text.slice(0, 4000)}\n\`\`\`\n\nPlease analyze this.`);
    } else {
      send(`I've uploaded a file "${file.name}" (${(file.size / 1024).toFixed(0)} KB, type: ${file.type}). Please note file parsing (OCR/PDF) is coming soon — describe what I should look for in this type of document.`);
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen">
      {/* Convo sidebar */}
      <aside className="hidden lg:flex lg:w-64 flex-col border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <button onClick={newChat} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy text-white py-2.5 text-sm font-semibold hover:bg-navy/90 transition-colors">
            <Plus className="h-4 w-4" /> {t("chat_new")}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("chat_history")}</p>
          {convos.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveId(c.id); loadMessages(c.id); }}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm truncate transition-colors ${activeId === c.id ? "bg-teal/10 text-navy font-medium" : "text-muted-foreground hover:bg-muted"}`}
            >
              {c.title || "New chat"}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card px-4 md:px-8 py-4">
          <h1 className="text-lg md:text-xl font-bold text-navy flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal" /> {t("chat_title")}
          </h1>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="inline-grid h-16 w-16 place-items-center rounded-2xl bg-navy-gradient text-white mb-4">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold text-navy">{t("chat_empty_title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("chat_empty_sub")}</p>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mx-auto">
                  {(["chat_suggest_1", "chat_suggest_2", "chat_suggest_3", "chat_suggest_4"] as const).map((k) => (
                    <button key={k} onClick={() => send(t(k))} className="text-left rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-teal transition-colors">
                      {t(k)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                m={m}
                speakingId={speakingId}
                loadingAudioId={loadingAudioId}
                onSpeak={speak}
              />
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-card px-4 md:px-8 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-border bg-background p-3 focus-within:border-teal transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={t("chat_placeholder")}
                rows={2}
                className="w-full resize-none bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <button onClick={toggleVoice} title={t("chat_voice")} className={`p-2 rounded-lg transition-colors ${listening ? "bg-red-500 text-white" : "hover:bg-muted text-muted-foreground"}`}>
                    <Mic className="h-4 w-4" />
                  </button>
                  <label className="p-2 rounded-lg cursor-pointer hover:bg-muted text-muted-foreground" title={t("chat_attach")}>
                    <Paperclip className="h-4 w-4" />
                    <input type="file" className="hidden" onChange={onAttach} accept=".txt,.csv,.md,image/*,.pdf" />
                  </label>
                </div>
                <button
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-teal/90 transition-colors"
                >
                  {sending ? t("chat_thinking") : (<><Send className="h-3.5 w-3.5" /> {t("chat_send")}</>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, speakingId, loadingAudioId, onSpeak }: {
  m: Msg;
  speakingId: string | null;
  loadingAudioId: string | null;
  onSpeak: (id: string, text: string) => void;
}) {
  const { t } = useI18n();
  const isUser = m.role === "user";
  const isSpeaking = speakingId === m.id;
  const isLoadingAudio = loadingAudioId === m.id;
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "bg-navy text-white rounded-2xl rounded-br-md px-4 py-3" : ""}`}>
        {isUser ? (
          <div className="whitespace-pre-wrap text-sm">{m.content}</div>
        ) : (
          <div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-code:text-teal prose-a:text-teal prose-table:text-sm prose-th:bg-muted">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ""}</ReactMarkdown>
              {m.streaming && <span className="inline-block w-2 h-4 bg-teal ml-1 animate-pulse align-middle" />}
            </div>
            {!m.streaming && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {typeof m.honesty_score === "number" && (
                  <HonestyCard score={m.honesty_score} breakdown={m.honesty_breakdown ?? undefined} />
                )}
                {m.content && (
                  <button
                    onClick={() => onSpeak(m.id, m.content)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                    aria-label={isSpeaking ? t("chat_stop_audio") : t("chat_listen")}
                    title={isSpeaking ? t("chat_stop_audio") : t("chat_listen")}
                  >
                    {isLoadingAudio ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> {t("chat_loading_audio")}</>
                    ) : isSpeaking ? (
                      <><Square className="h-3 w-3" /> {t("chat_stop_audio")}</>
                    ) : (
                      <><Volume2 className="h-3 w-3" /> {t("chat_listen")}</>
                    )}
                  </button>
                )}
              </div>
            )}
            {!m.streaming && m.sources && m.sources.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{t("chat_sources")}</p>
                <ul className="space-y-1">
                  {m.sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.startsWith("http") ? s : `https://${s}`} target="_blank" rel="noreferrer" className="text-xs text-teal hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> {s}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HonestyCard({ score, breakdown }: { score: number; breakdown?: Record<string, number> }) {
  const { t } = useI18n();
  const color = score >= 75 ? "text-teal" : score >= 50 ? "text-yellow-600" : "text-red-500";
  const bg = score >= 75 ? "bg-teal/10 border-teal/30" : score >= 50 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";
  return (
    <details className={`mt-3 rounded-xl border ${bg} p-3 glass`}>
      <summary className="cursor-pointer flex items-center justify-between text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className={`h-4 w-4 ${color}`} />
          {t("chat_honesty_score")}
        </span>
        <span className={`text-lg font-bold ${color}`}>{score}<span className="text-xs text-muted-foreground">/100</span></span>
      </summary>
      {breakdown && (
        <ul className="mt-3 space-y-1.5 text-xs">
          {Object.entries(breakdown).map(([k, v]) => (
            <li key={k} className="flex items-center justify-between">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-medium">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
