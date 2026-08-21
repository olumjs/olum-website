import { getContributors } from "@/lib/github-contributors";

// Async server component: the list is fetched and cached on the server (see
// lib/github-contributors.ts), so the avatars are in the HTML on first paint and
// visitors never call GitHub themselves.
export default async function ContributorsSection() {
  const contributors = await getContributors();

  // GitHub unreachable at build time -- show nothing rather than an empty shell.
  if (contributors.length === 0) return null;

  const people = contributors.length === 1 ? "contributor" : "contributors";

  return (
    <section className="py-24 sm:py-32 relative bg-[var(--bg)]" id="contributors">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(37,201,126,0.3), transparent)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#25C97E] tracking-widest uppercase mb-4 px-3 py-1.5 bg-[rgba(37,201,126,0.07)] border border-[rgba(37,201,126,0.15)] rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-[#25C97E] animate-pulse" />
            {contributors.length} {people}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[var(--fg)] leading-tight" style={{ fontFamily: "var(--font-syne)" }}>
            Built in the Open
            <br />
            <span className="gradient-text">By People, Not a Committee</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[var(--fg-muted)] max-w-xl mx-auto">
            Every commit across <span className="font-mono text-[var(--fg-2)]">olum</span> and{" "}
            <span className="font-mono text-[var(--fg-2)]">olum-compiler</span>. Open a pull request and your face lands here.
          </p>
        </div>

        {/* Avatars */}
        <ul className="flex flex-wrap items-start justify-center gap-x-8 gap-y-10 sm:gap-x-10 list-none p-0 m-0">
          {contributors.map((person) => (
            <li key={person.id}>
              <a
                href={person.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={person.login}
                className="ct-card group flex w-24 flex-col items-center gap-3 no-underline"
              >
                <img
                  src={person.avatarUrl}
                  alt=""
                  width={72}
                  height={72}
                  loading="lazy"
                  className="ct-avatar h-[72px] w-[72px] rounded-full border border-[var(--border)] bg-[var(--surface)] transition-all duration-300"
                />
                <span className="max-w-full truncate text-center text-sm font-semibold text-[var(--fg-2)] transition-colors duration-300 group-hover:text-[var(--fg)]">
                  {person.login}
                </span>
              </a>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-14 text-center">
          <a
            href="https://github.com/olumjs/olum/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--fg-2)] transition-colors duration-200 hover:border-[rgba(37,201,126,0.4)] hover:text-[var(--fg)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            Become a contributor
          </a>
        </div>
      </div>

      <style>{`
        .ct-avatar {
          filter: grayscale(1);
          opacity: 0.85;
        }
        .ct-card:hover .ct-avatar {
          filter: grayscale(0);
          opacity: 1;
          transform: translateY(-3px);
          border-color: rgba(37,201,126,0.5);
          box-shadow: 0 0 0 3px rgba(37,201,126,0.12);
        }
      `}</style>
    </section>
  );
}
