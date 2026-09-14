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
  confermaIscrizione,
  eliminaIscrizione,
  aggiornaIscrizione,
  riepilogoTaglie,
  segnaStampata,
  ottieniRatePagamento,
  segnaRataPagamento,
  aggiornaRata,
  riepilogoPagamenti,
  elencoIncassi,
  generaRateMancanti,
  aggiungiRata,
  eliminaRata,
  mappaPagamentiPerIscrizione,
} from "../actions";
import { formattaEuro } from "@/lib/pricing";

type Iscrizione = Awaited<ReturnType<typeof cercaIscrizioni>>[number];
type Corso = Awaited<ReturnType<typeof elencaCorsiConListini>>[number];

function formattaData(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formattaOra(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("it-IT");
}

const ORDINE_TAGLIE = ["5/6", "7/8", "9/10", "11/12", "13/14", "15/16", "XXS", "XS", "S", "M", "L", "XL", "XXL"];

function iniziali(nome: string, cognome: string): string {
  return `${(nome || "?")[0] ?? ""}${(cognome || "")[0] ?? ""}`.toUpperCase();
}

const VISTE = [
  { id: "panoramica", etichetta: "Panoramica", icona: "🏠" },
  { id: "iscrizioni", etichetta: "Iscrizioni", icona: "📋" },
  { id: "pagamenti", etichetta: "Incassi", icona: "💳" },
  { id: "listino", etichetta: "Listino", icona: "🎾" },
] as const;

type Vista = (typeof VISTE)[number]["id"];

function BarraPagamento({
  riepilogo,
}: {
  riepilogo?: { totale: number; pagato: number; scaduto: boolean; numeroRate: number; numeroPagate: number };
}) {
  if (!riepilogo || riepilogo.numeroRate === 0) {
    return <span className="text-xs text-court-dark/30">—</span>;
  }
  const percentuale = riepilogo.totale > 0 ? Math.round((riepilogo.pagato / riepilogo.totale) * 100) : 0;
  const completo = percentuale >= 100;
  const coloreBarra = riepilogo.scaduto ? "bg-red-400" : completo ? "bg-emerald-400" : "bg-amber-400";

  return (
    <div className="w-28">
      <div className="flex items-center justify-between text-xs">
        <span
          className={`font-semibold ${
            riepilogo.scaduto ? "text-red-600" : completo ? "text-emerald-600" : "text-court-dark/60"
          }`}
        >
          {riepilogo.scaduto ? "Scaduto" : `${percentuale}%`}
        </span>
        <span className="text-court-dark/40">
          {riepilogo.numeroPagate}/{riepilogo.numeroRate}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-court/10">
        <div className={`h-full rounded-full ${coloreBarra}`} style={{ width: `${Math.min(100, percentuale)}%` }} />
      </div>
    </div>
  );
}

function StatCard({
  etichetta,
  valore,
  icona,
  tono = "default",
}: {
  etichetta: string;
  valore: string | number;
  icona: string;
  tono?: "default" | "verde" | "ambra" | "rosso";
}) {
  const sfondoIcona =
    tono === "verde"
      ? "bg-emerald-100"
      : tono === "ambra"
        ? "bg-amber-100"
        : tono === "rosso"
          ? "bg-red-100"
          : "bg-ace";
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-court/5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${sfondoIcona}`}>
        {icona}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-court-dark/50">{etichetta}</p>
        <p className="truncate font-display text-xl font-bold text-court-dark">{valore}</p>
      </div>
    </div>
  );
}

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
  const [espansa, setEspansa] = useState<string | null>(null);
  const [taglie, setTaglie] = useState<Record<string, number>>({});
  const [pagamenti, setPagamenti] = useState({ totalePagato: 0, totaleDovuto: 0, totaleScaduto: 0 });
  const [incassi, setIncassi] = useState<Awaited<ReturnType<typeof elencoIncassi>>>([]);
  const [generandoRate, setGenerandoRate] = useState(false);
  const [mappaPagamenti, setMappaPagamenti] = useState<Awaited<ReturnType<typeof mappaPagamentiPerIscrizione>>>({});
  const [vista, setVista] = useState<Vista>("panoramica");

  async function caricaTutto(termine = "") {
    setCaricamento(true);
    const [risultatiIscrizioni, risultatiCorsi, quota, conteggioTaglie, riepilogoPag, listaIncassi, mappaPag] =
      await Promise.all([
        cercaIscrizioni(termine),
        elencaCorsiConListini(),
        ottieniQuotaIscrizione(),
        riepilogoTaglie(),
        riepilogoPagamenti(),
        elencoIncassi(50),
        mappaPagamentiPerIscrizione(),
      ]);
    setIscrizioni(risultatiIscrizioni);
    setCorsi(risultatiCorsi);
    setQuotaIscrizione(quota);
    setTaglie(conteggioTaglie);
    setPagamenti(riepilogoPag);
    setIncassi(listaIncassi);
    setMappaPagamenti(mappaPag);
    setCaricamento(false);
  }

  async function segnaComeStampata(id: string) {
    const adesso = new Date().toISOString();
    // Aggiorna subito lo stato in pagina, senza aspettare un ricaricamento completo
    setIscrizioni((prev) =>
      prev.map((it) => (it.id === id ? ({ ...it, stampata: true, stampata_il: adesso } as any) : it))
    );
    try {
      await segnaStampata(id);
    } catch (err) {
      console.error("Errore nel salvare lo stato di stampa:", err);
      alert(
        "La scheda si è aperta, ma non sono riuscito a salvare lo stato \"stampata\" nel database.\n\n" +
          "Motivo: " + (err instanceof Error ? err.message : String(err)) + "\n\n" +
          "Verifica di aver eseguito su Supabase:\nalter table iscrizioni add column if not exists stampata boolean not null default false;\nalter table iscrizioni add column if not exists stampata_il timestamptz;"
      );
    }
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

  async function generaRate() {
    setGenerandoRate(true);
    const risultato = await generaRateMancanti();
    await caricaTutto(ricerca);
    setGenerandoRate(false);
    if (risultato.create > 0) {
      alert(`Generate le rate per ${risultato.create} iscrizione/i che non le avevano ancora.`);
    } else {
      alert("Tutte le iscrizioni hanno già le rate generate.");
    }
  }

  const confermateCount = iscrizioni.filter((i) => (i as any).confermata).length;
  const daConfermareCount = iscrizioni.length - confermateCount;

  return (
    <div className="min-h-screen bg-chalk lg:flex">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy px-4 py-6 lg:flex">
        <img src="/logo-micolani.png" alt="Micolani Tennis" className="h-10 w-auto" />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {VISTE.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                vista === v.id ? "bg-white text-court-dark" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-lg">{v.icona}</span>
              {v.etichetta}
            </button>
          ))}
        </nav>
        <button
          onClick={esci}
          className="rounded-2xl border border-white/15 px-3.5 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
        >
          ↩ Esci
        </button>
      </aside>

      <div className="flex-1">
        {/* Top bar — mobile */}
        <div className="sticky top-0 z-20 bg-navy px-5 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <img src="/logo-micolani.png" alt="Micolani Tennis" className="h-8 w-auto" />
            <button onClick={esci} className="text-sm font-medium text-white/70 hover:text-white">
              Esci
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {VISTE.map((v) => (
              <button
                key={v.id}
                onClick={() => setVista(v.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  vista === v.id ? "bg-white text-court-dark" : "bg-white/10 text-white/70"
                }`}
              >
                <span>{v.icona}</span>
                {v.etichetta}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-5 py-8">
          {vista === "panoramica" && (
            <div>
              <h1 className="font-display text-2xl font-bold text-court-dark">
                Ciao! 👋 Ecco la situazione di oggi
              </h1>
              <p className="mt-1 text-sm text-court-dark/50">
                {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard etichetta="Iscrizioni" valore={iscrizioni.length} icona="📋" />
                <StatCard etichetta="Confermate" valore={confermateCount} icona="✅" tono="verde" />
                <StatCard etichetta="Da confermare" valore={daConfermareCount} icona="⏳" tono="ambra" />
                <StatCard
                  etichetta="Da stampare"
                  valore={iscrizioni.filter((i) => !(i as any).stampata).length}
                  icona="🖨️"
                  tono="ambra"
                />
                <StatCard etichetta="Totale pagato" valore={formattaEuro(pagamenti.totalePagato)} icona="💰" tono="verde" />
                <StatCard etichetta="Totale dovuto" valore={formattaEuro(pagamenti.totaleDovuto)} icona="🧾" />
                <StatCard etichetta="Totale scaduto" valore={formattaEuro(pagamenti.totaleScaduto)} icona="⚠️" tono="rosso" />
                <StatCard
                  etichetta="Taglie richieste"
                  valore={Object.values(taglie).reduce((t, n) => t + n, 0)}
                  icona="👕"
                />
              </div>

              <div className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-court/5">
                <h2 className="font-display text-lg font-semibold text-court-dark">Ultime iscrizioni</h2>
                <div className="mt-3 divide-y divide-court/5">
                  {iscrizioni.slice(0, 5).map((i) => (
                    <button
                      key={i.id}
                      onClick={() => {
                        setVista("iscrizioni");
                        setEspansa(i.id);
                      }}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-chalk"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ace text-xs font-semibold text-court-dark">
                        {iniziali(i.atleta_nome, i.atleta_cognome)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-court-dark">
                          {i.atleta_nome} {i.atleta_cognome}
                        </p>
                        <p className="text-xs text-court-dark/40">{(i as any).corsi?.nome}</p>
                      </span>
                      {(i as any).confermata ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Confermata
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                          Da confermare
                        </span>
                      )}
                    </button>
                  ))}
                  {iscrizioni.length === 0 && (
                    <p className="py-4 text-sm text-court-dark/40">Nessuna iscrizione ricevuta ancora.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {vista === "iscrizioni" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-court-dark">Iscrizioni</h1>
                  <p className="text-sm text-court-dark/50">Clicca su una riga per il dettaglio</p>
                </div>
                <form onSubmit={cerca} className="flex gap-2">
                  <input
                    value={ricerca}
                    onChange={(e) => setRicerca(e.target.value)}
                    placeholder="Cerca per codice, nome, telefono…"
                    className="w-56 rounded-full border border-court/20 px-4 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-court px-4 py-1.5 text-sm font-medium text-white hover:bg-court-dark"
                  >
                    Cerca
                  </button>
                </form>
              </div>

              <div className="mt-5 overflow-x-auto rounded-3xl bg-white p-2 shadow-sm ring-1 ring-court/5">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-court-dark/40">
                      <th className="px-3 pb-3 pt-3 font-medium">Atleta</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Codice</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Contatto</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Corso</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Totale</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Pagamento</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Stato</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Stampa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-court/5">
                    {caricamento && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-court-dark/40">
                          Caricamento…
                        </td>
                      </tr>
                    )}
                    {!caricamento && iscrizioni.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-court-dark/40">
                          Nessuna anagrafica trovata.
                        </td>
                      </tr>
                    )}
                    {iscrizioni.map((i) => (
                      <>
                        <tr
                          key={i.id}
                          onClick={() => setEspansa(espansa === i.id ? null : i.id)}
                          className="cursor-pointer transition-colors hover:bg-chalk"
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ace text-xs font-semibold text-court-dark">
                                {iniziali(i.atleta_nome, i.atleta_cognome)}
                              </span>
                              <div>
                                <p className="font-medium text-court-dark">
                                  {i.atleta_nome} {i.atleta_cognome}
                                </p>
                                {i.minorenne && <p className="text-xs text-court-dark/40">minorenne</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-medium text-court">{i.codice}</td>
                          <td className="px-3 py-3 text-court-dark/70">
                            {i.minorenne ? i.genitore_telefono : i.atleta_telefono}
                          </td>
                          <td className="px-3 py-3 text-court-dark/70">
                            {(i as any).corsi?.nome ?? "-"}
                            <span className="text-court-dark/40"> · {i.frequenza_settimanale}x/sett.</span>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-court-dark">{formattaEuro(i.prezzo_totale)}</p>
                            {i.numero_rate > 1 && (
                              <p className="text-xs text-court-dark/40">
                                {i.numero_rate}×{formattaEuro(i.importo_rata)} + quota
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <BarraPagamento riepilogo={mappaPagamenti[i.id]} />
                          </td>
                          <td className="px-3 py-3">
                            {(i as any).confermata ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Confermata
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                                Da confermare
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {(i as any).stampata ? (
                              <span className="text-lg" title="Già stampata">
                                🖨️✅
                              </span>
                            ) : (
                              <span className="text-xs text-court-dark/30">—</span>
                            )}
                          </td>
                        </tr>
                        {espansa === i.id && (
                          <tr>
                            <td colSpan={8} className="rounded-2xl bg-chalk px-4 py-5">
                              <DettaglioIscrizione
                                i={i}
                                onCambiato={() => caricaTutto(ricerca)}
                                onStampata={() => segnaComeStampata(i.id)}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {vista === "pagamenti" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-court-dark">Registro incassi</h1>
                  <p className="text-sm text-court-dark/50">Ultimi pagamenti registrati, più recenti in alto</p>
                </div>
                <button
                  onClick={generaRate}
                  disabled={generandoRate}
                  className="rounded-full border border-court/20 px-4 py-1.5 text-xs font-medium text-court-dark/60 hover:bg-white disabled:opacity-60"
                >
                  {generandoRate ? "Genero…" : "Genera rate mancanti"}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <StatCard etichetta="Pagato" valore={formattaEuro(pagamenti.totalePagato)} icona="💰" tono="verde" />
                <StatCard etichetta="Dovuto" valore={formattaEuro(pagamenti.totaleDovuto)} icona="🧾" />
                <StatCard etichetta="Scaduto" valore={formattaEuro(pagamenti.totaleScaduto)} icona="⚠️" tono="rosso" />
              </div>

              <div className="mt-5 overflow-x-auto rounded-3xl bg-white p-2 shadow-sm ring-1 ring-court/5">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-court-dark/40">
                      <th className="px-3 pb-3 pt-3 font-medium">Data</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Atleta</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Codice</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Causale</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Metodo</th>
                      <th className="px-3 pb-3 pt-3 font-medium">Importo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-court/5">
                    {incassi.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-court-dark/40">
                          Nessun incasso registrato ancora.
                        </td>
                      </tr>
                    )}
                    {incassi.map((inc: any) => (
                      <tr key={inc.id}>
                        <td className="px-3 py-2.5 text-court-dark/70">{formattaData(inc.data_pagamento)}</td>
                        <td className="px-3 py-2.5 text-court-dark">
                          {inc.iscrizioni?.atleta_nome} {inc.iscrizioni?.atleta_cognome}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-court">{inc.iscrizioni?.codice}</td>
                        <td className="px-3 py-2.5 text-court-dark/70">{inc.tipo}</td>
                        <td className="px-3 py-2.5 text-court-dark/50">{inc.metodo_pagamento || "—"}</td>
                        <td className="px-3 py-2.5 font-medium text-emerald-600">{formattaEuro(inc.importo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {vista === "listino" && (
            <div>
              <h1 className="font-display text-2xl font-bold text-court-dark">Listino e quota</h1>
              <p className="text-sm text-court-dark/50">Prezzi dei corsi e quota d'iscrizione</p>

              <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-court/5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-court-dark">Quota d'iscrizione</h2>
                    <p className="text-xs text-court-dark/50">Kit abbigliamento e tessera FITP — si aggiunge a ogni corso</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-court-dark/40">€</span>
                    <input
                      className="w-20 rounded-lg border border-court/20 px-2 py-1.5 text-right text-sm"
                      defaultValue={quotaIscrizione}
                      onChange={(e) => setQuotaModificata(e.target.value)}
                    />
                    <button
                      onClick={salvaQuota}
                      disabled={salvataggio === "quota"}
                      className="rounded-full bg-court px-4 py-1.5 text-sm font-medium text-white hover:bg-court-dark disabled:opacity-60"
                    >
                      {salvataggio === "quota" ? "Salvo…" : "Salva"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 divide-y divide-court/5 border-t border-court/10 pt-5">
                  {corsi.map((corso) => (
                    <div key={corso.id} className="py-4 first:pt-0">
                      <h3 className="mb-3 text-sm font-semibold text-court-dark">{corso.nome}</h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {corso.listini.map((l) => (
                          <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-chalk px-3 py-2">
                            <span className="text-sm text-court-dark/70">
                              {l.frequenza_settimanale}x/sett. — {l.numero_rate === 1 ? "unico" : `${l.numero_rate} rate`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-court-dark/40">€</span>
                              <input
                                className="w-16 rounded-md border border-court/20 bg-white px-1.5 py-1 text-right text-sm"
                                defaultValue={l.importo_rata}
                                onChange={(e) => setImportiModificati((p) => ({ ...p, [l.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => salvaImporto(l.id)}
                                disabled={salvataggio === l.id}
                                className="text-xs font-medium text-court underline decoration-court/30 underline-offset-2 hover:text-court-dark disabled:opacity-50"
                              >
                                {salvataggio === l.id ? "…" : "Salva"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-court/5">
                <h2 className="font-display text-lg font-semibold text-court-dark">Riepilogo taglie kit</h2>
                <p className="text-xs text-court-dark/50">Totale su tutte le iscrizioni ricevute</p>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                  {ORDINE_TAGLIE.filter((t) => taglie[t]).map((t) => (
                    <div key={t} className="rounded-xl bg-chalk px-3 py-2.5 text-center">
                      <p className="font-display text-xl font-bold text-court-dark">{taglie[t]}</p>
                      <p className="text-xs text-court-dark/50">{t}</p>
                    </div>
                  ))}
                  {taglie["Non indicata"] && (
                    <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-center">
                      <p className="font-display text-xl font-bold text-amber-700">{taglie["Non indicata"]}</p>
                      <p className="text-xs text-amber-700/70">Non indicata</p>
                    </div>
                  )}
                  {Object.keys(taglie).length === 0 && (
                    <p className="col-span-full text-sm text-court-dark/40">Nessun dato ancora.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-court-dark/50">
        {titolo}
      </h4>
      <dl className="space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Riga({ etichetta, valore }: { etichetta: string; valore: any }) {
  if (valore === null || valore === undefined || valore === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-court-dark/50">{etichetta}</dt>
      <dd className="text-right font-medium text-court-dark">
        {typeof valore === "boolean" ? (valore ? "Sì" : "No") : String(valore)}
      </dd>
    </div>
  );
}

const CAMPI_TESTO: Array<{ chiave: string; etichetta: string; tipo?: "text" | "date" | "checkbox" | "textarea" }> = [
  { chiave: "atleta_nome", etichetta: "Nome" },
  { chiave: "atleta_cognome", etichetta: "Cognome" },
  { chiave: "atleta_codice_fiscale", etichetta: "Codice fiscale" },
  { chiave: "atleta_data_nascita", etichetta: "Data di nascita", tipo: "date" },
  { chiave: "atleta_luogo_nascita", etichetta: "Luogo di nascita" },
  { chiave: "atleta_sesso", etichetta: "Sesso" },
  { chiave: "atleta_cittadinanza", etichetta: "Cittadinanza" },
  { chiave: "atleta_indirizzo", etichetta: "Indirizzo" },
  { chiave: "atleta_comune", etichetta: "Comune" },
  { chiave: "atleta_provincia", etichetta: "Provincia" },
  { chiave: "atleta_cap", etichetta: "CAP" },
  { chiave: "atleta_telefono", etichetta: "Telefono" },
  { chiave: "atleta_email", etichetta: "Email" },
  { chiave: "minorenne", etichetta: "Minorenne", tipo: "checkbox" },
  { chiave: "preferenze_giorni", etichetta: "Preferenze giorni" },
  { chiave: "preferenze_orari", etichetta: "Preferenze orari" },
  { chiave: "note_esigenze", etichetta: "Esigenze", tipo: "textarea" },
];

const CAMPI_GENITORE: typeof CAMPI_TESTO = [
  { chiave: "genitore_nome", etichetta: "Nome" },
  { chiave: "genitore_cognome", etichetta: "Cognome" },
  { chiave: "genitore_rapporto", etichetta: "Rapporto" },
  { chiave: "genitore_codice_fiscale", etichetta: "Codice fiscale" },
  { chiave: "genitore_data_nascita", etichetta: "Data di nascita", tipo: "date" },
  { chiave: "genitore_luogo_nascita", etichetta: "Luogo di nascita" },
  { chiave: "genitore_indirizzo", etichetta: "Indirizzo" },
  { chiave: "genitore_comune", etichetta: "Comune" },
  { chiave: "genitore_provincia", etichetta: "Provincia" },
  { chiave: "genitore_cap", etichetta: "CAP" },
  { chiave: "genitore_telefono", etichetta: "Telefono" },
  { chiave: "genitore_whatsapp", etichetta: "WhatsApp" },
  { chiave: "genitore_email", etichetta: "Email" },
  { chiave: "secondo_recapito_nome", etichetta: "Secondo referente" },
  { chiave: "secondo_recapito_telefono", etichetta: "Tel. secondo referente" },
  { chiave: "emergenza_nome", etichetta: "Contatto emergenza" },
  { chiave: "emergenza_telefono", etichetta: "Tel. emergenza" },
  { chiave: "persone_autorizzate_ritiro", etichetta: "Autorizzati al ritiro", tipo: "textarea" },
];

const CAMPI_CORSO: typeof CAMPI_TESTO = [
  { chiave: "frequenza_settimanale", etichetta: "Frequenza settimanale" },
  { chiave: "numero_rate", etichetta: "Numero rate" },
  { chiave: "importo_rata", etichetta: "Importo per rata" },
  { chiave: "quota_iscrizione", etichetta: "Quota iscrizione" },
  { chiave: "prezzo_totale", etichetta: "Prezzo totale" },
  { chiave: "taglia_kit", etichetta: "Taglia kit" },
];

const CAMPI_FATTURAZIONE: typeof CAMPI_TESTO = [
  { chiave: "fatturazione_uguale_genitore", etichetta: "Uguale al genitore/allievo", tipo: "checkbox" },
  { chiave: "fatturazione_intestatario", etichetta: "Intestatario" },
  { chiave: "fatturazione_codice_fiscale", etichetta: "Codice fiscale" },
  { chiave: "fatturazione_partita_iva", etichetta: "Partita IVA" },
  { chiave: "fatturazione_indirizzo", etichetta: "Indirizzo" },
  { chiave: "fatturazione_comune", etichetta: "Comune" },
  { chiave: "fatturazione_provincia", etichetta: "Provincia" },
  { chiave: "fatturazione_cap", etichetta: "CAP" },
  { chiave: "fatturazione_email", etichetta: "Email" },
  { chiave: "fatturazione_pec", etichetta: "PEC" },
  { chiave: "fatturazione_sdi", etichetta: "Codice SDI" },
  { chiave: "fatturazione_soggetto_pagante", etichetta: "Soggetto pagante" },
  { chiave: "fatturazione_metodo_pagamento", etichetta: "Metodo di pagamento" },
  { chiave: "fatturazione_richiesta_documento", etichetta: "Richiede documento fiscale", tipo: "checkbox" },
];

const CAMPI_CONSENSI: typeof CAMPI_TESTO = [
  { chiave: "consenso_dati_corretti", etichetta: "Dati corretti", tipo: "checkbox" },
  { chiave: "consenso_regolamento", etichetta: "Regolamento", tipo: "checkbox" },
  { chiave: "consenso_privacy", etichetta: "Privacy", tipo: "checkbox" },
  { chiave: "consenso_autorizzazione", etichetta: "Autorizzazione", tipo: "checkbox" },
  { chiave: "consenso_promozionale", etichetta: "Promozionale", tipo: "checkbox" },
  { chiave: "consenso_foto_video", etichetta: "Foto/video", tipo: "checkbox" },
  { chiave: "consenso_whatsapp_gruppi", etichetta: "Gruppi WhatsApp", tipo: "checkbox" },
];

const classeInputPiccolo = "w-full rounded-lg border border-court/20 px-2 py-1.5 text-sm";

function CampoModifica({
  campo,
  valore,
  onChange,
}: {
  campo: { chiave: string; etichetta: string; tipo?: "text" | "date" | "checkbox" | "textarea" };
  valore: any;
  onChange: (v: any) => void;
}) {
  if (campo.tipo === "checkbox") {
    return (
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-court-dark/60">{campo.etichetta}</span>
        <input type="checkbox" checked={!!valore} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      </label>
    );
  }
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-court-dark/60">{campo.etichetta}</span>
      {campo.tipo === "textarea" ? (
        <textarea className={classeInputPiccolo} rows={2} value={valore ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type={campo.tipo === "date" ? "date" : "text"}
          className={classeInputPiccolo}
          value={valore ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function DettaglioIscrizione({
  i,
  onCambiato,
  onStampata,
}: {
  i: Iscrizione;
  onCambiato: () => void;
  onStampata: () => void;
}) {
  const r = i as any;
  const [modificaAttiva, setModificaAttiva] = useState(false);
  const [bozza, setBozza] = useState<Record<string, any>>({});
  const [azioneInCorso, setAzioneInCorso] = useState(false);
  const [rate, setRate] = useState<Awaited<ReturnType<typeof ottieniRatePagamento>>>([]);
  const [caricamentoRate, setCaricamentoRate] = useState(true);

  useEffect(() => {
    let attivo = true;
    setCaricamentoRate(true);
    ottieniRatePagamento(r.id).then((risultato) => {
      if (attivo) {
        setRate(risultato);
        setCaricamentoRate(false);
      }
    });
    return () => {
      attivo = false;
    };
  }, [r.id]);

  async function toggleRataPagata(rataId: string, pagataAttuale: boolean) {
    setRate((prev) =>
      prev.map((riga) =>
        riga.id === rataId
          ? { ...riga, pagata: !pagataAttuale, data_pagamento: !pagataAttuale ? new Date().toISOString().split("T")[0] : null }
          : riga
      )
    );
    await segnaRataPagamento(rataId, !pagataAttuale);
  }

  async function modificaCampoRata(rataId: string, campo: string, valore: any) {
    setRate((prev) => prev.map((riga) => (riga.id === rataId ? { ...riga, [campo]: valore } : riga)));
    await aggiornaRata(rataId, { [campo]: valore || null });
  }

  async function nuovaRata() {
    await aggiungiRata(r.id, { tipo: "Nuova rata", importo: 0, scadenza: null });
    const aggiornate = await ottieniRatePagamento(r.id);
    setRate(aggiornate);
  }

  async function rimuoviRata(rataId: string) {
    if (!confirm("Eliminare questa rata?")) return;
    setRate((prev) => prev.filter((riga) => riga.id !== rataId));
    await eliminaRata(rataId);
  }

  function iniziaModifica() {
    const iniziale: Record<string, any> = {};
    for (const campo of [...CAMPI_TESTO, ...CAMPI_GENITORE, ...CAMPI_CORSO, ...CAMPI_FATTURAZIONE, ...CAMPI_CONSENSI]) {
      iniziale[campo.chiave] = r[campo.chiave];
    }
    setBozza(iniziale);
    setModificaAttiva(true);
  }

  async function salvaModifiche() {
    setAzioneInCorso(true);
    await aggiornaIscrizione(r.id, bozza);
    setAzioneInCorso(false);
    setModificaAttiva(false);
    onCambiato();
  }

  async function toggleConferma() {
    setAzioneInCorso(true);
    await confermaIscrizione(r.id, !r.confermata);
    setAzioneInCorso(false);
    onCambiato();
  }

  async function elimina() {
    if (!confirm(`Eliminare definitivamente l'iscrizione ${r.codice}? L'operazione non è reversibile.`)) return;
    setAzioneInCorso(true);
    await eliminaIscrizione(r.id);
    setAzioneInCorso(false);
    onCambiato();
  }

  function stampa() {
    window.open(`/admin/stampa/${r.id}`, "_blank");
    onStampata();
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-court/10 pb-4">
        <button
          onClick={toggleConferma}
          disabled={azioneInCorso}
          className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${
            r.confermata ? "border border-court/20 text-court-dark hover:bg-white" : "bg-court text-white hover:bg-court-dark"
          }`}
        >
          {r.confermata ? "Annulla conferma" : "Conferma iscrizione"}
        </button>

        <button
          onClick={stampa}
          className="rounded-full border border-court/20 px-4 py-1.5 text-sm font-medium text-court-dark hover:bg-white"
        >
          {r.stampata ? "🖨️ Ristampa" : "🖨️ Stampa scheda"}
        </button>

        {!modificaAttiva ? (
          <button
            onClick={iniziaModifica}
            className="rounded-full border border-court/20 px-4 py-1.5 text-sm font-medium text-court-dark hover:bg-white"
          >
            Modifica
          </button>
        ) : (
          <>
            <button
              onClick={salvaModifiche}
              disabled={azioneInCorso}
              className="rounded-full bg-court px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {azioneInCorso ? "Salvo…" : "Salva modifiche"}
            </button>
            <button
              onClick={() => setModificaAttiva(false)}
              className="rounded-full border border-court/20 px-4 py-1.5 text-sm font-medium text-court-dark hover:bg-white"
            >
              Annulla
            </button>
          </>
        )}

        <button
          onClick={elimina}
          disabled={azioneInCorso}
          className="ml-auto rounded-full border border-red-200 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Elimina
        </button>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl ring-1 ring-court/10">
        <div className="flex items-center justify-between bg-navy px-4 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Pagamenti
          </h4>
          <button
            onClick={nuovaRata}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
          >
            + Aggiungi rata
          </button>
        </div>

        <div className="bg-white p-4">
          {caricamentoRate ? (
            <p className="text-sm text-court-dark/40">Caricamento…</p>
          ) : rate.length === 0 ? (
            <p className="text-sm text-court-dark/40">
              Nessuna rata generata per questa iscrizione. Usa "+ Aggiungi rata" per crearne una.
            </p>
          ) : (
            <>
              {(() => {
                const totale = rate.reduce((t, x: any) => t + Number(x.importo), 0);
                const pagato = rate.filter((x: any) => x.pagata).reduce((t, x: any) => t + Number(x.importo), 0);
                const percentuale = totale > 0 ? Math.round((pagato / totale) * 100) : 0;
                return (
                  <div className="mb-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="font-display text-2xl font-bold text-court-dark">
                          {formattaEuro(pagato)}{" "}
                          <span className="text-sm font-normal text-court-dark/40">
                            di {formattaEuro(totale)}
                          </span>
                        </p>
                        <p className="text-xs text-court-dark/50">
                          {rate.filter((x: any) => x.pagata).length} di {rate.length} rate incassate
                        </p>
                      </div>
                      <span
                        className={`font-display text-xl font-bold ${
                          percentuale >= 100 ? "text-emerald-600" : "text-court"
                        }`}
                      >
                        {percentuale}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-court/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percentuale >= 100 ? "bg-emerald-500" : "bg-court"
                        }`}
                        style={{ width: `${Math.min(100, percentuale)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                {rate.map((riga: any) => (
                  <div
                    key={riga.id}
                    className={`rounded-xl px-3 py-2.5 transition-colors ${
                      riga.pagata ? "bg-emerald-50" : "bg-chalk"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={riga.pagata}
                        onChange={() => toggleRataPagata(riga.id, riga.pagata)}
                        className="h-4 w-4 shrink-0"
                      />
                      <input
                        className="min-w-[9rem] flex-1 border-b border-transparent bg-transparent text-sm font-medium text-court-dark hover:border-court/20 focus:border-court/40 focus:outline-none"
                        defaultValue={riga.tipo}
                        onBlur={(e) => e.target.value !== riga.tipo && modificaCampoRata(riga.id, "tipo", e.target.value)}
                      />
                      <span className="text-xs text-court-dark/40">€</span>
                      <input
                        type="number"
                        className="w-20 border-b border-transparent bg-transparent text-right text-sm font-medium text-court-dark hover:border-court/20 focus:border-court/40 focus:outline-none"
                        defaultValue={riga.importo}
                        onBlur={(e) =>
                          Number(e.target.value) !== Number(riga.importo) &&
                          modificaCampoRata(riga.id, "importo", Number(e.target.value))
                        }
                      />
                      <button
                        onClick={() => rimuoviRata(riga.id)}
                        className="ml-auto shrink-0 text-court-dark/30 hover:text-red-500"
                        title="Elimina rata"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-6 text-xs text-court-dark/50">
                      <label className="flex items-center gap-1">
                        Scadenza
                        <input
                          type="date"
                          className="rounded border border-court/15 bg-white px-1.5 py-0.5 text-court-dark"
                          defaultValue={riga.scadenza ?? ""}
                          onBlur={(e) =>
                            e.target.value !== (riga.scadenza ?? "") &&
                            modificaCampoRata(riga.id, "scadenza", e.target.value)
                          }
                        />
                      </label>
                      {riga.pagata && (
                        <>
                          <label className="flex items-center gap-1">
                            Pagata il
                            <input
                              type="date"
                              className="rounded border border-court/15 bg-white px-1.5 py-0.5 text-court-dark"
                              defaultValue={riga.data_pagamento ?? ""}
                              onBlur={(e) =>
                                e.target.value !== (riga.data_pagamento ?? "") &&
                                modificaCampoRata(riga.id, "data_pagamento", e.target.value)
                              }
                            />
                          </label>
                          <label className="flex items-center gap-1">
                            Metodo
                            <select
                              className="rounded border border-court/15 bg-white px-1.5 py-0.5 text-court-dark"
                              defaultValue={riga.metodo_pagamento ?? ""}
                              onChange={(e) => modificaCampoRata(riga.id, "metodo_pagamento", e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="Contanti">Contanti</option>
                              <option value="Carta">Carta</option>
                              <option value="Bonifico">Bonifico</option>
                              <option value="PayPal">PayPal</option>
                              <option value="Altro">Altro</option>
                            </select>
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Sezione titolo="Allievo">
          {modificaAttiva
            ? CAMPI_TESTO.map((c) => (
                <CampoModifica key={c.chiave} campo={c} valore={bozza[c.chiave]} onChange={(v) => setBozza((b) => ({ ...b, [c.chiave]: v }))} />
              ))
            : (
              <>
                <Riga etichetta="Nome" valore={`${r.atleta_nome} ${r.atleta_cognome}`} />
                <Riga etichetta="Codice fiscale" valore={r.atleta_codice_fiscale} />
                <Riga etichetta="Data di nascita" valore={formattaData(r.atleta_data_nascita)} />
                <Riga etichetta="Luogo di nascita" valore={r.atleta_luogo_nascita} />
                <Riga etichetta="Sesso" valore={r.atleta_sesso} />
                <Riga etichetta="Cittadinanza" valore={r.atleta_cittadinanza} />
                <Riga
                  etichetta="Residenza"
                  valore={[r.atleta_indirizzo, r.atleta_comune, r.atleta_provincia, r.atleta_cap].filter(Boolean).join(", ")}
                />
                <Riga etichetta="Telefono" valore={r.atleta_telefono} />
                <Riga etichetta="Email" valore={r.atleta_email} />
                <Riga etichetta="Preferenze giorni" valore={r.preferenze_giorni} />
                <Riga etichetta="Preferenze orari" valore={r.preferenze_orari} />
                <Riga etichetta="Esigenze" valore={r.note_esigenze} />
              </>
            )}
        </Sezione>

        {r.minorenne && (
          <Sezione titolo="Genitore/tutore">
            {modificaAttiva
              ? CAMPI_GENITORE.map((c) => (
                  <CampoModifica key={c.chiave} campo={c} valore={bozza[c.chiave]} onChange={(v) => setBozza((b) => ({ ...b, [c.chiave]: v }))} />
                ))
              : (
                <>
                  <Riga etichetta="Nome" valore={`${r.genitore_nome ?? ""} ${r.genitore_cognome ?? ""}`} />
                  <Riga etichetta="Rapporto" valore={r.genitore_rapporto} />
                  <Riga etichetta="Codice fiscale" valore={r.genitore_codice_fiscale} />
                  <Riga etichetta="Data di nascita" valore={formattaData(r.genitore_data_nascita)} />
                  <Riga etichetta="Luogo di nascita" valore={r.genitore_luogo_nascita} />
                  <Riga
                    etichetta="Residenza"
                    valore={[r.genitore_indirizzo, r.genitore_comune, r.genitore_provincia, r.genitore_cap].filter(Boolean).join(", ")}
                  />
                  <Riga etichetta="Telefono" valore={r.genitore_telefono} />
                  <Riga etichetta="WhatsApp" valore={r.genitore_whatsapp} />
                  <Riga etichetta="Email" valore={r.genitore_email} />
                  <Riga etichetta="Secondo referente" valore={r.secondo_recapito_nome} />
                  <Riga etichetta="Tel. secondo referente" valore={r.secondo_recapito_telefono} />
                  <Riga etichetta="Contatto emergenza" valore={r.emergenza_nome} />
                  <Riga etichetta="Tel. emergenza" valore={r.emergenza_telefono} />
                  <Riga etichetta="Autorizzati al ritiro" valore={r.persone_autorizzate_ritiro} />
                </>
              )}
          </Sezione>
        )}

        <Sezione titolo="Corso e prezzo">
          {modificaAttiva
            ? CAMPI_CORSO.map((c) => (
                <CampoModifica key={c.chiave} campo={c} valore={bozza[c.chiave]} onChange={(v) => setBozza((b) => ({ ...b, [c.chiave]: v }))} />
              ))
            : (
              <>
                <Riga etichetta="Corso" valore={r.corsi?.nome} />
                <Riga etichetta="Frequenza settimanale" valore={`${r.frequenza_settimanale}x/sett.`} />
                <Riga etichetta="Numero rate" valore={r.numero_rate} />
                <Riga etichetta="Importo per rata" valore={formattaEuro(r.importo_rata)} />
                <Riga etichetta="Quota iscrizione" valore={formattaEuro(r.quota_iscrizione)} />
                <Riga etichetta="Prezzo totale" valore={formattaEuro(r.prezzo_totale)} />
                <Riga etichetta="Taglia kit" valore={r.taglia_kit} />
              </>
            )}
        </Sezione>

        <Sezione titolo="Fatturazione">
          {modificaAttiva
            ? CAMPI_FATTURAZIONE.map((c) => (
                <CampoModifica key={c.chiave} campo={c} valore={bozza[c.chiave]} onChange={(v) => setBozza((b) => ({ ...b, [c.chiave]: v }))} />
              ))
            : (
              <>
                <Riga etichetta="Uguale al genitore/allievo" valore={r.fatturazione_uguale_genitore} />
                {!r.fatturazione_uguale_genitore && (
                  <>
                    <Riga etichetta="Intestatario" valore={r.fatturazione_intestatario} />
                    <Riga etichetta="Codice fiscale" valore={r.fatturazione_codice_fiscale} />
                    <Riga etichetta="Partita IVA" valore={r.fatturazione_partita_iva} />
                    <Riga
                      etichetta="Indirizzo"
                      valore={[r.fatturazione_indirizzo, r.fatturazione_comune, r.fatturazione_provincia, r.fatturazione_cap].filter(Boolean).join(", ")}
                    />
                    <Riga etichetta="Email" valore={r.fatturazione_email} />
                    <Riga etichetta="PEC" valore={r.fatturazione_pec} />
                    <Riga etichetta="Codice SDI" valore={r.fatturazione_sdi} />
                    <Riga etichetta="Soggetto pagante" valore={r.fatturazione_soggetto_pagante} />
                  </>
                )}
                <Riga etichetta="Metodo di pagamento" valore={r.fatturazione_metodo_pagamento} />
                <Riga etichetta="Richiede documento fiscale" valore={r.fatturazione_richiesta_documento} />
              </>
            )}
        </Sezione>

        <Sezione titolo="Consensi">
          {modificaAttiva
            ? CAMPI_CONSENSI.map((c) => (
                <CampoModifica key={c.chiave} campo={c} valore={bozza[c.chiave]} onChange={(v) => setBozza((b) => ({ ...b, [c.chiave]: v }))} />
              ))
            : (
              <>
                <Riga etichetta="Dati corretti" valore={r.consenso_dati_corretti} />
                <Riga etichetta="Regolamento" valore={r.consenso_regolamento} />
                <Riga etichetta="Privacy" valore={r.consenso_privacy} />
                <Riga etichetta="Autorizzazione" valore={r.consenso_autorizzazione} />
                <Riga etichetta="Promozionale" valore={r.consenso_promozionale} />
                <Riga etichetta="Foto/video" valore={r.consenso_foto_video} />
                <Riga etichetta="Gruppi WhatsApp" valore={r.consenso_whatsapp_gruppi} />
                <Riga etichetta="Versione informativa" valore={r.versione_informativa} />
              </>
            )}
        </Sezione>

        <Sezione titolo="Dati tecnici">
          <Riga etichetta="Inviata il" valore={formattaOra(r.created_at)} />
          <Riga etichetta="Confermata" valore={r.confermata} />
          <Riga etichetta="Confermata il" valore={formattaOra(r.confermata_il)} />
          <Riga etichetta="Stampata" valore={r.stampata} />
          <Riga etichetta="Stampata il" valore={formattaOra(r.stampata_il)} />
          <Riga etichetta="Indirizzo IP" valore={r.ip_address} />
          <Riga etichetta="Dispositivo/browser" valore={r.user_agent} />
        </Sezione>
      </div>
    </div>
  );
}
