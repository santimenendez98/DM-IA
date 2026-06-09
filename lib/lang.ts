import { useState, useEffect } from "react";

export type Lang = "es" | "en" | "pt";

const VALID: Lang[] = ["es", "en", "pt"];
const KEY = "hh_lang";
type Listener = (l: Lang) => void;

const listeners = new Set<Listener>();
let _current: Lang = "es";

export const langStore = {
  get(): Lang {
    return _current;
  },

  init() {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(KEY) as Lang | null;
    if (stored && VALID.includes(stored) && stored !== _current) {
      _current = stored;
    }
  },

  set(l: Lang) {
    _current = l;
    if (typeof window !== "undefined") localStorage.setItem(KEY, l);
    listeners.forEach((fn) => fn(l));
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useLang(): { lang: Lang; setLang: (l: Lang) => void } {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    langStore.init();
    setLangState(langStore.get());
    return langStore.subscribe(setLangState);
  }, []);

  return { lang, setLang: langStore.set };
}
