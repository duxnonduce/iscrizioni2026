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
    <main className="flex min-h-screen items-center justify-center bg-chalk px-5">
      <form
        onSubmit={accedi}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-court/10"
      >
        <h1 className="font-display text-2xl font-bold text-court-dark">
          Area segreteria
        </h1>
        <p className="mt-1 text-sm text-court-dark/60">Micolani Tennis</p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-court-dark/80">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-court/20 px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-court-dark/80">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-court/20 px-3 py-2.5"
            />
          </label>
        </div>

        {errore && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errore}
          </p>
        )}

        <button
          type="submit"
          disabled={caricamento}
          className="mt-6 w-full rounded-full bg-court px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-court-dark disabled:opacity-60"
        >
          {caricamento ? "Accesso in corso…" : "Accedi"}
        </button>
      </form>
    </main>
  );
}
