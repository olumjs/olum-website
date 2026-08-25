import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";
import { getAllTags, posts } from "@/lib/blog-posts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${siteConfig.name} Blog — framework updates, tutorials, and deep dives`;

export default function OgImage() {
  const tags = getAllTags().slice(0, 4);

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
              "radial-gradient(ellipse at 50% 20%, rgba(37,201,126,0.12) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(37,201,126,0.08)",
            border: "1px solid rgba(37,201,126,0.25)",
            borderRadius: 100,
            padding: "8px 20px",
            marginBottom: 44,
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
            The Olum Blog
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            color: "#f0f0f2",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            marginBottom: 22,
            maxWidth: 900,
          }}
        >
          What&apos;s happening in the Olum universe
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 400,
            color: "#71717a",
            marginBottom: 48,
            maxWidth: 760,
            lineHeight: 1.4,
          }}
        >
          Framework updates, tutorials, migration stories, and deep dives.
        </div>

        {/* Tag pills */}
        <div style={{ display: "flex", gap: 12 }}>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "10px 20px",
                color: "#a1a1aa",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Bottom line: post count + domain */}
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
          <span style={{ color: "#52525b", fontSize: 18, fontWeight: 500 }}>
            {posts.length} {posts.length === 1 ? "post" : "posts"}
          </span>
          <span style={{ color: "#25C97E", fontSize: 18, fontWeight: 500 }}>
            {siteConfig.domain}/blog
          </span>
        </div>
      </div>
    ),
    size
  );
}
