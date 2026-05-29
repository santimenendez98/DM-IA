"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loader } from "@/lib/loader";
import s from "./NotificationsBell.module.css";

// ── Types ──────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function notifHref(n: AppNotification): string | null {
  const cid = n.data.campaign_id as string | undefined;
  if (!cid) return null;
  if (n.type === "join_request") return `/campaigns/${cid}`;
  if (n.type === "request_accepted" || n.type === "player_joined" || n.type === "lobby_entered") return `/campaigns/${cid}/lobby`;
  if (n.type === "chat_message") return `/messages?campaign=${cid}`;
  return null;
}

// ── Icon per type ──────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  switch (type) {
    case "join_request":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="5" cy="3.8" r="2" fill="none" stroke="#c9a030" strokeWidth="1.2" />
          <path d="M1 12.5c0-2.4 1.8-4.2 4-4.2" fill="none" stroke="#c9a030" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="10" y1="7" x2="10" y2="13" stroke="#6acc6a" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="10" x2="13" y2="10" stroke="#6acc6a" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "request_accepted":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="#6acc6a" strokeWidth="1.2" />
          <path d="M4 7l2 2 4-4" stroke="#6acc6a" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "request_rejected":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="#d07070" strokeWidth="1.2" />
          <line x1="4.5" y1="4.5" x2="9.5" y2="9.5" stroke="#d07070" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9.5" y1="4.5" x2="4.5" y2="9.5" stroke="#d07070" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "expelled":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="5" cy="3.8" r="2" fill="none" stroke="#d07070" strokeWidth="1.2" />
          <path d="M1 12.5c0-2.4 1.8-4.2 4-4.2" fill="none" stroke="#d07070" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="9" y1="7.5" x2="13" y2="11.5" stroke="#d07070" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="13" y1="7.5" x2="9" y2="11.5" stroke="#d07070" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "player_joined":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="4" cy="3.5" r="1.8" fill="none" stroke="#c9a030" strokeWidth="1.2" />
          <circle cx="10" cy="3.5" r="1.8" fill="none" stroke="#c9a030" strokeWidth="1.2" />
          <path d="M1 12c0-2 1.3-3.5 3-3.5" fill="none" stroke="#c9a030" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M13 12c0-2-1.3-3.5-3-3.5" fill="none" stroke="#c9a030" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "campaign_deleted":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M3 4h8M5.5 4V3h3v1M5 4v7h4V4" stroke="#d07070" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "lobby_entered":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="5" cy="3.5" r="1.8" fill="none" stroke="#c9a030" strokeWidth="1.2" />
          <path d="M1 12c0-2.2 1.8-4 4-4" fill="none" stroke="#c9a030" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M9 7v5M9 7l2 2M9 7l-2 2" stroke="#6acc6a" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chat_message":
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <rect x="1" y="2" width="12" height="8" rx="1.5" fill="none" stroke="#c9a030" strokeWidth="1.2" />
          <path d="M4 10l-1.5 2.5" stroke="#c9a030" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="4" y1="5.5" x2="10" y2="5.5" stroke="#c9a030" strokeWidth="1.1" strokeLinecap="round" />
          <line x1="4" y1="7.5" x2="7.5" y2="7.5" stroke="#c9a030" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="#c9a030" strokeWidth="1.2" />
          <line x1="7" y1="4" x2="7" y2="7.5" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="10" r="0.8" fill="#c9a030" />
        </svg>
      );
  }
}

// ── Component ──────────────────────────────────────────────────

interface Props {
  userId: string;
}

export default function NotificationsBell({ userId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  // Fetch on mount
  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AppNotification[]) => setNotifications(data))
      .catch(() => {});
  }, []);

  // Real-time new notifications
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("broadcast", { event: "new_notification" }, ({ payload }: { payload: unknown }) => {
        const notif = payload as AppNotification;
        setNotifications((prev) => [notif, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Close panel on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const deleteOne = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    fetch(`/api/notifications/${id}`, { method: "DELETE" }).catch(() => {});
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const deleteAll = useCallback(async () => {
    await fetch("/api/notifications", { method: "DELETE" });
    setNotifications([]);
  }, []);

  const handleClick = useCallback(
    async (notif: AppNotification) => {
      if (!notif.read) {
        fetch(`/api/notifications/${notif.id}`, { method: "PATCH" }).catch(() => {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
        );
      }
      const href = notifHref(notif);
      if (href) {
        setOpen(false);
        loader.start();
        router.push(href);
      }
    },
    [router],
  );

  return (
    <div className={s.wrap} ref={panelRef}>
      <button
        className={s.bell}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-label="Notificaciones"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5v3l1.5 2.5H2L3.5 9V6A4.5 4.5 0 0 1 8 1.5Z"
            fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
          />
          <path d="M6 13a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className={s.badge}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className={s.panel}>
          <div className={s.panelHeader}>
            <span className={s.panelTitle}>Notificaciones</span>
            <div className={s.panelActions}>
              {unread > 0 && (
                <button className={s.headerBtn} onClick={markAllRead} type="button">
                  Leído
                </button>
              )}
              {notifications.length > 0 && (
                <button className={`${s.headerBtn} ${s.headerBtnDelete}`} onClick={deleteAll} type="button">
                  Borrar todo
                </button>
              )}
            </div>
          </div>

          <div className={s.list}>
            {notifications.length === 0 ? (
              <div className={s.empty}>
                <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
                  <path
                    d="M15 3a7 7 0 0 1 7 7v5l2 3H6l2-3v-5a7 7 0 0 1 7-7Z"
                    fill="none" stroke="#3a2808" strokeWidth="1.4" strokeLinejoin="round"
                  />
                  <path d="M12 21a3 3 0 0 0 6 0" fill="none" stroke="#3a2808" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <p>Sin notificaciones</p>
              </div>
            ) : (
              notifications.map((n) => {
                const clickable = notifHref(n) !== null;
                return (
                  <div
                    key={n.id}
                    className={`${s.item}${n.read ? "" : ` ${s.itemUnread}`}`}
                  >
                    <button
                      className={`${s.itemMain}${!clickable ? ` ${s.itemNoNav}` : ""}`}
                      onClick={() => handleClick(n)}
                      type="button"
                    >
                      <div className={s.itemIcon}>
                        <NotifIcon type={n.type} />
                      </div>
                      <div className={s.itemBody}>
                        <div className={s.itemTitle}>{n.title}</div>
                        {n.body && <div className={s.itemText}>{n.body}</div>}
                        <div className={s.itemTime}>{timeAgo(n.created_at)}</div>
                      </div>
                      {!n.read && <div className={s.dot} />}
                    </button>
                    <button
                      className={s.deleteBtn}
                      onClick={(e) => deleteOne(e, n.id)}
                      type="button"
                      aria-label="Eliminar notificación"
                    >
                      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
                        <line x1="1" y1="1" x2="8" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        <line x1="8" y1="1" x2="1" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
