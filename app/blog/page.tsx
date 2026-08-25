import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import {
  posts,
  getFeatured,
  getAllTags,
  formatDate,
  postsByDate,
  postDescription,
} from "@/lib/blog-posts";
import { getAllBlogViews } from "@/lib/analytics";
import BlogViews from "@/components/BlogViews";
import { siteConfig } from "@/lib/site-config";

type Props = { searchParams: Promise<{ tag?: string }> };

const BLOG_URL = `${siteConfig.url}/blog`;
const BLOG_TITLE = `Blog — ${siteConfig.name}`;
const BLOG_DESCRIPTION =
  "Framework updates, tutorials, migration stories, and deep dives from the OlumJS team and community.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tag } = await searchParams;
  const activeTag = tag?.trim() || null;

  // ?tag= views are thin slices of the same list, so they stay out of the index
  // and point their canonical at the unfiltered page — one URL collects all the
  // ranking signals, and crawlers still follow the links out to each post.
  if (activeTag) {
    const title = `Posts tagged “${activeTag}” — ${siteConfig.name} Blog`;
    const description = `Every OlumJS article tagged ${activeTag} — tutorials, release notes, and deep dives.`;
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: BLOG_URL },
      robots: { index: false, follow: true },
      openGraph: {
        type: "website",
        url: BLOG_URL,
        title,
        description,
        siteName: siteConfig.name,
        locale: siteConfig.locale,
      },
      twitter: { card: "summary_large_image", title, description },
    };
  }

  return {
    title: { absolute: BLOG_TITLE },
    description: BLOG_DESCRIPTION,
    keywords: [
      ...getAllTags(),
      "OlumJS blog",
      "JavaScript framework blog",
      "frontend tutorials",
      "web development articles",
    ],
    alternates: { canonical: BLOG_URL },
    openGraph: {
      type: "website",
      url: BLOG_URL,
      title: BLOG_TITLE,
      description: BLOG_DESCRIPTION,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
    },
    twitter: { card: "summary_large_image", title: BLOG_TITLE, description: BLOG_DESCRIPTION },
  };
}

// Blog + ItemList JSON-LD: declares the /blog#blog entity every post links back
// to, and hands search engines the newest posts as an ordered list.
function blogStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${BLOG_URL}#blog`,
        name: `${siteConfig.name} Blog`,
        url: BLOG_URL,
        description: BLOG_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${siteConfig.url}/#organization` },
        isPartOf: { "@id": `${siteConfig.url}/#website` },
        blogPost: postsByDate().map((post) => ({
          "@type": "BlogPosting",
          "@id": `${BLOG_URL}/${post.slug}#post`,
          headline: post.title,
          description: postDescription(post, 300),
          url: `${BLOG_URL}/${post.slug}`,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt ?? post.publishedAt,
          keywords: post.tags.join(", "),
          author: { "@type": "Person", name: post.author.name },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${BLOG_URL}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Blog", item: BLOG_URL },
        ],
      },
    ],
  };
}

