"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { SidebarGroup } from "@/lib/docs-content";
import { formatStars, REPO_URL } from "@/lib/github-stars";

// const versions = [
  // { label: "v2.0", tag: "latest", href: "/docs", current: true },
  // { label: "v1.4", tag: "stable", href: "/docs/v1", current: false },
  // { label: "v1.0", tag: "legacy", href: "/docs/v1.0", current: false },
// ];

function VersionDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // const current = versions?.find((v) => v?.current)!;

  return (
    <div ref={ref} className="relative hidden sm:block">
      {/* <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] font-mono font-semibold text-[#25C97E] bg-[rgba(37,201,126,0.08)] hover:bg-[rgba(37,201,126,0.14)] border border-[rgba(37,201,126,0.2)] px-2 py-[5px] rounded transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.label}
        <svg
          width="9" height="9" viewBox="0 0 10 10" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button> */}

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-48 rounded-xl overflow-hidden z-50 animate-slide-down"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
          role="listbox"
        >
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <p className="text-[10px] font-mono text-[var(--fg-subtle)] uppercase tracking-widest">Switch version</p>
          </div>
{/* 
          {versions.map((v) => (
            <Link
              key={v.label}
              href={v.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-[var(--hover-overlay)]"
              role="option"
              aria-selected={v.current}
            >
              <div className="flex items-center gap-2">
                {v.current
                  ? <span className="w-1.5 h-1.5 rounded-full bg-[#25C97E]" />
                  : <span className="w-1.5 h-1.5 rounded-full" />
                }
                <span className={`font-mono font-semibold ${v.current ? "text-[#25C97E]" : "text-[var(--fg-2)]"}`}>
                  {v.label}
                </span>
              </div>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={
                  v.tag === "latest"
                    ? { background: "rgba(37,201,126,0.12)", color: "#25C97E", border: "1px solid rgba(37,201,126,0.25)" }
                    : v.tag === "stable"
                    ? { background: "rgba(37,201,126,0.1)", color: "#25C97E", border: "1px solid rgba(37,201,126,0.2)" }
                    : { background: "rgba(255,255,255,0.05)", color: "var(--fg-subtle)", border: "1px solid var(--border)" }
                }
              >
                {v.tag}
              </span>
            </Link>
          ))} */}

          <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
            <a
              href="/docs/changelog"
              className="text-[11px] text-[var(--fg-subtle)] hover:text-[#25C97E] transition-colors font-mono"
              onClick={() => setOpen(false)}
            >
              View changelog →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Search quick-links ────────────────────────────────── */
type SearchLink = { label: string; category: string; href: string; featured?: true };

// Hrefs surfaced under "Quick Navigation" (shown when the search box is empty).
const FEATURED_HREFS = new Set([
  "/docs",
  "/docs/get-started",
  "/docs/state",
  "/docs/text-interpolation",
  "/docs/conditionals",
  "/docs/loops",
  "/docs/events",
  "/docs/components",
  "/docs/router",
  "/docs/common-mistakes",
  "/docs/quick-reference",
]);

// Derived from the docs sidebar (passed in from the server) so every docs route
// is always searchable — no separate list to keep in sync.
function buildSearchLinks(groups: SidebarGroup[]): SearchLink[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      label: item.label,
      category: group.label,
      href: item.href,
      ...(FEATURED_HREFS.has(item.href) ? { featured: true as const } : {}),
    }))
  );
}

