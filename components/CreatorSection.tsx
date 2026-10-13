import Image from "next/image";

export default function CreatorSection() {
  return (
    <section className="py-20 relative bg-[var(--bg)]" id="creator">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(37,201,126,0.3), transparent)" }}
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 text-center sm:text-left">
        <Image
          src="/creator.jpg"
          alt="Eissa Saber, creator of OlumJS"
          width={112}
          height={112}
          className="h-28 w-28 flex-shrink-0 rounded-full object-cover object-top border border-[var(--border)]"
        />
        <div>
          <h2 className="text-xl font-bold text-[var(--fg)]" style={{ fontFamily: "var(--font-syne)" }}>
            Hi, I&apos;m Eissa, the creator of OlumJS.
          </h2>
          <p className="mt-2 text-[var(--fg-muted)] leading-relaxed">
            I&apos;m open to freelance and full-time work.{" "}
            <a href="mailto:eissapk@zohomail.com" className="text-[#25C97E] hover:underline">
              eissapk@zohomail.com
            </a>
          </p>
          <p className="mt-3 text-sm text-[var(--fg-muted)]">
            <a href="https://github.com/eissapk" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)] transition-colors">
              GitHub
            </a>
            <span className="mx-2">·</span>
            <a href="https://www.linkedin.com/in/jesuspk/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)] transition-colors">
              LinkedIn
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
