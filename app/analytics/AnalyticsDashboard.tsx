"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Footer from "@/components/Footer";

// ─── Shared class fragments (olum design tokens) ────────────────────────────────
const CARD = "rounded-2xl bg-[var(--card)] border border-[var(--border)]";
const SEC_LBL = "font-mono text-[10px] uppercase tracking-wider text-[var(--fg-muted)]";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentVisit {
  key: string;
  route: string;
  device: string;
  timezone: string;
  os: string;
  browser: string;
  ts: number;
  blogSlug?: string;
  referrer?: string;
}

// One usage ping from the Olum CLI — see app/api/telemetry/route.ts.
interface TelemetryEvent {
  key: string;
  cliVersion: string;
  olumVersion: string;
  // the app's olum-compiler version; absent on pings from CLIs that predate the field
  compilerVersion?: string;
  // the full runtime version as the CLI reported it, "24.15.0". Stored unvalidated,
  // and older pings carry a bare major as a number, so the shape isn't guaranteed
  nodeVersion?: string | number;
  os: string;
  // IANA zone name the CLI resolved, "Africa/Cairo". "unknown" when the machine
  // could not resolve one, and absent on pings that predate the field
  timezone?: string;
  // absent on pings from CLI versions that predate the field
  type?: string;
  // the command's argument: the olum-ui component `add` installed, or the name given
  // to `create`. Absent on pings from CLI versions that predate the field
  name?: string;
  // flags the command ran with, `create` only
  options?: string[];
  timestamp: string;
  ts: number;
}

// What each command means in the Olum Users table, for readers who don't think
// in CLI verbs. Anything not listed shows as-is.
const TELEMETRY_TYPES: Record<string, string> = {
  create: "Project scaffolded with olum create",
  add: "olum-ui component installed with olum add",
  unknown: "Sent by a CLI version that predates the type field.",
};

interface TelemetryData {
  events?: TelemetryEvent[];
  lastReceived?: string | null;
}

interface AnalyticsData {
  totalVisits?: number;
  visitors?: number;
  pageViews?: Record<string, number>;
  blogs?: Record<string, number>;
  devices?: Record<string, number>;
  timezones?: Record<string, number>;
  os?: Record<string, number>;
  browsers?: Record<string, number>;
  recentVisits?: RecentVisit[];
  lastVisited?: string | null;
}

// The two halves of the dashboard. They share the header controls (range,
// timezone exclusions, refresh) but never show at the same time.
type DashboardTab = "site" | "users";

const TABS: { value: DashboardTab; label: string }[] = [
  { value: "site", label: "Website" },
  { value: "users", label: "Olum Users" },
];

type DateRange = "all" | "24h" | "7d" | "30d" | "90d" | "custom";

// A user-picked window from the calendar. `start` is the first day at 00:00 and
// `end` the last day at 23:59:59.999, so both endpoints are fully included.
interface CustomRange {
  start: number;
  end: number;
}

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "custom", label: "Custom Range…" },
];

// What the special (non-hostname) referrer sources mean. Shown as hover hints.
const REFERRER_HINTS: Record<string, string> = {
  direct: "Typed your domain or opened a bookmark — they already knew the site.",
  hidden: "Came from a real link, but the referrer was stripped: in-app browsers (Instagram, X, WhatsApp…), no-referrer sites, or https→http.",
  unknown: "A referrer was sent but couldn't be read.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function keyToRoute(key: string): string {
  if (key === "home") return "/";
  return "/" + key.replace(/__/g, "/");
}

function keyToLabel(key: string): string {
  return key.replace(/__/g, "/").replace(/_/g, " ");
}

function extractHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isDef(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function sumRecord(rec?: Record<string, number>): number {
  return Object.values(rec ?? {}).reduce((a, b) => a + b, 0);
}

// No identifier is stored with a ping, so the closest thing to a machine is the
// shape of its environment. Two pings that agree on all six fields are treated
// as one user while the Unique toggle is on.
function userFingerprint(e: TelemetryEvent): string {
  return [
    e.timezone ?? "unknown",
    e.os,
    isDef(e.nodeVersion) ? String(e.nodeVersion) : "unknown",
    e.cliVersion,
    e.olumVersion,
    e.compilerVersion ?? "unknown",
  ].join(" | ");
}

// One row per fingerprint — the newest ping, so the versions and the times show
// where that user is now, not where they started.
function latestPerUser(events: TelemetryEvent[]): TelemetryEvent[] {
  const latest = new Map<string, TelemetryEvent>();
  for (const e of events) {
    const id = userFingerprint(e);
    const seen = latest.get(id);
    if (!seen || e.ts > seen.ts) latest.set(id, e);
  }
  return [...latest.values()].sort((a, b) => b.ts - a.ts);
}

// Telemetry reuses the analytics password — both endpoints are guarded by the
// same SECRET. Kept separate from the analytics fetch so a telemetry failure
// (or an empty log) never blocks the rest of the dashboard from rendering.
async function fetchTelemetry(pw: string): Promise<TelemetryData | null> {
  const url = pw ? `/api/telemetry?secret=${encodeURIComponent(pw)}` : "/api/telemetry";
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json.ok ? (json.data as TelemetryData) : null;
  } catch {
    return null;
  }
}

// Heuristic bot detection. A headless browser is a near-certain signal — no real
// human browser reports "HeadlessChrome" or similar. (A bare "UTC" timezone was
// considered too, but it sweeps up privacy-hardened browsers like Tor/Firefox RFP
// that spoof the zone to UTC, so it's intentionally not used.)
function isBotVisit(v: RecentVisit): boolean {
  const browser = v.browser?.toLowerCase() ?? "";
  return browser.includes("headless");
}

function topEntry(rec?: Record<string, number>): [string, number] {
  const entries = Object.entries(rec ?? {}).filter(([, v]) => v > 0);
  if (!entries.length) return ["—", 0];
  return entries.sort(([, a], [, b]) => b - a)[0];
}

// ─── Calendar / date helpers ──────────────────────────────────────────────────

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

// "Mar 3, 2026" — short enough to fit two of them in the range button.
function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// The cells of one month grid: leading nulls pad the row to the first weekday,
// then one timestamp (midnight, local) per day.
function buildMonthCells(year: number, month: number): (number | null)[] {
  const cells: (number | null)[] = Array(new Date(year, month, 1).getDay()).fill(null);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day).getTime());
  return cells;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

