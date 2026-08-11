import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { ANALYTICS_COL as COL } from "@/lib/analytics";

// GET /api/analytics?secret=<secret>
// Returns the raw visit log for the dashboard. If SECRET is set, the request
// must supply a matching `secret`; otherwise the endpoint is open.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provided = searchParams.get("secret");
  const expected = process.env.SECRET;

  if (expected && provided !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [metaSnap, recentSnap] = await Promise.all([
    db.ref(`${COL}/lastVisited`).get(),
    db.ref(`${COL}/recentVisits`).orderByKey().get(),
  ]);

  // Push keys are chronological, so reversing (unshift) yields newest-first.
  const recentVisits: unknown[] = [];
  if (recentSnap.exists()) {
    recentSnap.forEach((child) => {
      recentVisits.unshift({ key: child.key, ...child.val() });
    });
  }

  return NextResponse.json({
    ok: true,
    data: { lastVisited: metaSnap.val() ?? null, recentVisits },
  });
}

// POST /api/analytics
// Records a single page visit. Called by the client-side AnalyticsTracker.
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  // IPs are intentionally not collected or stored — any `ip` field in the body is ignored.
  const { route, blogSlug, device, os, browser, timezone, referrer } =
    body as Record<string, unknown>;

  if (typeof route !== "string" || !route) {
    return NextResponse.json({ ok: false, error: "route required" }, { status: 400 });
  }

  const deviceKey = typeof device === "string" ? device : "unknown";

  await db.ref(COL).update({ lastVisited: new Date().toISOString() });

  await db.ref(`${COL}/recentVisits`).push({
    route,
    device: deviceKey,
    timezone: typeof timezone === "string" ? timezone : "Unknown",
    os: typeof os === "string" ? os : "Unknown",
    browser: typeof browser === "string" ? browser : "Unknown",
    ts: Date.now(),
    ...(typeof blogSlug === "string" && blogSlug ? { blogSlug } : {}),
    ...(typeof referrer === "string" && referrer ? { referrer } : {}),
  });

  return NextResponse.json({ ok: true });
}
