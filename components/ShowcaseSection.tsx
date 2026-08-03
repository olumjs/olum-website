const techStack = [
  // { name: "TypeScript", slug: "typescript", color: "#3178C6" },
  { name: "Vite",       slug: "vite",       color: "#646CFF" },
  { name: "Tailwind",   slug: "tailwindcss", color: "#06B6D4" },
  { name: "Node.js",    slug: "nodedotjs",  color: "#5FA04E" },
  { name: "Vercel",     slug: "vercel",     color: "#ffffff", mono: true },
  { name: "StackBlitz", slug: "stackblitz", color: "#1269D3" },
];

export default function ShowcaseSection() {
  return (
    <section className="py-20 sm:py-28 bg-[var(--bg-alt)] relative" id="why">

      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(37,201,126,0.2), transparent)" }}
      />

      <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-10">

        <p className="text-sm font-mono tracking-[0.18em] uppercase text-[var(--fg-2)] select-none">
          Built for the modern stack
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 sm:gap-x-16">
          {techStack.map((tech) => (
            <a
              key={tech.name}
              title={tech.name}
              className="sc-logo group flex flex-col items-center gap-2.5 cursor-default select-none no-underline"
            >
              <img
                src={`https://cdn.simpleicons.org/${tech.slug}/${tech.color.replace("#", "")}`}
                alt={tech.name}
                width={52}
                height={52}
                className={`sc-img transition-all duration-300${tech.mono ? " sc-img-mono" : ""}`}
              />
              <span className="text-[9px] font-mono tracking-[0.18em] uppercase text-[var(--fg-2)] opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                {tech.name}
              </span>
            </a>
          ))}
        </div>

      </div>

      <style>{`
        .sc-img {
          filter: grayscale(1) brightness(0.45);
          opacity: 0.9;
        }
        .sc-logo:hover .sc-img {
          filter: grayscale(0) brightness(1);
          opacity: 1;
          transform: translateY(-2px);
        }
        .sc-img-mono {
          opacity: 0.7;
        }
        .sc-logo:hover .sc-img-mono {
          opacity: 1;
        }
        [data-theme="light"] .sc-img-mono {
          filter: grayscale(1) invert(1) brightness(0.45);
          opacity: 0.7;
        }
        [data-theme="light"] .sc-logo:hover .sc-img-mono {
          filter: invert(1);
          opacity: 1;
        }
      `}</style>
    </section>
  );
}
