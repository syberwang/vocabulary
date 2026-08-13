"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Level, LocalLearningState } from "@/lib/types";
import {
  STORAGE_KEY,
  initialState,
  loadState,
  recordAttempt,
  saveState,
  startDailyCourse,
  type RecordAttemptInput,
} from "@/lib/local-store";

interface AppContextValue {
  state: LocalLearningState;
  hydrated: boolean;
  setLevel: (level: Level) => void;
  assignCourse: (courseId: string) => string;
  submitAttempt: (input: RecordAttemptInput) => void;
  toggleHard: (entryId: string) => void;
  setSpeechSettings: (voiceUri: string | undefined, rate: number) => void;
  resetDemo: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const cloudConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    const local = loadState();
    setState(local);
    if (!cloudConfigured) {
      setHydrated(true);
      return;
    }
    fetch("/api/state", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { window.location.href = "/login"; return null; }
        if (!response.ok) throw new Error("Cloud state failed");
        return response.json() as Promise<LocalLearningState>;
      })
      .then((cloud) => cloud && setState({ ...cloud, voiceUri: local.voiceUri, speechRate: local.speechRate }))
      .catch(() => undefined)
      .finally(() => { setCloudReady(true); setHydrated(true); });
  }, [cloudConfigured]);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
    if (!cloudConfigured || !cloudReady) return;
    const timer = window.setTimeout(() => {
      fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) }).catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [cloudConfigured, cloudReady, hydrated, state]);

  const setLevel = useCallback((level: Level) => {
    setState((current) => ({ ...current, selectedLevel: level }));
  }, []);

  const assignCourse = useCallback((courseId: string) => {
    let assigned = courseId;
    setState((current) => {
      const result = startDailyCourse(current, courseId);
      assigned = result.courseId;
      return result.state;
    });
    return assigned;
  }, []);

  const submitAttempt = useCallback((input: RecordAttemptInput) => {
    setState((current) => recordAttempt(current, input));
  }, []);

  const toggleHard = useCallback((entryId: string) => {
    setState((current) => {
      const hard = new Set(current.manualHardEntryIds);
      if (hard.has(entryId)) hard.delete(entryId);
      else hard.add(entryId);
      return { ...current, manualHardEntryIds: [...hard] };
    });
  }, []);

  const setSpeechSettings = useCallback((voiceUri: string | undefined, rate: number) => {
    setState((current) => ({ ...current, voiceUri, speechRate: rate }));
  }, []);

  const resetDemo = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  const value = useMemo(
    () => ({ state, hydrated, setLevel, assignCourse, submitAttempt, toggleHard, setSpeechSettings, resetDemo }),
    [state, hydrated, setLevel, assignCourse, submitAttempt, toggleHard, setSpeechSettings, resetDemo],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
