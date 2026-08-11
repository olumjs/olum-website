// Fixed-window rate limiter backed by the Realtime Database.
//
// The site runs on serverless instances, so an in-process counter would reset
// on every cold start and would never be shared between the instances handling
// concurrent requests. The window state has to live somewhere all of them can
// see, and Firebase is already a dependency here.

import { createHash } from "node:crypto";
import { db } from "@/lib/firebaseAdmin";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

type RateLimitOptions = {
  /** Database path holding the windows, e.g. `olum-telemetry/limits`. */
  path: string;
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

type Window = { windowStart: number; count: number };

// Callers are identified by a salted hash of their IP — enough to count repeat
// requests from one source, never enough to recover the address, so the
// endpoint's "no IPs stored" promise still holds. IPv4 is a small enough space
// to brute-force an unsalted hash, so set SECRET in the environment to make
// these keys genuinely irreversible.
function callerKey(req: Request): string {
  // `NextRequest.ip` was removed in Next 15, so the proxy header is the only
  // source. The left-most entry is the original client; the rest are proxies.
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip")?.trim();

  // No forwarded IP means we can't attribute the request (local dev, or a
  // direct hit). Bucket all such traffic together: throttling it as one caller
  // is the safe failure mode, waving it through is not.
  if (!ip) return "unattributed";

  const salt = process.env.SECRET ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function isWindow(value: unknown): value is Window {
  if (!value || typeof value !== "object") return false;
  const { windowStart, count } = value as Record<string, unknown>;
  return typeof windowStart === "number" && typeof count === "number";
}

// One-off callers never come back to have their window reset, so their entries
// would linger forever. Sweeping a small batch on a fraction of requests keeps
// the subtree bounded without needing a scheduled job.
//
// REQUIRES a database rule on the limits path:
//
//   "olum-telemetry": { "limits": { ".indexOn": ["windowStart"] } }
//
// The admin SDK rejects an unindexed `orderByChild` query outright rather than
// falling back to a client-side scan, so without this rule the sweep never runs
// and the subtree grows unbounded. Rate limiting itself is unaffected — it only
// ever touches one key by name.
const SWEEP_PROBABILITY = 0.02;
const SWEEP_BATCH = 200;

async function sweepExpired(path: string, cutoff: number): Promise<void> {
  try {
    const stale = await db
      .ref(path)
      .orderByChild("windowStart")
      .endAt(cutoff)
      .limitToFirst(SWEEP_BATCH)
      .get();

    if (!stale.exists()) return;

    const removals: Record<string, null> = {};
    stale.forEach((child) => {
      if (child.key) removals[child.key] = null;
    });
    await db.ref(path).update(removals);
  } catch (err) {
    // Housekeeping must never influence whether a request is served, but a
    // permanently failing sweep (a missing index) is worth surfacing rather
    // than swallowing into the caller's fail-open path.
    console.error(`[rate-limit] sweep of ${path} failed:`, err);
  }
}

/**
 * Counts this request against the caller's window.
 *
 * Fails open: if the database is unreachable the request is allowed through,
 * so a limiter outage degrades to "unlimited" rather than "site down".
 */
export async function rateLimit(
  req: Request,
  { path, limit, windowMs }: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const ref = db.ref(`${path}/${callerKey(req)}`);

    const { committed, snapshot } = await ref.transaction((current: unknown) => {
      // Expired or absent window — start a fresh one.
      if (!isWindow(current) || now - current.windowStart >= windowMs) {
        return { windowStart: now, count: 1 } satisfies Window;
      }
      // Over the limit: abort the transaction so the write is skipped. Not
      // extending the window on rejection keeps this a fixed window — a caller
      // who keeps hammering still gets back in when the window rolls over.
      if (current.count >= limit) return undefined;

      return { windowStart: current.windowStart, count: current.count + 1 } satisfies Window;
    });

    if (!committed) {
      const current = snapshot.val();
      // An abort means over-limit; a non-abort failure (write contention) is
      // not the caller's fault, so let it through.
      if (!isWindow(current) || current.count < limit) return { allowed: true };

      const elapsed = now - current.windowStart;
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)) };
    }

    if (Math.random() < SWEEP_PROBABILITY) {
      await sweepExpired(path, now - windowMs);
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
