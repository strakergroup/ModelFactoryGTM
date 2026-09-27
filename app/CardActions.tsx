"use client";

import { useState } from "react";

// "Copy as model card" and "Download PDF", enabled only for Launch-ready packs.
export default function CardActions({ markdown, pdfHref, ready }: { markdown: string; pdfHref: string; ready: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!ready) {
    return (
      <div className="actions">
        <button type="button" disabled title="Only Launch-ready packs can be exported">Copy as model card</button>
        <button type="button" className="secondary" disabled title="Only Launch-ready packs can be exported">Download PDF</button>
        <span className="muted small">Available once the pack is Launch-ready.</span>
      </div>
    );
  }
  return (
    <div className="actions">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(markdown);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }}
      >
        {copied ? "Copied" : "Copy as model card"}
      </button>
      <a className="button secondary" href={pdfHref} target="_blank" rel="noopener">Download PDF</a>
      <span className="muted small">Markdown, Public fields only. PDF opens a print page: choose “Save as PDF”.</span>
    </div>
  );
}
