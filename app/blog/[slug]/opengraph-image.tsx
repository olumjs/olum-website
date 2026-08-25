import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";
import { getPost, formatDate } from "@/lib/blog-posts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `A post on the ${siteConfig.name} blog`;

type Props = { params: Promise<{ slug: string }> };

// Long headlines get a smaller face so they still fit on three lines.
function titleSize(title: string): number {
  if (title.length > 70) return 52;
  if (title.length > 45) return 62;
  return 74;
}

export default async function OgImage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  const title = post?.title ?? "The Olum Blog";
  const tags = post?.tags.slice(0, 3) ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#09090b",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
            width: 1000,
            height: 700,
            background:
              "radial-gradient(ellipse at 50% 20%, rgba(37,201,126,0.1) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* Blog badge + tags */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(37,201,126,0.08)",
              border: "1px solid rgba(37,201,126,0.25)",
              borderRadius: 100,
              padding: "8px 20px",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#25C97E" }} />
            <span
              style={{
                color: "#25C97E",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Blog
            </span>
          </div>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 100,
                padding: "8px 18px",
                color: "#a1a1aa",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: titleSize(title),
            fontWeight: 800,
            color: "#f0f0f2",
            lineHeight: 1.08,
            letterSpacing: "-0.035em",
            maxWidth: 1000,
            display: "flex",
          }}
        >
          {title}
        </div>

        {/* Author + date + reading time */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 100,
            right: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: post?.author.color ?? "#25C97E",
                color: "#09090b",
                fontSize: 20,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {post?.author.avatar ?? "OL"}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#e4e4e7", fontSize: 20, fontWeight: 600 }}>
                {post?.author.name ?? siteConfig.name}
              </span>
              <span style={{ color: "#52525b", fontSize: 16 }}>
                {post ? `${formatDate(post.publishedAt)} · ${post.readingTime}` : siteConfig.domain}
              </span>
            </div>
          </div>
          <span style={{ color: "#25C97E", fontSize: 18, fontWeight: 500 }}>
            {siteConfig.domain}
          </span>
        </div>
      </div>
    ),
    size
  );
}
