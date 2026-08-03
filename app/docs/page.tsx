import type { Metadata } from "next";
import Link from "next/link";
import DocsSidebar from "@/components/DocsSidebar";
import Footer from "@/components/Footer";
import { getDocsNav } from "@/lib/docs-content";
import { slugify } from "@/lib/utils";
import { siteConfig } from "@/lib/site-config";

const docsDescription =
  "Learn OlumJS — a small, Vue/React-inspired UI framework. Guides on components, signal-based state and reactivity, scoped CSS, and its native-HTML template syntax.";

export const metadata: Metadata = {
  title: { absolute: "Docs — OlumJS" },
  description: docsDescription,
  alternates: { canonical: `${siteConfig.url}/docs` },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/docs`,
    title: "Docs — OlumJS",
    description: docsDescription,
    siteName: siteConfig.name,
  },
};

const docsBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
    { "@type": "ListItem", position: 2, name: "Docs", item: `${siteConfig.url}/docs` },
  ],
};

const buckets = [
  { bucket: "Code", attrs: "when, each, key, on* (events), html", inside: "a JS expression" },
  { bucket: "String", attrs: "class, style, title, href, id, props, …", inside: "a literal string; {expr} interpolates dynamics" },
  { bucket: "Text", attrs: "element text content", inside: "{expr}, auto-escaped" },
];

// Section headings on this page — single source of truth for the anchors and
// the "On this page" table of contents (ids are derived, never hardcoded).
const sections = ["The one rule", "Where to go next"];

const nextSteps = [
  { label: "Get Started", href: "/docs/get-started", desc: "Scaffold your first OlumJS app in one command.", icon: "🚀" },
  { label: "Component File Structure", href: "/docs/component-structure", desc: "Learn how .html component files are structured.", icon: "🧩" },
  { label: "State & Reactivity", href: "/docs/state", desc: "Understand how state drives re-renders.", icon: "⚡" },
  { label: "Quick Reference", href: "/docs/quick-reference", desc: "A cheat-sheet of all template syntax.", icon: "📋" },
  { label: "Live Sandbox", href: "https://code.olumjs.top", desc: "Try OlumJS instantly in your browser — no install required.", icon: "🧪", external: true },
  { label: "Olum UI", href: "https://ui.olumjs.top", desc: "Copy-paste components, styled and ready to own.", icon: "🎨", external: true },
];

export default async function DocsPage() {
  const groups = await getDocsNav();
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsBreadcrumb).replace(/</g, "\\u003c") }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="flex gap-8 py-8">
          <DocsSidebar groups={groups} />

          <main className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-[var(--fg-subtle)] font-mono mb-8">
              <Link href="/" className="hover:text-[#25C97E] transition-colors">Home</Link>
              <span>/</span>
              <span className="text-[#25C97E]">Docs</span>
            </div>

            <article className="prose-custom max-w-3xl">
              {/* Title */}
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#25C97E] tracking-widest uppercase mb-4 px-3 py-1.5 bg-[rgba(37,201,126,0.07)] border border-[rgba(37,201,126,0.15)] rounded-full">
                  Getting Started
                </div>
                <h1
                  className="text-4xl sm:text-5xl font-extrabold text-[var(--fg)] leading-tight mb-4"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  Introduction
                </h1>
                <p className="text-lg text-[var(--fg-2)] leading-relaxed">
                  OlumJS is a small, Vue/React-inspired UI framework. You write components as plain{" "}
                  <code className="text-[#25C97E] bg-[rgba(37,201,126,0.08)] px-1.5 py-0.5 rounded font-mono text-sm">.html</code>{" "}
                  files with a{" "}
                  <code className="text-[#25C97E] bg-[rgba(37,201,126,0.08)] px-1.5 py-0.5 rounded font-mono text-sm">&lt;script&gt;</code>,
                  a{" "}
                  <code className="text-[#25C97E] bg-[rgba(37,201,126,0.08)] px-1.5 py-0.5 rounded font-mono text-sm">&lt;style&gt;</code>,
                  and template markup; a compiler turns each one into a JavaScript module. The template language is deliberately{" "}
                  <strong className="text-[var(--fg)]">native-HTML-friendly</strong>: no naked{" "}
                  <code className="text-[#25C97E] bg-[rgba(37,201,126,0.08)] px-1.5 py-0.5 rounded font-mono text-sm">{"{}"}</code>{" "}
                  in attributes, and HTML formatters/linters work on your files unchanged.
                </p>
              </div>

              <div className="h-px bg-[var(--border-subtle)] mb-10" />

              {/* The one rule */}
              <section id={slugify(sections[0])} className="mb-12 scroll-mt-24">
                <h2
                  className="text-2xl font-bold text-[var(--fg)] mb-4"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  {sections[0]}
                </h2>
                <div className="flex gap-4 p-5 rounded-xl bg-[rgba(37,201,126,0.06)] border border-[rgba(37,201,126,0.2)] mb-6">
                  <span className="text-xl mt-0.5">💡</span>
                  <p className="text-sm text-[var(--fg-2)] leading-relaxed">
                    <strong className="text-[var(--fg)]">Everything lives inside <code className="text-[#25C97E] font-mono">&quot;&quot;</code>:</strong>{" "}
                    <code className="text-[#25C97E] font-mono">when</code> /{" "}
                    <code className="text-[#25C97E] font-mono">each</code> /{" "}
                    <code className="text-[#25C97E] font-mono">key</code> /{" "}
                    <code className="text-[#25C97E] font-mono">on*</code> /{" "}
                    <code className="text-[#25C97E] font-mono">html</code> hold a JS expression;{" "}
                    <strong className="text-[var(--fg)]">props and all other attributes</strong> are literal strings with{" "}
                    <code className="text-[#25C97E] font-mono">{"{expr}"}</code> inside for dynamics;
                    and <strong className="text-[var(--fg)]">text</strong> is{" "}
                    <code className="text-[#25C97E] font-mono">{"{expr}"}</code>, auto-escaped.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--card)] border-b border-[var(--border)]">
                        <th className="text-left px-4 py-2.5 font-mono text-[var(--fg-subtle)] font-semibold">Bucket</th>
                        <th className="text-left px-4 py-2.5 font-mono text-[var(--fg-subtle)] font-semibold">Attributes</th>
                        <th className="text-left px-4 py-2.5 font-mono text-[var(--fg-subtle)] font-semibold">Inside &quot;&quot;</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {buckets.map((row) => (
                        <tr key={row.bucket} className="bg-[var(--bg)] hover:bg-[var(--card)] transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-[var(--fg)]">{row.bucket}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-[#25C97E]">{row.attrs}</td>
                          <td className="px-4 py-2.5 text-[var(--fg-2)]">{row.inside}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Next steps */}
              <section id={slugify(sections[1])} className="scroll-mt-24">
                <h2
                  className="text-2xl font-bold text-[var(--fg)] mb-6"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  {sections[1]}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {nextSteps.map((card) =>
                    card.external ? (
                      <a
                        key={card.label}
                        href={card.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card-glow flex gap-4 p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] group"
                      >
                        <span className="text-2xl mt-0.5">{card.icon}</span>
                        <div>
                          <h3 className="font-semibold text-[var(--fg)] group-hover:text-[#25C97E] transition-colors mb-1">
                            {card.label}
                          </h3>
                          <p className="text-sm text-[var(--fg-muted)]">{card.desc}</p>
                        </div>
                      </a>
                    ) : (
                      <Link
                        key={card.label}
                        href={card.href}
                        className="card-glow flex gap-4 p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] group"
                      >
                        <span className="text-2xl mt-0.5">{card.icon}</span>
                        <div>
                          <h3 className="font-semibold text-[var(--fg)] group-hover:text-[#25C97E] transition-colors mb-1">
                            {card.label}
                          </h3>
                          <p className="text-sm text-[var(--fg-muted)]">{card.desc}</p>
                        </div>
                      </Link>
                    )
                  )}
                </div>
              </section>

              {/* Pagination */}
              <div className="flex justify-end mt-16 pt-8 border-t border-[var(--border-subtle)]">
                <Link
                  href="/docs/get-started"
                  className="flex items-center gap-2 text-sm text-[#25C97E] font-medium hover:opacity-80 transition-opacity"
                >
                  Get Started
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 7h10M8 3l4 4-4 4" />
                  </svg>
                </Link>
              </div>
            </article>
          </main>

          {/* Right aside */}
          <aside className="hidden xl:block w-52 shrink-0">
            <div className="sticky top-24">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-subtle)] font-mono mb-3">
                On this page
              </h4>
              <nav className="space-y-0.5">
                {sections.map((title) => (
                  <a
                    key={title}
                    href={`#${slugify(title)}`}
                    className="block text-xs text-[var(--fg-subtle)] hover:text-[#25C97E] py-0.5 transition-colors"
                  >
                    {title}
                  </a>
                ))}
              </nav>
              <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
                <a
                  href="https://github.com/olumjs"
                  className="flex items-center gap-2 text-xs text-[var(--fg-subtle)] hover:text-[var(--fg-2)] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  Edit on GitHub
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
