"use client";

import { useState } from "react";

export default function EmbedSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <label htmlFor="widget-snippet" className="text-sm font-bold text-[#1d2944]">
        Embed code
      </label>
      <textarea
        id="widget-snippet"
        readOnly
        value={snippet}
        rows={5}
        onFocus={(event) => event.currentTarget.select()}
        className="hc-form-control mt-2 w-full resize-none rounded-xl border px-4 py-3 font-mono text-xs leading-5"
      />
      <button
        type="button"
        onClick={copySnippet}
        className="hc-primary-button mt-3 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846]"
      >
        {copied ? "Copied" : "Copy embed code"}
      </button>
      <span className="ml-3 text-xs text-[#657087]" role="status" aria-live="polite">
        {copied ? "Snippet copied to your clipboard." : ""}
      </span>
    </div>
  );
}
