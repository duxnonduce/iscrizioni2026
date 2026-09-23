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

function iniziali(nome: string, cognome: string): string {
  return `${(nome || "?")[0] ?? ""}${(cognome || "")[0] ?? ""}`.toUpperCase();
}

const ORDINE_TAGLIE = ["5/6", "7/8", "9/10", "11/12", "13/14", "15/16", "XXS", "XS", "S", "M", "L", "XL", "XXL"];

const GIORNI_PREAVVISO = 15;

type Livello = "verde" | "giallo" | "rosso";
type Stato = { livello: Livello; testo: string };

function oggiISO(): string {
  return new Date().toISOString().split("T")[0];
}

function traGiorniISO(giorni: number): string {
  return new Date(Date.now() + giorni * 86400000).toISOString().split("T")[0];
}

function statoCertificato(r: any): Stato {
  if (!r.certificato_scadenza) return { livello: "rosso", testo: "Cert. mancante" };
  if (r.certificato_scadenza < oggiISO()) return { livello: "rosso", testo: "Cert. scaduto" };
  if (r.certificato_scadenza <= traGiorniISO(GIORNI_PREAVVISO)) return { livello: "giallo", testo: "Cert. in scadenza" };
  return { livello: "verde", testo: "Cert. OK" };
}

function statoTesseramento(r: any): Stato {
  if (!r.tesseramento_numero) return { livello: "rosso", testo: "Tess. mancante" };
  if (r.tesseramento_scadenza) {
    if (r.tesseramento_scadenza < oggiISO()) return { livello: "rosso", testo: "Tess. scaduta" };
    if (r.tesseramento_scadenza <= traGiorniISO(GIORNI_PREAVVISO)) return { livello: "giallo", testo: "Tess. in scadenza" };
  }
  return { livello: "verde", testo: "Tess. OK" };
}

function testoDocumentoFiscale(r: any): string {
  const parti: string[] = [];
  if (r.ricevuta_numero) {
    parti.push(`ricevuta non fiscale n.${r.ricevuta_numero}${r.ricevuta_blocco ? ` (blocco ${r.ricevuta_blocco})` : ""}`);
  }
  parti.push(
    r.fattura_numero
      ? `fattura n.${r.fattura_numero}${r.fattura_data ? ` emessa il ${formattaData(r.fattura_data)}` : ""}`
      : "fattura fiscale ancora non emessa"
  );
  return parti.length ? parti.join(" — ") : "Nessun documento associato";
}

function Pallino({ stato }: { stato: Stato }) {
  const stili: Record<Livello, string> = {
    verde: "bg-emerald-50 text-emerald-700",
    giallo: "bg-amber-50 text-amber-700",
    rosso: "bg-red-50 text-red-700",
  };
  const punto: Record<Livello, string> = {
    verde: "bg-emerald-500",
    giallo: "bg-amber-500",
    rosso: "bg-red-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${stili[stato.livello]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${punto[stato.livello]}`} />
      {stato.testo}
    </span>
  );
}

const VISTE = [
  { id: "panoramica", etichetta: "Panoramica", icona: "🏠" },
  { id: "iscrizioni", etichetta: "Iscrizioni", icona: "📋" },
  { id: "certificati", etichetta: "Certificati", icona: "🩺" },
  { id: "tesseramenti", etichetta: "Tesseramenti", icona: "🎟️" },
  { id: "pagamenti", etichetta: "Incassi", icona: "💳" },
  { id: "fiscale", etichetta: "Fiscale", icona: "📑" },
  { id: "listino", etichetta: "Listino", icona: "🎾" },
] as const;

type Vista = (typeof VISTE)[number]["id"];

