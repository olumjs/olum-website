import type { Metadata, Viewport } from "next";
import { Geist, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { getDocsNav } from "@/lib/docs-content";
import { ThemeProvider } from "@/components/ThemeProvider";
import { siteConfig } from "@/lib/site-config";
import { getRepoStars } from "@/lib/github-stars";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    template: "%s — OlumJS",
    default: siteConfig.title,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "technology",
  formatDetection: { telephone: false, email: false, address: false },
  alternates: { canonical: siteConfig.url },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    title: siteConfig.title,
    description: siteConfig.shortDescription,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.shortDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  width: "device-width",
  initialScale: 1,
};

// A single linked @graph: the Organization, WebSite, and SoftwareApplication
// entities cross-reference each other by @id so search engines resolve them as
// one entity rather than three unrelated blobs (better for knowledge panels).
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        "@id": `${siteConfig.url}/#logo`,
        url: siteConfig.logo,
        contentUrl: siteConfig.logo,
      },
      sameAs: siteConfig.sameAs,
    },
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.shortDescription,
      inLanguage: "en",
      publisher: { "@id": `${siteConfig.url}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteConfig.url}/#software`,
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.shortDescription,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      downloadUrl: siteConfig.npm,
      codeRepository: siteConfig.github,
      programmingLanguage: "JavaScript",
      keywords: "JavaScript, UI framework, VanillaJS, reactive, components",
      publisher: { "@id": `${siteConfig.url}/#organization` },
      sameAs: siteConfig.sameAs,
    },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [navGroups, githubStars] = await Promise.all([getDocsNav(), getRepoStars()]);
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geist.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <head>
        {/* Runs synchronously before first paint: dark is the default, and we
            only switch to light when the user has explicitly chosen it. The OS
            preference is never consulted, so there is no theme flash on reload. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('olum-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      </head>
      <body className="bg-[var(--bg)] text-[var(--fg)] antialiased min-h-screen">
        <ThemeProvider>
          <Navbar navGroups={navGroups} githubStars={githubStars} />
          {children}
          <AnalyticsTracker />
        </ThemeProvider>
        {/* JSON-LD structured data (Organization + WebSite + SoftwareApplication) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
