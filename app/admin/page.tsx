"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PaginaLoginAdmin() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [caricamento, setCaricamento] = useState(false);

  async function accedi(e: React.FormEvent) {
    e.preventDefault();
    setCaricamento(true);
    setErrore("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setCaricamento(false);

    if (error) {
      setErrore("Credenziali non valide.");
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B1020] px-5 font-[family-name:var(--font-dm)] text-[#EEF1FB] [color-scheme:dark]">
      <form
        onSubmit={accedi}
        className="w-full max-w-sm rounded-[28px] border border-white/[0.07] bg-[#121A33] p-8"
      >
        <img src="/logo-micolani.png" alt="Micolani Tennis" className="mx-auto mb-6 h-14 w-auto rounded-lg" />
        <h1 className="text-center font-[family-name:var(--font-sg)] text-3xl font-bold tracking-tight">
          Area segreteria
        </h1>

        <div className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#9AA6C7]">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/[0.1] bg-[#0F1630] px-4 py-3 text-[#EEF1FB] focus:border-[#C6F24E]/60 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#9AA6C7]">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/[0.1] bg-[#0F1630] px-4 py-3 text-[#EEF1FB] focus:border-[#C6F24E]/60 focus:outline-none"
            />
          </label>
        </div>

        {errore && (
          <p className="mt-4 rounded-2xl bg-rose-400/15 px-4 py-2.5 text-sm text-rose-300">{errore}</p>
        )}

        <button
          type="submit"
          disabled={caricamento}
          className="mt-7 w-full rounded-full bg-[#C6F24E] px-6 py-3 text-sm font-bold text-[#0B1020] hover:bg-[#d4f77c] disabled:opacity-60"
        >
          {caricamento ? "Accesso in corso…" : "Accedi"}
        </button>
      </form>
    </main>
  );
}
