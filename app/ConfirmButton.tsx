"use client";

export default function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button type="submit" className="danger" onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
