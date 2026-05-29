"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { loader } from "@/lib/loader";
import s from "./messages.module.css";

// ── Types ──────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  setting: string;
  tone: string;
  started_at: string | null;
}

interface ChatMessage {
  id: string;
  campaign_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

interface Preview {
  content: string;
  username: string;
}

// ── Helpers ────────────────────────────────────────────────────

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hm = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return hm;
  return `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · ${hm}`;
}

const AVATAR_COLORS = ["#7b4ab8", "#4a8fd0", "#b84a4a", "#4ab880", "#b8924a", "#4ab8b8"] as const;

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ── Component ──────────────────────────────────────────────────

export default function Messages() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignParam = searchParams.get("campaign");

  const [campaigns, setCampaigns]         = useState<Campaign[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [previews, setPreviews]           = useState<Map<string, Preview>>(new Map());
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [sending, setSending]             = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const listRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load user + campaigns + previews ──────────────────────────
  useEffect(() => {
    getCurrUser().then((u) => {
      if (!u) { router.replace("/auth/login"); return; }
      setCurrentUserId(u.id);
    });

    Promise.all([
      fetch("/api/campaigns").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/campaigns/joined").then((r) => (r.ok ? r.json() : [])),
    ]).then(([owned, joined]: [Campaign[], Campaign[]]) => {
      const seen = new Set<string>();
      const all: Campaign[] = [];
      for (const c of [...owned, ...joined]) {
        if (!seen.has(c.id)) { seen.add(c.id); all.push(c); }
      }
      setCampaigns(all);
      if (all.length > 0) {
        const preferred = campaignParam && all.find((c) => c.id === campaignParam);
        setSelectedId(preferred ? campaignParam : all[0].id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    // Load sidebar previews (last message per campaign)
    fetch("/api/campaigns/chat/previews")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ campaign_id: string; content: string; username: string }>) => {
        setPreviews(new Map(data.map((p) => [p.campaign_id, { content: p.content, username: p.username }])));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Load messages when campaign changes ────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    setLoadingMsgs(true);
    setMessages([]);
    let stale = false;

    fetch(`/api/campaigns/${selectedId}/chat`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          console.error("[chat] GET failed:", r.status, err);
          return [];
        }
        return r.json();
      })
      .then((data: ChatMessage[]) => {
        if (stale) return;
        // Merge DB results with any real-time messages that arrived during the fetch
        setMessages((prev) => {
          const dbIds = new Set(data.map((m) => m.id));
          const rtOnly = prev.filter((m) => !dbIds.has(m.id));
          return [...data, ...rtOnly].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        });
        setLoadingMsgs(false);
      })
      .catch(() => { if (!stale) setLoadingMsgs(false); });

    return () => { stale = true; };
  }, [selectedId]);

  // ── Presence heartbeat (suppress notifications while viewing) ──
  useEffect(() => {
    if (!selectedId) return;
    const ping = () => {
      fetch(`/api/campaigns/${selectedId}/chat/read`, { method: "PATCH" }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // ── Scroll to bottom on new messages ──────────────────────────
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Real-time ─────────────────────────────────────────────────
  // Uses broadcast (immediate, same channel name the server targets) AND
  // postgres_changes (reliable fallback once the SQL migration is applied).
  // Both sit on the same channel object; dedup by id prevents doubles.
  useEffect(() => {
    if (!selectedId) return;
    const supabase = createClient();

    const addMsg = (newMsg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setPreviews((prev) => {
        const next = new Map(prev);
        next.set(newMsg.campaign_id, { content: newMsg.content, username: newMsg.username });
        return next;
      });
    };

    const ch = supabase
      .channel(`chat:${selectedId}`)
      .on("broadcast", { event: "new_message" }, ({ payload }: { payload: unknown }) => {
        addMsg(payload as ChatMessage);
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "campaign_chat",
          filter: `campaign_id=eq.${selectedId}`,
        },
        (payload: { new: unknown }) => {
          addMsg(payload.new as ChatMessage);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [selectedId]);

  // ── Send message ───────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      await fetch(`/api/campaigns/${selectedId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, selectedId, sending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    },
    [sendMessage],
  );

  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const selectedCampaign = campaigns.find((c) => c.id === selectedId);

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />

      <div className={`${s.layout}${selectedId ? ` ${s.layoutChat}` : ""}`}>
        {/* ── Sidebar ── */}
        <aside className={s.sidebar}>
          <div className={s.sidebarHeader}>
            <button
              className={s.backBtn}
              type="button"
              onClick={() => { loader.start(); router.push("/dashboard"); }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path d="M7 1L3 5L7 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Taberna
            </button>
            <span className={s.sidebarTitle}>Mensajes</span>
          </div>

          <div className={s.campaignList}>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={s.skeleton} style={{ height: 54, margin: "4px 10px", borderRadius: 3 }} />
                ))
              : campaigns.length === 0
              ? <div className={s.emptySidebar}>No perteneces a ninguna campaña.</div>
              : campaigns.map((c) => {
                  const preview = previews.get(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`${s.campaignItem}${c.id === selectedId ? ` ${s.campaignItemActive}` : ""}`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className={s.campaignItemName}>{c.name}</div>
                      <div className={s.campaignItemSub}>
                        {preview
                          ? <><span className={s.previewUser}>{preview.username}:</span> {truncate(preview.content, 38)}</>
                          : "Sin mensajes"}
                      </div>
                    </button>
                  );
                })}
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <main className={s.chatPanel}>
          {!selectedId ? (
            <div className={s.noCampaign}>
              <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
                <rect x="4" y="8" width="32" height="22" rx="3" fill="none" stroke="#3a2808" strokeWidth="1.6" />
                <path d="M12 30l-4 4v0h8" fill="none" stroke="#3a2808" strokeWidth="1.6" strokeLinejoin="round" />
                <line x1="11" y1="16" x2="29" y2="16" stroke="#3a2808" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="11" y1="21" x2="23" y2="21" stroke="#3a2808" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <p>Selecciona una campaña para ver los mensajes.</p>
            </div>
          ) : (
            <>
              <div className={s.chatHeader}>
                <div className={s.chatHeaderInner}>
                  <button
                    className={s.mobileChatBack}
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="Volver a campañas"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                      <path d="M7 1L3 5L7 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Volver
                  </button>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <rect x="1" y="2" width="12" height="8" rx="1.5" fill="none" stroke="#c9a030" strokeWidth="1.2" />
                    <path d="M4 10l-1.5 2" stroke="#c9a030" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span className={s.chatTitle}>{selectedCampaign?.name ?? ""}</span>
                </div>
              </div>

              <div className={s.messageList} ref={listRef}>
                {loadingMsgs ? (
                  <div className={s.loadingMsgs}>
                    <div className={s.loadingDot} />
                    <div className={s.loadingDot} />
                    <div className={s.loadingDot} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className={s.emptyChat}>
                    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
                      <rect x="3" y="6" width="30" height="20" rx="3" fill="none" stroke="#3a2808" strokeWidth="1.5" />
                      <path d="M10 26l-3 4h6" fill="none" stroke="#3a2808" strokeWidth="1.5" strokeLinejoin="round" />
                      <line x1="10" y1="14" x2="26" y2="14" stroke="#3a2808" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="10" y1="19" x2="20" y2="19" stroke="#3a2808" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <p>El pergamino está en blanco. Sé el primero en escribir.</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const prev = messages[i - 1];
                    const sameUser = prev?.user_id === msg.user_id;
                    const gap = prev
                      ? (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) / 60_000
                      : Infinity;
                    const grouped = sameUser && gap < 2;
                    const isOwn = msg.user_id === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`${s.msg}${grouped ? ` ${s.msgGrouped}` : ""}${isOwn ? ` ${s.msgOwn}` : ""}`}
                      >
                        {!grouped && (
                          <div className={s.msgHeader}>
                            <span className={s.msgAvatar} style={{ background: avatarColor(msg.user_id) }}>
                              {msg.username[0]?.toUpperCase() ?? "?"}
                            </span>
                            <span className={`${s.msgUser}${isOwn ? ` ${s.msgUserOwn}` : ""}`}>
                              {msg.username}
                            </span>
                            <span className={s.msgTime}>{timeLabel(msg.created_at)}</span>
                          </div>
                        )}
                        <div className={`${s.msgContent}${grouped ? ` ${s.msgContentGrouped}` : ""}`}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className={s.inputArea}>
                <textarea
                  ref={inputRef}
                  className={s.input}
                  placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onInput={handleInput}
                  rows={1}
                  maxLength={500}
                  disabled={sending}
                />
                <button
                  type="button"
                  className={s.sendBtn}
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  aria-label="Enviar mensaje"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <path d="M1 7L13 1.5L9 7L13 12.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <line x1="9" y1="7" x2="5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
