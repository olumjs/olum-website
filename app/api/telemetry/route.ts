import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rate-limit";

// Dedicated collection for this site. Kept distinct from other projects that
// share the same Firebase Realtime Database so their data never collides.
const TELEMETRY_COL = "olum-telemetry";

// A well-behaved CLI pings a handful of times an hour at most, so this leaves
// plenty of headroom for real use while capping what a single source can write.
const RATE_LIMIT = { path: `${TELEMETRY_COL}/limits`, limit: 30, windowMs: 10 * 60 * 1000 };

const OS_VALUES = ["linux", "macos", "windows"] as const;
type OS = (typeof OS_VALUES)[number];

// Versions are free-form (semver, prereleases, git tags), so we only guard
// against junk being written into the database rather than parsing them.
const MAX_VERSION_LEN = 32;

function parseVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_VERSION_LEN) return null;
  return trimmed;
}

// Accepts a number (22), a plain string ("22") or a full version ("v22.14.0"),
// since callers read this from `process.versions.node` in different ways.
function parseNodeMajor(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const major = Number.parseInt(raw.replace(/^v/, ""), 10);
  if (!Number.isInteger(major) || major < 1 || major > 999) return null;
  return major;
}

function parseOS(value: unknown): OS | null {
  if (typeof value !== "string") return null;
  const os = value.trim().toLowerCase();
  return (OS_VALUES as readonly string[]).includes(os) ? (os as OS) : null;
}

// Client clocks can be wrong or absent — fall back to server time so every
// event is still ordered sensibly.
function parseTimestamp(value: unknown): string {
  const date =
    typeof value === "number" ? new Date(value) : typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

// GET /api/telemetry?secret=<secret>
// Returns the raw ping log for the dashboard. If SECRET is set, the request
// must supply a matching `secret`; otherwise the endpoint is open.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provided = searchParams.get("secret");
  const expected = process.env.SECRET;

  if (expected && provided !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Only `events` is read — never the sibling `limits` subtree, which holds the
  // rate limiter's hashed caller keys and has no place in a dashboard payload.
  const [metaSnap, eventsSnap] = await Promise.all([
    db.ref(`${TELEMETRY_COL}/lastReceived`).get(),
    db.ref(`${TELEMETRY_COL}/events`).orderByKey().get(),
  ]);

  // Push keys are chronological, so reversing (unshift) yields newest-first.
  const events: unknown[] = [];
  if (eventsSnap.exists()) {
    eventsSnap.forEach((child) => {
      events.unshift({ key: child.key, ...child.val() });
    });
  }

  return NextResponse.json({
    ok: true,
    data: { lastReceived: metaSnap.val() ?? null, events },
  });
}

// POST /api/telemetry
// Records one anonymous usage ping from the Olum CLI. No IPs, project names or
// other identifying data are collected or stored.
export async function POST(req: NextRequest) {
  // Checked before the body is read so a flood costs one database op, not a
  // parse and a write.
  const limit = await rateLimit(req, RATE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const { cliVersion, olumVersion, nodeMajor, os, timestamp } = body as Record<string, unknown>;

  const cli = parseVersion(cliVersion);
  if (!cli) {
    return NextResponse.json({ ok: false, error: "cliVersion required" }, { status: 400 });
  }

  const olum = parseVersion(olumVersion);
  if (!olum) {
    return NextResponse.json({ ok: false, error: "olumVersion required" }, { status: 400 });
  }

  const node = parseNodeMajor(nodeMajor);
  if (node === null) {
    return NextResponse.json({ ok: false, error: "nodeMajor required" }, { status: 400 });
  }

  const platform = parseOS(os);
  if (!platform) {
    return NextResponse.json(
      { ok: false, error: `os must be one of: ${OS_VALUES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    await db.ref(TELEMETRY_COL).update({ lastReceived: new Date().toISOString() });

    await db.ref(`${TELEMETRY_COL}/events`).push({
      cliVersion: cli,
      olumVersion: olum,
      nodeMajor: node,
      os: platform,
      timestamp: parseTimestamp(timestamp),
      ts: Date.now(),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