// Both ends of the active window, in ms. `null` means unbounded on that side —
// the presets are all open-ended at the top, only a custom range closes it.
function getRangeBounds(range: DateRange, custom: CustomRange | null): { since: number | null; until: number | null } {
  if (range === "custom") {
    return custom ? { since: custom.start, until: custom.end } : { since: null, until: null };
  }
  if (range === "all") return { since: null, until: null };
  const ms: Record<string, number> = {
    "24h": 86_400_000,
    "7d": 7 * 86_400_000,
    "30d": 30 * 86_400_000,
    "90d": 90 * 86_400_000,
  };
  return { since: Date.now() - ms[range], until: null };
}

function inBounds(ts: number, since: number | null, until: number | null): boolean {
  if (since !== null && ts < since) return false;
  if (until !== null && ts > until) return false;
  return true;
}

function computeFromVisits(visits: RecentVisit[]): AnalyticsData {
  const pageViews: Record<string, number> = {};
  const blogs: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const os: Record<string, number> = {};
  const browsers: Record<string, number> = {};
  const timezones: Record<string, number> = {};

  for (const v of visits) {
    const routeKey = v.route === "/" ? "home" : v.route.replace(/^\//, "").replace(/[.#$[\]]/g, "_").replace(/\//g, "__");
    pageViews[routeKey] = (pageViews[routeKey] ?? 0) + 1;
    if (v.blogSlug) blogs[v.blogSlug] = (blogs[v.blogSlug] ?? 0) + 1;
    devices[v.device] = (devices[v.device] ?? 0) + 1;
    os[v.os] = (os[v.os] ?? 0) + 1;
    browsers[v.browser] = (browsers[v.browser] ?? 0) + 1;
    const tzKey = v.timezone.replace(/[.#$[\]]/g, "_").replace(/\//g, "__");
    timezones[tzKey] = (timezones[tzKey] ?? 0) + 1;
  }

  return {
    totalVisits: visits.length,
    visitors: visits.length,
    pageViews,
    blogs,
    devices,
    os,
    browsers,
    timezones,
    recentVisits: visits,
    lastVisited: visits[0]?.ts ? new Date(visits[0].ts).toISOString() : null,
  };
}

// Two months side by side, click a day for the start and a second day for the
// end. Days after today are disabled — there is nothing recorded there. Written
// from scratch rather than pulling in a date library for one screen.
function DateRangeCalendar({
  value,
  onApply,
  onClear,
  onClose,
}: {
  value: CustomRange | null;
  onApply: (range: CustomRange) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  // Pinned once on open — re-reading the clock during render is impure.
  const [today] = useState(() => startOfDay(Date.now()));
  const [leftMonth, setLeftMonth] = useState<Date>(() => {
    const base = value ? new Date(value.start) : new Date();
    return addMonths(new Date(base.getFullYear(), base.getMonth(), 1), -1);
  });
  const [start, setStart] = useState<number | null>(value ? startOfDay(value.start) : null);
  const [end, setEnd] = useState<number | null>(value ? startOfDay(value.end) : null);
  const [hovered, setHovered] = useState<number | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Close on Escape or a click outside the popover.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  // First click sets the start, second click closes the range. Clicking before
  // an open start moves the start instead of making a backwards range.
  const pickDay = (day: number) => {
    if (start === null || end !== null) {
      setStart(day);
      setEnd(null);
    } else if (day < start) {
      setStart(day);
    } else {
      setEnd(day);
    }
  };

  // While only the start is picked, the hovered day previews the other end.
  const previewEnd = end ?? (start !== null && hovered !== null && hovered > start ? hovered : null);

  const isSelected = (day: number) =>
    (start !== null && day === start) || (end !== null && day === end);

  const isBetween = (day: number) =>
    start !== null && previewEnd !== null && day > start && day < previewEnd;

  const canApply = start !== null;

  const renderMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    return (
      <div key={`${year}-${month}`} className="w-[224px]">
        <p className="text-center font-mono text-[11px] text-[var(--fg)] mb-2">
          {MONTH_NAMES[month]} {year}
        </p>
        <div className="grid grid-cols-7 gap-y-0.5">
          {WEEKDAY_NAMES.map((name) => (
            <span key={name} className="text-center font-mono text-[9px] uppercase text-[var(--fg-muted)] py-1">
              {name}
            </span>
          ))}
          {buildMonthCells(year, month).map((day, i) => {
            if (day === null) return <span key={`pad-${i}`} />;
            const disabled = day > today;
            const selected = isSelected(day);
            const between = isBetween(day);
            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                onClick={() => pickDay(day)}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                className={[
                  "h-7 text-[11px] font-mono rounded-md transition-colors",
                  disabled ? "text-[var(--fg-muted)] opacity-30 cursor-not-allowed" : "cursor-pointer",
                  selected ? "bg-[var(--accent)] text-black font-semibold" : "",
                  !selected && between ? "bg-[var(--surface-hover)] text-[var(--fg)]" : "",
                  !selected && !between && !disabled ? "text-[var(--fg)] hover:bg-[var(--surface-hover)]" : "",
                  !selected && !between && sameDay(day, today) ? "border border-[var(--border)]" : "",
                ].join(" ")}
              >
                {new Date(day).getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Select a date range"
      className={`absolute right-0 top-[calc(100%+8px)] z-50 p-4 shadow-xl ${CARD}`}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setLeftMonth(addMonths(leftMonth, -1))}
          className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] transition-colors cursor-pointer"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className={SEC_LBL}>Select range</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
          className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] transition-colors cursor-pointer"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="flex gap-5 flex-wrap justify-center">
        {renderMonth(leftMonth)}
        {renderMonth(addMonths(leftMonth, 1))}
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
        <p className="font-mono text-[11px] text-[var(--fg-muted)]">
          {start === null
            ? "Pick a start day"
            : end === null
              ? `${formatDay(start)} → pick an end day`
              : `${formatDay(start)} → ${formatDay(end)}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] py-[6px] px-3 text-[.7rem] text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => {
              if (start === null) return;
              // A single-day pick means that whole day, not a zero-width window.
              onApply({ start: startOfDay(start), end: endOfDay(end ?? start) });
            }}
            className="rounded-lg bg-[var(--accent)] py-[6px] px-3 text-[.7rem] font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Lightweight CSS-only tooltip (no external UI lib). Shows on hover/focus.
// `placement` is manual, not measured: a tall tooltip near the top of the page
// opens upward into the sticky navbar and gets clipped, so those pass "bottom".
function Hint({
  content,
  children,
  className = "",
  placement = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  placement?: "top" | "bottom";
}) {
  return (
    <span className={`group/hint relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-0 z-50 w-max max-w-[280px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[.78rem] leading-[1.6] text-[var(--fg-secondary)] opacity-0 shadow-lg transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100 ${
          placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
        }`}
      >
        {content}
      </span>
    </span>
  );
}

function StatCard({ label, value, sub, valueClassName }: { label: string; value: string | number; sub?: string; valueClassName?: string }) {
  return (
    <div className={`${CARD} p-5 flex flex-col gap-1.5 flex-1 min-w-[140px]`}>
      <p className={SEC_LBL}>{label}</p>
      <p className={`font-bold text-[var(--fg)] tracking-tight leading-tight ${valueClassName ?? "text-[1.65rem] tabular-nums leading-none"}`}>
        {value}
      </p>
      {sub && <p className="font-mono text-[11px] text-[var(--fg-muted)] truncate mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({
  data,
  labelFn,
  descFn,
  maxItems = 8,
  total,
}: {
  data?: Record<string, number>;
  labelFn?: (key: string) => string;
  descFn?: (key: string) => string | undefined;
  maxItems?: number;
  // when set, each row also shows its share of this figure. It is deliberately not
  // the sum of the bars: a flag's share is out of every run that could have used it
  total?: number;
}) {
  const entries = Object.entries(data ?? {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxItems);

  if (!entries.length) {
    return <p className="text-sm text-[var(--fg-muted)] opacity-40 py-1">No data yet</p>;
  }

  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([key, value]) => {
        const label = labelFn ? labelFn(key) : key;
        const desc = descFn?.(key);
        return (
          <div key={key} className="flex items-center gap-3 min-w-0">
            {desc ? (
              <Hint content={desc} className="shrink-0" >
                <span
                  className="font-mono text-[11px] text-[var(--fg-secondary)] truncate cursor-help underline decoration-dotted decoration-[var(--fg-muted)]/50 underline-offset-2 block"
                  style={{ width: "128px" }}
                >
                  {label}
                </span>
              </Hint>
            ) : (
              <span
                className="font-mono text-[11px] text-[var(--fg-secondary)] truncate shrink-0"
                style={{ width: "128px" }}
                title={label}
              >
                {label}
              </span>
            )}
            <div className="flex-1 bg-[var(--surface-hover)] rounded-full h-[3px] overflow-hidden min-w-0">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.round((value / max) * 100)}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-[var(--fg-muted)] tabular-nums shrink-0 w-8 text-right">
              {value}
            </span>
            {!!total && total > 0 && (
              <span
                className="font-mono text-[11px] text-[var(--fg-muted)] opacity-60 tabular-nums shrink-0 w-12 text-right"
                title={`${value} of ${total}`}
              >
                ({Math.round((value / total) * 100)}%)
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Expand/collapse control shared by the visits and pings tables.
function FullscreenToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={on ? "Exit fullscreen" : "Fullscreen"}
      aria-label={on ? "Exit fullscreen" : "Fullscreen"}
      className="shrink-0 p-1.5 rounded-md hover:bg-[var(--surface-hover)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
    >
      {on ? (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        </svg>
      ) : (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      )}
    </button>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-center justify-between mb-5">
        <p className={SEC_LBL}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

// Info icon for the Referrers panel — hover to see what each special source means.
function ReferrerLegend() {
  return (
    <Hint
      content={
        <div className="flex flex-col gap-2 py-0.5 text-left">
          {Object.entries(REFERRER_HINTS).map(([key, hint]) => (
            <div key={key} className="leading-[1.5]">
              <span className="font-semibold capitalize">{key}</span>
              <span className="opacity-80"> — {hint}</span>
            </div>
          ))}
          <div className="leading-[1.5] opacity-80">
            Anything else (e.g. <span className="font-semibold">google.com</span>) is the site the visitor came from.
          </div>
        </div>
      }
    >
      <button
        type="button"
        aria-label="What do these referrer sources mean?"
        className="shrink-0 p-1 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors cursor-help"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
        </svg>
      </button>
    </Hint>
  );
}

// Excludes chosen timezones from the whole dashboard — for dropping your own
// zone so your own visits and CLI pings don't skew the numbers. Applies to the
// site-visit stats, every chart, the visits table and the Olum Users section.
function TimezoneFilter({
  counts,
  excluded,
  onToggle,
  onClear,
}: {
  counts: Record<string, number>;
  excluded: string[];
  onToggle: (tz: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape or a click outside the popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Busiest zone first, so the one worth excluding is usually at the top. An
  // excluded zone stays listed even when the range holds none of it, otherwise
  // the row needed to un-exclude it would disappear.
  const zones = [...new Set([...Object.keys(counts), ...excluded])]
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={excluded.length ? `Excluded everywhere: ${excluded.join(", ")}` : "Exclude timezones from the whole dashboard"}
        className={`flex items-center gap-2 rounded-lg border py-[8px] px-3 text-[.75rem] transition-colors cursor-pointer ${
          excluded.length
            ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-hover)]"
        }`}
      >
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20" />
        </svg>
        {excluded.length ? `Timezones (${excluded.length})` : "Timezones"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Exclude timezones"
          className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[260px] p-3 shadow-xl ${CARD}`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className={SEC_LBL}>Exclude everywhere</span>
            {!!excluded.length && (
              <button
                type="button"
                onClick={onClear}
                className="font-mono text-[10px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {!zones.length ? (
            <p className="font-mono text-[11px] text-[var(--fg-muted)] opacity-50 py-2">No timezones yet</p>
          ) : (
            <div className="max-h-[240px] overflow-y-auto flex flex-col gap-0.5">
              {zones.map((tz) => {
                const off = excluded.includes(tz);
                return (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => onToggle(tz)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <span
                      className={`w-3.5 h-3.5 shrink-0 rounded-[4px] border flex items-center justify-center ${
                        off ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)]"
                      }`}
                    >
                      {off && (
                        <svg width="9" height="9" fill="none" stroke="black" strokeWidth="3" viewBox="0 0 24 24">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <span className={`font-mono text-[11px] truncate ${off ? "text-[var(--fg-muted)] line-through" : "text-[var(--fg)]"}`} title={tz}>
                      {tz}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-[var(--fg-muted)] opacity-60 shrink-0">
                      {counts[tz] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Password Gate ────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }: { onAuth: (pw: string, data: AnalyticsData) => void }) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = pw ? `/api/analytics?secret=${encodeURIComponent(pw)}` : "/api/analytics";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError("Wrong password. Try again.");
        return;
      }
      if (pw) sessionStorage.setItem("a_tk", pw);
      onAuth(pw, json.data as AnalyticsData);
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-6">
      <div className={`${CARD} p-8 w-full max-w-[360px] flex flex-col items-center gap-7`}>
        <div className="w-11 h-11 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
          <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-[var(--fg-muted)]">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-[var(--fg)] font-bold text-xl tracking-tight">Analytics</h1>
          <p className="font-mono text-[11px] text-[var(--fg-muted)] mt-1.5 tracking-wide uppercase">
            Enter password to continue
          </p>
        </div>

        <form onSubmit={submit} className="w-full flex flex-col gap-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(""); }}
            placeholder="Password"
            autoFocus
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--fg)] placeholder:text-[var(--fg-muted)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          {error && (
            <p className="text-red-400 font-mono text-[11px]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full justify-center flex items-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Checking…" : "Enter Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [authed, setAuthed] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [storedPw, setStoredPw] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [visitsSearch, setVisitsSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tab, setTab] = useState<DashboardTab>("site");
  const [visitsFullscreen, setVisitsFullscreen] = useState(false);
  const [telemetryFullscreen, setTelemetryFullscreen] = useState(false);
  const [hideBots, setHideBots] = useState(true);
  // Timezones hidden from the Recent Visits table. Kept in localStorage so the
  // choice survives a reload — it is a view preference, not part of the data.
  const [excludedTimezones, setExcludedTimezones] = useState<string[]>(() => {
    // Read once, lazily. Never during the server render — the dashboard shows
    // the spinner then, so the first client render can't mismatch.
    if (typeof window === "undefined") return [];
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("a_tz_excluded") ?? "[]");
      return Array.isArray(saved) ? saved.filter((t): t is string => typeof t === "string") : [];
    } catch {
      return []; // corrupt or unavailable storage — start with nothing excluded
    }
  });
  // Off: every ping counts. On: pings that share a user fingerprint count once.
  const [uniqueUsers, setUniqueUsers] = useState(true);

  const toggleTimezone = useCallback((tz: string) => {
    setExcludedTimezones((prev) => {
      const next = prev.includes(tz) ? prev.filter((t) => t !== tz) : [...prev, tz];
      try { localStorage.setItem("a_tz_excluded", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearTimezones = useCallback(() => {
    setExcludedTimezones([]);
    try { localStorage.removeItem("a_tz_excluded"); } catch { /* ignore */ }
  }, []);

  // Auto-login from session storage
  useEffect(() => {
    const saved = sessionStorage.getItem("a_tk") ?? "";
    const url = saved ? `/api/analytics?secret=${encodeURIComponent(saved)}` : "/api/analytics";

    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setStoredPw(saved);
          setData(json.data as AnalyticsData);
          setAuthed(true);
          setLastUpdated(new Date());
          fetchTelemetry(saved).then(setTelemetry);
        } else if (saved) {
          sessionStorage.removeItem("a_tk");
        }
      })
      .catch(() => {})
      .finally(() => setInitDone(true));
  }, []);

  const refresh = useCallback(async () => {
    const pw = storedPw || sessionStorage.getItem("a_tk") || "";
    setRefreshing(true);
    try {
      const url = pw ? `/api/analytics?secret=${encodeURIComponent(pw)}` : "/api/analytics";
      const [res, freshTelemetry] = await Promise.all([fetch(url), fetchTelemetry(pw)]);
      const json = await res.json();
      if (json.ok) {
        setData(json.data as AnalyticsData);
        setLastUpdated(new Date());
      }
      if (freshTelemetry) setTelemetry(freshTelemetry);
    } finally {
      setRefreshing(false);
    }
  }, [storedPw]);

  // Clear the docs + playground GitHub caches. Reuses the analytics secret
  // (stored on login) since /api/clear-cache is guarded by the SECRET env var too.
  const clearCache = useCallback(async () => {
    const pw = storedPw || sessionStorage.getItem("a_tk") || "";
    setClearing(true);
    setClearMsg(null);
    try {
      const res = await fetch(`/api/clear-cache?secret=${encodeURIComponent(pw)}`);
      const json = await res.json().catch(() => ({}));
      setClearMsg(
        res.ok
          ? { ok: true, text: "Cache cleared" }
          : { ok: false, text: json.error || `Failed (${res.status})` },
      );
    } catch {
      setClearMsg({ ok: false, text: "Connection failed" });
    } finally {
      setClearing(false);
      setTimeout(() => setClearMsg(null), 4000);
    }
  }, [storedPw]);

  const handleAuth = (pw: string, freshData: AnalyticsData) => {
    setStoredPw(pw);
    setData(freshData);
    setAuthed(true);
    setLastUpdated(new Date());
    setInitDone(true);
    fetchTelemetry(pw).then(setTelemetry);
  };

  // Visits inside the active date window, before the timezone filter — this is
  // what the timezone picker counts, so an excluded zone still shows its size.
  const rangeVisits = useMemo<RecentVisit[]>(() => {
    const { since, until } = getRangeBounds(dateRange, customRange);
    const all = data?.recentVisits ?? [];
    return since === null && until === null ? all : all.filter((v) => inBounds(v.ts, since, until));
  }, [data, dateRange, customRange]);

  // Everything downstream — stat cards, charts, referrers, the visits table —
  // reads this, so excluding a zone removes it from the whole dashboard rather
  // than only hiding rows.
  const activeData = useMemo<AnalyticsData | null>(() => {
    if (!data) return null;
    const visits = excludedTimezones.length
      ? rangeVisits.filter((v) => !excludedTimezones.includes(v.timezone || "unknown"))
      : rangeVisits;
    return computeFromVisits(visits);
  }, [data, rangeVisits, excludedTimezones]);

  const referrerCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const v of activeData?.recentVisits ?? []) {
      if (v.referrer) {
        const label = extractHostname(v.referrer);
        counts[label] = (counts[label] ?? 0) + 1;
      }
    }
    return counts;
  }, [activeData]);

  // Pings inside the active date window, before the timezone filter — the
  // telemetry half of what the timezone picker counts. Windowed on `ts`, the
  // time we received the ping, not the machine clock the CLI reported: the
  // reported one is unverifiable and skewed by wrong local clocks.
  const rangeTelemetry = useMemo<TelemetryEvent[]>(() => {
    const { since, until } = getRangeBounds(dateRange, customRange);
    const all = telemetry?.events ?? [];
    return since === null && until === null ? all : all.filter((e) => inBounds(e.ts, since, until));
  }, [telemetry, dateRange, customRange]);

  // What the whole Olum Users section reads: the date range and the timezone
  // exclusions both apply, the same way they do to site visits above.
  const telemetryEvents = useMemo<TelemetryEvent[]>(() => {
    return excludedTimezones.length
      ? rangeTelemetry.filter((e) => !excludedTimezones.includes(e.timezone || "unknown"))
      : rangeTelemetry;
  }, [rangeTelemetry, excludedTimezones]);

  // Rows of the Recent list: one per ping, or one per user when the toggle is on.
  const visibleTelemetry = useMemo<TelemetryEvent[]>(
    () => (uniqueUsers ? latestPerUser(telemetryEvents) : telemetryEvents),
    [telemetryEvents, uniqueUsers],
  );

  const telemetryBreakdown = useMemo(() => {
    // Buckets hold ids, not counts. The id is the ping's own key while the
    // toggle is off — so every ping counts — and the user fingerprint while it
    // is on, so a machine counts once per bucket however often it ran a command.
    const cliVersions: Record<string, Set<string>> = {};
    const olumVersions: Record<string, Set<string>> = {};
    const compilerVersions: Record<string, Set<string>> = {};
    const nodeVersions: Record<string, Set<string>> = {};
    const osCounts: Record<string, Set<string>> = {};
    const timezoneCounts: Record<string, Set<string>> = {};
    const typeCounts: Record<string, Set<string>> = {};
    // both commands carry a name, and the two mean different things — an olum-ui
    // component for `add`, the project's own name for `create` — so they are counted
    // apart rather than mixed into one list of labels
    const components: Record<string, Set<string>> = {};
    const projects: Record<string, Set<string>> = {};
    const optionCounts: Record<string, Set<string>> = {};
    const users = new Set<string>();

    const bump = (bucket: Record<string, Set<string>>, key: string, id: string) => {
      (bucket[key] ??= new Set()).add(id);
    };

    for (const e of telemetryEvents) {
      const id = uniqueUsers ? userFingerprint(e) : e.key;
      users.add(userFingerprint(e));

      bump(cliVersions, e.cliVersion, id);
      bump(olumVersions, e.olumVersion, id);
      bump(compilerVersions, e.compilerVersion ?? "unknown", id);
      bump(nodeVersions, `node ${e.nodeVersion}`, id);
      bump(osCounts, e.os, id);
      bump(timezoneCounts, e.timezone ?? "unknown", id);
      const type = e.type ?? "unknown";
      bump(typeCounts, type, id);

      if (e.name && type === "add") bump(components, e.name, id);
      if (e.name && type === "create") bump(projects, e.name, id);

      for (const flag of e.options ?? []) bump(optionCounts, flag, id);
    }

    const sizes = (bucket: Record<string, Set<string>>): Record<string, number> =>
      Object.fromEntries(Object.entries(bucket).map(([k, v]) => [k, v.size]));

    const typeSizes = sizes(typeCounts);
    const componentSizes = sizes(components);
    const projectSizes = sizes(projects);
    const optionSizes = sizes(optionCounts);

    return {
      cliVersions: sizes(cliVersions),
      olumVersions: sizes(olumVersions),
      compilerVersions: sizes(compilerVersions),
      nodeVersions: sizes(nodeVersions),
      osCounts: sizes(osCounts),
      timezoneCounts: sizes(timezoneCounts),
      typeCounts: typeSizes,
      components: componentSizes,
      projects: projectSizes,
      optionCounts: optionSizes,
      optionsUsed: Object.values(optionSizes).reduce((a, b) => a + b, 0),
      // pings by default — the same machine running the command twice counts
      // twice — or distinct machines while the Unique toggle is on
      projectsCreated: typeSizes.create ?? 0,
      componentsAdded: Object.values(componentSizes).reduce((a, b) => a + b, 0),
      userCount: users.size,
    };
  }, [telemetryEvents, uniqueUsers]);

  // What one counted thing is called in the Olum Users section.
  const telemetryUnit = uniqueUsers ? "users" : "pings";

  // Every timezone the dashboard knows about, with what excluding it would cost:
  // site visits plus CLI pings in the active range. Counted before the filter
  // runs, so the numbers don't collapse to zero once a zone is excluded.
  const timezoneCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const v of rangeVisits) {
      const tz = v.timezone || "unknown";
      counts[tz] = (counts[tz] ?? 0) + 1;
    }
    for (const e of rangeTelemetry) {
      const tz = e.timezone || "unknown";
      counts[tz] = (counts[tz] ?? 0) + 1;
    }
    return counts;
  }, [rangeVisits, rangeTelemetry]);

  // Visits to show in the table — every visit, minus bots when that filter is on.
  // Excluded timezones are already gone: activeData never carried them.
  const visibleVisits = useMemo<RecentVisit[]>(() => {
    const visits = activeData?.recentVisits ?? [];
    return hideBots ? visits.filter((v) => !isBotVisit(v)) : visits;
  }, [activeData, hideBots]);

  // Change the range and reset the search so filtered results aren't confusing.
  // "Custom Range" only opens the calendar — the range itself changes on Apply.
  const changeDateRange = (range: DateRange) => {
    if (range === "custom") {
      setCalendarOpen(true);
      return;
    }
    setDateRange(range);
    setCustomRange(null);
    setVisitsSearch("");
  };

  const applyCustomRange = (range: CustomRange) => {
    setCustomRange(range);
    setDateRange("custom");
    setVisitsSearch("");
    setCalendarOpen(false);
  };

  // Clearing the calendar drops back to the widest view.
  const clearCustomRange = () => {
    setCustomRange(null);
    setDateRange("all");
    setVisitsSearch("");
    setCalendarOpen(false);
  };

  // What the active range is called — a custom one names its two endpoints.
  const rangeLabel = (range: DateRange): string => {
    if (range === "custom") {
      return customRange
        ? `${formatDay(customRange.start)} – ${formatDay(customRange.end)}`
        : "Custom Range";
    }
    return DATE_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "";
  };

  const changeTab = (next: DashboardTab) => {
    setTab(next);
    setVisitsFullscreen(false);
    setTelemetryFullscreen(false);
  };

  // Close fullscreen on Escape; lock page scroll while either table is expanded.
  const anyFullscreen = visitsFullscreen || telemetryFullscreen;
  useEffect(() => {
    if (!anyFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setVisitsFullscreen(false);
      setTelemetryFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.documentElement.style.overflow = "";
    };
  }, [anyFullscreen]);

  const wrap = (content: React.ReactNode) => (
    <>
      <main id="main-content" className="relative z-10 min-h-[calc(100vh-64px)]">
        {content}
      </main>
      <Footer />
    </>
  );

  // Loading spinner while checking session
  if (!initDone) {
    return wrap(
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin text-[var(--accent)]" width="22" height="22" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="font-mono text-xs text-[var(--fg-muted)]">Loading…</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return wrap(<PasswordGate onAuth={handleAuth} />);
  }

  // ── Data derivations ────────────────────────────────────────────────────────

  const totalVisits = activeData?.totalVisits ?? activeData?.visitors ?? 0;
  const totalPageViews = sumRecord(activeData?.pageViews);
  const totalBlogReads = sumRecord(activeData?.blogs);
  const [topPageKey, topPageCount] = topEntry(activeData?.pageViews);

  const lastPingStr = telemetry?.lastReceived
    ? new Date(telemetry.lastReceived).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const lastVisitedStr = activeData?.lastVisited
    ? new Date(activeData.lastVisited).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return wrap(
    <div className="max-w-5xl mx-auto px-6 pt-14 pb-28">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className={SEC_LBL}>Dashboard</p>
          <h1 className="gradient-text text-[clamp(1.8rem,4vw,2.5rem)] font-bold tracking-tight leading-none mt-1">
            Analytics
          </h1>
          {tab === "site" && lastVisitedStr && (
            <p className="font-mono text-[11px] text-[var(--fg-muted)] mt-2 opacity-70">
              Last visitor: {lastVisitedStr}
            </p>
          )}
          {tab === "users" && lastPingStr && (
            <p className="font-mono text-[11px] text-[var(--fg-muted)] mt-2 opacity-70">
              Last ping: {lastPingStr}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1 flex-wrap">
          {lastUpdated && (
            <span className="font-mono text-[11px] text-[var(--fg-muted)]">
              Updated {relativeTime(lastUpdated.getTime())}
            </span>
          )}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => changeDateRange(e.target.value as DateRange)}
              className="appearance-none bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)] text-[.75rem] py-[8px] pl-3 pr-8 rounded-lg focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value === "custom" ? rangeLabel("custom") : opt.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
              width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          {/* Calendar range picker — sits beside the presets and overrides them. */}
          <div className="relative">
            <button
              onClick={() => setCalendarOpen((open) => !open)}
              aria-haspopup="dialog"
              aria-expanded={calendarOpen}
              title="Pick a custom date range"
              className={`flex items-center gap-2 rounded-lg border py-[8px] px-3 text-[.75rem] transition-colors cursor-pointer ${
                dateRange === "custom"
                  ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {dateRange === "custom" && customRange ? rangeLabel("custom") : "Custom"}
            </button>
            {calendarOpen && (
              <DateRangeCalendar
                value={customRange}
                onApply={applyCustomRange}
                onClear={clearCustomRange}
                onClose={() => setCalendarOpen(false)}
              />
            )}
          </div>

          {/* Global timezone exclusions — sits with the date controls because it
              filters the whole page the same way the range does. */}
          <TimezoneFilter
            counts={timezoneCounts}
            excluded={excludedTimezones}
            onToggle={toggleTimezone}
            onClear={clearTimezones}
          />
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] py-[8px] px-4 text-[.75rem] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
          >
            <svg
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              className={refreshing ? "animate-spin" : ""}
            >
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={clearCache}
            disabled={clearing}
            title="Clear the docs & playground caches (refetch from GitHub)"
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] py-[8px] px-4 text-[.75rem] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
          >
            <svg
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              className={clearing ? "animate-spin" : ""}
            >
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
            {clearing ? "Clearing…" : "Clear cache"}
          </button>
          {clearMsg && (
            <span
              className={`font-mono text-[11px] ${clearMsg.ok ? "text-[var(--accent)]" : "text-red-400"}`}
            >
              {clearMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-6 flex items-center gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => changeTab(t.value)}
            aria-current={tab === t.value ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[.8rem] font-medium transition-colors cursor-pointer ${
              tab === t.value
                ? "border-[var(--accent)] text-[var(--fg)]"
                : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "site" && (
        <>
        {/* ── Empty state for filtered range ── */}
        {totalVisits === 0 && dateRange !== "all" && (
          <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 flex items-center gap-3">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-[var(--fg-muted)] shrink-0">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
            <p className="font-mono text-[11px] text-[var(--fg-muted)]">
              No visits recorded for <span className="text-[var(--fg)]">{rangeLabel(dateRange)}</span>.
            </p>
          </div>
        )}

        {/* ── Stats Row ── */}
        <div className="flex gap-3 flex-wrap mb-5">
          <StatCard
            label="Sessions"
            value={totalVisits.toLocaleString()}
            sub="total visits"
          />
          <StatCard
            label="Page Views"
            value={totalPageViews.toLocaleString()}
            sub="total route hits"
          />
          <StatCard
            label="Blog Reads"
            value={totalBlogReads.toLocaleString()}
            sub="post views"
          />
          <StatCard
            label="Top Page"
            value={keyToRoute(topPageKey)}
            sub={topPageCount ? `${topPageCount} views` : "—"}
            valueClassName="text-[.95rem] break-all"
          />
        </div>

        {/* ── Page Views + Blog Posts ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Panel title="Page Views">
            <BarChart data={activeData?.pageViews} labelFn={keyToRoute} />
          </Panel>

          <Panel title="Blog Posts">
            {sumRecord(activeData?.blogs) === 0 ? (
              <p className="text-sm text-[var(--fg-muted)] opacity-40 py-1">No blog visits yet</p>
            ) : (
              <BarChart data={activeData?.blogs} labelFn={(k) => k.replace(/__/g, "/")} />
            )}
          </Panel>
        </div>

        {/* ── Devices / OS / Browsers ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Panel title="Devices">
            <BarChart data={activeData?.devices} />
          </Panel>
          <Panel title="OS">
            <BarChart data={activeData?.os} labelFn={keyToLabel} />
          </Panel>
          <Panel title="Browsers">
            <BarChart data={activeData?.browsers} labelFn={keyToLabel} />
          </Panel>
        </div>

        {/* ── Timezones ── */}
        <Panel title="Timezones">
          <BarChart
            data={activeData?.timezones}
            labelFn={(k) => k.replace(/__/g, "/")}
            maxItems={10}
          />
        </Panel>

        {/* ── Referrers ── */}
        <div className="mt-4">
          <Panel title="Referrers" action={<ReferrerLegend />}>
            <BarChart data={referrerCounts} descFn={(k) => REFERRER_HINTS[k]} maxItems={10} />
          </Panel>
        </div>

        {/* ── Recent Visits ── */}
        <div className={
          visitsFullscreen
            ? "fixed inset-x-0 bottom-0 top-[60px] z-40 flex flex-col bg-[var(--bg)]"
            : `mt-4 ${CARD} overflow-hidden`
        }>
          <div className={`px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4 flex-wrap ${visitsFullscreen ? "shrink-0" : ""}`}>
            <p className={SEC_LBL}>Recent Visits</p>
            <div className="flex items-center gap-3 flex-1 justify-end flex-wrap">
              <input
                type="search"
                value={visitsSearch}
                onChange={(e) => setVisitsSearch(e.target.value)}
                placeholder="Search…"
                className="bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] py-1.5 px-3 w-48"
              />
              <button
                onClick={() => setHideBots((v) => !v)}
                title={hideBots ? "Hiding likely bots (headless browser)" : "Showing bots"}
                className={`shrink-0 px-2.5 py-1.5 rounded-md text-[11px] font-mono transition-colors ${
                  hideBots
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                Hide bots
              </button>
              {!!visibleVisits.length && (
                <span className="font-mono text-[11px] text-[var(--fg-muted)] shrink-0">
                  {visibleVisits.length} entries
                </span>
              )}
              <FullscreenToggle on={visitsFullscreen} onToggle={() => setVisitsFullscreen((v) => !v)} />
            </div>
          </div>

          <div className={`overflow-x-auto overflow-y-auto ${visitsFullscreen ? "flex-1" : "max-h-[420px]"}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["Route", "Blog Slug", "Referrer", "Device", "OS", "Browser", "Timezone", "Time"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--fg-muted)] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!visibleVisits.length ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center font-mono text-xs text-[var(--fg-muted)] opacity-40"
                    >
                      No visits recorded yet
                    </td>
                  </tr>
                ) : (
                  visibleVisits
                  .filter((v) => {
                    const q = visitsSearch.toLowerCase();
                    if (!q) return true;
                    return [v.route, v.blogSlug, v.referrer, v.device, v.os, v.browser, v.timezone]
                      .some((f) => f?.toLowerCase().includes(q));
                  })
                  .map((v) => (
                    <tr
                      key={v.key}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg)] max-w-[120px]">
                        <span className="block truncate" title={v.route}>{v.route}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg-muted)] max-w-[120px]">
                        {v.blogSlug
                          ? <span className="block truncate" title={v.blogSlug}>{v.blogSlug}</span>
                          : <span className="opacity-30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--fg-muted)] max-w-[120px]">
                        {v.referrer
                          ? <span className="block truncate" title={v.referrer}>{extractHostname(v.referrer)}</span>
                          : <span className="opacity-30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--fg-secondary)] whitespace-nowrap capitalize">
                        {v.device}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--fg-secondary)] whitespace-nowrap">
                        {v.os}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--fg-secondary)] whitespace-nowrap">
                        {v.browser}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--fg-muted)] whitespace-nowrap">
                        {v.timezone}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--fg-muted)] whitespace-nowrap">
                        {relativeTime(v.ts)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {tab === "users" && (
        <>
        {/* ── Olum CLI telemetry ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[var(--fg)] font-bold text-lg tracking-tight">Olum Users</h2>
            <Hint
              placement="bottom"
              content={
                <div className="flex flex-col gap-2 py-0.5 text-left leading-[1.5]">
                  <div>
                    Anonymous pings sent by the Olum CLI. Each row is one ping, not one person —
                    no identifier is stored, so the same machine reporting twice counts twice.
                  </div>
                  <div className="opacity-80">
                    Treat the total as usage volume, not a headcount.
                  </div>
                  <div className="opacity-80">
                    <span className="text-[var(--fg)]">Unique</span> counts one machine once:
                    pings that agree on timezone, OS, Node, CLI, Olum and compiler version are
                    folded into a single user. It is a best guess — two machines set up the same
                    way look identical.
                  </div>
                  <div className="opacity-80">
                    The date range and the excluded timezones above both apply here. Pings are
                    windowed by when we received them, not by the clock on the sending machine.
                    CLI pings are sparser than site visits, so a short range can leave this
                    section empty.
                  </div>
                </div>
              }
            >
              <button
                type="button"
                aria-label="What does this section count?"
                className="shrink-0 p-1 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors cursor-help"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
                </svg>
              </button>
            </Hint>
            <button
              onClick={() => setUniqueUsers((v) => !v)}
              title={
                uniqueUsers
                  ? "Counting unique users: timezone + OS + Node + CLI + Olum + compiler"
                  : "Counting every ping"
              }
              className={`ml-auto shrink-0 px-2.5 py-1.5 rounded-md text-[11px] font-mono transition-colors ${
                uniqueUsers
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              Unique
            </button>
          </div>

          {/* Same note as the visits table gets: an empty section is far more often
              a narrow range than a dead CLI. */}
          {!telemetryEvents.length && dateRange !== "all" && (
            <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 flex items-center gap-3">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-[var(--fg-muted)] shrink-0">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
              </svg>
              <p className="font-mono text-[11px] text-[var(--fg-muted)]">
                No CLI pings received in <span className="text-[var(--fg)]">{rangeLabel(dateRange)}</span>.
              </p>
            </div>
          )}

          {/* the three headline numbers: projects scaffolded, flags used, components installed */}
          <div className="flex gap-3 flex-wrap mb-3">
            <StatCard
              label="Projects Created"
              value={telemetryBreakdown.projectsCreated.toLocaleString()}
              sub={uniqueUsers ? "users who ran olum create" : "olum create runs"}
            />
            <StatCard
              label="Options Used"
              value={telemetryBreakdown.optionsUsed.toLocaleString()}
              sub={`${Object.keys(telemetryBreakdown.optionCounts).length} distinct flag${
                Object.keys(telemetryBreakdown.optionCounts).length === 1 ? "" : "s"
              }`}
            />
            <StatCard
              label="Components Added"
              value={telemetryBreakdown.componentsAdded.toLocaleString()}
              sub={`${Object.keys(telemetryBreakdown.components).length} distinct component${
                Object.keys(telemetryBreakdown.components).length === 1 ? "" : "s"
              }`}
            />
          </div>

          <div className="flex gap-3 flex-wrap mb-5">
            <StatCard
              label={uniqueUsers ? "Unique Users" : "Total Pings"}
              value={(uniqueUsers ? telemetryBreakdown.userCount : telemetryEvents.length).toLocaleString()}
              sub={uniqueUsers ? `of ${telemetryEvents.length.toLocaleString()} pings` : "CLI reports"}
            />
            <StatCard
              label="Top CLI"
              value={topEntry(telemetryBreakdown.cliVersions)[0]}
              sub={`${topEntry(telemetryBreakdown.cliVersions)[1] || 0} ${telemetryUnit}`}
              valueClassName="text-[.95rem] break-all"
            />
            <StatCard
              label="Top Olum"
              value={topEntry(telemetryBreakdown.olumVersions)[0]}
              sub={`${topEntry(telemetryBreakdown.olumVersions)[1] || 0} ${telemetryUnit}`}
              valueClassName="text-[.95rem] break-all"
            />
            <StatCard
              label="Top Compiler"
              value={topEntry(telemetryBreakdown.compilerVersions)[0]}
              sub={`${topEntry(telemetryBreakdown.compilerVersions)[1] || 0} ${telemetryUnit}`}
              valueClassName="text-[.95rem] break-all"
            />
            <StatCard
              label="Top Node"
              value={topEntry(telemetryBreakdown.nodeVersions)[0]}
              sub={`${topEntry(telemetryBreakdown.nodeVersions)[1] || 0} ${telemetryUnit}`}
              valueClassName="text-[.95rem] break-all"
            />
            <StatCard
              label="Top OS"
              value={topEntry(telemetryBreakdown.osCounts)[0]}
              sub={`${topEntry(telemetryBreakdown.osCounts)[1] || 0} ${telemetryUnit}`}
              valueClassName="text-[.95rem] break-all capitalize"
            />
            <StatCard
              label="Top Timezone"
              value={topEntry(telemetryBreakdown.timezoneCounts)[0]}
              sub={`${topEntry(telemetryBreakdown.timezoneCounts)[1] || 0} ${telemetryUnit}`}
              valueClassName="text-[.95rem] break-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Panel title="Commands">
              <BarChart data={telemetryBreakdown.typeCounts} descFn={(k) => TELEMETRY_TYPES[k]} />
            </Panel>
            <Panel title="Operating Systems">
              <BarChart data={telemetryBreakdown.osCounts} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Panel title="Components Added">
              <BarChart data={telemetryBreakdown.components} maxItems={10} />
            </Panel>
            <Panel title="Create Options">
              {/* share of every `create` run that passed the flag, not of all flags used */}
              <BarChart
                data={telemetryBreakdown.optionCounts}
                labelFn={(k) => `--${k}`}
                total={telemetryBreakdown.projectsCreated}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* the name given to `olum create`, kebab-cased by the CLI so the same
                project counts once however it was typed */}
            <Panel title="Project Names">
              <BarChart data={telemetryBreakdown.projects} maxItems={10} />
            </Panel>
            <Panel title="Timezones">
              <BarChart data={telemetryBreakdown.timezoneCounts} maxItems={10} />
            </Panel>
          </div>


          <div className={
            telemetryFullscreen
              ? "fixed inset-x-0 bottom-0 top-[60px] z-40 flex flex-col bg-[var(--bg)]"
              : `${CARD} overflow-hidden`
          }>
            <div className={`px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4 flex-wrap ${telemetryFullscreen ? "shrink-0" : ""}`}>
              <p className={SEC_LBL}>{uniqueUsers ? "Unique Users" : "Recent Pings"}</p>
              <div className="flex items-center gap-3">
                {!!visibleTelemetry.length && (
                  <span className="font-mono text-[11px] text-[var(--fg-muted)] shrink-0">
                    {visibleTelemetry.length} entries
                  </span>
                )}
                <FullscreenToggle on={telemetryFullscreen} onToggle={() => setTelemetryFullscreen((v) => !v)} />
              </div>
            </div>

            <div className={`overflow-x-auto overflow-y-auto ${telemetryFullscreen ? "flex-1" : "max-h-[420px]"}`}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {["Command", "Name", "Options", "CLI Version", "Olum Version", "Compiler", "Node", "OS", "Timezone", "Reported", "Received"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--fg-muted)] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!visibleTelemetry.length ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-10 text-center font-mono text-xs text-[var(--fg-muted)] opacity-40"
                      >
                        No CLI pings recorded yet
                      </td>
                    </tr>
                  ) : (
                    visibleTelemetry.map((e) => (
                      <tr
                        key={e.key}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span
                            className="font-mono text-[11px] rounded-md px-2 py-1 bg-[var(--surface-hover)] text-[var(--fg-secondary)]"
                            title={TELEMETRY_TYPES[e.type ?? "unknown"]}
                          >
                            {e.type ?? "unknown"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg)] max-w-[160px]">
                          {e.name
                            ? <span className="block truncate" title={e.name}>{e.name}</span>
                            : <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--fg-muted)] whitespace-nowrap">
                          {e.options?.length
                            ? e.options.map((flag) => `--${flag}`).join(" ")
                            : <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg-secondary)] whitespace-nowrap">
                          {e.cliVersion}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg-secondary)] whitespace-nowrap">
                          {e.olumVersion}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg-secondary)] whitespace-nowrap">
                          {e.compilerVersion ?? <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg-secondary)] whitespace-nowrap">
                          {/* stringified: the value is stored unvalidated, and a
                              non-primitive would otherwise crash the render */}
                          {isDef(e.nodeVersion) ? String(e.nodeVersion) : <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[var(--fg-secondary)] whitespace-nowrap capitalize">
                          {e.os}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--fg-secondary)] whitespace-nowrap">
                          {e.timezone ?? <span className="opacity-30">—</span>}
                        </td>
                        {/* Reported = the clock on the user's machine; Received = ours. They
                            disagree when a machine's clock is wrong, which is worth seeing. */}
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--fg-muted)] whitespace-nowrap">
                          <span title={e.timestamp}>
                            {new Date(e.timestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--fg-muted)] whitespace-nowrap">
                          {relativeTime(e.ts)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
