"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "listening" | "error";

interface Options {
  lang?: string;
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
}

// Minimal SpeechRecognition types (not in all TS DOM libs)
interface SR {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SRResult {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}

interface SREvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<SRResult>;
}

interface SRErrorEvent {
  readonly error: string;
}

interface SRConstructor {
  new (): SR;
}

function getSR(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: SRConstructor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition ??
    null
  );
}

export function useVoiceInput({ lang = "es-ES", onFinalTranscript, onInterimTranscript }: Options) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<SR | null>(null);
  const listeningRef = useRef(false);
  const onFinalRef = useRef(onFinalTranscript);
  const onInterimRef = useRef(onInterimTranscript);

  onFinalRef.current = onFinalTranscript;
  onInterimRef.current = onInterimTranscript;

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const buildRecognition = useCallback((currentLang: string): SR | null => {
    const SR = getSR();
    if (!SR) return null;

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = currentLang;

    r.onresult = (event: SREvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < (event.results as unknown as SRResult[]).length; i++) {
        const result = (event.results as unknown as SRResult[])[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) onFinalRef.current(text);
        } else {
          interim += result[0].transcript;
        }
      }
      onInterimRef.current?.(interim);
    };

    r.onerror = (event: SRErrorEvent) => {
      if (event.error === "aborted") return;
      if (event.error === "no-speech") return;
      const msg =
        event.error === "not-allowed"
          ? "Permiso de micrófono denegado. Habilitalo en la configuración del navegador."
          : "Error en reconocimiento de voz.";
      setErrorMsg(msg);
      setVoiceState("error");
      listeningRef.current = false;
      onInterimRef.current?.("");
    };

    r.onend = () => {
      if (listeningRef.current) {
        try { r.start(); } catch { /* ignore restart failure */ }
      } else {
        setVoiceState("idle");
        onInterimRef.current?.("");
      }
    };

    return r;
  }, []);

  const toggle = useCallback((currentLang?: string) => {
    if (!isSupported) {
      setErrorMsg("Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.");
      setVoiceState("error");
      return;
    }

    if (listeningRef.current) {
      listeningRef.current = false;
      recognitionRef.current?.stop();
      onInterimRef.current?.("");
    } else {
      setErrorMsg(null);
      listeningRef.current = true;
      const r = buildRecognition(currentLang ?? lang);
      if (!r) return;
      recognitionRef.current = r;
      setVoiceState("listening");
      try {
        r.start();
      } catch {
        listeningRef.current = false;
        setVoiceState("idle");
      }
    }
  }, [isSupported, buildRecognition, lang]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { voiceState, isSupported, errorMsg, toggle };
}
