"use client";

import { useRef, useState } from "react";

// Some browsers block navigator.clipboard (permissions, embedded views).
// Fall back to a hidden textarea + execCommand, then to showing the text.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

// "Copy as model card" and "Download PDF", enabled only for Launch-ready packs.
export default function CardActions({ markdown, pdfHref, ready }: { markdown: string; pdfHref: string; ready: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const box = useRef<HTMLTextAreaElement>(null);
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
    <>
      <div className="actions">
        <button
          type="button"
          onClick={async () => {
            if (await copyText(markdown)) {
              setState("copied");
              setTimeout(() => setState("idle"), 2500);
            } else {
              setState("manual");
              setTimeout(() => box.current?.select(), 50);
            }
          }}
        >
          {state === "copied" ? "Copied" : "Copy as model card"}
        </button>
        <a className="button secondary" href={pdfHref} target="_blank" rel="noopener">Download PDF</a>
        <span className="muted small">Markdown, Public fields only. PDF opens a print page: choose “Save as PDF”.</span>
      </div>
      {state === "manual" && (
        <div className="warn-box">
          This browser blocked automatic copying. The model card is selected below: press Ctrl+C (Cmd+C on a Mac) to copy it.
          <textarea ref={box} className="markdown-box" readOnly rows={12} value={markdown} aria-label="Model card Markdown" />
        </div>
      )}
    </>
  );
}
