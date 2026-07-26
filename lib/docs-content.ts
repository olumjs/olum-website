import { cache } from "react";

// ── Config ──────────────────────────────────────────────────────────────────
// Docs are fetched from each repo's `docs/*.md` on its DEFAULT branch, then
// CACHED. The cache auto-revalidates weekly, and GET /api/clear-cache refetches
// on demand via revalidateTag(DOCS_TAG). Requires a server runtime (not static
// export / GitHub Pages).
// The sidebar renders one section per repo, in THIS order. Reorder to reorder
// the menu. `olum` → "core"; `olum-x` → "x" (see repoLabel).
export const DOC_REPOS = [
  {
    repo: "olumjs/olum",
    minVer: "v0.5.5",
  },
  {
    repo: "olumjs/olum-transition",
    minVer: "v0.2.0",
  },
  {
    repo: "olumjs/olum-router",
    minVer: "v0.3.1",
  },
  {
    repo: "olumjs/olum-store",
    minVer: "v0.1.0",
  },
];

// Cache tag shared by every GitHub fetch below; /api/clear-cache invalidates it.
export const DOCS_TAG = "docs";
// How long a cached fetch stays fresh before Next revalidates it (1 week).
const DOCS_REVALIDATE = 60 * 60 * 24 * 7;

// Sidebar section label for a repo: `olumjs/olum` → "core"; `olumjs/olum-x` → "x".
function repoLabel(repo: string): string {
  const short = repo.split("/")[1] ?? repo;
  if (short === "olum") return "core";
  return short.startsWith("olum-") ? short.slice("olum-".length) : short;
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface Doc {
  slug: string;
  repo: string; // "olumjs/olum"
  title: string;
  group: string;
  order: number;
  body: string; // markdown, frontmatter stripped
  editUrl: string; // GitHub blob URL for the source file
  lastModified?: string; // ISO date (YYYY-MM-DD) of the file's last commit, if known
}

export type SidebarItem = { label: string; href: string; fixed?: boolean };
export type SidebarGroup = {
  label: string;
  items: SidebarItem[];
  repo?: string; // "olumjs/olum" — sections backed by a repo get a branch dropdown
  defaultBranch?: string; // the repo's default branch (initially selected)
  branches?: string[]; // all branch names, for the version dropdown
};

// A doc's identity within a branch — used by the sidebar's file list.
export interface DocMeta {
  slug: string;
  title: string;
  order: number;
}

interface GhContentItem {
  name: string;
  type: string;
  download_url: string | null;
  html_url: string;
}

function isDocFile(it: GhContentItem): boolean {
  return it.type === "file" && it.name.endsWith(".md") && it.name.toLowerCase() !== "readme.md";
}

// ── Static (non-repo) docs ──────────────────────────────────────────────────
// Rendered like fetched docs but hardcoded here and pinned in the sidebar
// (alongside the Introduction). `get-started` lives here since create-olum
// isn't a fetched repo. An empty `editUrl` hides the "Edit on GitHub" link.
export const STATIC_DOCS: Doc[] = [
  {
    slug: "get-started",
    repo: "",
    title: "Get Started",
    group: "Getting Started",
    order: 0,
    editUrl: "",
    lastModified: "2026-07-04", // hand-maintained in-repo; bump when this content changes
    body: [
      "Scaffold a new OlumJS project with the official CLI — TypeScript, routing, and a dev server ready out of the box:",
      "",
      '```bash title="Terminal"',
      "npx create-olum my-app --tailwind",
      "```",
      "",
      ":::tip",
      "This scaffolds a full project with TypeScript, file-based routing, and a configured dev server in one command, with Tailwind CSS installed and configured automatically. Omit the `--tailwind` flag to skip Tailwind CSS setup.",
      ":::",
      "",
    ].join("\n"),
  },
];

// ── GitHub fetch ────────────────────────────────────────────────────────────
// A token (GITHUB_TOKEN) lifts the 60 req/hr unauthenticated limit but is optional —
// we make only ~1 API call per repo (the directory listing); file bodies come from
// the raw CDN via download_url, which isn't rate-limited. Set it in CI, where
// runners share IPs, to stay safely under the limit.
function ghHeaders(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// `next build` fans out across many workers that hit GitHub concurrently, and
// undici's default 10s connect timeout is easy to trip when the CDN is slow —
// a single thrown UND_ERR_CONNECT_TIMEOUT would otherwise fail the whole build.
// These are transient, so retry the *thrown* network/timeout errors (HTTP
// statuses are meaningful to callers and pass through untouched). The `next`
// cache options are preserved, so a successful attempt still caches normally.
const FETCH_RETRIES = 3;
async function ghFetch(url: string, init?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < FETCH_RETRIES) {
        const backoff = 500 * 2 ** attempt; // 0.5s, 1s, 2s
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastErr;
}

// Thrown when a branch simply has no `docs/` folder — a normal "no docs here"
// state (not an error), handled gracefully by the per-branch loaders.
class DocsDirNotFound extends Error {}

async function fetchDocsDir(repo: string, ref?: string): Promise<GhContentItem[]> {
  // No `ref` → GitHub serves the repo's default branch automatically.
  const url = ref
    ? `https://api.github.com/repos/${repo}/contents/docs?ref=${encodeURIComponent(ref)}`
    : `https://api.github.com/repos/${repo}/contents/docs`;
  const res = await ghFetch(url, {
    headers: ghHeaders(),
    next: { revalidate: DOCS_REVALIDATE, tags: [DOCS_TAG] },
  });
  if (!res.ok) {
    if (res.status === 404) throw new DocsDirNotFound(`No docs dir on ${repo}${ref ? `@${ref}` : ""}`);
    throw new Error(`Failed to list ${repo}/docs${ref ? `@${ref}` : ""}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function fetchRaw(url: string, label: string): Promise<string> {
  return ghFetch(url, { next: { revalidate: DOCS_REVALIDATE, tags: [DOCS_TAG] } }).then((r) => {
    if (!r.ok) throw new Error(`Failed to fetch ${label}: ${r.status}`);
    return r.text();
  });
}

// Last-modified date (ISO YYYY-MM-DD) for a docs file, read from its most recent
// commit. Powers accurate <lastmod> in the sitemap and dateModified in the doc's
// JSON-LD. Cached weekly like everything else, and deliberately fault-tolerant:
// any failure (rate limit, network, empty history) resolves to null so callers
// fall back to the build date instead of breaking the page. This adds ~1 API
// call per doc file — safe under the weekly cache; set GITHUB_TOKEN in CI.
async function fetchLastModified(repo: string, path: string, ref?: string): Promise<string | null> {
  const params = new URLSearchParams({ path, per_page: "1" });
  if (ref) params.set("sha", ref);
  try {
    const res = await ghFetch(`https://api.github.com/repos/${repo}/commits?${params}`, {
      headers: ghHeaders(),
      next: { revalidate: DOCS_REVALIDATE, tags: [DOCS_TAG] },
    });
    if (!res.ok) return null;
    const commits: { commit?: { committer?: { date?: string } } }[] = await res.json();
    const date = commits[0]?.commit?.committer?.date;
    return date ? date.split("T")[0] : null;
  } catch {
    return null;
  }
}

// Compare version-like branch names numerically, so "v0.5.10" > "v0.5.9"
// (a plain string sort gets this wrong). Names with no numeric part (e.g.
// "main", "dev") sort below versioned ones. Positive result → `a` is newer.
export function compareVersions(a: string, b: string): number {
  const parse = (s: string) =>
    s
      .match(/\d+(?:\.\d+)*/)?.[0]
      .split(".")
      .map(Number) ?? null;
  const pa = parse(a);
  const pb = parse(b);
  if (!pa && !pb) return a.localeCompare(b);
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

// This repo's configured minimum version, or "" if it isn't one we serve.
function minVerFor(repo: string): string {
  return DOC_REPOS.find((r) => r.repo === repo)?.minVer ?? "";
}

// Whether `repo` is one we serve.
export function isRepoAllowed(repo: string): boolean {
  return DOC_REPOS.some((r) => r.repo === repo);
}

// Whether a branch meets that repo's `minVer` floor.
export function isVersionAllowed(repo: string, branch: string): boolean {
  const min = minVerFor(repo);
  return !min || compareVersions(branch, min) >= 0;
}

// All branch names for a repo (for the version dropdown).
export const getBranches = cache(async (repo: string): Promise<string[]> => {
  const res = await ghFetch(`https://api.github.com/repos/${repo}/branches?per_page=100`, {
    headers: ghHeaders(),
    next: { revalidate: DOCS_REVALIDATE, tags: [DOCS_TAG] },
  });
  if (!res.ok) throw new Error(`Failed to list branches for ${repo}: ${res.status} ${res.statusText}`);
  const data: { name: string }[] = await res.json();
  return data.map((b) => b.name);
});

// Per-repo: branches (newest → oldest) and `latest` = the newest branch that
// actually has a docs/ folder. That's the version selected by default, so users
// land on the latest available docs (a newer branch without docs is skipped).
export const getRepoMeta = cache(async (repo: string): Promise<{ branches: string[]; latest: string }> => {
  const branches = (await getBranches(repo)).filter((b) => isVersionAllowed(repo, b)).sort((a, b) => compareVersions(b, a));
  for (const branch of branches) {
    try {
      await fetchDocsDir(repo, branch); // resolves only if the branch has docs/
      return { branches, latest: branch };
    } catch (e) {
      if (e instanceof DocsDirNotFound) continue; // skip to the next-newest branch
      throw e; // real failure (rate limit, network) — surface it
    }
  }
  return { branches, latest: branches[0] ?? "" }; // no branch had docs (unlikely)
});

// The docs (slug/title/order) of a repo on a specific branch — the sidebar's
// file list after a version is picked.
export async function getRepoDocMetas(repo: string, ref: string): Promise<DocMeta[]> {
  if (!isVersionAllowed(repo, ref)) return []; // below the version floor → not served
  let items: GhContentItem[];
  try {
    items = await fetchDocsDir(repo, ref);
  } catch (e) {
    if (e instanceof DocsDirNotFound) return []; // branch has no docs/ → empty list
    throw e;
  }
  const metas = await Promise.all(
    items.filter(isDocFile).map(async (file): Promise<DocMeta> => {
      const raw = await fetchRaw(file.download_url!, `${repo}/docs/${file.name}@${ref}`);
      const { data } = parseFrontmatter(raw);
      const slug = file.name.replace(/\.md$/, "");
      return { slug, title: data.title || slug, order: Number(data.order) || 0 };
    })
  );
  return metas.sort((a, b) => a.order - b.order);
}

// A single doc from a specific repo + branch (for the versioned doc page).
export async function getDocAt(repo: string, ref: string, slug: string): Promise<Doc | null> {
  if (!isVersionAllowed(repo, ref)) return null; // below the version floor → 404
  let items: GhContentItem[];
  try {
    items = await fetchDocsDir(repo, ref);
  } catch (e) {
    if (e instanceof DocsDirNotFound) return null; // branch has no docs/ → 404
    throw e;
  }
  const file = items.find((it) => isDocFile(it) && it.name === `${slug}.md`);
  if (!file?.download_url) return null;
  const [raw, lastModified] = await Promise.all([
    fetchRaw(file.download_url, `${repo}/docs/${file.name}@${ref}`),
    fetchLastModified(repo, `docs/${file.name}`, ref),
  ]);
  const { data, body } = parseFrontmatter(raw);
  return {
    slug,
    repo,
    title: data.title || slug,
    group: data.group || "Docs",
    order: Number(data.order) || 0,
    body,
    editUrl: file.html_url,
    ...(lastModified && { lastModified }),
  };
}

// ── Frontmatter ─────────────────────────────────────────────────────────────
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) data[key] = val;
  }
  return { data, body: raw.slice(m[0].length) };
}

