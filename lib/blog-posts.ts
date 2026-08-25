import blogStore from "@/data/blog.json";
import { plainExcerpt } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
// The blog is stored as plain JSON in data/blog.json and edited through the
// dev-only editor at /blog/editor (see app/api/*-post routes). Display pages
// import the JSON module below, so new/edited posts are picked up on the next
// request (dev) or at build time (production).

export interface BlogSection {
  heading: string;
  body: string;
  code?: string;
  codeLanguage?: string;
}

export interface Author {
  name: string;
  avatar: string;
  color: string;
  role: string;
}

export interface Post {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO yyyy-mm-dd
  updatedAt?: string; // ISO yyyy-mm-dd — optional; falls back to publishedAt
  readingTime: string; // e.g. "5 min read"
  featured?: boolean;
  tags: string[];
  author: Author;
  sections: BlogSection[];
}

export const posts: Post[] = blogStore as Post[];

// The featured post drives the big hero card on /blog. Falls back to the first
// post if none is explicitly flagged.
export function getFeatured(): Post | null {
  return posts.find((p) => p.featured) ?? posts[0] ?? null;
}

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug);
}

export function getAllTags(): string[] {
  return Array.from(new Set(posts.flatMap((p) => p.tags))).sort();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Turn "8 min read" into an ISO-8601 duration ("PT8M") for the `timeRequired`
// field of the BlogPosting JSON-LD. Falls back to undefined when unparsable.
export function readingTimeISO(readingTime: string): string | undefined {
  const m = /(\d+)/.exec(readingTime);
  return m ? `PT${m[1]}M` : undefined;
}

// Rough word count of a post's prose (headings + bodies, code excluded) — feeds
// the `wordCount` JSON-LD field.
export function wordCount(post: Post): number {
  return post.sections
    .map((s) => `${s.heading} ${s.body}`)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

// Posts sorted newest first — used by the sitemap/feed-style listings where
// order matters for SEO signals.
export function postsByDate(): Post[] {
  return [...posts].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

// The meta / OG description for a post. The stored description is preferred but
// often runs long, so it is trimmed on a word boundary. When a post has none,
// the opening prose of its first non-empty section stands in — a real sentence
// about this post beats repeating the site-wide tagline on every article.
export function postDescription(post: Post, max = 160): string {
  const stored = plainExcerpt(post.description ?? "", max);
  if (stored) return stored;
  const firstBody = post.sections.find((s) => s.body.trim())?.body ?? "";
  return plainExcerpt(firstBody, max);
}
