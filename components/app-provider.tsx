"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Level, LocalLearningState } from "@/lib/types";
import {
  initialState,
  loadState,
  localDate,
  recordAttempt,
  saveState,
  startDailyCourse,
  type RecordAttemptInput,
} from "@/lib/local-store";

export type SyncStatus = "local" | "loading" | "syncing" | "synced" | "error";

interface CloudMutation {
  id: string;
  url: string;
  method: "POST" | "PUT" | "PATCH";
  body: unknown;
}

interface AppContextValue {
  state: LocalLearningState;
  hydrated: boolean;
  syncStatus: SyncStatus;
  syncMessage?: string;
  canRecordProgress: boolean;
  retrySync: () => void;
  setLevel: (level: Level) => void;
  assignCourse: (courseId: string) => string;
  submitAttempt: (input: RecordAttemptInput) => void;
  toggleHard: (entryId: string) => void;
  setSpeechSettings: (voiceUri: string | undefined, rate: number) => void;
}

const OUTBOX_KEY = "french-vocabulary-pwa:cloud-outbox:v1";
const AppContext = createContext<AppContextValue | null>(null);

function readOutbox() {
  try {
    return JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]") as CloudMutation[];
  } catch {
    return [];
  }
}

function writeOutbox(queue: CloudMutation[]) {
  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncMessage, setSyncMessage] = useState<string>();
  const [online, setOnline] = useState(true);
  const outboxRef = useRef<CloudMutation[]>([]);
  const flushingRef = useRef(false);
  const cloudConfigured = true;

  const flushOutbox = useCallback(async (forceRefresh = false) => {
    if (!cloudConfigured || flushingRef.current || (outboxRef.current.length === 0 && !forceRefresh)) return;
    if (!navigator.onLine) {
      setSyncStatus("error");
      setSyncMessage("当前离线，学习记录尚未同步。联网后请重试。");
      return;
    }
    flushingRef.current = true;
    setSyncStatus("syncing");
    setSyncMessage(undefined);
    let shouldContinue = false;
    try {
      while (outboxRef.current.length) {
        const mutation = outboxRef.current[0];
        const response = await fetch(mutation.url, {
          method: mutation.method,
          headers: { "Content-Type": "application/json", "X-Idempotency-Key": mutation.id },
          body: JSON.stringify(mutation.body),
          cache: "no-store",
        });
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(payload?.error ?? `同步失败（${response.status}）`);
        }
        outboxRef.current.shift();
        writeOutbox(outboxRef.current);
      }
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("操作已保存，但刷新云端状态失败。");
      if (response.ok && outboxRef.current.length === 0) {
        const cloud = await response.json() as LocalLearningState;
        setState((current) => ({ ...cloud, voiceUri: current.voiceUri, speechRate: current.speechRate }));
      }
      setSyncStatus(outboxRef.current.length ? "syncing" : "synced");
      shouldContinue = outboxRef.current.length > 0;
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(error instanceof Error ? error.message : "同步失败，请重试。");
    } finally {
      flushingRef.current = false;
      if (shouldContinue) queueMicrotask(() => void flushOutbox());
    }
  }, [cloudConfigured]);

  const enqueueMutation = useCallback((mutation: CloudMutation) => {
    if (!cloudConfigured) return;
    outboxRef.current.push(mutation);
    writeOutbox(outboxRef.current);
    setSyncStatus("syncing");
    void flushOutbox();
  }, [cloudConfigured, flushOutbox]);

  useEffect(() => {
    const local = loadState();
    const pending = cloudConfigured ? readOutbox() : [];
    outboxRef.current = pending;
    setState(local);
    if (pathname === "/login" || pathname === "/offline") {
      setSyncStatus("synced");
      setHydrated(true);
      return;
    }
    if (!cloudConfigured) {
      setSyncStatus("local");
      setHydrated(true);
      return;
    }
    fetch("/api/state", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { window.location.href = "/login"; return null; }
        if (!response.ok) throw new Error("无法读取云端学习记录。");
        return response.json() as Promise<LocalLearningState>;
      })
      .then((cloud) => {
        if (cloud && pending.length === 0) {
          setState({ ...cloud, voiceUri: local.voiceUri, speechRate: local.speechRate });
        }
        setSyncStatus(pending.length ? "syncing" : "synced");
      })
      .catch((error) => {
        setSyncStatus("error");
        setSyncMessage(error instanceof Error ? error.message : "云端载入失败。");
      })
      .finally(() => {
        setHydrated(true);
        if (pending.length) void flushOutbox();
      });
  }, [cloudConfigured, flushOutbox, pathname]);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [hydrated, state]);

  useEffect(() => {
    if (!cloudConfigured) return;
    setOnline(navigator.onLine);
    const handleOnline = () => { setOnline(true); void flushOutbox(true); };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [cloudConfigured, flushOutbox]);

  const setLevel = useCallback((level: Level) => {
    setState((current) => ({ ...current, selectedLevel: level }));
    enqueueMutation({ id: crypto.randomUUID(), url: "/api/state", method: "PATCH", body: { selectedLevel: level } });
  }, [enqueueMutation]);

  const assignCourse = useCallback((courseId: string) => {
    if (cloudConfigured && !online) {
      setSyncStatus("error");
      setSyncMessage("当前离线，今日课程需要联网后才能开始。");
      return courseId;
    }
    const result = startDailyCourse(state, courseId);
    setState(result.state);
    enqueueMutation({
      id: crypto.randomUUID(),
      url: "/api/daily-course",
      method: "POST",
      body: { courseId, localDate: localDate(state.timezone) },
    });
    return result.courseId;
  }, [cloudConfigured, enqueueMutation, online, state]);

  const submitAttempt = useCallback((input: RecordAttemptInput) => {
    if (cloudConfigured && !online) {
      setSyncStatus("error");
      setSyncMessage("当前离线，正式学习进度需要联网后才能提交。");
      return;
    }
    const id = crypto.randomUUID();
    const occurredAt = new Date().toISOString();
    setState((current) => recordAttempt(current, { ...input, id, occurredAt }));
    enqueueMutation({
      id,
      url: "/api/reviews/attempts",
      method: "POST",
      body: { ...input, id },
    });
  }, [cloudConfigured, enqueueMutation, online]);

  const toggleHard = useCallback((entryId: string) => {
    if (cloudConfigured && !online) {
      setSyncStatus("error");
      setSyncMessage("当前离线，强化标记需要联网后才能修改。");
      return;
    }
    const manual = !state.manualHardEntryIds.includes(entryId);
    setState((current) => {
      const hard = new Set(current.manualHardEntryIds);
      if (manual) hard.add(entryId); else hard.delete(entryId);
      return { ...current, manualHardEntryIds: [...hard] };
    });
    enqueueMutation({ id: crypto.randomUUID(), url: `/api/hard-words/${entryId}`, method: "PUT", body: { manual } });
  }, [cloudConfigured, enqueueMutation, online, state.manualHardEntryIds]);

  const setSpeechSettings = useCallback((voiceUri: string | undefined, rate: number) => {
    setState((current) => ({ ...current, voiceUri, speechRate: rate }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      hydrated,
      syncStatus,
      syncMessage,
      canRecordProgress: !cloudConfigured || online,
      retrySync: () => void flushOutbox(true),
      setLevel,
      assignCourse,
      submitAttempt,
      toggleHard,
      setSpeechSettings,
    }),
    [state, hydrated, syncStatus, syncMessage, cloudConfigured, online, flushOutbox, setLevel, assignCourse, submitAttempt, toggleHard, setSpeechSettings],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
