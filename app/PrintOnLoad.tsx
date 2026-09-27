"use client";

import { useEffect } from "react";

// Opens the print dialog ("Save as PDF") when the page was opened from Download PDF.
export default function PrintOnLoad({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <button type="button" className="no-print" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
