import CliCommand from "@/components/CliCommand";

const CLI_CMD = "npx create-olum my-app --tailwind";

export default function CTASection() {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-[var(--bg)]">
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(37,201,126,0.25), transparent)" }}
      />
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 100%, var(--glow), transparent)",
        }}
      />

      {/* Decorative diamonds */}
      <div
        className="absolute -bottom-10 -right-10 w-64 h-64 opacity-[0.05] animate-float-slow"
        style={{ background: "#25C97E", clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
      />
      <div
        className="absolute top-10 -left-10 w-40 h-40 opacity-[0.05] animate-float"
        style={{ background: "#25C97E", clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#25C97E] tracking-widest uppercase mb-6 px-3 py-1.5 bg-[rgba(37,201,126,0.07)] border border-[rgba(37,201,126,0.15)] rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[#25C97E] animate-pulse" />
          Ready to ship
        </div>

        <h2
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--fg)] leading-tight mb-6"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Start building in{" "}
          <span className="gradient-text">seconds.</span>
        </h2>

        <p className="text-base sm:text-lg text-[var(--fg-muted)] max-w-xl mx-auto mb-10 leading-relaxed">
          One command. Full-stack ready. No configuration hell. Just code.
        </p>

        <CliCommand cmd={CLI_CMD} className="max-w-lg mx-auto" />
        <p className="text-xs text-[var(--fg-subtle)] font-mono mb-8 mt-2">
          Omit <span className="text-[var(--fg-2)]">--tailwind</span> to skip Tailwind CSS setup.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/docs"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-[#25C97E] rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all duration-200 shadow-[0_0_40px_rgba(37,201,126,0.25)]"
          >
            Read the Docs
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </a>
          <a
            href="https://github.com/olumjs"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-medium text-[var(--fg)] bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)] transition-all duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
