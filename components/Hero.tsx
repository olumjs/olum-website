import Link from "next/link";
import Image from "next/image";
import CliCommand from "@/components/CliCommand";

const CLI_CMD = "npx create-olum my-app --tailwind";

/* ─── Hero ─────────────────────────────────────────────────── */
export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

      {/* ── Layer 1: base bg ────────────────────────────────── */}
      <div className="absolute inset-0 bg-[var(--bg)]" />

      {/* ── Layer 2: fine grid lines ────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(37,201,126,0.045) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(37,201,126,0.045) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "40px 40px",
        }}
      />

      {/* ── Layer 3: dominant top orb (Nuxt-style spotlight) ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: "clamp(700px, 110vw, 1400px)",
          height: "clamp(400px, 70vh, 800px)",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(37,201,126,0.28) 0%, rgba(37,201,126,0.12) 28%, rgba(37,201,126,0.04) 50%, transparent 68%)",
        }}
      />

      {/* ── Layer 4: secondary bottom-corner accent ──────────── */}
      <div
        className="absolute bottom-0 right-0 pointer-events-none"
        style={{
          width: 500,
          height: 400,
          background:
            "radial-gradient(ellipse at 100% 100%, rgba(37,201,126,0.05) 0%, transparent 60%)",
        }}
      />

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 flex flex-col items-center text-center gap-8">

        {/* Logo with halo rings */}
        <div
          className="animate-fade-up animate-fade-up-1 relative flex items-center justify-center"
          style={{ width: 200, height: 200 }}
        >
          {/* Outermost ring */}
          <div
            className="absolute rounded-full border"
            style={{
              width: 196, height: 196,
              borderColor: "rgba(37,201,126,0.07)",
            }}
          />
          {/* Middle ring */}
          <div
            className="absolute rounded-full border"
            style={{
              width: 152, height: 152,
              borderColor: "rgba(37,201,126,0.14)",
            }}
          />
          {/* Inner ring */}
          <div
            className="absolute rounded-full border animate-pulse-glow"
            style={{
              width: 116, height: 116,
              borderColor: "rgba(37,201,126,0.28)",
              boxShadow: "0 0 28px rgba(37,201,126,0.12)",
            }}
          />
          {/* Centre glow disk */}
          <div
            className="absolute rounded-full"
            style={{
              width: 120, height: 120,
              background:
                "radial-gradient(circle, rgba(37,201,126,0.14) 0%, transparent 72%)",
            }}
          />
          {/* Logo */}
          <div className="relative animate-float-slow">
            <Image src="/logo.svg" width={96} height={96} alt="Olum logo" />
          </div>
        </div>

        {/* Badge */}
        <div className="animate-fade-up animate-fade-up-2 inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#25C97E] bg-[rgba(37,201,126,0.07)] border border-[rgba(37,201,126,0.22)] px-3.5 py-1.5 rounded-full tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#25C97E] animate-pulse inline-block" />
          Reactive HTML
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-up animate-fade-up-3 text-[clamp(2.6rem,7vw,4.5rem)] font-extrabold leading-[1.06] tracking-tight text-[var(--fg)]"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Built for Prototypes,
          <br />
          <span className="gradient-text">Rapid Development</span>
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-up animate-fade-up-4 text-[clamp(1rem,2vw,1.2rem)] text-[var(--fg-2)] max-w-xl mx-auto leading-relaxed -mt-2">
          The fastest way to turn ideas into apps for hackathons and experiments.
        </p>

        {/* CTA row */}
        <div className="animate-fade-up animate-fade-up-5 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-7 py-3 text-sm font-bold text-white bg-[#25C97E] rounded-xl hover:brightness-110 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 shadow-[0_0_32px_rgba(37,201,126,0.28),0_2px_8px_rgba(0,0,0,0.3)]"
          >
            Get started
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 7h8M7 3l4 4-4 4" />
            </svg>
          </Link>
          <a
            href="https://github.com/olumjs"
            className="inline-flex items-center gap-2 px-7 py-3 text-sm font-medium text-[var(--fg-2)] hover:text-[var(--fg)] rounded-xl border border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-all duration-200"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            GitHub
            {/* <span className="font-mono tabular-nums text-[#25C97E]">{general.githubStars} ★</span> */}
          </a>
        </div>

        {/* CLI command */}
        <CliCommand cmd={CLI_CMD} className="animate-fade-up animate-fade-up-6 w-full max-w-md" />
        <p className="animate-fade-up animate-fade-up-6 text-xs text-[var(--fg-subtle)] font-mono -mt-4">
          Omit <span className="text-[var(--fg-2)]">--tailwind</span> to skip Tailwind CSS setup.
        </p>

        {/* Stats */}
        {/* <div
          className="animate-fade-up flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-14 pt-2"
          style={{ animationDelay: "0.65s" }}
        >
          {[
            { value: "8kb", label: "Gzipped runtime" },
            { value: "42ms", label: "Avg. TTI" },
            { value: "100%", label: "TypeScript native" },
          ].map((stat, i) => (
            <div key={stat.label} className="flex flex-col items-center gap-1.5">
              {i > 0 && (
                <div className="hidden sm:block absolute h-8 w-px bg-[var(--border)] -translate-x-7" />
              )}
              <span
                className="text-2xl font-extrabold gradient-text"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                {stat.value}
              </span>
              <span className="text-[11px] text-[var(--fg-2)] font-mono uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
          ))}
        </div> */}


      </div>

      {/* Bottom fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to top, var(--bg), transparent)" }}
      />
    </section>
  );
}
