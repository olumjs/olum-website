"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const VIDEO_SRC = "/demo/brag.mp4";
const VIDEO_POSTER = "/demo/brag-poster.jpg";

/** Simple rectangular button that opens a fullscreen layer to play the demo video. */
export default function HeroDemoVideo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-invert animate-cta-ring inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl hover:opacity-90 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2.5 1.5l7 4.5-7 4.5v-9z" />
        </svg>
        Watch demo
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close video"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center justify-center w-10 h-10 rounded-full border border-[var(--border-hover)] bg-[var(--surface)] text-[var(--fg-2)] hover:text-[var(--fg)] transition-colors duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>

          <video
            className="w-full aspect-video"
            poster={VIDEO_POSTER}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          >
            <source src={VIDEO_SRC} type="video/mp4" />
          </video>
        </div>,
        document.body
      )}
    </>
  );
}
