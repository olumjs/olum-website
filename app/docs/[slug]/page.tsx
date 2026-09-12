import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import DocsSidebar from "@/components/DocsSidebar";
import Footer from "@/components/Footer";
import { Markdown } from "@/components/Markdown";
import { extractToc, plainExcerpt } from "@/lib/utils";
import { siteConfig } from "@/lib/site-config";
import {
  isRepoAllowed,
  getAllDocs,
  getDoc,
  getDocAt,
  getDocOrder,
  getDocsNav,
  STATIC_DOCS,
} from "@/lib/docs-content";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ repo?: string; ref?: string }>;
}

// Resolve the ?repo & ?ref query into a validated version, or null for default.
function versionFrom(sp: { repo?: string; ref?: string }) {
  if (sp.repo && sp.ref && isRepoAllowed(sp.repo)) return { repo: sp.repo, ref: sp.ref };
  return null;
}

export async function generateStaticParams() {
  const docs = await getAllDocs();
  return [...STATIC_DOCS, ...docs].map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) return {};

  const title = `${doc.title} — OlumJS Docs`;
  const description = plainExcerpt(doc.body) || siteConfig.shortDescription;
  // Canonical points at the clean, unversioned URL so the ?repo=&ref= variants
  // (older doc versions) consolidate their ranking signals onto this page.
  const canonical = `${siteConfig.url}/docs/${slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: siteConfig.name,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function getPrevNext(slug: string) {
  const [order, groups] = await Promise.all([getDocOrder(), getDocsNav()]);
  const items = groups.flatMap((g) => g.items);
  const label = (href: string) => items.find((i) => i.href === href)?.label ?? null;

  const href = `/docs/${slug}`;
  const idx = order.indexOf(href);
  const prevHref = idx > 0 ? order[idx - 1] : null;
  const nextHref = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  return {
    prev: prevHref ? { href: prevHref, label: label(prevHref) } : null,
    next: nextHref ? { href: nextHref, label: label(nextHref) } : null,
  };
}

export default async function DocSectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const version = versionFrom(await searchParams);
  const [doc, groups] = await Promise.all([
    version ? getDocAt(version.repo, version.ref, slug) : getDoc(slug),
    getDocsNav(),
  ]);
  if (!doc) notFound();

  const { prev, next } = await getPrevNext(slug);
  const toc = extractToc(doc.body);

  const canonical = `${siteConfig.url}/docs/${slug}`;
  const description = plainExcerpt(doc.body) || siteConfig.shortDescription;
  const docStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${canonical}#article`,
        headline: doc.title,
        description,
        articleSection: doc.group,
        inLanguage: "en",
        ...(doc.lastModified && {
          datePublished: doc.lastModified,
          dateModified: doc.lastModified,
        }),
        url: canonical,
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        isPartOf: { "@id": `${siteConfig.url}/#website` },
        author: { "@id": `${siteConfig.url}/#organization` },
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Docs", item: `${siteConfig.url}/docs` },
          { "@type": "ListItem", position: 3, name: doc.title, item: canonical },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docStructuredData).replace(/</g, "\\u003c") }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[calc(5rem+var(--ads-h))]">
        <div className="flex gap-8 py-8">
          <DocsSidebar groups={groups} activeRepo={version?.repo} activeRef={version?.ref} />

          <main className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-[var(--fg-subtle)] font-mono mb-8">
              <Link href="/" className="hover:text-[#25C97E] transition-colors">Home</Link>
              <span>/</span>
              <Link href="/docs" className="hover:text-[#25C97E] transition-colors">Docs</Link>
              <span>/</span>
              <span className="text-[#25C97E]">{doc.title}</span>
            </div>

            <article className="prose-custom max-w-3xl">
              {/* Header */}
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#25C97E] tracking-widest uppercase mb-4 px-3 py-1.5 bg-[rgba(37,201,126,0.07)] border border-[rgba(37,201,126,0.15)] rounded-full">
                  {doc.group}
                </div>
                <h1
                  className="text-4xl sm:text-5xl font-extrabold text-[var(--fg)] leading-tight"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  {doc.title}
                </h1>
              </div>

              <div className="h-px bg-[var(--border-subtle)] mb-10" />

              {/* Content (rendered from the repo's markdown) */}
              <Markdown>{doc.body}</Markdown>

              {/* Prev / Next */}
              <div className="flex justify-between mt-16 pt-8 border-t border-[var(--border-subtle)]">
                {prev ? (
                  <Link
                    href={prev.href}
                    className="flex items-center gap-2 text-sm text-[#25C97E] font-medium hover:opacity-80 transition-opacity"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 7H2M6 3L2 7l4 4" />
                    </svg>
                    {prev.label}
                  </Link>
                ) : (
                  <div />
                )}
                {next ? (
                  <Link
                    href={next.href}
                    className="flex items-center gap-2 text-sm text-[#25C97E] font-medium hover:opacity-80 transition-opacity"
                  >
                    {next.label}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 7h10M8 3l4 4-4 4" />
                    </svg>
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            </article>
          </main>

          {/* On-this-page TOC (h2 headings from the doc) + Edit-on-GitHub link */}
          <aside className="hidden xl:block w-52 shrink-0">
            <div className="sticky top-[calc(6rem+var(--ads-h))]">
              {toc.length > 0 && (
                <>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-subtle)] font-mono mb-3">
                    On this page
                  </h4>
                  <nav className="space-y-0.5">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="block text-xs text-[var(--fg-subtle)] hover:text-[#25C97E] py-0.5 transition-colors"
                      >
                        {item.title}
                      </a>
                    ))}
                  </nav>
                </>
              )}
              {doc.editUrl && (
                <div className={toc.length > 0 ? "mt-8 pt-6 border-t border-[var(--border-subtle)]" : ""}>
                  <a
                    href={doc.editUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-xs text-[var(--fg-subtle)] hover:text-[var(--fg-2)] transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    Edit on GitHub
                  </a>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
