import { siteConfig } from "@/lib/site-config";
import { getDocOrder, getDocDates } from "@/lib/docs-content";
import { getPlaygroundGroups } from "@/lib/playground-examples.server";
import { flattenExamples } from "@/lib/playground-examples";
import { postsByDate } from "@/lib/blog-posts";

const today = new Date().toISOString().split("T")[0];

export async function GET() {
  const [docOrder, docDates, playgroundGroups] = await Promise.all([
    getDocOrder(),
    getDocDates(),
    getPlaygroundGroups(),
  ]);
  const playgroundExamples = flattenExamples(playgroundGroups);
  const blogPosts = postsByDate();
  const staticRoutes = [
    // Home reflects the freshest doc change, falling back to the build date.
    {
      url: siteConfig.url,
      changefreq: "monthly",
      priority: "1.0",
      lastmod: Object.values(docDates).sort().at(-1) ?? today,
    },
    // Bare /playground redirects to the first example, so it is intentionally
    // omitted here — sitemaps should list canonical (non-redirecting) URLs.
    ...playgroundExamples.map((ex, i) => ({
      url: `${siteConfig.url}/playground/${ex.slug}`,
      changefreq: "monthly",
      priority: i === 0 ? "0.9" : "0.7",
      lastmod: today,
    })),
    // The listing is as fresh as its newest post; each post reports its own
    // publish/update date so crawlers only re-fetch what actually changed.
    {
      url: `${siteConfig.url}/blog`,
      changefreq: "weekly",
      priority: "0.8",
      lastmod: blogPosts[0]?.publishedAt ?? today,
    },
    ...blogPosts.map((post) => ({
      url: `${siteConfig.url}/blog/${post.slug}`,
      changefreq: "monthly",
      priority: "0.7",
      lastmod: post.updatedAt ?? post.publishedAt,
    })),
  ];

  const docRoutes = docOrder.map((href) => ({
    url: `${siteConfig.url}${href}`,
    changefreq: "monthly",
    priority: href === "/docs" ? "0.9" : "0.8",
    // Real last-commit date per doc; build date only where GitHub has no history.
    lastmod: docDates[href] ?? today,
  }));

  const allRoutes = [...staticRoutes, ...docRoutes];

  const urlEntries = allRoutes
    .map(({ url, lastmod, changefreq, priority }) =>
      [
        `  <url>`,
        `    <loc>${url}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        `  </url>`,
      ].join("\n")
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
