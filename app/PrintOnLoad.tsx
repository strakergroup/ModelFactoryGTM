"use client";

import { useEffect } from "react";

export default function PrintOnLoad() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button type="button" className="no-print" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