// ── Loaders (cached per build/request) ──────────────────────────────────────
export const getAllDocs = cache(async (): Promise<Doc[]> => {
  const perRepo = await Promise.all(
    DOC_REPOS.map(async ({ repo }) => {
      const { latest } = await getRepoMeta(repo);
      const items = await fetchDocsDir(repo, latest); // cache hit — probed by getRepoMeta
      const mdFiles = items.filter(isDocFile);
      console.log(`[docs] ${repo} @ ${latest} (latest) — ${mdFiles.length} file(s)`);
      return Promise.all(
        mdFiles.map(async (file): Promise<Doc> => {
          const [raw, lastModified] = await Promise.all([
            fetchRaw(file.download_url!, `${repo}/docs/${file.name}@${latest}`),
            fetchLastModified(repo, `docs/${file.name}`, latest),
          ]);
          const { data, body } = parseFrontmatter(raw);
          const slug = file.name.replace(/\.md$/, "");
          return {
            slug,
            repo,
            title: data.title || slug,
            group: data.group || "Docs",
            order: Number(data.order) || 0,
            body,
            editUrl: file.html_url,
            ...(lastModified && { lastModified }),
          };
        })
      );
    })
  );

  const docs = perRepo.flat();
  // Guard against slug collisions across repos.
  const seen = new Set<string>();
  for (const d of docs) {
    if (seen.has(d.slug)) throw new Error(`Duplicate doc slug "${d.slug}" (from ${d.repo})`);
    seen.add(d.slug);
  }
  return docs.sort((a, b) => a.order - b.order);
});

