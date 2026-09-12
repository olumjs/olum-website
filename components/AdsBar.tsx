"use client";

export default function AdsBar() {
  function close() {
    document.documentElement.classList.add("ads-dismissed");
    try {
      localStorage.setItem("olum-ads-dismissed", "1");
    } catch {}
  }

  return (
    <div
      className="ads-bar fixed top-0 left-0 right-0 z-[60] h-10 flex items-center justify-center gap-2 px-10 text-center text-[13px] font-semibold text-black"
      style={{ background: "linear-gradient(90deg, #25C97E, #34e39a)" }}
    >
      <span className="truncate">
        <span aria-hidden="true">🏆</span> Build an app with OlumJS and win $100! —{" "}
        <span className="hidden sm:inline">Join the App Contest → </span>
        <a
          href="https://discord.gg/2zK7tb2Cg9"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Join Discord
        </a>
      </span>
      <button
        onClick={close}
        aria-label="Dismiss announcement"
        className="absolute right-2.5 p-1 rounded hover:bg-black/10 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3.293 3.293a1 1 0 011.414 0L9 7.586l4.293-4.293a1 1 0 111.414 1.414L10.414 9l4.293 4.293a1 1 0 01-1.414 1.414L9 10.414l-4.293 4.293a1 1 0 01-1.414-1.414L7.586 9 3.293 4.707a1 1 0 010-1.414z"
          />
        </svg>
      </button>
    </div>
  );
}
