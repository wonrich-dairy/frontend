export const COLOMBO_TZ = "Asia/Colombo";

function parseUtc(utcString: string): Date {
  // Backend returns datetime(6) as "2026-09-15 19:30:00" or "2026-09-15T19:30:00" without Z
  // Force UTC parsing: if no Z and no timezone offset, treat as UTC by adding Z
  let s = utcString.trim();
  if (!s.endsWith("Z") && !s.match(/[+-]\d{2}:?\d{2}$/)) {
    // Convert "2026-09-15 19:30:00" -> "2026-09-15T19:30:00Z"
    s = s.replace(" ", "T");
    if (!s.includes("T")) s = s;
    s = s + "Z";
  }
  return new Date(s);
}

export function formatColombo(utcString: string | null | undefined): string {
  if (!utcString) return "-";
  const date = parseUtc(utcString);
  if (isNaN(date.getTime())) return "-";
  
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatLiveElapsed(startUtc: string, nowMs: number): string {
  const start = parseUtc(startUtc).getTime();
  const elapsedMs = nowMs - start;
  if (elapsedMs < 0 || isNaN(start)) return "0m 0s";
  const totalSec = Math.floor(elapsedMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec}s`;
}
