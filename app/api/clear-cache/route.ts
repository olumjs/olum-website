import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { DOCS_TAG } from "@/lib/docs-content";
import { PLAYGROUND_TAG, clearPlaygroundCache } from "@/lib/playground-examples.server";
import { STARS_TAG } from "@/lib/github-stars";
import { CONTRIBUTORS_TAG } from "@/lib/github-contributors";

// GET /api/clear-cache
// Invalidates the cached docs, playground examples and GitHub star count so the
// next request
// refetches them from GitHub.
//
// Guarded by the SAME secret as the analytics dashboard — the SECRET env var —
// so one credential covers both. The request must supply it as `?secret=…` (or
// the `x-revalidate-secret` header). This lets the logged-in dashboard's "Clear
// cache" button reuse its stored secret. If SECRET is unset the endpoint is
// disabled — it never runs open.
export async function GET(request: Request) {
  const secret = process.env.SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Endpoint disabled: SECRET is not configured." },
      { status: 503 },
    );
  }
  const provided =
    new URL(request.url).searchParams.get("secret") ??
    request.headers.get("x-revalidate-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Invalid or missing secret." }, { status: 401 });
  }

  // "max" → stale-while-revalidate: entries are marked stale and refetched in
  // the background on the next visit (recommended over the deprecated 1-arg form).
  revalidateTag(DOCS_TAG, "max");
  revalidateTag(PLAYGROUND_TAG, "max");
  revalidateTag(STARS_TAG, "max");
  revalidateTag(CONTRIBUTORS_TAG, "max");
  // The playground also keeps an in-process memo and an on-disk tree cache that
  // the fetch tag doesn't cover — drop those too.
  await clearPlaygroundCache();

  return NextResponse.json({
    revalidated: true,
    tags: [DOCS_TAG, PLAYGROUND_TAG, STARS_TAG, CONTRIBUTORS_TAG],
    now: new Date().toISOString(),
  });
}
