import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rate-limit";

// Dedicated collection for this site. Kept distinct from other projects that
// share the same Firebase Realtime Database so their data never collides.
const TELEMETRY_COL = "olum-telemetry";

// A well-behaved CLI pings a handful of times an hour at most, so this leaves
// plenty of headroom for real use while capping what a single source can write.
const RATE_LIMIT = { path: `${TELEMETRY_COL}/limits`, limit: 30, windowMs: 10 * 60 * 1000 };

// Node's `process.platform` names two of these differently from how anyone reads
// them. Every other platform (freebsd, openbsd, sunos, aix, android…) already
// reports a sensible name, so it is kept as sent rather than enumerated here —
// a new platform should not need a deploy to be counted.
const OS_ALIASES: Record<string, string> = { darwin: "macos", win32: "windows" };

// Free-form values that end up as dashboard labels. Constrained to a short slug
// so a malformed or hostile client can't write junk into the log.
const SLUG = /^[a-z0-9][a-z0-9._-]{0,23}$/;

// Versions are free-form (semver, prereleases, git tags), so we only guard
// against junk being written into the database rather than parsing them.
const MAX_VERSION_LEN = 32;

function parseVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_VERSION_LEN) return null;
  return trimmed;
}

function parseOS(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const os = value.trim().toLowerCase();
  const named = OS_ALIASES[os] ?? os;
  return SLUG.test(named) ? named : null;
}

// Which command produced the ping — "create", "add", and whatever comes next.
// Optional, so pings from CLI versions predating this field still record.
function parseType(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const type = value.trim().toLowerCase();
  return SLUG.test(type) ? type : "unknown";
}

// The argument the command was given. Only recorded for commands whose argument
// names something of ours — an olum-ui component for `add`. A `create` argument is
// the user's own project name, which can identify a person or an unreleased product,
// so it is dropped here as well as in the CLI: enforcing it at the point of storage
// means no client, old or modified, can put one in the log.
const NAMELESS_TYPES = ["create"];
const MAX_NAME_LEN = 64;

function parseName(value: unknown, type: string): string | null {
  if (NAMELESS_TYPES.includes(type)) return null;
  if (typeof value !== "string") return null;
  // charCode filter rather than a regex, so no control-character escape is needed
  const printable = Array.from(value)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  return printable.trim().slice(0, MAX_NAME_LEN) || null;
}

// Flags the command ran with, e.g. ["tailwind"]. Deduped and capped so a caller
// can't pad a ping with hundreds of entries.
const MAX_OPTIONS = 10;

function parseOptions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const flags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => SLUG.test(item));
  const unique = Array.from(new Set(flags)).slice(0, MAX_OPTIONS);
  return unique.length ? unique : null;
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

  const { cliVersion, olumVersion, compilerVersion, nodeVersion, nodeMajor, os, timezone, type, name, options, timestamp } =
    body as Record<string, unknown>;

  const cli = parseVersion(cliVersion);
  if (!cli) {
    return NextResponse.json({ ok: false, error: "cliVersion required" }, { status: 400 });
  }

  const olum = parseVersion(olumVersion);
  if (!olum) {
    return NextResponse.json({ ok: false, error: "olumVersion required" }, { status: 400 });
  }

  const platform = parseOS(os);
  if (!platform) {
    return NextResponse.json(
      { ok: false, error: "os required (lowercase platform name, max 24 chars)" },
      { status: 400 },
    );
  }

  const command = parseType(type);
  const label = parseName(name, command);
  const flags = parseOptions(options);

  try {
    await db.ref(TELEMETRY_COL).update({ lastReceived: new Date().toISOString() });

    await db.ref(`${TELEMETRY_COL}/events`).push({
      cliVersion: cli,
      olumVersion: olum,
      // stored exactly as the CLI reported it — the full runtime version, e.g.
      // "24.15.0". Deliberately not parsed or format-checked, so an unusual build
      // (nightly, rc, a vendor fork) records as-is instead of being rejected.
      // `nodeMajor` is the key CLIs used before the rename; `null` when neither is
      // present, since the database refuses an undefined value.
      nodeVersion: nodeVersion ?? nodeMajor ?? null,
      // the app's olum-compiler, resolved the same way as olumVersion. Optional:
      // older CLIs don't send it, and an app may not have the compiler installed
      compilerVersion: parseVersion(compilerVersion) ?? "unknown",
      os: platform,
      timezone,
      type: command,
      timestamp: parseTimestamp(timestamp),
      ts: Date.now(),
      // both optional: older CLIs don't send them, and `add` has no flags
      ...(label ? { name: label } : {}),
      ...(flags ? { options: flags } : {}),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