function SearchModal({ onClose, searchLinks }: { onClose: () => void; searchLinks: SearchLink[] }) {
  const SEARCH_LINKS = searchLinks;
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = query
    ? SEARCH_LINKS.filter(
        (l) =>
          l.label.toLowerCase().includes(query.toLowerCase()) ||
          l.category.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_LINKS.filter((l) => l.featured);

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = filtered[activeIdx];
        if (target) { router.push(target.href); onClose(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, filtered, activeIdx, router]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[14vh] px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden animate-search-appear"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(37,201,126,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs, guides, blog posts…"
            className="flex-1 bg-transparent text-sm text-[var(--fg)] placeholder-[var(--fg-subtle)] outline-none font-mono"
          />
          <kbd className="kbd">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="p-2 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-xs font-mono text-[var(--fg-subtle)] py-6">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            <>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--fg-subtle)] px-3 py-2">
                {query ? "Results" : "Quick Navigation"}
              </p>
              {filtered.map((link, i) => (
                <Link
                  key={link.label}
                  href={link.href}
                  data-idx={i}
                  onClick={onClose}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    i === activeIdx ? "bg-[var(--hover-overlay)]" : "hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(37,201,126,0.08)", border: "1px solid rgba(37,201,126,0.15)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#25C97E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <span className={`transition-colors ${i === activeIdx ? "text-[var(--fg)]" : "text-[var(--fg-2)] group-hover:text-[var(--fg)]"}`}>{link.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--fg-subtle)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                    {link.category}
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] flex items-center gap-3 text-[11px] font-mono text-[var(--fg-subtle)]">
          <span className="flex items-center gap-1"><kbd className="kbd">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="kbd">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="kbd">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Search trigger button ─────────────────────────────── */
function SearchButton({ onClick }: { onClick: () => void }) {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return (
    <button
      onClick={onClick}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--fg-2)] bg-[var(--surface)] border border-[var(--border-hover)] hover:border-[var(--fg-muted)] hover:text-[var(--fg)] transition-all duration-150 group"
      aria-label="Search documentation"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <span className="text-xs font-mono">Search docs…</span>
      <kbd className="kbd ml-1">{isMac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}

const navLinks: { href: string; label: string; external?: boolean; reload?: boolean }[] = [
  { href: "/docs", label: "Docs" },
  // `reload` forces a full page load so the playground's cross-origin isolation
  // headers apply (WebContainers needs SharedArrayBuffer). See Playground.tsx.
  { href: "/playground", label: "Playground", reload: true },
  { href: "https://code.olumjs.top", label: "Sandbox", external: true },
  { href: "https://ui.olumjs.top", label: "UI", external: true },
  { href: "/blog", label: "Blog" },
];

export default function Navbar({
  navGroups,
  githubStars,
}: {
  navGroups: SidebarGroup[];
  // Read server-side from the main repo (see lib/github-stars.ts); null when the
  // GitHub call failed, in which case the count is simply left out.
  githubStars: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchLinks = useMemo(() => buildSearchLinks(navGroups), [navGroups]);
  // Null hides the badge entirely: both when GitHub could not be reached and
  // when the count is 0 -- a bare "0" beside the icon reads worse than no
  // number at all.
  const stars = githubStars !== null && githubStars > 0 ? formatStars(githubStars) : null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {searchOpen && <SearchModal onClose={closeSearch} searchLinks={searchLinks} />}

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "backdrop-blur-2xl border-b border-[var(--border)]" : ""}`}
        style={scrolled ? { background: "color-mix(in srgb, var(--bg) 88%, transparent)" } : undefined}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[60px] flex items-center justify-between gap-4">
          {/* Logo + version */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.svg" width={28} height={28} alt="Olum logo" />
              <span className="text-[1.2rem] font-extrabold tracking-tight text-[var(--fg)] relative top-[2px]" style={{ fontFamily: "var(--font-syne)" }}>
                Olum
              </span>
            </Link>
            <VersionDropdown />
          </div>

          {/* Search */}
          <SearchButton onClick={openSearch} />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((l) =>
              l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] rounded-lg hover:bg-[var(--hover-overlay)] transition-all duration-200"
                >
                  {l.label}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ) : l.reload ? (
                <a
                  key={l.href}
                  href={l.href}
                  className="px-4 py-2 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] rounded-lg hover:bg-[var(--hover-overlay)] transition-all duration-200"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-4 py-2 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] rounded-lg hover:bg-[var(--hover-overlay)] transition-all duration-200"
                >
                  {l.label}
                </Link>
              )
            )}
            <a
              href={REPO_URL}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] rounded-lg hover:bg-[var(--hover-overlay)] transition-all duration-200"
              aria-label={stars ? `GitHub — ${stars} stars` : "GitHub"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              {stars && <span className="tabular-nums text-xs font-medium">{stars}</span>}
            </a>
            <a
              href="https://bsky.app/profile/olumjs.bsky.social"
              className="flex items-center px-3 py-2 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] rounded-lg hover:bg-[var(--hover-overlay)] transition-all duration-200"
              aria-label="Bluesky"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z" />
              </svg>
            </a>
            <a
              href="https://discord.gg/2zK7tb2Cg9"
              className="flex items-center px-3 py-2 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] rounded-lg hover:bg-[var(--hover-overlay)] transition-all duration-200"
              aria-label="Discord"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.522 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
            </a>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle />

            {/* Mobile search */}
            <button
              onClick={openSearch}
              className="md:hidden p-2 text-[var(--fg-2)] hover:text-[var(--fg)] transition-colors rounded-lg hover:bg-[var(--surface)]"
              aria-label="Search"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 text-[var(--fg-2)] hover:text-[var(--fg)] transition-colors rounded-lg hover:bg-[var(--surface)]"
              aria-label="Toggle menu"
            >
              {open ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.293 3.293a1 1 0 011.414 0L9 7.586l4.293-4.293a1 1 0 111.414 1.414L10.414 9l4.293 4.293a1 1 0 01-1.414 1.414L9 10.414l-4.293 4.293a1 1 0 01-1.414-1.414L7.586 9 3.293 4.707a1 1 0 010-1.414z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <path fillRule="evenodd" d="M2 4.5a.5.5 0 01.5-.5h13a.5.5 0 010 1h-13a.5.5 0 01-.5-.5zm0 4a.5.5 0 01.5-.5h13a.5.5 0 010 1h-13a.5.5 0 01-.5-.5zm0 4a.5.5 0 01.5-.5h13a.5.5 0 010 1h-13a.5.5 0 01-.5-.5z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            className="md:hidden border-t border-[var(--border)] backdrop-blur-2xl animate-slide-down"
            style={{ background: "color-mix(in srgb, var(--bg) 96%, transparent)" }}
          >
            {navLinks.map((l) =>
              l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1.5 px-6 py-3.5 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--hover-overlay)] border-b border-[var(--border-subtle)] transition-colors"
                >
                  {l.label}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ) : l.reload ? (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-6 py-3.5 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--hover-overlay)] border-b border-[var(--border-subtle)] transition-colors"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-6 py-3.5 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--hover-overlay)] border-b border-[var(--border-subtle)] transition-colors"
                >
                  {l.label}
                </Link>
              )
            )}
            <a
              href={REPO_URL}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-6 py-3.5 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--hover-overlay)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              GitHub
              {stars && <span className="ml-auto tabular-nums text-xs font-medium">{stars}</span>}
            </a>
            <a
              href="https://bsky.app/profile/olumjs.bsky.social"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-6 py-3.5 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--hover-overlay)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z" />
              </svg>
              Bluesky
            </a>
            <a
              href="https://discord.gg/2zK7tb2Cg9"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-6 py-3.5 text-sm text-[var(--fg-2)] hover:text-[var(--fg)] hover:bg-[var(--hover-overlay)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.522 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
              Discord
            </a>
          </div>
        )}
      </header>
    </>
  );
}
