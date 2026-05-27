"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { loader } from "@/lib/loader";

// ── Overlay + spinner ──────────────────────────────────────────
// Direct DOM manipulation avoids calling setState during React's
// useInsertionEffect phase (triggered by Next.js internals).

function Overlay() {
  const ref   = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return loader.subscribe((active) => {
      clearTimeout(timer.current);

      if (active) {
        el.removeAttribute("data-fading");
        el.style.removeProperty("display");
      } else {
        el.dataset.fading = "true";
        timer.current = setTimeout(() => {
          if (ref.current) ref.current.style.display = "none";
        }, 320);
      }
    });
  }, []);

  return (
    <div ref={ref} className="g-overlay" style={{ display: "none" }} aria-hidden>
      <div className="g-spinner">
        <div className="g-spinner-dot" />
      </div>
    </div>
  );
}

// ── Route watcher ──────────────────────────────────────────────

function RouteWatcher() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    loader.stop();
  }, [pathname, searchParams]);

  useEffect(() => {
    function onAnchorClick(e: MouseEvent) {
      const a = (e.target as Element).closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) return;
      loader.start();
    }

    const origPush    = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      origPush(...args);
      loader.start();
    };

    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      origReplace(...args);
      loader.start();
    };

    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      history.pushState    = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  return null;
}

// ── Export ─────────────────────────────────────────────────────

export function GlobalLoader() {
  return (
    <>
      <Overlay />
      <Suspense>
        <RouteWatcher />
      </Suspense>
    </>
  );
}
