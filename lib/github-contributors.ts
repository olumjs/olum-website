// Server-only: the people who commit to the framework, for the homepage
// contributors section.
//
// The framework lives in two repos -- olum (runtime) and olum-compiler -- and the
// same person shows up in both lists. They are merged on GitHub's numeric user id
// (stable even if someone renames their account, unlike the login) and their
// commit counts are added together, so nobody appears twice.
//
// Cached for a day and tagged so /api/clear-cache can drop it. GITHUB_TOKEN lifts
// the unauthenticated 60/hr limit, same as the other GitHub fetches.
const REPOS = ["olumjs/olum", "olumjs/olum-compiler"] as const;

/** Next fetch-cache tag; revalidate it to force a refetch from GitHub. */
export const CONTRIBUTORS_TAG = "github-contributors";

const CACHE_TTL = 24 * 60 * 60; // seconds -- the list barely moves

export type Contributor = {
  id: number;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  /** Commits summed across every repo in REPOS. Not shown -- it only orders
   *  the list, so the most active people come first. */
  contributions: number;
};

type ApiContributor = {
  id?: number;
  login?: string;
  avatar_url?: string;
  html_url?: string;
  contributions?: number;
  type?: string;
};

/** One repo's list. Failures return an empty list so a single bad repo (renamed,
 *  made private, rate-limited) costs its own entries and not the whole section. */
async function fetchRepoContributors(repo: string): Promise<ApiContributor[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contributors?per_page=100`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: CACHE_TTL, tags: [CONTRIBUTORS_TAG] },
    });
    if (!res.ok) return [];
    const body: unknown = await res.json();
    return Array.isArray(body) ? (body as ApiContributor[]) : [];
  } catch {
    return []; // offline build
  }
}

/**
 * Every human contributor across the framework repos, deduplicated, most commits
 * first. Empty when GitHub is unreachable — the section hides itself rather than
 * rendering an empty shell.
 */
export async function getContributors(): Promise<Contributor[]> {
  const lists = await Promise.all(REPOS.map(fetchRepoContributors));

  const byId = new Map<number, Contributor>();
  for (const person of lists.flat()) {
    // Bots (dependabot, github-actions) commit, but they are not contributors.
    const isBot = person.type === "Bot" || person.login?.endsWith("[bot]");
    if (!person.id || !person.login || isBot) continue;

    const seen = byId.get(person.id);
    if (seen) {
      seen.contributions += person.contributions ?? 0;
      continue;
    }
    byId.set(person.id, {
      id: person.id,
      login: person.login,
      avatarUrl: person.avatar_url ?? "",
      profileUrl: person.html_url ?? `https://github.com/${person.login}`,
      contributions: person.contributions ?? 0,
    });
  }

  return [...byId.values()].sort(
    (a, b) => b.contributions - a.contributions || a.login.localeCompare(b.login),
  );
}
