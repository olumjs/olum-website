"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SidebarGroup, SidebarItem } from "@/lib/docs-content";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

// Per-repo UI state: which branch is picked and the file list for it.
type SectionState = { branch: string; items: SidebarItem[]; loading: boolean };

export default function DocsSidebar({
  groups,
  activeRepo,
  activeRef,
}: {
  groups: SidebarGroup[];
  activeRepo?: string;
  activeRef?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // The sidebar remounts on every doc navigation (it's rendered per-page, not
  // in a shared layout), so restore its scroll offset from sessionStorage
  // rather than relying on the DOM node surviving across pages.
  useLayoutEffect(() => {
    const saved = sessionStorage.getItem("docs-sidebar-scroll");
    if (saved && scrollRef.current) scrollRef.current.scrollTop = Number(saved);
  }, []);

  const [state, setState] = useState<Record<string, SectionState>>(() => {
    const init: Record<string, SectionState> = {};
    for (const g of groups) {
      if (g.repo) init[g.repo] = { branch: g.defaultBranch ?? "", items: g.items, loading: false };
    }
    return init;
  });

  // Only the section containing the currently viewed doc starts expanded.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const activeLabel = groups.find((g) =>
      activeRepo
        ? g.repo === activeRepo
        : g.items.some((i) => i.href.split("?")[0] === pathname)
    )?.label;
    const init: Record<string, boolean> = {};
    for (const g of groups) init[g.label] = g.label === activeLabel;
    if (!activeLabel && groups[0]) init[groups[0].label] = true;
    return init;
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((s) => ({ ...s, [label]: !s[label] }));

  async function selectBranch(group: SidebarGroup, branch: string, syncUrl = true) {
    setOpenGroups((s) => ({ ...s, [group.label]: true }));
    const repo = group.repo!;
    const fixed = group.items.filter((i) => i.fixed);
    const isDefault = branch === group.defaultBranch;

    // Keep the current doc in view but at the selected branch, and reflect the
    // choice in the URL so window.location stays in sync (and the page re-renders
    // its content at the picked ref).
    if (syncUrl) {
      const query = isDefault
        ? ""
        : `?repo=${encodeURIComponent(repo)}&ref=${encodeURIComponent(branch)}`;
      router.push(`${pathname}${query}`, { scroll: false });
    }

    if (isDefault) {
      setState((s) => ({ ...s, [repo]: { branch, items: group.items, loading: false } }));
      return;
    }

    setState((s) => ({ ...s, [repo]: { ...s[repo], branch, loading: true } }));
    try {
      const res = await fetch(
        `/api/docs/files?repo=${encodeURIComponent(repo)}&ref=${encodeURIComponent(branch)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { docs: { slug: string; title: string }[] } = await res.json();
      const fetched: SidebarItem[] = data.docs.map((d) => ({
        label: d.title,
        href: `/docs/${d.slug}?repo=${encodeURIComponent(repo)}&ref=${encodeURIComponent(branch)}`,
      }));
      setState((s) => ({ ...s, [repo]: { branch, items: [...fixed, ...fetched], loading: false } }));
    } catch {
      setState((s) => ({ ...s, [repo]: { branch, items: fixed, loading: false } }));
    }
  }

  // Deep-link support: if the current page is a versioned view, pre-load that
  // branch's file list into its section on mount.
  useEffect(() => {
    if (!activeRepo || !activeRef) return;
    const group = groups.find((g) => g.repo === activeRepo);
    if (group && activeRef !== group.defaultBranch) selectBranch(group, activeRef, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = (item: SidebarItem) => {
    const [path, query] = item.href.split("?");
    if (path !== pathname) return false;
    const itemRef = query ? new URLSearchParams(query).get("ref") : null;
    return (itemRef ?? undefined) === (activeRef ?? undefined);
  };

  return (
    <aside className="hidden lg:block w-60 shrink-0">
      <div
        ref={scrollRef}
        onScroll={(e) => sessionStorage.setItem("docs-sidebar-scroll", String(e.currentTarget.scrollTop))}
        className="sticky top-24 overflow-y-auto max-h-[calc(100vh-6rem)] pr-2 scrollbar-thin"
      >
        <nav className="space-y-6 pb-12">
          {groups.map((group) => {
            const st = group.repo ? state[group.repo] : undefined;
            const items = st ? st.items : group.items;
            const isOpen = !!openGroups[group.label];
            return (
              <div key={group.label}>
                <div className="flex items-center justify-between gap-2 mb-2 px-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={isOpen}
                    className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[var(--fg)] font-mono cursor-pointer hover:text-[#25C97E]"
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={`shrink-0 opacity-70 transition-transform duration-150 ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    >
                      <path d="M4.5 3L7.5 6L4.5 9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <h4>{group.label}</h4>
                  </button>
                  {group.branches && group.branches.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`${group.label} version`}
                        className="inline-flex items-center gap-1 max-w-[8rem] text-[11px] font-mono rounded-md bg-[var(--card)] border border-[var(--border)] text-[var(--fg-2)] px-1.5 py-1 outline-none hover:border-[var(--border-hover)] data-[state=open]:border-[#25C97E] cursor-pointer"
                      >
                        <span className="truncate">{st?.branch ?? group.defaultBranch}</span>
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="shrink-0 opacity-70"
                        >
                          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuRadioGroup
                          value={st?.branch ?? group.defaultBranch ?? ""}
                          onValueChange={(v) => selectBranch(group, v)}
                        >
                          {group.branches.map((b) => (
                            <DropdownMenuRadioItem key={b} value={b}>
                              {b}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {!isOpen ? null : st?.loading ? (
                  <p className="px-3 py-1.5 text-xs text-[var(--fg-subtle)] font-mono">Loading…</p>
                ) : (
                  <ul className="space-y-0.5">
                    {items.map((item) => {
                      const active = isActive(item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 ${
                              active
                                ? "bg-[rgba(37,201,126,0.1)] text-[#25C97E] font-medium"
                                : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[rgba(255,255,255,0.04)]"
                            }`}
                          >
                            {active && <span className="w-1 h-1 rounded-full bg-[#25C97E]" />}
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
