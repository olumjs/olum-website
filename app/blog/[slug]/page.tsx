import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import { CodeBlock } from "@/components/CodeBlock";
import {
  getPost,
  getAllSlugs,
  formatDate,
  readingTimeISO,
  wordCount,
  postDescription,
} from "@/lib/blog-posts";
import type { Post } from "@/lib/blog-posts";
import { getBlogViewsBySlug } from "@/lib/analytics";
import BlogViews from "@/components/BlogViews";
import { siteConfig } from "@/lib/site-config";

// Re-render at most once a minute so the view count stays fresh without
// making the (otherwise static) post pages dynamic.
export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found", robots: { index: false, follow: true } };

  const title = `${post.title} — ${siteConfig.name} Blog`;
  // Trimmed to fit a search snippet, and falling back to the post's opening
  // prose when it has no description of its own. The full text still shows on
  // the page itself.
  const description = postDescription(post) || siteConfig.shortDescription;
  const canonical = `${siteConfig.url}/blog/${post.slug}`;

  return {
    title: { absolute: title },
    description,
    keywords: [...post.tags, siteConfig.name, "JavaScript", "web development"],
    authors: [{ name: post.author.name }],
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      publishedTime: isoDateTime(post.publishedAt),
      modifiedTime: isoDateTime(post.updatedAt ?? post.publishedAt),
      authors: [post.author.name],
      section: post.tags[0],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// Stored dates are plain "yyyy-mm-dd"; OG article tags and JSON-LD both want a
// full ISO timestamp, so midnight UTC is assumed.
function isoDateTime(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

// Article-level JSON-LD. The post is tied back to the site-wide Organization
// and WebSite entities declared in the root layout via their @id, and the
// breadcrumb gives search results the Home › Blog › Post trail.
function postStructuredData(post: Post) {
  const url = `${siteConfig.url}/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#post`,
        headline: post.title,
        description: postDescription(post, 300),
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        datePublished: isoDateTime(post.publishedAt),
        dateModified: isoDateTime(post.updatedAt ?? post.publishedAt),
        image: `${url}/opengraph-image`,
        inLanguage: "en",
        keywords: post.tags.join(", "),
        articleSection: post.tags[0],
        wordCount: wordCount(post),
        timeRequired: readingTimeISO(post.readingTime),
        author: {
          "@type": "Person",
          name: post.author.name,
          jobTitle: post.author.role,
          url: siteConfig.url,
        },
        publisher: { "@id": `${siteConfig.url}/#organization` },
        isPartOf: { "@id": `${siteConfig.url}/blog#blog` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${siteConfig.url}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };
}

// ── Body rendering ────────────────────────────────────────────────────────────
// Bodies are plain text with two conveniences: blank lines split paragraphs,
// lines starting with "- " become a bullet list, and [label](href) becomes a
// link. Text is rendered as React nodes (not raw HTML), so literal markup like
// <if when="…"> shows through verbatim.

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const [, label, href] = m;
    const internal = href.startsWith("/") || href.startsWith("#");
    nodes.push(
      internal ? (
        <Link key={key++} href={href} className="text-[#25C97E] hover:underline">
          {label}
        </Link>
      ) : (
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#25C97E] hover:underline"
        >
          {label}
        </a>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBody(body: string): ReactNode[] {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const lines = block.split("\n");
      const isList = lines.every((l) => l.trim().startsWith("- "));
      if (isList) {
        return (
          <ul key={i} className="space-y-2.5 pl-1">
            {lines.map((line, j) => (
              <li key={j} className="flex items-start gap-3">
                <span
                  className="mt-1.5 w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
                  style={{ background: "rgba(37,201,126,0.15)", border: "1px solid rgba(37,201,126,0.3)" }}
                >
                  <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                    <polyline points="1.5,4 3,5.5 6.5,2" stroke="#25C97E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-sm text-[var(--fg-2)] leading-relaxed">
                  {renderInline(line.trim().replace(/^-\s+/, ""))}
                </span>
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={i} className="text-base text-[var(--fg-2)] leading-relaxed">
          {renderInline(block)}
        </p>
      );
    });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const views = await getBlogViewsBySlug(slug);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* JSON-LD: BlogPosting + breadcrumb for rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(postStructuredData(post)).replace(/</g, "\\u003c"),
        }}
      />

      {/* Hero */}
      <section className="relative pt-28 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(37,201,126,0.12), transparent 65%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[#25C97E] transition-colors mb-8 group"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M12 7H2M6 3L2 7l4 4" />
            </svg>
            Back to Blog
          </Link>

          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-mono px-2.5 py-1 rounded-full border"
                style={{
                  background: "rgba(37,201,126,0.07)",
                  border: "1px solid rgba(37,201,126,0.2)",
                  color: "#25C97E",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[var(--fg)] leading-tight mb-6"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 pb-8 border-b border-[var(--border-subtle)]">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#09090b] shrink-0"
              style={{ background: post.author.color }}
            >
              {post.author.avatar}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--fg)]">{post.author.name}</p>
              <p className="text-xs text-[var(--fg-subtle)]">{post.author.role}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-[var(--fg-2)]">{formatDate(post.publishedAt)}</p>
              <div className="flex items-center justify-end gap-2.5">
                <p className="text-xs text-[var(--fg-subtle)] font-mono">{post.readingTime}</p>
                <BlogViews views={views} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 space-y-6">
        {post.sections.map((section, i) => (
          <section key={i} className="space-y-5">
            {section.heading && (
              <h2
                className="text-2xl sm:text-3xl font-extrabold text-[var(--fg)] mt-12 mb-2"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                {section.heading}
              </h2>
            )}
            {renderBody(section.body)}
            {section.code?.trim() && (
              <CodeBlock code={section.code} lang={section.codeLanguage || undefined} />
            )}
          </section>
        ))}

        {/* Author card */}
        <div
          className="flex items-center gap-5 rounded-2xl p-6 mt-16"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-[#09090b] shrink-0"
            style={{ background: post.author.color }}
          >
            {post.author.avatar}
          </div>
          <div>
            <p className="font-bold text-[var(--fg)]" style={{ fontFamily: "var(--font-syne)" }}>
              {post.author.name}
            </p>
            <p className="text-sm text-[var(--fg-muted)]">{post.author.role}</p>
          </div>
        </div>

        {/* Back */}
        <div className="pt-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--fg-muted)] hover:text-[#25C97E] transition-colors group"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M12 7H2M6 3L2 7l4 4" />
            </svg>
            Back to all posts
          </Link>
        </div>
      </article>

      <Footer />
    </div>
  );
}
