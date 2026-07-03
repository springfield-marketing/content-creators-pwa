"use client";

// Async type-ahead over the real agent list (/api/agents/search).
// Debounced, min 2 characters, server-side matching — the client never
// holds the full 200+ roster.

import { useEffect, useRef, useState } from "react";
import { Select } from "@mantine/core";

export type AgentHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  office: string | null;
};

export function AgentSearchSelect({
  value,
  onChange,
  label,
  placeholder = "Type at least 2 letters to search",
  description,
}: {
  value: AgentHit | null;
  onChange: (agent: AgentHit | null) => void;
  label?: string;
  placeholder?: string;
  description?: string;
}) {
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<AgentHit[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any in-flight debounce on unmount.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      fetch(`/api/agents/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: AgentHit[]) => setHits(rows))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 250);
  };

  // Keep the selected agent visible in options even when search changes.
  const options = [
    ...(value && !hits.some((h) => h.id === value.id) ? [value] : []),
    ...hits,
  ].map((a) => ({
    value: a.id,
    label: a.office ? `${a.name} — ${a.office}` : a.name,
  }));

  return (
    <Select
      label={label}
      placeholder={placeholder}
      description={description}
      searchable
      clearable
      data={options}
      value={value?.id ?? null}
      searchValue={search}
      onSearchChange={handleSearchChange}
      onChange={(id) => {
        if (!id) return onChange(null);
        onChange(hits.find((h) => h.id === id) ?? value);
      }}
      filter={({ options }) => options} // server already filtered
      nothingFoundMessage={
        search.trim().length < 2
          ? "Type at least 2 letters"
          : loading
            ? "Searching…"
            : "No matching agent"
      }
    />
  );
}
