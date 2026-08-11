"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

// Routes we never record (the dashboard itself, and anything under it).
const SKIP = ["/analytics"];

// Never track local development traffic.
const IS_DEV = process.env.NODE_ENV === "development";

declare global {
  interface Window {
    UAParser?: new () => {
      getResult(): {
        browser: { name?: string };
        os: { name?: string };
        device: { type?: string };
      };
    };
  }
}

interface UAData {
  device: string;
  os: string;
  browser: string;
}

function getTrafficSource(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith("traffic_source="))
    ?.split("=")[1];
}

function sendAnalytics(pathname: string, ua: UAData) {
  try {
    // Record each route at most once per session.
    const pageKey = `a_p_${pathname}`;
    if (sessionStorage.getItem(pageKey)) return;
    sessionStorage.setItem(pageKey, "1");

    const isNewSession = !sessionStorage.getItem("a_s");
    if (isNewSession) sessionStorage.setItem("a_s", "1");

    const blogSlugMatch = pathname.match(/^\/blog\/(.+)/);
    const blogSlug = blogSlugMatch?.[1];
    const referrer = getTrafficSource();

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: pathname,
        ...(blogSlug ? { blogSlug } : {}),
        device: ua.device,
        os: ua.os,
        browser: ua.browser,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(referrer ? { referrer } : {}),
        isNewSession,
      }),
    }).catch(() => {});
  } catch {
    // sessionStorage blocked
  }
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const uaRef = useRef<UAData | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (IS_DEV) return;
    if (SKIP.some((r) => pathname.startsWith(r))) return;
    // uaRef is null on first load (script not yet loaded) — onLoad handles that case
    if (uaRef.current) sendAnalytics(pathname, uaRef.current);
  }, [pathname]);

  function handleLoad() {
    if (!window.UAParser) return;
    const result = new window.UAParser().getResult();
    const ua: UAData = {
      device: result.device.type ?? "desktop",
      os: result.os.name ?? "Other",
      browser: result.browser.name ?? "Other",
    };
    uaRef.current = ua;
    const current = pathnameRef.current;
    if (!SKIP.some((r) => current.startsWith(r))) sendAnalytics(current, ua);
  }

  if (IS_DEV) return null;

  return <Script src="/ua-parser.min.js" strategy="afterInteractive" onLoad={handleLoad} />;
}
