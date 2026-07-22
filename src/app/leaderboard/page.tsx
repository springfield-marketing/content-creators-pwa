"use client";

// Standalone, public, full-screen leaderboard for the office TV. Dark, large,
// high-contrast; auto-refreshes every 5 minutes. Ranked by target attainment.

import { useEffect, useState } from "react";
import dayjs from "dayjs";

type Row = {
  rank: number;
  name: string;
  approved: number;
  posted: number;
  turnaroundHours: number | null;
  target: number;
  attainment: number | null;
};
type Data = { month: string; updatedAt: string; rows: Row[] };

const INK = "#F4F6FB";
const MUTED = "#8A94A6";
const ACCENT = "#5B8CFF";
const MEDAL = ["#FFCE45", "#CBD5E1", "#E0955A"]; // gold / silver / bronze

const GRID = "72px minmax(0,1fr) 130px 130px 150px 320px";

function turn(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return "<1h";
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export default function Leaderboard() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/leaderboard")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setData)
        .catch(() => {});
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1200px 800px at 70% -10%, #16203a 0%, #0A0D14 60%)",
        color: INK,
        fontVariantNumeric: "tabular-nums",
        padding: "clamp(24px, 3vw, 56px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "clamp(20px, 2.5vw, 40px)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <span style={{ fontSize: "clamp(28px, 3.4vw, 52px)", fontWeight: 800, letterSpacing: -0.5 }}>
            🏆 Creator Leaderboard
          </span>
        </div>
        <div style={{ textAlign: "right", color: MUTED }}>
          <div style={{ fontSize: "clamp(18px, 1.8vw, 28px)", fontWeight: 700, color: INK }}>
            {data ? dayjs(`${data.month}-01`).format("MMMM YYYY").toUpperCase() : " "}
          </div>
          <div style={{ fontSize: "clamp(12px, 1vw, 15px)" }}>
            {data ? `Updated ${dayjs(data.updatedAt).format("HH:mm")} · ranked by target %` : "Loading…"}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          gap: 16,
          padding: "0 clamp(12px, 1.5vw, 28px)",
          color: MUTED,
          fontSize: "clamp(11px, 0.95vw, 15px)",
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        <div>Rank</div>
        <div>Creator</div>
        <div style={{ textAlign: "right" }}>Approved</div>
        <div style={{ textAlign: "right" }}>Posted</div>
        <div style={{ textAlign: "right" }}>Turnaround</div>
        <div>Target</div>
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "clamp(8px, 0.9vw, 14px)" }}>
        {(data?.rows ?? []).map((r) => {
          const top = r.rank <= 3;
          const pct = r.attainment == null ? null : Math.round(r.attainment * 100);
          const barW = r.attainment == null ? 0 : Math.min(r.attainment, 1) * 100;
          return (
            <div
              key={r.name}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 16,
                alignItems: "center",
                padding: "clamp(12px, 1.4vw, 22px) clamp(12px, 1.5vw, 28px)",
                borderRadius: 16,
                background: top ? "rgba(91,140,255,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${top ? "rgba(91,140,255,0.28)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              {/* Rank */}
              <div>
                <div
                  style={{
                    width: "clamp(40px, 3.2vw, 56px)",
                    height: "clamp(40px, 3.2vw, 56px)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "clamp(18px, 1.7vw, 26px)",
                    fontWeight: 800,
                    color: top ? "#0A0D14" : MUTED,
                    background: top ? MEDAL[r.rank - 1] : "transparent",
                    border: top ? "none" : `2px solid rgba(255,255,255,0.12)`,
                  }}
                >
                  {r.rank}
                </div>
              </div>

              {/* Name */}
              <div
                style={{
                  fontSize: "clamp(20px, 2.1vw, 34px)",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.name}
              </div>

              {/* Approved */}
              <div style={{ textAlign: "right", fontSize: "clamp(22px, 2.2vw, 36px)", fontWeight: 800 }}>
                {r.approved}
              </div>

              {/* Posted */}
              <div style={{ textAlign: "right", fontSize: "clamp(20px, 2vw, 32px)", fontWeight: 600, color: r.posted === 0 ? MUTED : INK }}>
                {r.posted}
              </div>

              {/* Turnaround */}
              <div style={{ textAlign: "right", fontSize: "clamp(18px, 1.8vw, 28px)", fontWeight: 600, color: MUTED }}>
                {turn(r.turnaroundHours)}
              </div>

              {/* Target % */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    flex: 1,
                    height: "clamp(10px, 0.9vw, 14px)",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${barW}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: pct != null && pct >= 100 ? "#38D39F" : ACCENT,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 72,
                    textAlign: "right",
                    fontSize: "clamp(18px, 1.7vw, 26px)",
                    fontWeight: 700,
                    color: pct == null ? MUTED : INK,
                  }}
                >
                  {pct == null ? "—" : `${pct}%`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(data?.rows.length ?? 0) === 0 && (
        <div style={{ color: MUTED, textAlign: "center", marginTop: 60, fontSize: 22 }}>
          {data ? "No data yet this month." : "Loading…"}
        </div>
      )}
    </div>
  );
}
