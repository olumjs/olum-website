"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

const CODE_LANGS = ["html", "css", "js", "ts", "jsx", "tsx", "bash", "json", ""] as const;
type CodeLanguage = (typeof CODE_LANGS)[number];

interface Section {
  id: string;
  heading: string;
  body: string;
  code?: string;
  codeLanguage?: CodeLanguage;
}

interface Author {
  name: string;
  avatar: string;
  color: string;
  role: string;
}

interface PostOut {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingTime: string;
  tags: string[];
  author: Author;
  sections: Omit<Section, "id">[];
}

interface PostFull extends PostOut {
  featured?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 8);

const slugify = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "OT";

const estimateReadingTime = (sections: Section[]): string => {
  const words = sections.reduce((acc, s) => {
    const bodyWords = s.body.split(/\s+/).filter(Boolean).length;
    const codeWords = s.code ? s.code.split(/\s+/).filter(Boolean).length * 0.5 : 0;
    return acc + bodyWords + codeWords;
  }, 0);
  return `${Math.max(1, Math.round(words / 200))} min read`;
};

const emptySection = (): Section => ({ id: uid(), heading: "", body: "", code: "", codeLanguage: "html" });

const PRESET_COLORS = ["#25C97E", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899"];

const DEFAULT_AUTHOR: Author = { name: "Olum Team", avatar: "OT", color: "#25C97E", role: "Core Team" };

// shared input styling
const inputCls =
  "w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[rgba(37,201,126,0.5)] transition-colors";
const labelCls = "text-xs text-[var(--fg-muted)]";
const secLbl = "text-xs font-mono font-semibold text-[#25C97E] tracking-widest uppercase";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EditorPage() {
  const today = new Date().toISOString().split("T")[0];

  // ── Editor state ──
  const [slug, setSlug] = useState("my-first-post");
  const [slugLocked, setSlugLocked] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publishedAt, setPublishedAt] = useState(today);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [author, setAuthor] = useState<Author>(DEFAULT_AUTHOR);
  const [sections, setSections] = useState<Section[]>([emptySection()]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // ── Posts list state ──
  const [posts, setPosts] = useState<PostFull[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsSearch, setPostsSearch] = useState("");
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [settingFeaturedSlug, setSettingFeaturedSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setPosts(data.posts);
    } catch (err) {
      setPostsError(String(err));
    } finally {
      setPostsLoading(false);
    }
  }, []);

  // Initial load — keep setState inside async callbacks so it never runs
  // synchronously in the effect body. Manual refetches use fetchPosts().
  useEffect(() => {
    let active = true;
    fetch("/api/posts")
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.ok) setPosts(data.posts);
        else setPostsError(data.error);
      })
      .catch((err) => active && setPostsError(String(err)))
      .finally(() => active && setPostsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const setAuthorField = (patch: Partial<Author>) =>
    setAuthor((a) => {
      const next = { ...a, ...patch };
      if (patch.name !== undefined) next.avatar = initials(patch.name);
      return next;
    });

  const loadPost = (post: PostFull) => {
    setTitle(post.title);
    setSlug(post.slug);
    setSlugLocked(true);
    setDescription(post.description ?? "");
    setPublishedAt(post.publishedAt);
    setTags(post.tags ?? []);
    setAuthor({ ...DEFAULT_AUTHOR, ...(post.author ?? {}) });
    setSections(
      (post.sections ?? []).map((s) => ({
        ...s,
        id: uid(),
        code: s.code ?? "",
        codeLanguage: (s.codeLanguage as CodeLanguage) ?? "",
      }))
    );
    setEditingSlug(post.slug);
    setTimeout(() => {
      document.getElementById("post-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const clearEditor = () => {
    setTitle("");
    setSlug("my-first-post");
    setSlugLocked(false);
    setDescription("");
    setPublishedAt(today);
    setTags([]);
    setAuthor(DEFAULT_AUTHOR);
    setSections([emptySection()]);
    setEditingSlug(null);
  };

  const handleSetFeatured = async (postSlug: string) => {
    setSettingFeaturedSlug(postSlug);
    try {
      const res = await fetch("/api/set-featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: postSlug }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      await fetchPosts();
    } catch (err) {
      alert(`Failed to set featured: ${String(err)}`);
    } finally {
      setSettingFeaturedSlug(null);
    }
  };

  const handleDelete = async (postSlug: string) => {
    setDeletingSlug(postSlug);
    try {
      const res = await fetch("/api/delete-post", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: postSlug }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setConfirmSlug(null);
      if (editingSlug === postSlug) clearEditor();
      await fetchPosts();
    } catch (err) {
      alert(`Delete failed: ${String(err)}`);
    } finally {
      setDeletingSlug(null);
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugLocked) setSlug(slugify(val));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };
  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const updateSection = (id: string, field: keyof Section, value: string) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  const addSection = () => setSections((prev) => [...prev, emptySection()]);
  const removeSection = (id: string) => setSections((prev) => prev.filter((s) => s.id !== id));
  const moveSection = (id: string, dir: -1 | 1) =>
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });

  const buildOutput = useCallback((): PostOut => {
    const cleanSections = sections.map((sec) => {
      const s: Omit<Section, "id"> = { heading: sec.heading, body: sec.body };
      if (sec.code?.trim()) {
        s.code = sec.code;
        s.codeLanguage = sec.codeLanguage || "";
      }
      return s;
    });
    return {
      slug,
      title,
      description,
      publishedAt,
      readingTime: estimateReadingTime(sections),
      tags,
      author: { ...author, avatar: author.avatar || initials(author.name) },
      sections: cleanSections,
    };
  }, [slug, title, description, publishedAt, tags, author, sections]);

  const handleSave = async () => {
    if (!slug.trim() || !title.trim()) {
      alert("Title and slug are required.");
      return;
    }
    setSaveState("saving");
    try {
      const res = await fetch("/api/save-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOutput()),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSaveState("saved");
      setEditingSlug(slug);
      setSlugLocked(true);
      setTimeout(() => setSaveState("idle"), 3000);
      await fetchPosts();
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 4000);
    }
  };

  // ─── Render ──
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="max-w-7xl mx-auto px-6 pt-[calc(6rem+var(--ads-h))] pb-28">
        {/* Sub-header (sits below the global fixed navbar) */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[#25C97E] transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 7H2M6 3L2 7l4 4" />
            </svg>
            Back to Blog
          </Link>
          <span className="text-xs font-mono text-[var(--fg-subtle)]">dev-only editor</span>
        </div>

        <div className="flex gap-6 items-start">
          {/* ── Sidebar: Existing Posts ── */}
          <aside className="w-72 shrink-0 sticky top-[calc(6rem+var(--ads-h))] max-h-[calc(100vh-7rem-var(--ads-h))] flex flex-col gap-3 overflow-hidden">
            <p className={secLbl}>
              Posts{!postsLoading && <span className="opacity-40 ml-1">({posts.length})</span>}
            </p>

            {!postsLoading && posts.length > 0 && (
              <input
                value={postsSearch}
                onChange={(e) => setPostsSearch(e.target.value)}
                placeholder="Search…"
                className={inputCls + " py-2 shrink-0"}
              />
            )}

            <div className="flex flex-col gap-2 overflow-y-auto pr-1 pt-1">
              {postsLoading && <p className="text-sm text-[var(--fg-muted)] py-8 text-center opacity-40">Loading…</p>}
              {postsError && <p className="text-sm text-red-400 py-3">{postsError}</p>}
              {!postsLoading && !postsError && posts.length === 0 && (
                <p className="text-sm text-[var(--fg-muted)] py-8 text-center opacity-40">No posts yet.</p>
              )}
              {!postsLoading && !postsError &&
                posts
                  .filter((p) => {
                    const q = postsSearch.trim().toLowerCase();
                    return !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
                  })
                  .map((post) => (
                    <div
                      key={post.slug}
                      className={`rounded-xl px-3 py-3 border bg-[var(--card)] transition-colors shrink-0 ${
                        editingSlug === post.slug ? "border-[rgba(37,201,126,0.4)]" : "border-[var(--border)]"
                      }`}
                    >
                      <div className="flex items-start gap-1.5 min-w-0">
                        <p className="text-[.8rem] text-[var(--fg)] font-medium leading-snug flex-1 min-w-0">{post.title}</p>
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          {post.featured && <span className="text-[11px] text-[#25C97E]" title="Featured">★</span>}
                          {editingSlug === post.slug && (
                            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-mono bg-[rgba(37,201,126,0.12)] text-[#25C97E]">editing</span>
                          )}
                        </div>
                      </div>
                      <p className="font-mono text-[10px] text-[var(--fg-subtle)] opacity-70 mt-1">
                        {post.publishedAt} · {post.readingTime}
                      </p>

                      {confirmSlug !== post.slug ? (
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <button
                            onClick={() => loadPost(post)}
                            className="px-2.5 py-1 text-[11px] rounded-md border border-[var(--border)] text-[var(--fg-2)] hover:text-[var(--fg)] hover:border-[var(--border-hover)] transition-colors font-mono"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleSetFeatured(post.slug)}
                            disabled={settingFeaturedSlug === post.slug || !!post.featured}
                            title={post.featured ? "Already featured" : "Set as featured"}
                            className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors font-mono disabled:cursor-not-allowed ${
                              post.featured
                                ? "border-[rgba(37,201,126,0.4)] text-[#25C97E] opacity-60"
                                : "border-[var(--border)] text-[var(--fg-2)] hover:text-[var(--fg)] hover:border-[var(--border-hover)]"
                            }`}
                          >
                            {settingFeaturedSlug === post.slug ? "…" : post.featured ? "★" : "☆"}
                          </button>
                          <button
                            onClick={() => setConfirmSlug(post.slug)}
                            className="px-2.5 py-1 text-[11px] rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-colors font-mono ml-auto"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <span className="text-[11px] text-[var(--fg-muted)]">Sure?</span>
                          <button
                            onClick={() => setConfirmSlug(null)}
                            className="px-2.5 py-1 text-[11px] rounded-md border border-[var(--border)] text-[var(--fg-2)] hover:text-[var(--fg)] transition-colors font-mono"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(post.slug)}
                            disabled={deletingSlug === post.slug}
                            className="px-2.5 py-1 text-[11px] rounded-md border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-mono disabled:opacity-50 ml-auto"
                          >
                            {deletingSlug === post.slug ? "…" : "Confirm"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
            </div>
          </aside>

          {/* ── Editor ── */}
          <div className="flex-1 min-w-0 space-y-10">
            {/* heading + actions */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className={secLbl}>Blog Editor</p>
                <h1 className="text-[var(--fg)] text-2xl font-bold tracking-tight leading-tight mt-1" style={{ fontFamily: "var(--font-syne)" }}>
                  {editingSlug ? "Edit Post" : "New Post"}
                </h1>
                {editingSlug && <p className="font-mono text-[11px] text-[var(--fg-muted)] mt-1 opacity-70">/blog/{editingSlug}</p>}
              </div>
              <div className="flex items-center gap-2 pt-1">
                {editingSlug && (
                  <button onClick={clearEditor} className="px-4 py-2 text-xs rounded-lg border border-[var(--border)] text-[var(--fg-2)] hover:text-[var(--fg)] hover:border-[var(--border-hover)] transition-colors">
                    + New Post
                  </button>
                )}
                <SaveButton state={saveState} onClick={handleSave} />
              </div>
            </div>

            {/* ── Meta Block ── */}
            <section id="post-form" className="space-y-5 scroll-mt-24">
              <p className={secLbl}>Post metadata</p>

              <div className="space-y-1.5">
                <label className={labelCls}>Title</label>
                <input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Introducing OlumJS 1.0" className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Slug</label>
                <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden focus-within:border-[rgba(37,201,126,0.5)] transition-colors">
                  <span className="px-3 text-xs text-[var(--fg-muted)] border-r border-[var(--border)] py-2.5 select-none font-mono">/blog/</span>
                  <input
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugLocked(true); }}
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--fg)] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short description shown on cards and meta tags…"
                  rows={2}
                  className={inputCls + " resize-none"}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className={labelCls}>Published date</label>
                  <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className={inputCls} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className={labelCls}>Reading time (auto)</label>
                  <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--fg-muted)] text-sm select-none font-mono">
                    {estimateReadingTime(sections)}
                  </div>
                </div>
              </div>

              {/* Author */}
              <div className="space-y-2">
                <label className={labelCls}>Author</label>
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-[#09090b] shrink-0" style={{ background: author.color }}>
                    {author.avatar || initials(author.name)}
                  </div>
                  <input value={author.name} onChange={(e) => setAuthorField({ name: e.target.value })} placeholder="Author name" className={inputCls} />
                  <input value={author.role} onChange={(e) => setAuthorField({ role: e.target.value })} placeholder="Role" className={inputCls} />
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[11px] text-[var(--fg-muted)] font-mono">color</span>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAuthorField({ color: c })}
                      className={`w-5 h-5 rounded-full border transition-transform ${author.color === c ? "border-[var(--fg)] scale-110" : "border-transparent"}`}
                      style={{ background: c }}
                      aria-label={`Set author color ${c}`}
                    />
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className={labelCls}>Tags</label>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                    placeholder="Type a tag and press Enter"
                    className={inputCls}
                  />
                  <button onClick={addTag} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--fg-2)] hover:border-[var(--border-hover)] hover:text-[var(--fg)] transition-colors shrink-0">
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono bg-[rgba(37,201,126,0.1)] border border-[rgba(37,201,126,0.25)] text-[#25C97E]">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="opacity-60 hover:opacity-100 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ── Sections ── */}
            <section className="space-y-4">
              <p className={secLbl}>Sections <span className="opacity-40">({sections.length})</span></p>
              <div className="space-y-3">
                {sections.map((section, idx) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    index={idx}
                    total={sections.length}
                    onChange={updateSection}
                    onRemove={removeSection}
                    onMove={moveSection}
                  />
                ))}
              </div>
              <button
                onClick={addSection}
                className="w-full py-3 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--fg-muted)] hover:border-[rgba(37,201,126,0.4)] hover:text-[#25C97E] transition-colors"
              >
                + Add section
              </button>
            </section>

            {/* bottom actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <SaveButton state={saveState} onClick={handleSave} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Save Button ──────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  const label =
    state === "saving" ? "Saving…" : state === "saved" ? "✓ Saved!" : state === "error" ? "Save failed" : "Save to blog";
  return (
    <button
      onClick={onClick}
      disabled={state === "saving"}
      className="px-5 py-2 text-sm font-medium rounded-lg bg-[#25C97E] text-[#09090b] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
    >
      {label}
    </button>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  section: Section;
  index: number;
  total: number;
  onChange: (id: string, field: keyof Section, value: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}

function SectionCard({ section, index, total, onChange, onRemove, onMove }: SectionCardProps) {
  const [showCode, setShowCode] = useState(!!section.code);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const openLinkForm = () => {
    const ta = bodyRef.current;
    if (ta) {
      const sel = section.body.slice(ta.selectionStart, ta.selectionEnd);
      if (sel) setLinkText(sel);
    }
    setShowLinkForm(true);
  };

  const insertLink = () => {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = linkText.trim() || "link text";
    const href = linkUrl.trim() || "https://";
    const insertion = `[${text}](${href})`;
    const newBody = section.body.slice(0, start) + insertion + section.body.slice(end);
    onChange(section.id, "body", newBody);
    setShowLinkForm(false);
    setLinkText("");
    setLinkUrl("");
    setTimeout(() => {
      ta.focus();
      const pos = start + insertion.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--card)] group">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
        <span className="font-mono text-[11px] text-[var(--fg-muted)] tabular-nums w-4 text-right shrink-0">{index + 1}</span>
        <input
          value={section.heading}
          onChange={(e) => onChange(section.id, "heading", e.target.value)}
          placeholder="Section heading…"
          className="flex-1 bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none"
        />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onMove(section.id, -1)} disabled={index === 0} className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-20 disabled:cursor-not-allowed text-xs">↑</button>
          <button onClick={() => onMove(section.id, 1)} disabled={index === total - 1} className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-20 disabled:cursor-not-allowed text-xs">↓</button>
          <button onClick={() => onRemove(section.id)} disabled={total === 1} className="p-1 rounded text-[var(--fg-muted)] hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed text-xs ml-1">✕</button>
        </div>
      </div>

      {/* body */}
      <div className="px-4 pt-3 pb-2">
        <textarea
          ref={bodyRef}
          value={section.body}
          onChange={(e) => onChange(section.id, "body", e.target.value)}
          placeholder="Write the section body… Blank line = new paragraph. Lines starting with '- ' become a bullet list."
          rows={4}
          className="w-full bg-transparent text-sm text-[var(--fg-2)] placeholder:text-[var(--fg-muted)] focus:outline-none resize-none leading-relaxed"
        />
        <div className="flex items-center gap-2 pt-1 pb-1 border-t border-[var(--border)]/50">
          <button onClick={openLinkForm} className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)] hover:text-[#25C97E] transition-colors">+ Insert link</button>
          <span className="font-mono text-[10px] text-[var(--fg-subtle)]">[text](url) syntax</span>
        </div>
        {showLinkForm && (
          <div className="flex items-center gap-2 pt-2 pb-1 flex-wrap">
            <input autoFocus value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Link text" className="w-32 bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--fg)] focus:outline-none focus:border-[rgba(37,201,126,0.5)]" />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") insertLink(); if (e.key === "Escape") setShowLinkForm(false); }}
              placeholder="https://… or /docs"
              className="flex-1 min-w-40 bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono text-[var(--fg)] focus:outline-none focus:border-[rgba(37,201,126,0.5)]"
            />
            <button onClick={insertLink} className="px-2.5 py-1 text-[11px] rounded border border-[rgba(37,201,126,0.4)] text-[#25C97E] hover:bg-[rgba(37,201,126,0.1)] font-mono">Insert</button>
            <button onClick={() => { setShowLinkForm(false); setLinkText(""); setLinkUrl(""); }} className="px-2 py-1 text-[11px] rounded border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] font-mono">Cancel</button>
          </div>
        )}
      </div>

      {/* code toggle */}
      <div className="px-4 pb-4">
        <button onClick={() => setShowCode((v) => !v)} className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)] hover:text-[#25C97E] transition-colors">
          {showCode ? "− Remove code block" : "+ Add code block"}
        </button>
        {showCode && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={section.codeLanguage}
                onChange={(e) => onChange(section.id, "codeLanguage", e.target.value)}
                className="bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 font-mono text-xs text-[var(--fg-2)] focus:outline-none focus:border-[rgba(37,201,126,0.4)]"
              >
                {CODE_LANGS.map((lang) => (
                  <option key={lang} value={lang}>{lang || "no language"}</option>
                ))}
              </select>
              <span className="font-mono text-[10px] text-[var(--fg-muted)]">language tag</span>
            </div>
            <textarea
              value={section.code}
              onChange={(e) => onChange(section.id, "code", e.target.value)}
              placeholder="paste your code here…"
              rows={5}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--fg-2)] font-mono text-xs placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[rgba(37,201,126,0.3)] resize-none leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
