const pillars = [
  {
    label: "Client-first",
    body: "Keep writing plain Olum components. Same files, same router, no server runtime and no new mental model.",
    icon: (
      <path d="M8 6 3 11l5 5M16 6l5 5-5 5M13.5 4l-3 16" />
    ),
  },
  {
    label: "SEO-friendly",
    body: "Every route ships real HTML. Crawlers, link previews and readers get the content without running a line of JS.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5M4.5 11h13M11 4.2a15 15 0 0 1 0 13.6M11 4.2a15 15 0 0 0 0 13.6" />
      </>
    ),
  },
  {
    label: "Static deploy",
    body: "Drop the output folder on GitHub Pages, S3 or any CDN. No rewrite rules, no catch-all config, no server to babysit.",
    icon: (
      <>
        <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
        <path d="M4 7.5 12 12l8-4.5M12 12v9" />
      </>
    ),
  },
];

const outputTree = [
  { depth: 0, name: "dist/", file: false },
  { depth: 1, name: "index.html", file: true, route: "/" },
  { depth: 1, name: "about/index.html", file: true, route: "/about" },
  { depth: 1, name: "blog/hello/index.html", file: true, route: "/blog/hello" },
  { depth: 1, name: "not-found.html", file: true, route: "404" },
];

export default function ComingNextSection() {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-[var(--bg)]" id="coming-next">
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(37,201,126,0.3), transparent)" }}
      />
      {/* Soft glow behind the card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, var(--glow), transparent)" }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#25C97E] tracking-widest uppercase mb-4 px-3 py-1.5 bg-[rgba(37,201,126,0.07)] border border-[rgba(37,201,126,0.15)] rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-[#25C97E] animate-pulse" />
            Coming next · in the works
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[var(--fg)] leading-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Fully Static.
            <br />
            <span className="gradient-text">Routes Like a Server.</span>
          </h2>

          <p className="mt-5 text-base sm:text-lg text-[var(--fg-muted)] max-w-2xl mx-auto leading-relaxed">
            Write client-first. Stay SEO-friendly. Deploy statically — with the routing
            experience of a server catch-all.
          </p>
        </div>

        {/* Pillars */}
        <div className="grid gap-4 sm:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.label}
              className="card-glow rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 hover:border-[var(--border-hover)] transition-colors duration-200"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(37,201,126,0.09)] border border-[rgba(37,201,126,0.18)] text-[#25C97E]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {p.icon}
                </svg>
              </div>
              <h3 className="text-sm font-bold text-[var(--fg)] mb-1.5 tracking-tight">{p.label}</h3>
              <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">{p.body}</p>
            </div>
          ))}
        </div>

        {/* Output preview */}
        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <span className="h-2 w-2 rounded-full bg-[#25C97E] animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--fg-2)]">
              olum build — one HTML file per route
            </span>
          </div>

          <div className="p-4 sm:p-5 font-mono text-[12px] sm:text-[13px] overflow-x-auto">
            {outputTree.map((row) => (
              <div
                key={row.name}
                className="flex items-center gap-3 py-1 whitespace-nowrap"
                style={{ paddingLeft: row.depth * 18 }}
              >
                <span className={row.file ? "text-[var(--fg-2)]" : "text-[var(--fg)] font-semibold"}>
                  {row.file ? "├─ " : ""}{row.name}
                </span>
                {row.route && (
                  <>
                    <span className="text-[var(--fg-subtle)]">→</span>
                    <span className="text-[#25C97E]">{row.route}</span>
                  </>
                )}
              </div>
            ))}
          </div>

          <p className="px-4 sm:px-5 pb-4 text-[12px] leading-relaxed text-[var(--fg-subtle)]">
            Deep links resolve on the host itself — no <span className="text-[var(--fg-2)]">index.html</span> fallback
            rule, no hash URLs. The client router still takes over after the first paint.
          </p>
        </div>

        {/* Foot note */}
        <p className="mt-8 text-center text-[13px] text-[var(--fg-subtle)]">
          Still in development — no release date yet.{" "}
          <a
            href="https://github.com/olumjs"
            className="text-[#25C97E] hover:brightness-125 underline underline-offset-4 decoration-[rgba(37,201,126,0.35)] transition-all duration-200"
          >
            Follow the progress on GitHub
          </a>
          .
        </p>

      </div>
    </section>
  );
}
