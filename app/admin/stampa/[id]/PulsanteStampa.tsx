"use client";

export default function PulsanteStampa() {
  return (
    <div className="print:hidden mb-6 flex items-center justify-between">
      <a
        href="/admin/dashboard"
        className="rounded-full border border-court/20 px-4 py-2 text-sm font-medium text-court-dark hover:bg-chalk"
      >
        ← Torna al pannello
      </a>
      <button
        onClick={() => window.print()}
        className="rounded-full bg-court px-5 py-2 text-sm font-semibold text-white hover:bg-court-dark"
      >
        Stampa questa scheda
      </button>
    </div>
  );
}
