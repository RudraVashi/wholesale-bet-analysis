"use client";

import { useEffect, useState } from "react";
import type { JournalEntry, PowerLeg, PropLine } from "@/lib/types";

const BUILDER_KEY = "formcast.builder";
const JOURNAL_KEY = "formcast.journal";
const MANUAL_KEY = "formcast.manualProps";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useBuilderLegs() {
  const [legs, setLegs] = useState<PowerLeg[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLegs(readJson(BUILDER_KEY, []));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(BUILDER_KEY, JSON.stringify(legs));
  }, [legs, ready]);

  function addLeg(leg: PowerLeg) {
    setLegs((prev) => {
      if (prev.some((l) => l.id === leg.id)) return prev;
      if (prev.length >= 4) return prev;
      return [...prev, leg];
    });
  }

  function removeLeg(id: string) {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }

  function clear() {
    setLegs([]);
  }

  return { legs, addLeg, removeLeg, clear, ready };
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(readJson(JOURNAL_KEY, []));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  }, [entries, ready]);

  function addEntry(entry: JournalEntry) {
    setEntries((prev) => [entry, ...prev]);
  }

  function updateResult(
    id: string,
    result: JournalEntry["result"],
  ) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, result } : e)),
    );
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return { entries, addEntry, updateResult, removeEntry, ready };
}

export function useManualProps() {
  const [text, setText] = useState("");
  const [props, setProps] = useState<PropLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readJson<{ text: string; props: PropLine[] }>(MANUAL_KEY, {
      text: "",
      props: [],
    });
    setText(saved.text);
    setProps(saved.props);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(MANUAL_KEY, JSON.stringify({ text, props }));
  }, [text, props, ready]);

  return { text, setText, props, setProps, ready };
}