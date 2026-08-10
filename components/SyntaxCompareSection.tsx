"use client";

import { useState, type ReactNode } from "react";
import { Highlight } from "@/lib/highlight";
import { CopyButton } from "@/components/CopyButton";

// The same tiny counter, written the idiomatic way in each framework, so the
// syntax difference is the only variable — same behavior, same markup shape.

type Framework = {
  id: string;
  label: string;
  filename: string;
  lang?: "html";
  code: string;
};

const OLUM_FILENAME = "Counter.html";
const OLUM_CODE = `<script>
  const state = { name: "world", count: 0 };
</script>

<h1>Hello {state.name}!</h1>
<input value="{state.name}" oninput="e => state.name = e.target.value" />
<button onclick="state.count += 1">clicks: {state.count}</button>`;

const FRAMEWORKS: Framework[] = [
  {
    id: "svelte",
    label: "Svelte",
    filename: "Counter.svelte",
    lang: "html",
    code: `<script>
  let name = $state("world");
  let count = $state(0);
</script>

<h1>Hello {name}!</h1>
<input bind:value={name} />
<button onclick={() => count += 1}>clicks: {count}</button>`,
  },
  {
    id: "vue",
    label: "Vue",
    filename: "Counter.vue",
    lang: "html",
    code: `<script setup>
  import { ref } from "vue";
  const name = ref("world");
  const count = ref(0);
</script>

<template>
  <h1>Hello {{ name }}!</h1>
  <input v-model="name" />
  <button @click="count += 1">clicks: {{ count }}</button>
</template>`,
  },
  {
    id: "solid",
    label: "Solid",
    filename: "Counter.jsx",
    code: `import { createSignal } from "solid-js";

export default function Counter() {
  const [name, setName] = createSignal("world");
  const [count, setCount] = createSignal(0);

  return (
    <>
      <h1>Hello {name()}!</h1>
      <input value={name()} onInput={(e) => setName(e.currentTarget.value)} />
      <button onClick={() => setCount(count() + 1)}>clicks: {count()}</button>
    </>
  );
}`,
  },
  {
    id: "react",
    label: "React",
    filename: "Counter.jsx",
    code: `import { useState } from "react";

export default function Counter() {
  const [name, setName] = useState("world");
  const [count, setCount] = useState(0);

  return (
    <>
      <h1>Hello {name}!</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => setCount(count + 1)}>clicks: {count}</button>
    </>
  );
}`,
  },
  {
    id: "angular",
    label: "Angular",
    filename: "counter.component.ts",
    code: `import { Component, signal } from "@angular/core";

@Component({
  selector: "app-counter",
  template: \`
    <h1>Hello {{ name() }}!</h1>
    <input [value]="name()" (input)="name.set($any($event.target).value)" />
    <button (click)="count.set(count() + 1)">clicks: {{ count() }}</button>
  \`,
})
export class CounterComponent {
  name = signal("world");
  count = signal(0);
}`,
  }
];

function CodePanel({ filename, code, lang, tabs }: { filename: string; code: string; lang?: "html"; tabs?: ReactNode }) {
  return (
    <div className="h-full flex flex-col rounded-xl overflow-hidden border border-[#27272a] bg-[#000000]">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          {tabs ? (
            <div className="min-w-0 flex-1 overflow-x-auto">{tabs}</div>
          ) : (
            <span className="text-xs text-[#52525b] font-mono truncate">{filename}</span>
          )}
        </div>
        <CopyButton text={code} />
      </div>
      <div className="overflow-x-auto p-5 flex-1">
        <pre className="font-mono text-[13px] leading-[22px] text-[#e2e8f0]">
          <Highlight code={code} lang={lang} />
        </pre>
      </div>
    </div>
  );
}

export default function SyntaxCompareSection() {
  const [activeId, setActiveId] = useState(FRAMEWORKS[0].id);
  const active = FRAMEWORKS.find((fw) => fw.id === activeId) ?? FRAMEWORKS[0];

  return (
    <section className="py-24 sm:py-32 relative bg-[var(--bg-alt)]" id="compare">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(37,201,126,0.25), transparent)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#25C97E] tracking-widest uppercase mb-4 px-3 py-1.5 bg-[rgba(37,201,126,0.07)] border border-[rgba(37,201,126,0.15)] rounded-full">
            Syntax comparison
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[var(--fg)] leading-tight" style={{ fontFamily: "var(--font-syne)" }}>
            Same counter.
            <br />
            <span className="gradient-text">A fraction of the syntax.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[var(--fg-muted)] max-w-2xl mx-auto">
            No hooks, no signals to unwrap, no directives to memorize. Mutate a plain object — Olum re-renders.
          </p>
        </div>

        {/* Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 self-start text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-1 rounded-md bg-[rgba(37,201,126,0.12)] border border-[rgba(37,201,126,0.28)] text-[#25C97E]">
              Olum
            </span>
            <CodePanel filename={OLUM_FILENAME} code={OLUM_CODE} lang="html" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="self-start text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--fg-muted)]">
              vs.
            </span>
            <CodePanel
              filename={active.filename}
              code={active.code}
              lang={active.lang}
              tabs={
                <div className="flex items-center gap-0.5 rounded-lg bg-[#111113] p-[3px] w-max">
                  {FRAMEWORKS.map((fw) => (
                    <button
                      key={fw.id}
                      type="button"
                      onClick={() => setActiveId(fw.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium font-mono transition-colors whitespace-nowrap ${
                        activeId === fw.id ? "bg-[#27272a] text-white shadow-sm" : "text-[#71717a] hover:text-[#d4d4d8]"
                      }`}
                    >
                      {fw.label}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
