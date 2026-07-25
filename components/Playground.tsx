"use client";
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import sdk, { type VM } from "@stackblitz/sdk";
import { useTheme } from "@/components/ThemeProvider";
import {
  type PlaygroundGroup,
  STARTER_REPO_SLUG,
  examplePreviewPath,
  findExample,
  defaultExample,
  openFileList,
} from "@/lib/playground-examples";

/* ─── Examples dropdown ─────────────────────────────────────── */
function ExamplesDropdown({
  groups,
  currentSlug,
  onSelect,
}: {
  groups: PlaygroundGroup[];
  currentSlug: string;
  onSelect: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const current = findExample(groups, currentSlug);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Open the list centred on the current example rather than at the top — with
  // ~50 items the selection is usually well below the fold. Set scrollTop on the
  // panel directly instead of scrollIntoView, which would also scroll the page
  // behind it. The panel is absolutely positioned, so it is the items'
  // offsetParent and offsetTop is already relative to it. Layout effect so the
  // list paints at the right offset with no visible jump.
  useLayoutEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2;
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-[var(--border-hover)] bg-[var(--surface)] px-3 py-1.5 text-xs font-mono text-[var(--fg)] transition-colors hover:border-[var(--fg-muted)]"
      >
        <span className="text-[var(--fg-subtle)]">Example:</span>
        <span className="font-semibold">{current?.title ?? "Select…"}</span>
        <svg
          width="9" height="9" viewBox="0 0 10 10" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-60 overflow-y-auto rounded-xl animate-slide-down"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
          role="listbox"
        >
          {groups.map((group) => (
            <div key={group.slug} className="py-1.5">
              <p className="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--fg-subtle)]">
                {group.label}
              </p>
              {group.items.map((ex) => {
                const active = ex.slug === currentSlug;
                return (
                  <button
                    key={ex.slug}
                    ref={active ? activeRef : undefined}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(ex.slug);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--hover-overlay)] ${
                      active ? "text-[#25C97E]" : "text-[var(--fg-2)]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-[#25C97E]" : "bg-transparent"}`}
                    />
                    {ex.title}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Playground ────────────────────────────────────────────── */
export default function Playground({
  groups,
  initialSlug,
}: {
  groups: PlaygroundGroup[];
  initialSlug: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const vmRef = useRef<VM | null>(null);
  const slugRef = useRef(initialSlug); // always the latest selection
  const aliveRef = useRef(true);       // false once unmounted, to stop the poll
  const { theme } = useTheme();        // site theme, drives the embed theme
  const [slug, setSlug] = useState(initialSlug);
  const [ready, setReady] = useState(false);

  // Look up the editor files to open for a slug — every file in the example's
  // folder as a comma-separated list, so StackBlitz opens them all as tabs
  // (page.html active). See openFileList / @stackblitz/sdk OpenFileOption.
  const filesOf = useCallback(
    (s: string) => openFileList(findExample(groups, s)),
    [groups],
  );

  // Navigate the preview to the currently-selected example. In WebContainers the
  // dev server boots asynchronously and `preview.setUrl` is ignored until it is
  // up, so we wait for the preview URL to become available before pushing. We
  // read slugRef (not a captured value) so a switch made while the server is
  // still booting still lands on the right route.
  const navigatePreview = useCallback(async () => {
    const vm = vmRef.current;
    if (!vm) return;
    for (let i = 0; i < 120 && aliveRef.current; i++) {
      const url = await vm.preview.getUrl().catch(() => null);
      if (url) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (aliveRef.current) {
      vm.preview.setUrl(examplePreviewPath(slugRef.current)).catch(() => {});
    }
  }, []);

  // Embed the project once. The VM handle lets us switch files and navigate the
  // preview later without reloading the iframe.
  useEffect(() => {
    // WebContainers needs SharedArrayBuffer, which requires the document to be
    // cross-origin isolated. The COOP/COEP headers are scoped to /playground in
    // next.config, so they only take effect on a real document load of this
    // route. Arriving via client-side navigation from a non-isolated page leaves
    // `crossOriginIsolated` false and the embed fails silently — force one full
    // reload of the current URL to pick up the headers. The sessionStorage guard
    // ensures we never reload more than once if isolation still can't be had.
    const RELOAD_KEY = "pg-reload-for-coi";
    if (window.crossOriginIsolated) {
      sessionStorage.removeItem(RELOAD_KEY);
    } else if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
      return;
    }

    aliveRef.current = true; // reset for Strict Mode's second mount
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    // The SDK replaces the element it's given with the iframe, so embed into a
    // throwaway child of the stable host (also makes the effect safe to re-run
    // under React Strict Mode).
    const target = document.createElement("div");
    host.replaceChildren(target);

    // Read the applied theme from the DOM (set before paint) so the initial
    // embed matches even before the ThemeProvider's own effect has run. Live
    // changes are handled by the reactive effect below.
    const embedTheme =
      document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

    // Import and run the GitHub repo (olumjs/olum-starter@examples) live in
    // StackBlitz WebContainers — no StackBlitz-hosted project involved.
    sdk
      .embedGithubProject(target, STARTER_REPO_SLUG, {
        forceEmbedLayout: true,
        openFile: filesOf(initialSlug),
        view: "default",
        theme: embedTheme,
        hideNavigation: true,
        hideExplorer: true,
        hideDevTools: true,
        terminalHeight: 0, // minimize the terminal
        height: "100%",
        crossOriginIsolated: true,
      })
      .then((vm) => {
        if (cancelled) return;
        vmRef.current = vm;
        setReady(true);
        // Point the previewed app at the matching route once its server boots.
        navigatePreview();
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      aliveRef.current = false;
      vmRef.current = null;
      host.replaceChildren();
    };
    // initialSlug is only the seed; subsequent switches go through selectExample.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the embed's editor theme in sync with the site theme. Runs once the VM
  // is ready and again whenever the user toggles the theme.
  useEffect(() => {
    if (!ready) return;
    vmRef.current?.editor.setTheme(theme).catch(() => {});
  }, [theme, ready]);

  const selectExample = useCallback((next: string) => {
    if (next === slugRef.current) return;
    slugRef.current = next;
    setSlug(next);
    // Update the URL in place — no Next navigation, so the iframe stays mounted.
    window.history.pushState(null, "", `/playground/${next}`);
    const vm = vmRef.current;
    const files = filesOf(next);
    if (vm && files) {
      vm.editor.openFile(files).catch(() => {});
      navigatePreview();
    }
  }, [filesOf, navigatePreview]);

  // Keep the selected example in sync with the browser's back/forward buttons.
  useEffect(() => {
    function onPop() {
      // /playground/<group>/<item> → "group/item"
      const segs = window.location.pathname.split("/").filter(Boolean);
      segs.shift(); // drop "playground"
      const ex = findExample(groups, segs.join("/")) ?? defaultExample(groups);
      if (!ex) return;
      slugRef.current = ex.slug;
      setSlug(ex.slug);
      const vm = vmRef.current;
      const files = openFileList(ex);
      if (vm && files) {
        vm.editor.openFile(files).catch(() => {});
        navigatePreview();
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [groups, navigatePreview]);

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)] pt-[60px]">
      {/* Branded toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--card)] px-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#25C97E] shadow-[0_0_8px_rgba(37,201,126,0.7)]" />
          <span
            className="hidden sm:inline text-sm font-bold text-[var(--fg)]"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Playground
          </span>
          <ExamplesDropdown groups={groups} currentSlug={slug} onSelect={selectExample} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/docs"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[var(--border-hover)] bg-[var(--surface)] px-3 py-1.5 text-xs font-mono text-[var(--fg-2)] transition-colors hover:border-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            Read the docs
          </Link>
          <a
            href="https://github.com/olumjs"
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(37,201,126,0.2)] bg-[rgba(37,201,126,0.08)] px-3 py-1.5 text-xs font-mono font-semibold text-[#25C97E] transition-colors hover:bg-[rgba(37,201,126,0.14)]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            Star on GitHub
          </a>
        </div>
      </div>

      {/* Editor + preview */}
      <div className="relative min-h-0 flex-1">
        {!ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[var(--bg)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[#25C97E]" />
            <p className="text-xs font-mono text-[var(--fg-subtle)]">Booting the playground…</p>
          </div>
        )}
        <div
          ref={hostRef}
          className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
        />
      </div>
    </div>
  );
}
