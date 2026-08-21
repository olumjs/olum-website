// Server-only: star count for the main olum repo, for the navbar badge.
//
// The main repo only -- not a sum over the org. The org has other repos with
// their own stars (olum-writer, olum-ui, ...), and adding them up reads as an
// inflated/duplicated number next to a link people expect to mean "the framework".
//
// One request, cached by the Next fetch cache for an hour and tagged so
// /api/clear-cache can drop it. GITHUB_TOKEN lifts the unauthenticated 60/hr
// limit, same as the playground fetch.
const REPO = "olumjs/olum";
const REPO_API = `https://api.github.com/repos/${REPO}`;

/** The repo the badge counts. Linked from the navbar so the link and the
 *  number can never drift apart. */
export const REPO_URL = `https://github.com/${REPO}`;

/** Next fetch-cache tag; revalidate it to force a refetch from GitHub. */
export const STARS_TAG = "github-stars";

const CACHE_TTL = 60 * 60; // seconds -- a star count is never urgent

/**
 * Stargazers on the main repo, or `null` when GitHub is unreachable or
 * rate-limited. Callers render nothing on `null` rather than a guessed number.
 */
export async function getRepoStars(): Promise<number | null> {
  try {
    const res = await fetch(REPO_API, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: CACHE_TTL, tags: [STARS_TAG] },
    });
    if (!res.ok) return null;
    const repo: { stargazers_count?: number } = await res.json();
    return typeof repo.stargazers_count === "number" ? repo.stargazers_count : null;
  } catch {
    return null; // offline build -- the badge just doesn't render
  }
}

/** 6 -> "6", 1200 -> "1.2k". */
export function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;
}
