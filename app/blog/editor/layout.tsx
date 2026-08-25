import type { Metadata } from "next";

// The editor is a dev-only authoring tool. robots.txt already disallows it, but
// a page-level noindex keeps it out of the index even if it is linked directly.
export const metadata: Metadata = {
  title: "Blog editor",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