export default async function BlogPage({ searchParams }: Props) {
  const { tag } = await searchParams;
  const activeTag = tag?.trim() || null;
  const blogViews = await getAllBlogViews();

  const filtered = activeTag
    ? posts.filter((p) => p.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase()))
    : posts;

  // Featured is the flagged post when it's in the filtered set, else the first match.
  const flagged = getFeatured();
  const featured = filtered.find((p) => p.slug === flagged?.slug) ?? filtered[0] ?? null;
  const rest = filtered.filter((p) => p.slug !== featured?.slug);
  const allTags = ["All", ...getAllTags()];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* JSON-LD: Blog listing + breadcrumb */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogStructuredData()).replace(/</g, "\\u003c"),
        }}
      />

      {/* Hero header */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-dot-grid opacity-40" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(37,201,126,0.14), transparent 70%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#25C97E] tracking-widest uppercase mb-5 px-3 py-1.5 bg-[rgba(37,201,126,0.07)] border border-[rgba(37,201,126,0.15)] rounded-full">
            The Olum Blog
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--fg)] leading-tight mb-4"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            What&apos;s happening in the{" "}
            <span className="gradient-text">Olum</span> universe
          </h1>
          <p className="text-base sm:text-lg text-[var(--fg-muted)] max-w-xl mx-auto">
            Framework updates, tutorials, migration stories, and deep dives from
            the Olum team and community.
          </p>
          {process.env.NODE_ENV === "development" && (
            <div className="mt-6">
              <Link
                href="/blog/editor"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--fg-2)] hover:text-[#25C97E] hover:border-[rgba(37,201,126,0.3)] transition-all"
              >
                + New / Edit posts
              </Link>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Tag filter */}
        <div className="flex items-center gap-2 flex-wrap mb-12 overflow-x-auto pb-2">
          {allTags.map((t) => {
            const isAll = t === "All";
            const active = isAll ? !activeTag : activeTag?.toLowerCase() === t.toLowerCase();
            return (
              <Link
                key={t}
                href={isAll ? "/blog" : `/blog?tag=${encodeURIComponent(t)}`}
                scroll={false}
                className={`px-3 py-1.5 text-xs font-mono rounded-full border transition-all ${
                  active
                    ? "bg-[rgba(37,201,126,0.12)] border-[rgba(37,201,126,0.3)] text-[#25C97E]"
                    : "bg-[var(--card)] border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg-2)] hover:border-[var(--border-hover)]"
                }`}
              >
                {t}
              </Link>
            );
          })}
        </div>

        {/* Featured post */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="card-glow shine group mb-10 relative rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden block"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Decorative panel */}
              <div
                className="relative hidden lg:block min-h-[280px]"
                style={{
                  background: "linear-gradient(135deg, rgba(37,201,126,0.08), rgba(37,201,126,0.04))",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle at 60% 40%, rgba(37,201,126,0.2), transparent 60%)",
                  }}
                />
                {/* Floating badge */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div
                      className="w-32 h-32 animate-float"
                      style={{
                        background: "#25C97E",
                        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                        filter: "drop-shadow(0 0 40px rgba(37,201,126,0.4))",
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="text-2xl font-extrabold text-[#09090b]"
                        style={{ fontFamily: "var(--font-syne)" }}
                      >
                        NEW
                      </span>
                    </div>
                  </div>
                </div>
                <div className="absolute top-4 left-4">
                  <span className="text-xs font-mono text-[#25C97E] bg-[rgba(37,201,126,0.1)] border border-[rgba(37,201,126,0.2)] px-2 py-1 rounded">
                    FEATURED
                  </span>
                </div>
              </div>

              {/* Text */}
              <div className="p-8 lg:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {featured.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-mono text-[var(--fg-subtle)] bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="lg:hidden text-xs font-mono text-[#25C97E] bg-[rgba(37,201,126,0.1)] border border-[rgba(37,201,126,0.2)] px-2 py-0.5 rounded">
                    FEATURED
                  </span>
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] leading-tight mb-4 group-hover:text-[#25C97E] transition-colors"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  {featured.title}
                </h2>
                <p className="text-[var(--fg-muted)] leading-relaxed mb-6 line-clamp-3">
                  {featured.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#09090b]"
                      style={{ background: featured.author.color }}
                    >
                      {featured.author.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--fg)]">
                        {featured.author.name}
                      </p>
                      <p className="text-xs text-[var(--fg-subtle)] flex items-center gap-2">
                        {formatDate(featured.publishedAt)} · {featured.readingTime}
                        <BlogViews views={blogViews[featured.slug] ?? 0} />
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 text-sm font-medium text-[#25C97E]">
                    Read more
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 7h10M8 3l4 4-4 4" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Post grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map((post) => (
            <Link
              href={`/blog/${post.slug}`}
              key={post.slug}
              className="card-glow shine group flex flex-col gap-4 p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
            >
              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap">
                {post.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono text-[var(--fg-subtle)] bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Title */}
              <h3
                className="font-bold text-[var(--fg)] leading-snug group-hover:text-[#25C97E] transition-colors line-clamp-2"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                {post.title}
              </h3>

              {/* Excerpt */}
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed line-clamp-3 flex-1">
                {post.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] mt-auto">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-[#09090b] shrink-0"
                    style={{ background: post.author.color }}
                  >
                    {post.author.avatar}
                  </div>
                  <span className="text-xs text-[var(--fg-subtle)] truncate">
                    {post.author.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[var(--fg-subtle)] font-mono">
                    {post.readingTime}
                  </span>
                  <BlogViews views={blogViews[post.slug] ?? 0} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <p className="text-center text-[var(--fg-muted)] py-16">
            No posts tagged{" "}
            <span className="text-[var(--fg)] font-medium">{activeTag}</span>.{" "}
            <Link href="/blog" className="text-[#25C97E] hover:underline">
              View all posts
            </Link>
          </p>
        )}
      </div>

      <Footer />
    </div>
  );
}
