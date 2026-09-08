"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  cercaIscrizioni,
  elencaCorsiConListini,
  aggiornaImportoRata,
  ottieniQuotaIscrizione,
  aggiornaQuotaIscrizione,
} from "../actions";
import { formattaEuro } from "@/lib/pricing";

type Iscrizione = Awaited<ReturnType<typeof cercaIscrizioni>>[number];
type Corso = Awaited<ReturnType<typeof elencaCorsiConListini>>[number];

export default function DashboardSegreteria() {
  const router = useRouter();
  const supabase = createClient();

  const [iscrizioni, setIscrizioni] = useState<Iscrizione[]>([]);
  const [corsi, setCorsi] = useState<Corso[]>([]);
  const [quotaIscrizione, setQuotaIscrizione] = useState<number>(100);
  const [quotaModificata, setQuotaModificata] = useState<string>("");
  const [ricerca, setRicerca] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [importiModificati, setImportiModificati] = useState<Record<string, string>>({});
  const [salvataggio, setSalvataggio] = useState<string | null>(null);

  async function caricaTutto(termine = "") {
    setCaricamento(true);
    const [risultatiIscrizioni, risultatiCorsi, quota] = await Promise.all([
      cercaIscrizioni(termine),
      elencaCorsiConListini(),
      ottieniQuotaIscrizione(),
    ]);
    setIscrizioni(risultatiIscrizioni);
    setCorsi(risultatiCorsi);
    setQuotaIscrizione(quota);
    setCaricamento(false);
  }

  useEffect(() => {
    caricaTutto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cerca(e: React.FormEvent) {
    e.preventDefault();
    await caricaTutto(ricerca);
  }

  async function salvaImporto(listinoId: string) {
    const valore = importiModificati[listinoId];
    if (valore === undefined) return;
    const numero = Number(valore.replace(",", "."));
    if (Number.isNaN(numero) || numero < 0) return;

    setSalvataggio(listinoId);
    await aggiornaImportoRata(listinoId, numero);
    await caricaTutto(ricerca);
    setSalvataggio(null);
  }

  async function salvaQuota() {
    const numero = Number(quotaModificata.replace(",", "."));
    if (Number.isNaN(numero) || numero < 0) return;
    setSalvataggio("quota");
    await aggiornaQuotaIscrizione(numero);
    await caricaTutto(ricerca);
    setQuotaModificata("");
    setSalvataggio(null);
  }

  async function esci() {
    await supabase.auth.signOut();
    router.push("/admin");
  }

  return (
    <main className="min-h-screen bg-chalk px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-court-dark">
              Area segreteria
            </h1>
            <p className="text-sm text-court-dark/60">Micolani Tennis</p>
          </div>
          <button
            onClick={esci}
            className="rounded-full border border-court/20 px-4 py-2 text-sm font-medium text-court-dark hover:bg-white"
          >
            Esci
          </button>
        </div>

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-court/10">
          <h2 className="font-display text-lg font-semibold text-court-dark">
            Quota d'iscrizione (kit + tessera FITP)
          </h2>
          <div className="mt-3 flex items-center gap-3">
            <input
              className="w-28 rounded-lg border border-court/20 px-2 py-1.5 text-sm"
              defaultValue={quotaIscrizione}
              onChange={(e) => setQuotaModificata(e.target.value)}
            />
            <button
              onClick={salvaQuota}
              disabled={salvataggio === "quota"}
              className="rounded-full bg-court px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {salvataggio === "quota" ? "Salvo…" : "Salva"}
            </button>
            <span className="text-sm text-court-dark/50">
              si applica a tutte le iscrizioni, in aggiunta al corso
            </span>
          </div>
        </section>

        <section className="mb-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-court/10">
          <h2 className="font-display text-lg font-semibold text-court-dark">Listino corsi</h2>
          <div className="mt-4 space-y-6">
            {corsi.map((corso) => (
              <div key={corso.id}>
                <h3 className="mb-2 text-sm font-semibold text-court-dark">{corso.nome}</h3>
                <div className="space-y-1.5">
                  {corso.listini.map((l) => (
                    <div key={l.id} className="flex items-center gap-3">
                      <span className="w-40 text-sm text-court-dark/70">
                        {l.frequenza_settimanale}x/sett. — {l.numero_rate === 1 ? "unico" : `${l.numero_rate} rate`}
                      </span>
                      <input
                        className="w-24 rounded-lg border border-court/20 px-2 py-1.5 text-sm"
                        defaultValue={l.importo_rata}
                        onChange={(e) =>
                          setImportiModificati((p) => ({ ...p, [l.id]: e.target.value }))
                        }
                      />
                      <button
                        onClick={() => salvaImporto(l.id)}
                        disabled={salvataggio === l.id}
                        className="rounded-full bg-court px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {salvataggio === l.id ? "Salvo…" : "Salva"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-court/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-court-dark">
              Anagrafiche ricevute
            </h2>
            <form onSubmit={cerca} className="flex gap-2">
              <input
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                placeholder="Cerca per codice, nome, telefono…"
                className="w-56 rounded-lg border border-court/20 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-full bg-court px-4 py-1.5 text-sm font-medium text-white"
              >
                Cerca
              </button>
            </form>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-court/10 text-court-dark/60">
                  <th className="py-2 pr-3">Codice</th>
                  <th className="py-2 pr-3">Atleta</th>
                  <th className="py-2 pr-3">Contatto</th>
                  <th className="py-2 pr-3">Corso</th>
                  <th className="py-2 pr-3">Frequenza</th>
                  <th className="py-2 pr-3">Totale</th>
                </tr>
              </thead>
              <tbody>
                {caricamento && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-court-dark/50">
                      Caricamento…
                    </td>
                  </tr>
                )}
                {!caricamento && iscrizioni.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-court-dark/50">
                      Nessuna anagrafica trovata.
                    </td>
                  </tr>
                )}
                {iscrizioni.map((i) => (
                  <tr key={i.id} className="border-b border-court/5">
                    <td className="py-2 pr-3 font-medium text-court">{i.codice}</td>
                    <td className="py-2 pr-3">
                      {i.atleta_nome} {i.atleta_cognome}
                      {i.minorenne && (
                        <span className="ml-1 rounded-full bg-ace px-2 py-0.5 text-xs text-court-dark">
                          minorenne
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {i.minorenne ? i.genitore_telefono : i.atleta_telefono}
                    </td>
                    <td className="py-2 pr-3">{(i as any).corsi?.nome ?? "-"}</td>
                    <td className="py-2 pr-3">{i.frequenza_settimanale}x/sett.</td>
                    <td className="py-2 pr-3">
                      {formattaEuro(i.prezzo_totale)}
                      {i.numero_rate > 1 && (
                        <span className="text-court-dark/50">
                          {" "}
                          ({i.numero_rate}×{formattaEuro(i.importo_rata)} + quota)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
