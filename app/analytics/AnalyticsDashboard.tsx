"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  nodeMajor: number;
  os: string;
  timestamp: string;
  ts: number;
}

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

type DateRange = "all" | "24h" | "7d" | "30d" | "90d";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
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

function sumRecord(rec?: Record<string, number>): number {
  return Object.values(rec ?? {}).reduce((a, b) => a + b, 0);
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

function getRangeStart(range: DateRange): number | null {
  if (range === "all") return null;
  const ms: Record<string, number> = {
    "24h": 86_400_000,
    "7d": 7 * 86_400_000,
    "30d": 30 * 86_400_000,
    "90d": 90 * 86_400_000,
  };
  return Date.now() - ms[range];
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

// ─── Sub-components ───────────────────────────────────────────────────────────

// Lightweight CSS-only tooltip (no external UI lib). Shows on hover/focus.
function Hint({ content, children, className = "" }: { content: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={`group/hint relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-max max-w-[280px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[.78rem] leading-[1.6] text-[var(--fg-secondary)] opacity-0 shadow-lg transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100"
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
}: {
  data?: Record<string, number>;
  labelFn?: (key: string) => string;
  descFn?: (key: string) => string | undefined;
  maxItems?: number;
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
          </div>
        );
      })}
    </div>
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
  const [visitsFullscreen, setVisitsFullscreen] = useState(false);
  const [hideBots, setHideBots] = useState(true);

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

  const activeData = useMemo<AnalyticsData | null>(() => {
    if (!data) return null;
    const since = getRangeStart(dateRange);
    const visits = since
      ? (data.recentVisits ?? []).filter((v) => v.ts >= since)
      : (data.recentVisits ?? []);
    return computeFromVisits(visits);
  }, [data, dateRange]);

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

  // Telemetry honours the same date range as the visit data, so both halves of
  // the dashboard always describe the same period.
  const telemetryEvents = useMemo<TelemetryEvent[]>(() => {
    const events = telemetry?.events ?? [];
    const since = getRangeStart(dateRange);
    return since ? events.filter((e) => e.ts >= since) : events;
  }, [telemetry, dateRange]);

  const telemetryBreakdown = useMemo(() => {
    const cliVersions: Record<string, number> = {};
    const olumVersions: Record<string, number> = {};
    const nodeVersions: Record<string, number> = {};
    const osCounts: Record<string, number> = {};

    for (const e of telemetryEvents) {
      cliVersions[e.cliVersion] = (cliVersions[e.cliVersion] ?? 0) + 1;
      olumVersions[e.olumVersion] = (olumVersions[e.olumVersion] ?? 0) + 1;
      nodeVersions[`node ${e.nodeMajor}`] = (nodeVersions[`node ${e.nodeMajor}`] ?? 0) + 1;
      osCounts[e.os] = (osCounts[e.os] ?? 0) + 1;
    }

    return { cliVersions, olumVersions, nodeVersions, osCounts };
  }, [telemetryEvents]);

  // Visits to show in the table — every visit, minus bots when that filter is on.
  const visibleVisits = useMemo<RecentVisit[]>(() => {
    const visits = activeData?.recentVisits ?? [];
    return hideBots ? visits.filter((v) => !isBotVisit(v)) : visits;
  }, [activeData, hideBots]);

  // Change the range and reset the search so filtered results aren't confusing.
  const changeDateRange = (range: DateRange) => {
    setDateRange(range);
    setVisitsSearch("");
  };

  // Close fullscreen on Escape; lock page scroll while fullscreen
  useEffect(() => {
    if (!visitsFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setVisitsFullscreen(false); };
    window.addEventListener("keydown", handler);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.documentElement.style.overflow = "";
    };
  }, [visitsFullscreen]);

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
          {lastVisitedStr && (
            <p className="font-mono text-[11px] text-[var(--fg-muted)] mt-2 opacity-70">
              Last visitor: {lastVisitedStr}
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
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
              width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
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

      {/* ── Empty state for filtered range ── */}
      {totalVisits === 0 && dateRange !== "all" && (
        <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 flex items-center gap-3">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-[var(--fg-muted)] shrink-0">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
          </svg>
          <p className="font-mono text-[11px] text-[var(--fg-muted)]">
            No visits recorded for <span className="text-[var(--fg)]">{DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label}</span>.
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
            <button
              onClick={() => setVisitsFullscreen((v) => !v)}
              title={visitsFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="shrink-0 p-1.5 rounded-md hover:bg-[var(--surface-hover)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              {visitsFullscreen ? (
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
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

      {/* ── Olum CLI telemetry ── */}
      <div className="mt-12">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[var(--fg)] font-bold text-lg tracking-tight">Olum Users</h2>
          <Hint
            content={
              <div className="flex flex-col gap-2 py-0.5 text-left leading-[1.5]">
                <div>
                  Anonymous pings sent by the Olum CLI. Each row is one ping, not one person —
                  no identifier is stored, so the same machine reporting twice counts twice.
                </div>
                <div className="opacity-80">
                  Treat the total as usage volume, not a headcount.
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
        </div>

        <div className="flex gap-3 flex-wrap mb-5">
          <StatCard
            label="Total Pings"
            value={telemetryEvents.length.toLocaleString()}
            sub="CLI reports"
          />
          <StatCard
            label="Top CLI"
            value={topEntry(telemetryBreakdown.cliVersions)[0]}
            sub={`${topEntry(telemetryBreakdown.cliVersions)[1] || 0} pings`}
            valueClassName="text-[.95rem] break-all"
          />
          <StatCard
            label="Top Olum"
            value={topEntry(telemetryBreakdown.olumVersions)[0]}
            sub={`${topEntry(telemetryBreakdown.olumVersions)[1] || 0} pings`}
            valueClassName="text-[.95rem] break-all"
          />
          <StatCard
            label="Top Node"
            value={topEntry(telemetryBreakdown.nodeVersions)[0]}
            sub={`${topEntry(telemetryBreakdown.nodeVersions)[1] || 0} pings`}
            valueClassName="text-[.95rem] break-all"
          />
          <StatCard
            label="Top OS"
            value={topEntry(telemetryBreakdown.osCounts)[0]}
            sub={`${topEntry(telemetryBreakdown.osCounts)[1] || 0} pings`}
            valueClassName="text-[.95rem] break-all capitalize"
          />
        </div>

        <div className={`${CARD} overflow-hidden`}>
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4 flex-wrap">
            <p className={SEC_LBL}>Recent Pings</p>
            <div className="flex items-center gap-3">
              {!!telemetryEvents.length && (
                <span className="font-mono text-[11px] text-[var(--fg-muted)] shrink-0">
                  {telemetryEvents.length} entries
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["CLI Version", "Olum Version", "Node", "OS", "Reported", "Received"].map((h) => (
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
                {!telemetryEvents.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center font-mono text-xs text-[var(--fg-muted)] opacity-40"
                    >
                      No CLI pings recorded yet
                    </td>
                  </tr>
                ) : (
                  telemetryEvents.map((e) => (
                    <tr
                      key={e.key}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg)] whitespace-nowrap">
                        {e.cliVersion}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg-secondary)] whitespace-nowrap">
                        {e.olumVersion}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--fg-secondary)] whitespace-nowrap">
                        {e.nodeMajor}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--fg-secondary)] whitespace-nowrap capitalize">
                        {e.os}
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
    </div>
  );
}