function BarraPagamento({
  riepilogo,
}: {
  riepilogo?: { totale: number; pagato: number; scaduto: boolean; numeroRate: number; numeroPagate: number };
}) {
  if (!riepilogo || riepilogo.numeroRate === 0) {
    return <span className="text-xs text-neutral-300">—</span>;
  }
  const percentuale = riepilogo.totale > 0 ? Math.round((riepilogo.pagato / riepilogo.totale) * 100) : 0;
  const completo = percentuale >= 100;
  const coloreBarra = riepilogo.scaduto ? "bg-red-400" : completo ? "bg-emerald-400" : "bg-amber-400";

  return (
    <div className="w-28">
      <div className="flex items-center justify-between text-xs">
        <span
          className={`font-semibold ${
            riepilogo.scaduto ? "text-red-600" : completo ? "text-emerald-600" : "text-neutral-500"
          }`}
        >
          {riepilogo.scaduto ? "Scaduto" : `${percentuale}%`}
        </span>
        <span className="text-neutral-400">
          {riepilogo.numeroPagate}/{riepilogo.numeroRate}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
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
      ? "bg-emerald-50"
      : tono === "ambra"
        ? "bg-amber-50"
        : tono === "rosso"
          ? "bg-red-50"
          : "bg-neutral-100";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${sfondoIcona}`}>
        {icona}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-neutral-400">{etichetta}</p>
        <p className="truncate text-lg font-semibold tracking-tight text-neutral-900">{valore}</p>
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

  const conCertificatoDaSistemare = iscrizioni.filter((i) => statoCertificato(i).livello === "rosso").length;
  const conCertificatoInScadenza = iscrizioni.filter((i) => statoCertificato(i).livello === "giallo").length;
  const conTesseramentoDaSistemare = iscrizioni.filter((i) => statoTesseramento(i).livello === "rosso").length;
  const conTesseramentoInScadenza = iscrizioni.filter((i) => statoTesseramento(i).livello === "giallo").length;

  const punteggioLivello: Record<Livello, number> = { rosso: 0, giallo: 1, verde: 2 };

  const pagatoENonTesserati = iscrizioni.filter(
    (i: any) => (mappaPagamenti[i.id]?.pagato ?? 0) > 0 && !i.tesseramento_numero
  );
  const urgentiTesseramento = pagatoENonTesserati
    .filter((i: any) => statoCertificato(i).livello === "verde")
    .sort((a: any, b: any) => (mappaPagamenti[b.id]?.pagato ?? 0) - (mappaPagamenti[a.id]?.pagato ?? 0));
  const inAttesaCertificato = pagatoENonTesserati
    .filter((i: any) => statoCertificato(i).livello !== "verde")
    .sort((a: any, b: any) => (mappaPagamenti[b.id]?.pagato ?? 0) - (mappaPagamenti[a.id]?.pagato ?? 0));
  const iscrizioniOrdinatePerAllerta = [...iscrizioni].sort((a, b) => {
    const pa = Math.min(punteggioLivello[statoCertificato(a).livello], punteggioLivello[statoTesseramento(a).livello]);
    const pb = Math.min(punteggioLivello[statoCertificato(b).livello], punteggioLivello[statoTesseramento(b).livello]);
    return pa - pb;
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <img src="/logo-micolani.png" alt="Micolani Tennis" className="h-8 w-auto shrink-0 rounded-md" />

          <nav className="flex items-center gap-0.5 overflow-x-auto rounded-full bg-neutral-100 p-1">
            {VISTE.map((v) => (
              <button
                key={v.id}
                onClick={() => setVista(v.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                  vista === v.id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <span>{v.icona}</span>
                <span className="hidden sm:inline">{v.etichetta}</span>
              </button>
            ))}
          </nav>

          <button
            onClick={esci}
            className="shrink-0 rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Esci
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {vista === "panoramica" && (
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">
              Ciao! Ecco la situazione di oggi
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
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

            <button
              onClick={() => setVista("certificati")}
              className="mt-4 block w-full rounded-2xl border border-black/[0.06] bg-white p-4 text-left hover:border-black/[0.1]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">🩺 Certificati e tesseramenti</p>
                <span className="text-sm text-neutral-400">Vedi tutto →</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Pallino stato={{ livello: "rosso", testo: `${conCertificatoDaSistemare} certificati da sistemare` }} />
                <Pallino stato={{ livello: "giallo", testo: `${conCertificatoInScadenza} in scadenza` }} />
                <Pallino stato={{ livello: "rosso", testo: `${conTesseramentoDaSistemare} tessere da sistemare` }} />
                <Pallino stato={{ livello: "giallo", testo: `${conTesseramentoInScadenza} in scadenza` }} />
              </div>
            </button>

            <div className="mt-4 rounded-2xl border border-black/[0.06] bg-white p-5">
              <h2 className="text-base font-semibold text-neutral-900">Ultime iscrizioni</h2>
              <div className="mt-3 divide-y divide-black/[0.05]">
                {iscrizioni.slice(0, 5).map((i) => (
                  <button
                    key={i.id}
                    onClick={() => {
                      setVista("iscrizioni");
                      setEspansa(i.id);
                    }}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-neutral-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-court to-court-light text-xs font-semibold text-white">
                      {iniziali(i.atleta_nome, i.atleta_cognome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {i.atleta_nome} {i.atleta_cognome}
                      </p>
                      <p className="truncate text-xs text-neutral-400">{(i as any).corsi?.nome}</p>
                    </span>
                    {(i as any).confermata ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Confermata
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        Da confermare
                      </span>
                    )}
                  </button>
                ))}
                {iscrizioni.length === 0 && (
                  <p className="py-4 text-sm text-neutral-400">Nessuna iscrizione ricevuta ancora.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {vista === "iscrizioni" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">Iscrizioni</h1>
                <p className="text-sm text-neutral-400">Clicca su una riga per il dettaglio</p>
              </div>
              <form onSubmit={cerca} className="flex gap-2">
                <input
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  placeholder="Cerca per codice, nome, telefono…"
                  className="w-56 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-sm focus:border-neutral-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  Cerca
                </button>
              </form>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-black/[0.06] bg-white p-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-neutral-400">
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
                <tbody className="divide-y divide-black/[0.05]">
                  {caricamento && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-neutral-400">
                        Caricamento…
                      </td>
                    </tr>
                  )}
                  {!caricamento && iscrizioni.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-neutral-400">
                        Nessuna anagrafica trovata.
                      </td>
                    </tr>
                  )}
                  {iscrizioni.map((i) => (
                    <>
                      <tr
                        key={i.id}
                        onClick={() => setEspansa(espansa === i.id ? null : i.id)}
                        className="cursor-pointer transition-colors hover:bg-neutral-50"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-court to-court-light text-xs font-semibold text-white">
                              {iniziali(i.atleta_nome, i.atleta_cognome)}
                            </span>
                            <div>
                              <p className="font-medium text-neutral-900">
                                {i.atleta_nome} {i.atleta_cognome}
                              </p>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {i.minorenne && <span className="text-xs text-neutral-400">minorenne</span>}
                                <Pallino stato={statoCertificato(i)} />
                                <Pallino stato={statoTesseramento(i)} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-neutral-900">{i.codice}</td>
                        <td className="px-3 py-3 text-neutral-500">
                          {i.minorenne ? i.genitore_telefono : i.atleta_telefono}
                        </td>
                        <td className="px-3 py-3 text-neutral-500">
                          {(i as any).corsi?.nome ?? "-"}
                          <span className="text-neutral-300"> · {i.frequenza_settimanale}x/sett.</span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-neutral-900">{formattaEuro(i.prezzo_totale)}</p>
                          {i.numero_rate > 1 && (
                            <p className="text-xs text-neutral-400">
                              {i.numero_rate}×{formattaEuro(i.importo_rata)} + quota
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <BarraPagamento riepilogo={mappaPagamenti[i.id]} />
                        </td>
                        <td className="px-3 py-3">
                          {(i as any).confermata ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Confermata
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
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
                            <span className="text-xs text-neutral-300">—</span>
                          )}
                        </td>
                      </tr>
                      {espansa === i.id && (
                        <tr>
                          <td colSpan={8} className="rounded-2xl bg-neutral-50 px-4 py-5">
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

        {vista === "certificati" && (
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">Certificati medici</h1>
            <p className="text-sm text-neutral-400">
              Le righe più urgenti sono in cima. Clicca su un nominativo per aprire la scheda.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard etichetta="Da sistemare" valore={conCertificatoDaSistemare} icona="🩺" tono="rosso" />
              <StatCard etichetta="In scadenza" valore={conCertificatoInScadenza} icona="⏳" tono="ambra" />
              <StatCard
                etichetta="In regola"
                valore={iscrizioni.filter((i) => statoCertificato(i).livello === "verde").length}
                icona="✅"
                tono="verde"
              />
              <StatCard etichetta="Totale" valore={iscrizioni.length} icona="📋" />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-neutral-400">
                    <th className="px-4 pb-3 pt-4 font-medium">Atleta</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Stato</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Tipo</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Scadenza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {[...iscrizioni]
                    .sort((a, b) => punteggioLivello[statoCertificato(a).livello] - punteggioLivello[statoCertificato(b).livello])
                    .map((i: any) => {
                      const stato = statoCertificato(i);
                      const barra = stato.livello === "rosso" ? "border-l-red-400" : stato.livello === "giallo" ? "border-l-amber-400" : "border-l-emerald-400";
                      return (
                        <tr
                          key={i.id}
                          onClick={() => {
                            setVista("iscrizioni");
                            setEspansa(i.id);
                          }}
                          className={`cursor-pointer border-l-4 ${barra} hover:bg-neutral-50`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-court to-court-light text-xs font-semibold text-white">
                                {iniziali(i.atleta_nome, i.atleta_cognome)}
                              </span>
                              <p className="font-medium text-neutral-900">
                                {i.atleta_nome} {i.atleta_cognome}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Pallino stato={stato} />
                          </td>
                          <td className="px-4 py-3 text-neutral-500">
                            {i.certificato_tipo === "agonistico" ? "Agonistico" : i.certificato_tipo === "non_agonistico" ? "Non agonistico" : "—"}
                          </td>
                          <td className="px-4 py-3 text-neutral-500">{formattaData(i.certificato_scadenza)}</td>
                        </tr>
                      );
                    })}
                  {iscrizioni.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-neutral-400">
                        Nessuna iscrizione ricevuta ancora.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vista === "tesseramenti" && (
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">Tesseramenti FITP</h1>
            <p className="text-sm text-neutral-400">
              Le righe più urgenti sono in cima. Clicca su un nominativo per aprire la scheda.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard etichetta="Da sistemare" valore={conTesseramentoDaSistemare} icona="🎟️" tono="rosso" />
              <StatCard etichetta="In scadenza" valore={conTesseramentoInScadenza} icona="⏳" tono="ambra" />
              <StatCard
                etichetta="In regola"
                valore={iscrizioni.filter((i) => statoTesseramento(i).livello === "verde").length}
                icona="✅"
                tono="verde"
              />
              <StatCard etichetta="Totale" valore={iscrizioni.length} icona="📋" />
            </div>

            {urgentiTesseramento.length > 0 && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-red-200 bg-red-50">
                <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                  <span className="text-lg">🚨</span>
                  <h2 className="text-sm font-semibold text-red-800">
                    Pronti per il tesseramento — hanno pagato e hanno il certificato medico valido
                  </h2>
                </div>
                <div className="divide-y divide-red-100">
                  {urgentiTesseramento.map((i: any) => (
                    <button
                      key={i.id}
                      onClick={() => {
                        setVista("iscrizioni");
                        setEspansa(i.id);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-red-100/60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-court to-court-light text-xs font-semibold text-white">
                        {iniziali(i.atleta_nome, i.atleta_cognome)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {i.atleta_nome} {i.atleta_cognome}
                        </p>
                        <p className="text-xs text-neutral-500">{i.corsi?.nome}</p>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-red-700">
                        {formattaEuro(mappaPagamenti[i.id]?.pagato ?? 0)} pagati
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {inAttesaCertificato.length > 0 && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
                <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                  <span className="text-lg">🩺</span>
                  <h2 className="text-sm font-semibold text-amber-800">
                    In attesa del certificato — hanno pagato ma non si possono ancora tesserare
                  </h2>
                </div>
                <div className="divide-y divide-amber-100">
                  {inAttesaCertificato.map((i: any) => (
                    <button
                      key={i.id}
                      onClick={() => {
                        setVista("iscrizioni");
                        setEspansa(i.id);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-amber-100/60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-court to-court-light text-xs font-semibold text-white">
                        {iniziali(i.atleta_nome, i.atleta_cognome)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {i.atleta_nome} {i.atleta_cognome}
                        </p>
                        <p className="text-xs text-neutral-500">{i.corsi?.nome}</p>
                      </span>
                      <Pallino stato={statoCertificato(i)} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-neutral-400">
                    <th className="px-4 pb-3 pt-4 font-medium">Atleta</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Stato</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Numero tessera</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Società</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Tipo</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Scadenza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {[...iscrizioni]
                    .sort((a, b) => punteggioLivello[statoTesseramento(a).livello] - punteggioLivello[statoTesseramento(b).livello])
                    .map((i: any) => {
                      const stato = statoTesseramento(i);
                      const barra = stato.livello === "rosso" ? "border-l-red-400" : stato.livello === "giallo" ? "border-l-amber-400" : "border-l-emerald-400";
                      return (
                        <tr
                          key={i.id}
                          onClick={() => {
                            setVista("iscrizioni");
                            setEspansa(i.id);
                          }}
                          className={`cursor-pointer border-l-4 ${barra} hover:bg-neutral-50`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-court to-court-light text-xs font-semibold text-white">
                                {iniziali(i.atleta_nome, i.atleta_cognome)}
                              </span>
                              <p className="font-medium text-neutral-900">
                                {i.atleta_nome} {i.atleta_cognome}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Pallino stato={stato} />
                          </td>
                          <td className="px-4 py-3 text-neutral-500">{i.tesseramento_numero || "—"}</td>
                          <td className="px-4 py-3">
                            {i.tesseramento_societa ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  i.tesseramento_societa === "TP5 ASD"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {i.tesseramento_societa}
                              </span>
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-neutral-500">
                            {i.tesseramento_tipo === "agonistico" ? "Agonistico" : i.tesseramento_tipo === "non_agonistico" ? "Non agonistico" : "—"}
                          </td>
                          <td className="px-4 py-3 text-neutral-500">{formattaData(i.tesseramento_scadenza)}</td>
                        </tr>
                      );
                    })}
                  {iscrizioni.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-400">
                        Nessuna iscrizione ricevuta ancora.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {vista === "pagamenti" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">Registro incassi</h1>
                <p className="text-sm text-neutral-400">Ultimi pagamenti registrati, più recenti in alto</p>
              </div>
              <button
                onClick={generaRate}
                disabled={generandoRate}
                className="rounded-full border border-black/[0.08] px-4 py-1.5 text-xs font-medium text-neutral-500 hover:bg-white disabled:opacity-60"
              >
                {generandoRate ? "Genero…" : "Genera rate mancanti"}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <StatCard etichetta="Pagato" valore={formattaEuro(pagamenti.totalePagato)} icona="💰" tono="verde" />
              <StatCard etichetta="Dovuto" valore={formattaEuro(pagamenti.totaleDovuto)} icona="🧾" />
              <StatCard etichetta="Scaduto" valore={formattaEuro(pagamenti.totaleScaduto)} icona="⚠️" tono="rosso" />
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-black/[0.06] bg-white p-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-neutral-400">
                    <th className="px-3 pb-3 pt-3 font-medium">Data</th>
                    <th className="px-3 pb-3 pt-3 font-medium">Atleta</th>
                    <th className="px-3 pb-3 pt-3 font-medium">Codice</th>
                    <th className="px-3 pb-3 pt-3 font-medium">Causale</th>
                    <th className="px-3 pb-3 pt-3 font-medium">Metodo</th>
                    <th className="px-3 pb-3 pt-3 font-medium">Importo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {incassi.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-400">
                        Nessun incasso registrato ancora.
                      </td>
                    </tr>
                  )}
                  {incassi.map((inc: any) => (
                    <tr key={inc.id}>
                      <td className="px-3 py-2.5 text-neutral-500">{formattaData(inc.data_pagamento)}</td>
                      <td className="px-3 py-2.5 text-neutral-900">
                        <p>
                          {inc.iscrizioni?.atleta_nome} {inc.iscrizioni?.atleta_cognome}
                        </p>
                        <p className="text-xs text-neutral-400">{testoDocumentoFiscale(inc)}</p>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-neutral-900">{inc.iscrizioni?.codice}</td>
                      <td className="px-3 py-2.5 text-neutral-500">{inc.tipo}</td>
                      <td className="px-3 py-2.5 text-neutral-400">{inc.metodo_pagamento || "—"}</td>
                      <td className="px-3 py-2.5 font-medium text-emerald-600">{formattaEuro(inc.importo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vista === "fiscale" && (
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">Documenti fiscali</h1>
            <p className="text-sm text-neutral-400">
              Ricevute non fiscali e fatture associate a ogni pagamento incassato
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard etichetta="Incassi totali" valore={incassi.length} icona="💳" />
              <StatCard
                etichetta="Con ricevuta"
                valore={incassi.filter((inc: any) => inc.ricevuta_numero).length}
                icona="🧾"
                tono="verde"
              />
              <StatCard
                etichetta="Fatture emesse"
                valore={incassi.filter((inc: any) => inc.fattura_numero).length}
                icona="📄"
                tono="verde"
              />
              <StatCard
                etichetta="Fatture da emettere"
                valore={incassi.filter((inc: any) => !inc.fattura_numero).length}
                icona="⚠️"
                tono="ambra"
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-neutral-400">
                    <th className="px-4 pb-3 pt-4 font-medium">Data</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Atleta</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Importo</th>
                    <th className="px-4 pb-3 pt-4 font-medium">Documenti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {incassi.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-neutral-400">
                        Nessun incasso registrato ancora.
                      </td>
                    </tr>
                  )}
                  {incassi.map((inc: any) => (
                    <tr
                      key={inc.id}
                      onClick={() => {
                        setVista("iscrizioni");
                        setEspansa(inc.iscrizione_id);
                      }}
                      className={`cursor-pointer border-l-4 hover:bg-neutral-50 ${
                        inc.fattura_numero ? "border-l-emerald-400" : "border-l-amber-400"
                      }`}
                    >
                      <td className="px-4 py-3 text-neutral-500">{formattaData(inc.data_pagamento)}</td>
                      <td className="px-4 py-3 text-neutral-900">
                        {inc.iscrizioni?.atleta_nome} {inc.iscrizioni?.atleta_cognome}
                        <span className="ml-1 text-xs text-neutral-400">({inc.iscrizioni?.codice})</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{formattaEuro(inc.importo)}</td>
                      <td className="px-4 py-3 text-neutral-500">{testoDocumentoFiscale(inc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vista === "listino" && (
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">Listino e quota</h1>
            <p className="text-sm text-neutral-400">Prezzi dei corsi e quota d'iscrizione</p>

            <section className="mt-5 rounded-2xl border border-black/[0.06] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">Quota d'iscrizione</h2>
                  <p className="text-xs text-neutral-400">Kit abbigliamento e tessera FITP — si aggiunge a ogni corso</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-400">€</span>
                  <input
                    className="w-20 rounded-lg border border-black/[0.08] px-2 py-1.5 text-right text-sm"
                    defaultValue={quotaIscrizione}
                    onChange={(e) => setQuotaModificata(e.target.value)}
                  />
                  <button
                    onClick={salvaQuota}
                    disabled={salvataggio === "quota"}
                    className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
                  >
                    {salvataggio === "quota" ? "Salvo…" : "Salva"}
                  </button>
                </div>
              </div>

              <div className="mt-6 divide-y divide-black/[0.05] border-t border-black/[0.05] pt-5">
                {corsi.map((corso) => (
                  <div key={corso.id} className="py-4 first:pt-0">
                    <h3 className="mb-3 text-sm font-semibold text-neutral-900">{corso.nome}</h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {corso.listini.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2">
                          <span className="text-sm text-neutral-500">
                            {l.frequenza_settimanale}x/sett. — {l.numero_rate === 1 ? "unico" : `${l.numero_rate} rate`}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-neutral-400">€</span>
                            <input
                              className="w-16 rounded-md border border-black/[0.08] bg-white px-1.5 py-1 text-right text-sm"
                              defaultValue={l.importo_rata}
                              onChange={(e) => setImportiModificati((p) => ({ ...p, [l.id]: e.target.value }))}
                            />
                            <button
                              onClick={() => salvaImporto(l.id)}
                              disabled={salvataggio === l.id}
                              className="text-xs font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-600 disabled:opacity-50"
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

            <section className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-6">
              <h2 className="text-base font-semibold text-neutral-900">Riepilogo taglie kit</h2>
              <p className="text-xs text-neutral-400">Totale su tutte le iscrizioni ricevute</p>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                {ORDINE_TAGLIE.filter((t) => taglie[t]).map((t) => (
                  <div key={t} className="rounded-xl bg-neutral-50 px-3 py-2.5 text-center">
                    <p className="text-lg font-semibold text-neutral-900">{taglie[t]}</p>
                    <p className="text-xs text-neutral-400">{t}</p>
                  </div>
                ))}
                {taglie["Non indicata"] && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-center">
                    <p className="text-lg font-semibold text-amber-700">{taglie["Non indicata"]}</p>
                    <p className="text-xs text-amber-700/70">Non indicata</p>
                  </div>
                )}
                {Object.keys(taglie).length === 0 && (
                  <p className="col-span-full text-sm text-neutral-400">Nessun dato ancora.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
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
      <dt className="text-neutral-400">{etichetta}</dt>
      <dd className="text-right font-medium text-neutral-900">
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

const classeInputPiccolo = "w-full rounded-lg border border-black/[0.08] px-2 py-1.5 text-sm";

const CAMPI_CERTIFICATO: Array<{
  chiave: string;
  etichetta: string;
  tipo?: "text" | "date" | "checkbox" | "textarea" | "select";
  opzioni?: Array<{ valore: string; etichetta: string }>;
}> = [
  {
    chiave: "certificato_tipo",
    etichetta: "Tipo certificato",
    tipo: "select",
    opzioni: [
      { valore: "agonistico", etichetta: "Agonistico" },
      { valore: "non_agonistico", etichetta: "Non agonistico" },
    ],
  },
  { chiave: "certificato_scadenza", etichetta: "Scadenza certificato", tipo: "date" },
];

const CAMPI_TESSERAMENTO: typeof CAMPI_CERTIFICATO = [
  { chiave: "tesseramento_numero", etichetta: "Numero tessera" },
  {
    chiave: "tesseramento_societa",
    etichetta: "Società",
    tipo: "select",
    opzioni: [
      { valore: "KICKOFF ACADEMY SSD ARL", etichetta: "KICKOFF ACADEMY SSD ARL" },
      { valore: "TP5 ASD", etichetta: "TP5 ASD" },
    ],
  },
  {
    chiave: "tesseramento_tipo",
    etichetta: "Tipo tesseramento",
    tipo: "select",
    opzioni: [
      { valore: "agonistico", etichetta: "Agonistico" },
      { valore: "non_agonistico", etichetta: "Non agonistico" },
    ],
  },
  { chiave: "tesseramento_data", etichetta: "Data tesseramento", tipo: "date" },
  { chiave: "tesseramento_scadenza", etichetta: "Scadenza tessera", tipo: "date" },
];

function CampoModifica({
  campo,
  valore,
  onChange,
}: {
  campo: {
    chiave: string;
    etichetta: string;
    tipo?: "text" | "date" | "checkbox" | "textarea" | "select";
    opzioni?: Array<{ valore: string; etichetta: string }>;
  };
  valore: any;
  onChange: (v: any) => void;
}) {
  if (campo.tipo === "checkbox") {
    return (
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-neutral-500">{campo.etichetta}</span>
        <input type="checkbox" checked={!!valore} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      </label>
    );
  }
  if (campo.tipo === "select") {
    return (
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-500">{campo.etichetta}</span>
        <select className={classeInputPiccolo} value={valore ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {campo.opzioni?.map((o) => (
            <option key={o.valore} value={o.valore}>
              {o.etichetta}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-500">{campo.etichetta}</span>
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
    for (const campo of [...CAMPI_TESTO, ...CAMPI_GENITORE, ...CAMPI_CORSO, ...CAMPI_FATTURAZIONE, ...CAMPI_CONSENSI, ...CAMPI_CERTIFICATO, ...CAMPI_TESSERAMENTO]) {
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
      <div className="mb-3 flex flex-wrap gap-2">
        <Pallino stato={statoCertificato(r)} />
        <Pallino stato={statoTesseramento(r)} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-black/[0.06] pb-4">
        <button
          onClick={toggleConferma}
          disabled={azioneInCorso}
          className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${
            r.confermata ? "border border-black/[0.08] text-neutral-900 hover:bg-neutral-50" : "bg-neutral-900 text-white hover:bg-neutral-900"
          }`}
        >
          {r.confermata ? "Annulla conferma" : "Conferma iscrizione"}
        </button>

        <button
          onClick={stampa}
          className="rounded-full border border-black/[0.08] px-4 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          {r.stampata ? "🖨️ Ristampa" : "🖨️ Stampa scheda"}
        </button>

        {!modificaAttiva ? (
          <button
            onClick={iniziaModifica}
            className="rounded-full border border-black/[0.08] px-4 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Modifica
          </button>
        ) : (
          <>
            <button
              onClick={salvaModifiche}
              disabled={azioneInCorso}
              className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {azioneInCorso ? "Salvo…" : "Salva modifiche"}
            </button>
            <button
              onClick={() => setModificaAttiva(false)}
              className="rounded-full border border-black/[0.08] px-4 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Certificato medico</h4>
            <Pallino stato={statoCertificato(r)} />
          </div>
          {modificaAttiva ? (
            <div className="space-y-3">
              {CAMPI_CERTIFICATO.map((c) => (
                <CampoModifica key={c.chiave} campo={c} valore={bozza[c.chiave]} onChange={(v) => setBozza((b) => ({ ...b, [c.chiave]: v }))} />
              ))}
            </div>
          ) : (
            <dl className="space-y-1 text-sm">
              <Riga
                etichetta="Tipo"
                valore={r.certificato_tipo === "agonistico" ? "Agonistico" : r.certificato_tipo === "non_agonistico" ? "Non agonistico" : null}
              />
              <Riga etichetta="Scadenza" valore={formattaData(r.certificato_scadenza)} />
            </dl>
          )}
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tesseramento FITP</h4>
            <Pallino stato={statoTesseramento(r)} />
          </div>
          {modificaAttiva ? (
            <div className="space-y-3">
              {CAMPI_TESSERAMENTO.map((c) => (
                <CampoModifica key={c.chiave} campo={c} valore={bozza[c.chiave]} onChange={(v) => setBozza((b) => ({ ...b, [c.chiave]: v }))} />
              ))}
            </div>
          ) : (
            <dl className="space-y-1 text-sm">
              <Riga etichetta="Numero tessera" valore={r.tesseramento_numero} />
              <Riga etichetta="Società" valore={r.tesseramento_societa} />
              <Riga
                etichetta="Tipo"
                valore={r.tesseramento_tipo === "agonistico" ? "Agonistico" : r.tesseramento_tipo === "non_agonistico" ? "Non agonistico" : null}
              />
              <Riga etichetta="Data tesseramento" valore={formattaData(r.tesseramento_data)} />
              <Riga etichetta="Scadenza tessera" valore={formattaData(r.tesseramento_scadenza)} />
            </dl>
          )}
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-black/[0.06]">
        <div className="flex items-center justify-between bg-navy px-4 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Pagamenti
          </h4>
          <button
            onClick={nuovaRata}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-50/20"
          >
            + Aggiungi rata
          </button>
        </div>

        <div className="bg-white p-4">
          {caricamentoRate ? (
            <p className="text-sm text-neutral-400">Caricamento…</p>
          ) : rate.length === 0 ? (
            <p className="text-sm text-neutral-400">
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
                        <p className="font-display text-2xl font-bold text-neutral-900">
                          {formattaEuro(pagato)}{" "}
                          <span className="text-sm font-normal text-neutral-400">
                            di {formattaEuro(totale)}
                          </span>
                        </p>
                        <p className="text-xs text-neutral-400">
                          {rate.filter((x: any) => x.pagata).length} di {rate.length} rate incassate
                        </p>
                      </div>
                      <span
                        className={`font-display text-xl font-bold ${
                          percentuale >= 100 ? "text-emerald-600" : "text-neutral-900"
                        }`}
                      >
                        {percentuale}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-900/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percentuale >= 100 ? "bg-emerald-500" : "bg-neutral-900"
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
                      riga.pagata ? "bg-emerald-50" : "bg-neutral-50"
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
                        className="min-w-[9rem] flex-1 border-b border-transparent bg-transparent text-sm font-medium text-neutral-900 hover:border-black/[0.08] focus:border-court/40 focus:outline-none"
                        defaultValue={riga.tipo}
                        onBlur={(e) => e.target.value !== riga.tipo && modificaCampoRata(riga.id, "tipo", e.target.value)}
                      />
                      <span className="text-xs text-neutral-400">€</span>
                      <input
                        type="number"
                        className="w-20 border-b border-transparent bg-transparent text-right text-sm font-medium text-neutral-900 hover:border-black/[0.08] focus:border-court/40 focus:outline-none"
                        defaultValue={riga.importo}
                        onBlur={(e) =>
                          Number(e.target.value) !== Number(riga.importo) &&
                          modificaCampoRata(riga.id, "importo", Number(e.target.value))
                        }
                      />
                      <button
                        onClick={() => rimuoviRata(riga.id)}
                        className="ml-auto shrink-0 text-neutral-900/30 hover:text-red-500"
                        title="Elimina rata"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-6 text-xs text-neutral-400">
                      <label className="flex items-center gap-1">
                        Scadenza
                        <input
                          type="date"
                          className="rounded border border-black/[0.06] bg-white px-1.5 py-0.5 text-neutral-900"
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
                              className="rounded border border-black/[0.06] bg-white px-1.5 py-0.5 text-neutral-900"
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
                              className="rounded border border-black/[0.06] bg-white px-1.5 py-0.5 text-neutral-900"
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
                    {riga.pagata && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-6 text-xs text-neutral-400">
                        <label className="flex items-center gap-1">
                          Ricevuta n.
                          <input
                            type="text"
                            className="w-16 rounded border border-black/[0.06] bg-white px-1.5 py-0.5 text-neutral-900"
                            defaultValue={riga.ricevuta_numero ?? ""}
                            onBlur={(e) =>
                              e.target.value !== (riga.ricevuta_numero ?? "") &&
                              modificaCampoRata(riga.id, "ricevuta_numero", e.target.value)
                            }
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          Blocco
                          <input
                            type="text"
                            className="w-14 rounded border border-black/[0.06] bg-white px-1.5 py-0.5 text-neutral-900"
                            defaultValue={riga.ricevuta_blocco ?? ""}
                            onBlur={(e) =>
                              e.target.value !== (riga.ricevuta_blocco ?? "") &&
                              modificaCampoRata(riga.id, "ricevuta_blocco", e.target.value)
                            }
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          Fattura n.
                          <input
                            type="text"
                            className="w-16 rounded border border-black/[0.06] bg-white px-1.5 py-0.5 text-neutral-900"
                            defaultValue={riga.fattura_numero ?? ""}
                            onBlur={(e) =>
                              e.target.value !== (riga.fattura_numero ?? "") &&
                              modificaCampoRata(riga.id, "fattura_numero", e.target.value)
                            }
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          Emessa il
                          <input
                            type="date"
                            className="rounded border border-black/[0.06] bg-white px-1.5 py-0.5 text-neutral-900"
                            defaultValue={riga.fattura_data ?? ""}
                            onBlur={(e) =>
                              e.target.value !== (riga.fattura_data ?? "") &&
                              modificaCampoRata(riga.id, "fattura_data", e.target.value)
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <details className="group rounded-2xl border border-black/[0.06] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-neutral-500">
          <span>Altri dati — anagrafica, fatturazione, consensi, informazioni tecniche</span>
          <span className="text-neutral-300 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="grid grid-cols-1 gap-6 border-t border-black/[0.05] px-5 py-5 sm:grid-cols-2">
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
      </details>
    </div>
  );
}
