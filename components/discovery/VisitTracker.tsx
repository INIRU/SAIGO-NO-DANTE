"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readHistory, remember } from "@/lib/discovery/history";
export default function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    const match = path.match(
      /\/(identities|decks|planner\/community)\/([a-f0-9-]{36})$/i,
    );
    if (!match || !readHistory().enabled) return;
    const kind =
      match[1] === "identities"
        ? "identity"
        : match[1] === "decks"
          ? "deck"
          : "planner";
    const timer = setTimeout(() => {
      if (!readHistory().enabled) return;
      remember({
        kind,
        id: match[2],
        href: path,
        title: document.title.split("|")[0].trim(),
      });
      void fetch("/api/discovery/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id: match[2] }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [path]);
  return null;
}
