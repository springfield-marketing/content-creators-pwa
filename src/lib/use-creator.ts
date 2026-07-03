"use client";

// Client data layer for the public booking flow: fetches real creators from
// the API and adapts them to the Creator shape the slot generator uses
// (mock-slots stays untouched until real availability arrives in step 6).

import { useEffect, useState } from "react";
import type { Creator } from "./mock-data";
import type { ShootDurations, WorkingHours } from "@/db/schema";

export type CreatorCard = {
  id: string;
  slug: string;
  name: string;
  photoUrl: string | null;
};

type CreatorProfile = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  workingHours: WorkingHours;
  shootDurations: ShootDurations;
  bufferMinutes: number;
  minNoticeHours: number;
  maxHorizonDays: number;
  maxShootsPerDay: number;
  timeOff: { from: string; to: string }[];
};

const DAY_NUM: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Stable placeholder avatar color per name until real photos exist.
const COLORS = ["indigo", "teal", "grape", "orange", "pink", "cyan", "lime", "violet"];
export function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
}

function hoursSummary(wh: WorkingHours, workDays: number[]): string {
  if (workDays.length === 0) return "No working days set";
  const sorted = [...workDays].sort((a, b) => a - b);
  const consecutive =
    sorted.length > 2 &&
    sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  const days = consecutive
    ? `${DAY_LABEL[sorted[0]]}–${DAY_LABEL[sorted[sorted.length - 1]]}`
    : sorted.map((d) => DAY_LABEL[d]).join(", ");
  const firstDayKey = Object.keys(DAY_NUM).find((k) => DAY_NUM[k] === sorted[0]);
  const ranges = wh[firstDayKey as keyof WorkingHours] ?? [];
  const times =
    ranges.length > 0
      ? `${ranges[0][0]}–${ranges[ranges.length - 1][1]}`
      : "";
  return `${days} ${times}`.trim();
}

function adapt(p: CreatorProfile): Creator {
  const workDays = Object.entries(p.workingHours)
    .filter(([, ranges]) => ranges && ranges.length > 0)
    .map(([day]) => DAY_NUM[day]);
  return {
    id: p.id,
    slug: p.slug!,
    name: p.name,
    color: avatarColor(p.name),
    active: p.isActive,
    settings: {
      workingHours: hoursSummary(p.workingHours, workDays),
      workDays,
      photoDuration: p.shootDurations.photo,
      videoDuration: p.shootDurations.video,
      buffer: p.bufferMinutes,
      minNoticeHours: p.minNoticeHours,
      horizonWeeks: Math.round(p.maxHorizonDays / 7),
      maxShootsPerDay: p.maxShootsPerDay,
    },
    timeOff: p.timeOff.map((o) => ({ ...o, reason: "" })),
  };
}

export function useCreators() {
  const [creators, setCreators] = useState<CreatorCard[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/creators")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCreators)
      .catch(() => setError(true));
  }, []);
  return { creators, error };
}

export function useCreatorProfile(slug: string) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_found">(
    "loading"
  );
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/creators/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: CreatorProfile) => {
        if (cancelled) return;
        setCreator(adapt(p));
        setState("ready");
      })
      .catch(() => !cancelled && setState("not_found"));
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return { creator, state };
}