export async function getDoc(slug: string): Promise<Doc | null> {
  const staticDoc = STATIC_DOCS.find((d) => d.slug === slug);
  if (staticDoc) return staticDoc;
  const docs = await getAllDocs();
  return docs.find((d) => d.slug === slug) ?? null;
}

// Sidebar: one section per repo (in DOC_REPOS order), each listing that repo's
// docs sorted by their frontmatter `order`. The hand-authored Introduction
// (/docs) is pinned to the top of the first section.
export const getDocsNav = cache(async (): Promise<SidebarGroup[]> => {
  const docs = await getAllDocs();
  const byRepo = new Map<string, Doc[]>();
  for (const d of docs) {
    const arr = byRepo.get(d.repo);
    if (arr) arr.push(d);
    else byRepo.set(d.repo, [d]);
  }

  const groups: SidebarGroup[] = await Promise.all(
    DOC_REPOS.filter(({ repo }) => byRepo.has(repo)).map(async ({ repo }): Promise<SidebarGroup> => {
      const { branches, latest } = await getRepoMeta(repo); // cached
      return {
        label: repoLabel(repo),
        repo,
        defaultBranch: latest, // newest branch with docs → selected by default
        branches,
        items: byRepo
          .get(repo)!
          .sort((a, b) => a.order - b.order)
          .map((d) => ({ label: d.title, href: `/docs/${d.slug}` })),
      };
    })
  );

  // Fixed items pinned to the top of the first section: Introduction (/docs)
  // and the hardcoded static docs (Get Started). `fixed` keeps the sidebar from
  // replacing them when a branch is picked.
  const pinned: SidebarItem[] = [
    { label: "Introduction", href: "/docs", fixed: true },
    ...STATIC_DOCS.map((d) => ({ label: d.title, href: `/docs/${d.slug}`, fixed: true })),
  ];
  if (groups.length) groups[0].items.unshift(...pinned);
  else groups.push({ label: "core", items: pinned });

  return groups;
});

// Ordered list of doc hrefs for prev/next — derived from the sidebar so paging
// follows the exact menu order.
export async function getDocOrder(): Promise<string[]> {
  const groups = await getDocsNav();
  return groups.flatMap((g) => g.items.map((i) => i.href));
}

// Map of doc href → last-modified ISO date (only where a real date is known),
// for accurate <lastmod> in the sitemap. The Introduction page (/docs) has no
// file of its own, so it inherits the newest date across all docs.
export async function getDocDates(): Promise<Record<string, string>> {
  const docs = await getAllDocs();
  const map: Record<string, string> = {};
  for (const d of STATIC_DOCS) if (d.lastModified) map[`/docs/${d.slug}`] = d.lastModified;
  for (const d of docs) if (d.lastModified) map[`/docs/${d.slug}`] = d.lastModified;
  const newest = Object.values(map).sort().at(-1);
  if (newest) map["/docs"] = newest;
  return map;
}
