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
  elencaSocieta,
  salvaSocieta,
  elencoRicevute,
  ricevutePerIscrizione,
  emettiRicevuta,
  rigeneraPdfRicevuta,
  linkRicevuta,
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

const SG = "font-[family-name:var(--font-sg)]";

function giorniA(iso: string): number {
  const a = new Date(oggiISO()).getTime();
  const b = new Date(iso).getTime();
  return Math.round((b - a) / 86400000);
}

function quandoScade(scadenza: string | null): { testo: string; scuro: boolean } {
  if (!scadenza) return { testo: "non consegnato", scuro: true };
  const d = giorniA(scadenza);
  if (d < 0) return { testo: `scaduto da ${-d} giorni`, scuro: true };
  if (d === 0) return { testo: "scade oggi", scuro: true };
  return { testo: `tra ${d} giorni`, scuro: false };
}

function Pallino({ stato }: { stato: Stato }) {
  const stili: Record<Livello, string> = {
    verde: "bg-emerald-400/15 text-emerald-300",
    giallo: "bg-amber-300/15 text-amber-300",
    rosso: "bg-rose-400/15 text-rose-300",
  };
  const punto: Record<Livello, string> = {
    verde: "bg-emerald-400",
    giallo: "bg-amber-300",
    rosso: "bg-rose-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${stili[stato.livello]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${punto[stato.livello]}`} />
      {stato.testo}
    </span>
  );
}

function PillStato({ confermata }: { confermata: boolean }) {
  return confermata ? (
    <span className="whitespace-nowrap rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">Confermata</span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-300">Da confermare</span>
  );
}

function PillSocieta({ societa }: { societa: string | null }) {
  if (!societa) return <span className="text-[#6B77A0]">—</span>;
  const viola = societa === "TP5 ASD";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        viola ? "bg-violet-400/15 text-violet-300" : "bg-sky-400/15 text-sky-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${viola ? "bg-violet-400" : "bg-sky-400"}`} />
      {societa}
    </span>
  );
}

function Avatar({ nome, cognome, size = 38 }: { nome: string; cognome: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#26336A] font-bold text-[#DDE4FA]"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size / 3.1)) }}
    >
      {iniziali(nome, cognome)}
    </span>
  );
}

function BarraPagamento({
  riepilogo,
}: {
  riepilogo?: { totale: number; pagato: number; scaduto: boolean; numeroRate: number; numeroPagate: number };
}) {
  if (!riepilogo || riepilogo.numeroRate === 0) {
    return <span className="text-xs text-[#6B77A0]">—</span>;
  }
  const percentuale = riepilogo.totale > 0 ? Math.round((riepilogo.pagato / riepilogo.totale) * 100) : 0;
  const completo = percentuale >= 100;
  return (
    <div className="flex min-w-[130px] flex-col gap-1.5">
      <span
        className={`text-xs font-semibold ${
          riepilogo.scaduto ? "text-rose-300" : completo ? "text-emerald-300" : "text-[#C3CCE8]"
        }`}
      >
        {riepilogo.scaduto ? "Scaduto" : `${percentuale}%`} · {riepilogo.numeroPagate}/{riepilogo.numeroRate} rate
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#26336A]">
        <div
          className={`h-full rounded-full ${riepilogo.scaduto ? "bg-rose-400" : "bg-[#C6F24E]"}`}
          style={{ width: `${Math.max(2, Math.min(100, percentuale))}%` }}
        />
      </div>
    </div>
  );
}

function Tile({
  etichetta,
  valore,
  tono = "default",
}: {
  etichetta: string;
  valore: string | number;
  tono?: "default" | "verde" | "ambra" | "rosso";
}) {
  const colore =
    tono === "verde" ? "text-emerald-300" : tono === "ambra" ? "text-amber-300" : tono === "rosso" ? "text-rose-300" : "text-[#EEF1FB]";
  return (
    <div className="flex flex-col justify-between gap-3 rounded-3xl border border-white/[0.07] bg-[#121A33] p-5">
      <span className="text-[13px] text-[#9AA6C7]">{etichetta}</span>
      <strong className={`${SG} text-4xl font-bold tracking-tight ${colore}`}>{valore}</strong>
    </div>
  );
}

function Pannello({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white/[0.07] bg-[#121A33] p-6 sm:p-7 ${className}`}>{children}</div>
  );
}

function IconaStampa({ fatta }: { fatta: boolean }) {
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${fatta ? "text-[#C6F24E]" : "text-[#6B77A0]"}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 9V3h10v6M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3M7 14h10v7H7z" />
      </svg>
      {fatta ? "✓" : "—"}
    </span>
  );
}

const inputScuro =
  "rounded-full border border-white/[0.1] bg-[#0F1630] px-4 py-2 text-sm text-[#EEF1FB] placeholder:text-[#6B77A0] focus:border-[#C6F24E]/60 focus:outline-none";


const VISTE = [
  { id: "panoramica", etichetta: "Panoramica" },
  { id: "iscrizioni", etichetta: "Iscrizioni" },
  { id: "certificati", etichetta: "Certificati" },
  { id: "tesseramenti", etichetta: "Tesseramenti" },
  { id: "pagamenti", etichetta: "Incassi" },
  { id: "fiscale", etichetta: "Fiscale" },
  { id: "ricevute", etichetta: "Ricevute" },
  { id: "listino", etichetta: "Listino" },
] as const;

type Vista = (typeof VISTE)[number]["id"];

function Titolo({ sopra, titolo, destra }: { sopra: string; titolo: string; destra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="text-sm capitalize text-[#9AA6C7]">{sopra}</div>
        <h1 className={`${SG} text-4xl font-bold tracking-tight sm:text-5xl`}>{titolo}</h1>
      </div>
      {destra}
    </div>
  );
}

function RigaPersona({ i, destra, onApri }: { i: any; destra: React.ReactNode; onApri: (id: string) => void }) {
  return (
    <button
      onClick={() => onApri(i.id)}
      className="flex w-full items-center gap-3.5 rounded-2xl bg-[#19234A] px-4 py-3 text-left transition-colors hover:bg-[#1f2c5c]"
    >
      <Avatar nome={i.atleta_nome} cognome={i.atleta_cognome} />
      <span className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">
          {i.atleta_nome} {i.atleta_cognome}
        </p>
        <p className="truncate text-xs text-[#9AA6C7]">{i.corsi?.nome}</p>
      </span>
      {destra}
    </button>
  );
}


function SchedaSocieta({
  s,
  onSalva,
}: {
  s: any;
  onSalva: (id: string, campi: Record<string, unknown>) => Promise<void>;
}) {
  const [v, setV] = useState({
    ragione_sociale: s.ragione_sociale ?? "",
    indirizzo: s.indirizzo ?? "",
    partita_iva: s.partita_iva ?? "",
    codice_fiscale: s.codice_fiscale ?? "",
    prefisso: s.prefisso ?? "",
    dicitura: s.dicitura ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const completa = !!(v.ragione_sociale && v.indirizzo && (v.partita_iva || v.codice_fiscale));
  const campo = (chiave: keyof typeof v, etichetta: string, extra = "") => (
    <label className={`flex flex-col gap-1.5 ${extra}`}>
      <span className="text-xs font-semibold text-[#9AA6C7]">{etichetta}</span>
      <input
        value={v[chiave]}
        onChange={(e) => setV((prev) => ({ ...prev, [chiave]: e.target.value }))}
        className={`${inputScuro} !rounded-2xl`}
      />
    </label>
  );
  return (
    <div className="rounded-3xl bg-[#19234A] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[15px]">{s.codice === "kickoff" ? "Società 1" : "Società 2"}</strong>
        {completa ? <Pallino stato={{ livello: "verde", testo: "Dati completi" }} /> : <Pallino stato={{ livello: "giallo", testo: "Dati da completare" }} />}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {campo("ragione_sociale", "Ragione sociale", "sm:col-span-2")}
        {campo("indirizzo", "Indirizzo / sede", "sm:col-span-2")}
        {campo("partita_iva", "Partita IVA")}
        {campo("codice_fiscale", "Codice fiscale")}
        {campo("prefisso", "Prefisso numerazione (es. MIC)")}
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-semibold text-[#9AA6C7]">
            Dicitura fiscale in calce (facoltativa — da concordare con il commercialista)
          </span>
          <textarea
            rows={2}
            value={v.dicitura}
            onChange={(e) => setV((prev) => ({ ...prev, dicitura: e.target.value }))}
            className={`${inputScuro} !rounded-2xl`}
          />
        </label>
      </div>
      <button
        onClick={async () => {
          setSalvando(true);
          await onSalva(s.id, v);
          setSalvando(false);
        }}
        disabled={salvando}
        className="mt-4 rounded-full bg-[#C6F24E] px-5 py-2 text-sm font-bold text-[#0B1020] hover:bg-[#d4f77c] disabled:opacity-60"
      >
        {salvando ? "Salvo…" : "Salva dati"}
      </button>
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
  const [schedaId, setSchedaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("tutte");
  const [taglie, setTaglie] = useState<Record<string, number>>({});
  const [pagamenti, setPagamenti] = useState({ totalePagato: 0, totaleDovuto: 0, totaleScaduto: 0 });
  const [incassi, setIncassi] = useState<Awaited<ReturnType<typeof elencoIncassi>>>([]);
  const [generandoRate, setGenerandoRate] = useState(false);
  const [mappaPagamenti, setMappaPagamenti] = useState<Awaited<ReturnType<typeof mappaPagamentiPerIscrizione>>>({});
  const [vista, setVista] = useState<Vista>("panoramica");
  const [ricevute, setRicevute] = useState<any[]>([]);
  const [societa, setSocieta] = useState<any[]>([]);
  const [ricercaRicevute, setRicercaRicevute] = useState("");

  async function caricaTutto(termine = "") {
    setCaricamento(true);
    const [risultatiIscrizioni, risultatiCorsi, quota, conteggioTaglie, riepilogoPag, listaIncassi, mappaPag, listaRicevute, listaSocieta] =
      await Promise.all([
        cercaIscrizioni(termine),
        elencaCorsiConListini(),
        ottieniQuotaIscrizione(),
        riepilogoTaglie(),
        riepilogoPagamenti(),
        elencoIncassi(50),
        mappaPagamentiPerIscrizione(),
        elencoRicevute(300),
        elencaSocieta(),
      ]);
    setIscrizioni(risultatiIscrizioni);
    setCorsi(risultatiCorsi);
    setQuotaIscrizione(quota);
    setTaglie(conteggioTaglie);
    setPagamenti(riepilogoPag);
    setIncassi(listaIncassi);
    setMappaPagamenti(mappaPag);
    setRicevute(listaRicevute);
    setSocieta(listaSocieta);
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
  useEffect(() => {
    if (schedaId && !caricamento && !iscrizioni.find((x: any) => x.id === schedaId)) {
      setSchedaId(null);
    }
  }, [iscrizioni, caricamento, schedaId]);

  async function apriPdfRicevuta(id: string) {
    try {
      const url = await linkRicevuta(id);
      window.open(url, "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Impossibile aprire il PDF.");
    }
  }

  async function rigeneraRicevuta(id: string) {
    try {
      await rigeneraPdfRicevuta(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Rigenerazione non riuscita.");
    }
    await caricaTutto(ricerca);
  }

  async function salvaSocietaHandler(id: string, campi: Record<string, unknown>) {
    try {
      await salvaSocieta(id, campi);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Salvataggio non riuscito.");
      return;
    }
    await caricaTutto(ricerca);
  }

  const ricevuteFiltrate = ricevute.filter((x: any) => {
    const q = ricercaRicevute.trim().toLowerCase();
    if (!q) return true;
    return [x.numero_testo, x.intestatario, x.atleta, x.causale, x.operatore, x.metodo]
      .filter(Boolean)
      .some((t: string) => t.toLowerCase().includes(q));
  });

  function apri(id: string) {
    setSchedaId(id);
    setVista("iscrizioni");
  }

  function vai(v: Vista) {
    setVista(v);
    setSchedaId(null);
  }

  const iscrizioniFiltrate = iscrizioni.filter((i: any) => {
    switch (filtro) {
      case "daConfermare":
        return !i.confermata;
      case "daStampare":
        return !i.stampata;
      case "certDaSistemare":
        return statoCertificato(i).livello === "rosso";
      case "daTesserare":
        return statoTesseramento(i).livello === "rosso";
      default:
        return true;
    }
  });
  const daStampareCount = iscrizioni.filter((i: any) => !i.stampata).length;
  const filtri = [
    { id: "tutte", etichetta: "Tutte", n: iscrizioni.length },
    { id: "daConfermare", etichetta: "Da confermare", n: daConfermareCount },
    { id: "daStampare", etichetta: "Da stampare", n: daStampareCount },
    { id: "certDaSistemare", etichetta: "Certificato da sistemare", n: conCertificatoDaSistemare },
    { id: "daTesserare", etichetta: "Da tesserare", n: conTesseramentoDaSistemare },
  ];

  const incassatoTotale = pagamenti.totalePagato + pagamenti.totaleDovuto;
  const percIncassato = incassatoTotale > 0 ? Math.round((pagamenti.totalePagato / incassatoTotale) * 100) : 0;
  const dovutoNonScaduto = Math.max(pagamenti.totaleDovuto - pagamenti.totaleScaduto, 0);
  const saluto = new Date().getHours() < 13 ? "Buongiorno" : new Date().getHours() < 18 ? "Buon pomeriggio" : "Buonasera";
  const dataOggi = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const badgeNav: Record<string, number> = {
    certificati: conCertificatoDaSistemare,
    tesseramenti: conTesseramentoDaSistemare,
  };
  const schedaCorrente: any = schedaId ? iscrizioni.find((x: any) => x.id === schedaId) : null;

  return (
    <div className="min-h-screen bg-[#0B1020] font-[family-name:var(--font-dm)] text-[#EEF1FB] [color-scheme:dark]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-7 px-5 pb-16 pt-5 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <img src="/logo-micolani.png" alt="Micolani Tennis" className="h-10 w-auto rounded-lg" />
          <nav aria-label="Sezioni" className="flex flex-wrap gap-1.5 rounded-[28px] border border-white/[0.07] bg-[#121A33] p-1.5">
            {VISTE.map((v) => (
              <button
                key={v.id}
                onClick={() => vai(v.id)}
                className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm transition-colors ${
                  vista === v.id
                    ? "bg-[#C6F24E] font-bold text-[#0B1020]"
                    : "font-medium text-[#AAB4D4] hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {v.etichetta}
                {vista !== v.id && badgeNav[v.id] > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-400/20 px-1 text-[11px] font-bold text-rose-300">
                    {badgeNav[v.id]}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <button
            onClick={esci}
            className="h-12 rounded-full border border-white/[0.07] bg-[#121A33] px-5 text-sm font-semibold hover:bg-[#19234A]"
          >
            Esci
          </button>
        </header>

        {vista === "iscrizioni" && schedaId && (
          <div className="flex flex-col gap-5">
            <button
              onClick={() => setSchedaId(null)}
              className="flex items-center gap-1.5 self-start text-sm font-semibold text-[#AAB4D4] hover:text-white"
            >
              ← Iscrizioni
            </button>
            {!schedaCorrente ? (
              <Pannello>
                <p className="text-sm text-[#9AA6C7]">{caricamento ? "Caricamento…" : "Iscrizione non trovata."}</p>
              </Pannello>
            ) : (
              <>
                <Pannello className="flex flex-wrap items-center justify-between gap-5">
                  <div className="flex items-center gap-5">
                    <Avatar nome={schedaCorrente.atleta_nome} cognome={schedaCorrente.atleta_cognome} size={72} />
                    <div className="flex flex-col gap-1.5">
                      <h1 className={`${SG} text-3xl font-bold tracking-tight sm:text-4xl`}>
                        {schedaCorrente.atleta_nome} {schedaCorrente.atleta_cognome}
                      </h1>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#9AA6C7]">
                        <strong className="tracking-wider text-[#EEF1FB]">{schedaCorrente.codice}</strong>
                        <span>
                          {schedaCorrente.corsi?.nome} · {schedaCorrente.frequenza_settimanale}x a settimana
                        </span>
                        {schedaCorrente.minorenne && schedaCorrente.genitore_nome && (
                          <span>
                            Genitore: {schedaCorrente.genitore_nome} {schedaCorrente.genitore_cognome}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <PillStato confermata={!!schedaCorrente.confermata} />
                        <Pallino stato={statoCertificato(schedaCorrente)} />
                        <Pallino stato={statoTesseramento(schedaCorrente)} />
                      </div>
                    </div>
                  </div>
                </Pannello>
                <DettaglioIscrizione
                  i={schedaCorrente}
                  onCambiato={() => caricaTutto(ricerca)}
                  onStampata={() => segnaComeStampata(schedaCorrente.id)}
                />
              </>
            )}
          </div>
        )}

        {vista === "panoramica" && (
          <div className="flex flex-col gap-7">
            <Titolo sopra={dataOggi} titolo={saluto} />

            <section className="grid grid-cols-12 gap-4">
              <Pannello className="col-span-12 flex flex-col gap-5 lg:col-span-7">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-[#9AA6C7]">Incassi stagione</span>
                  <span className="text-[13px] text-[#9AA6C7]">{percIncassato}% incassato</span>
                </div>
                <div className={`${SG} text-5xl font-bold leading-none tracking-tight sm:text-6xl`}>
                  {formattaEuro(pagamenti.totalePagato)}
                </div>
                <div className="flex h-3.5 gap-1">
                  <div className="rounded-full bg-[#C6F24E]" style={{ flex: Math.max(pagamenti.totalePagato, 1) }} />
                  <div className="rounded-full bg-[#3A4A7C]" style={{ flex: Math.max(dovutoNonScaduto, 0.0001) }} />
                  {pagamenti.totaleScaduto > 0 && (
                    <div className="rounded-full bg-rose-400" style={{ flex: pagamenti.totaleScaduto }} />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-3 text-[13px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[#9AA6C7]"><span className="h-2 w-2 rounded-full bg-[#C6F24E]" />Pagato</span>
                    <strong className={`${SG} text-lg`}>{formattaEuro(pagamenti.totalePagato)}</strong>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[#9AA6C7]"><span className="h-2 w-2 rounded-full bg-[#3A4A7C]" />Da incassare</span>
                    <strong className={`${SG} text-lg`}>{formattaEuro(dovutoNonScaduto)}</strong>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-rose-300"><span className="h-2 w-2 rounded-full bg-rose-400" />Scaduto</span>
                    <strong className={`${SG} text-lg text-rose-300`}>{formattaEuro(pagamenti.totaleScaduto)}</strong>
                  </div>
                </div>
              </Pannello>

              <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-5">
                <Tile etichetta="Iscrizioni" valore={iscrizioni.length} />
                <Tile etichetta="Confermate" valore={confermateCount} tono="verde" />
                <Tile etichetta="Da confermare" valore={daConfermareCount} tono="ambra" />
                <Tile etichetta="Da stampare" valore={daStampareCount} />
              </div>

              <Pannello className="col-span-12 flex flex-col gap-2.5 lg:col-span-6">
                <div className="flex items-center justify-between">
                  <h2 className={`${SG} text-xl font-semibold`}>Pronti per il tesseramento</h2>
                  <span className="rounded-full bg-[#C6F24E] px-2.5 py-0.5 text-xs font-bold text-[#0B1020]">{urgentiTesseramento.length}</span>
                </div>
                <p className="mb-1 text-[13px] text-[#9AA6C7]">Hanno già pagato e hanno il certificato valido.</p>
                {urgentiTesseramento.length === 0 && <p className="text-sm text-[#6B77A0]">Nessuno in questa situazione.</p>}
                {urgentiTesseramento.slice(0, 5).map((i: any) => (
                  <RigaPersona
                    onApri={apri}
                    key={i.id}
                    i={i}
                    destra={<span className="text-sm font-bold text-[#C6F24E]">{formattaEuro(mappaPagamenti[i.id]?.pagato ?? 0)}</span>}
                  />
                ))}
              </Pannello>

              <Pannello className="col-span-12 flex flex-col gap-2.5 lg:col-span-6">
                <div className="flex items-center justify-between">
                  <h2 className={`${SG} text-xl font-semibold`}>In attesa del certificato</h2>
                  <span className="rounded-full bg-amber-300/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">{inAttesaCertificato.length}</span>
                </div>
                <p className="mb-1 text-[13px] text-[#9AA6C7]">Hanno pagato ma non sono ancora tesserabili.</p>
                {inAttesaCertificato.length === 0 && <p className="text-sm text-[#6B77A0]">Nessuno in questa situazione.</p>}
                {inAttesaCertificato.slice(0, 5).map((i: any) => (
                  <RigaPersona key={i.id} onApri={apri} i={i} destra={<Pallino stato={statoCertificato(i)} />} />
                ))}
              </Pannello>

              <Pannello className="col-span-12 flex flex-col gap-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className={`${SG} text-xl font-semibold`}>Ultime iscrizioni</h2>
                  <button onClick={() => vai("iscrizioni")} className="text-[13px] font-semibold text-[#C6F24E]">
                    Vedi tutte →
                  </button>
                </div>
                {iscrizioni.length === 0 && <p className="text-sm text-[#6B77A0]">Nessuna iscrizione ricevuta ancora.</p>}
                {iscrizioni.slice(0, 5).map((i: any) => (
                  <RigaPersona
                    onApri={apri}
                    key={i.id}
                    i={i}
                    destra={
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Pallino stato={statoCertificato(i)} />
                        <Pallino stato={statoTesseramento(i)} />
                        <PillStato confermata={!!i.confermata} />
                      </div>
                    }
                  />
                ))}
              </Pannello>
            </section>
          </div>
        )}

        {vista === "iscrizioni" && !schedaId && (
          <div className="flex flex-col gap-5">
            <Titolo
              sopra={`${iscrizioni.length} iscrizioni`}
              titolo="Iscrizioni"
              destra={
                <form onSubmit={cerca} className="flex gap-2">
                  <input
                    value={ricerca}
                    onChange={(e) => setRicerca(e.target.value)}
                    aria-label="Cerca un'iscrizione"
                    placeholder="Cerca per nome, codice o telefono"
                    className={`${inputScuro} w-72 max-w-full`}
                  />
                  <button type="submit" className="rounded-full bg-[#C6F24E] px-5 py-2 text-sm font-bold text-[#0B1020] hover:bg-[#d4f77c]">
                    Cerca
                  </button>
                </form>
              }
            />

            <div className="flex flex-wrap gap-2">
              {filtri.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`h-10 rounded-full px-4 text-[13px] ${
                    filtro === f.id
                      ? "bg-[#EEF1FB] font-bold text-[#0B1020]"
                      : "border border-white/[0.07] bg-[#121A33] font-medium text-[#AAB4D4] hover:bg-[#19234A]"
                  }`}
                >
                  {f.etichetta} · {f.n}
                </button>
              ))}
            </div>

            <Pannello className="flex flex-col gap-2.5 !p-4 sm:!p-5">
              {caricamento && <p className="p-4 text-sm text-[#9AA6C7]">Caricamento…</p>}
              {!caricamento && iscrizioniFiltrate.length === 0 && (
                <p className="p-4 text-sm text-[#9AA6C7]">Nessuna iscrizione trovata.</p>
              )}
              {iscrizioniFiltrate.map((i: any) => (
                <button
                  key={i.id}
                  onClick={() => apri(i.id)}
                  className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[20px] bg-[#19234A] px-5 py-3.5 text-left transition-colors hover:bg-[#1f2c5c]"
                >
                  <span className="flex min-w-[210px] flex-1 items-center gap-3">
                    <Avatar nome={i.atleta_nome} cognome={i.atleta_cognome} />
                    <span className="flex flex-col">
                      <strong className="text-[15px]">
                        {i.atleta_nome} {i.atleta_cognome}
                        {i.minorenne && <span className="ml-2 text-xs font-normal text-[#9AA6C7]">minorenne</span>}
                      </strong>
                      <span className="text-xs text-[#9AA6C7]">
                        {i.corsi?.nome ?? "-"} · {i.frequenza_settimanale}x
                      </span>
                    </span>
                  </span>
                  <span className="flex w-[120px] flex-col gap-0.5">
                    <span className="text-xs text-[#9AA6C7]">Codice</span>
                    <strong className="text-[13px] tracking-wider">{i.codice}</strong>
                  </span>
                  <span className="flex min-w-[220px] flex-1 flex-wrap gap-1.5">
                    <Pallino stato={statoCertificato(i)} />
                    <Pallino stato={statoTesseramento(i)} />
                  </span>
                  <span className="flex-1 basis-[140px]">
                    <BarraPagamento riepilogo={mappaPagamenti[i.id]} />
                  </span>
                  <span className="flex w-[90px] flex-col gap-0.5">
                    <span className="text-xs text-[#9AA6C7]">Totale</span>
                    <strong className="text-sm">{formattaEuro(i.prezzo_totale)}</strong>
                  </span>
                  <PillStato confermata={!!i.confermata} />
                  <IconaStampa fatta={!!i.stampata} />
                </button>
              ))}
            </Pannello>
          </div>
        )}

        {vista === "certificati" && (
          <div className="flex flex-col gap-5">
            <Titolo sopra="Controllo certificati medici" titolo="Certificati" />
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile etichetta="Da sistemare" valore={conCertificatoDaSistemare} tono="rosso" />
              <Tile etichetta="In scadenza" valore={conCertificatoInScadenza} tono="ambra" />
              <Tile etichetta="In regola" valore={iscrizioni.filter((i) => statoCertificato(i).livello === "verde").length} tono="verde" />
              <Tile etichetta="Totale iscritti" valore={iscrizioni.length} />
            </section>
            <div className="flex items-center gap-2.5 px-1 text-[13px] text-[#9AA6C7]">
              <Pallino stato={{ livello: "giallo", testo: `Preavviso ${GIORNI_PREAVVISO} giorni` }} />
              <span>Le righe più urgenti sono in cima. Clicca un nome per aprire la scheda.</span>
            </div>
            <Pannello className="flex flex-col gap-2.5 !p-4 sm:!p-5">
              <div className="hidden gap-x-6 px-5 pb-1 text-xs font-semibold text-[#9AA6C7] md:flex">
                <span className="min-w-0 flex-1">Atleta</span>
                <span className="w-[170px]">Stato</span>
                <span className="w-[130px]">Tipo</span>
                <span className="w-[150px]">Scadenza</span>
                <span className="w-[150px]">Quando</span>
              </div>
              {[...iscrizioni]
                .sort((a: any, b: any) => {
                  const d = punteggioLivello[statoCertificato(a).livello] - punteggioLivello[statoCertificato(b).livello];
                  if (d !== 0) return d;
                  return (a.certificato_scadenza ?? "").localeCompare(b.certificato_scadenza ?? "");
                })
                .map((i: any) => {
                  const q = quandoScade(i.certificato_scadenza);
                  return (
                    <button
                      key={i.id}
                      onClick={() => apri(i.id)}
                      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[20px] bg-[#19234A] px-5 py-3.5 text-left transition-colors hover:bg-[#1f2c5c]"
                    >
                      <span className="flex min-w-[200px] flex-1 items-center gap-3">
                        <Avatar nome={i.atleta_nome} cognome={i.atleta_cognome} />
                        <span className="flex flex-col">
                          <strong className="text-[15px]">
                            {i.atleta_nome} {i.atleta_cognome}
                          </strong>
                          <span className="text-xs text-[#9AA6C7]">{i.corsi?.nome}</span>
                        </span>
                      </span>
                      <span className="w-[170px]">
                        <Pallino stato={statoCertificato(i)} />
                      </span>
                      <span className="w-[130px] text-sm text-[#C3CCE8]">
                        {i.certificato_tipo === "agonistico" ? "Agonistico" : i.certificato_tipo === "non_agonistico" ? "Non agonistico" : "—"}
                      </span>
                      <span className="w-[150px] text-sm font-semibold">{formattaData(i.certificato_scadenza)}</span>
                      <span className={`w-[150px] text-[13px] font-semibold ${q.scuro ? "text-rose-300" : "text-[#9AA6C7]"}`}>{q.testo}</span>
                    </button>
                  );
                })}
              {iscrizioni.length === 0 && <p className="p-4 text-sm text-[#9AA6C7]">Nessuna iscrizione ricevuta ancora.</p>}
            </Pannello>
          </div>
        )}

        {vista === "tesseramenti" && (
          <div className="flex flex-col gap-5">
            <Titolo sopra="Controllo tessere FITP" titolo="Tesseramenti" />
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile etichetta="Da sistemare" valore={conTesseramentoDaSistemare} tono="rosso" />
              <Tile etichetta="In scadenza" valore={conTesseramentoInScadenza} tono="ambra" />
              <Tile etichetta="In regola" valore={iscrizioni.filter((i) => statoTesseramento(i).livello === "verde").length} tono="verde" />
              <Tile etichetta="Totale iscritti" valore={iscrizioni.length} />
            </section>

            <section className="grid grid-cols-12 gap-4">
              <Pannello className="col-span-12 flex flex-col gap-2.5 lg:col-span-6">
                <div className="flex items-center justify-between">
                  <h2 className={`${SG} text-xl font-semibold`}>Pronti per il tesseramento</h2>
                  <span className="rounded-full bg-[#C6F24E] px-2.5 py-0.5 text-xs font-bold text-[#0B1020]">{urgentiTesseramento.length}</span>
                </div>
                <p className="mb-1 text-[13px] text-[#9AA6C7]">Hanno già pagato e hanno il certificato medico valido.</p>
                {urgentiTesseramento.length === 0 && <p className="text-sm text-[#6B77A0]">Nessuno in questa situazione.</p>}
                {urgentiTesseramento.map((i: any) => (
                  <RigaPersona
                    onApri={apri}
                    key={i.id}
                    i={i}
                    destra={<span className="text-sm font-bold text-[#C6F24E]">{formattaEuro(mappaPagamenti[i.id]?.pagato ?? 0)}</span>}
                  />
                ))}
              </Pannello>
              <Pannello className="col-span-12 flex flex-col gap-2.5 lg:col-span-6">
                <div className="flex items-center justify-between">
                  <h2 className={`${SG} text-xl font-semibold`}>In attesa del certificato</h2>
                  <span className="rounded-full bg-amber-300/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">{inAttesaCertificato.length}</span>
                </div>
                <p className="mb-1 text-[13px] text-[#9AA6C7]">Hanno pagato ma non si possono ancora tesserare.</p>
                {inAttesaCertificato.length === 0 && <p className="text-sm text-[#6B77A0]">Nessuno in questa situazione.</p>}
                {inAttesaCertificato.map((i: any) => (
                  <RigaPersona key={i.id} onApri={apri} i={i} destra={<Pallino stato={statoCertificato(i)} />} />
                ))}
              </Pannello>
            </section>

            <Pannello className="flex flex-col gap-2.5 !p-4 sm:!p-5">
              <div className="hidden gap-x-6 px-5 pb-1 text-xs font-semibold text-[#9AA6C7] md:flex">
                <span className="min-w-0 flex-1">Atleta</span>
                <span className="w-[170px]">Stato</span>
                <span className="w-[100px]">N. tessera</span>
                <span className="w-[210px]">Società</span>
                <span className="w-[120px]">Tipo</span>
                <span className="w-[130px]">Scadenza</span>
              </div>
              {[...iscrizioni]
                .sort((a: any, b: any) => punteggioLivello[statoTesseramento(a).livello] - punteggioLivello[statoTesseramento(b).livello])
                .map((i: any) => (
                  <button
                    key={i.id}
                    onClick={() => apri(i.id)}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[20px] bg-[#19234A] px-5 py-3.5 text-left transition-colors hover:bg-[#1f2c5c]"
                  >
                    <span className="flex min-w-[200px] flex-1 items-center gap-3">
                      <Avatar nome={i.atleta_nome} cognome={i.atleta_cognome} />
                      <strong className="text-[15px]">
                        {i.atleta_nome} {i.atleta_cognome}
                      </strong>
                    </span>
                    <span className="w-[170px]">
                      <Pallino stato={statoTesseramento(i)} />
                    </span>
                    <span className="w-[100px] text-sm font-semibold">{i.tesseramento_numero || "—"}</span>
                    <span className="w-[210px]">
                      <PillSocieta societa={i.tesseramento_societa} />
                    </span>
                    <span className="w-[120px] text-sm text-[#C3CCE8]">
                      {i.tesseramento_tipo === "agonistico" ? "Agonistico" : i.tesseramento_tipo === "non_agonistico" ? "Non agonistico" : "—"}
                    </span>
                    <span className="w-[130px] text-sm font-semibold">{formattaData(i.tesseramento_scadenza)}</span>
                  </button>
                ))}
              {iscrizioni.length === 0 && <p className="p-4 text-sm text-[#9AA6C7]">Nessuna iscrizione ricevuta ancora.</p>}
            </Pannello>
          </div>
        )}

        {vista === "pagamenti" && (
          <div className="flex flex-col gap-5">
            <Titolo
              sopra="Registro dei pagamenti ricevuti"
              titolo="Incassi"
              destra={
                <button
                  onClick={generaRate}
                  disabled={generandoRate}
                  className="h-11 rounded-full border border-white/[0.07] bg-[#121A33] px-5 text-[13px] font-semibold text-[#AAB4D4] hover:bg-[#19234A] disabled:opacity-60"
                >
                  {generandoRate ? "Genero…" : "Genera rate mancanti"}
                </button>
              }
            />
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Tile etichetta="Pagato" valore={formattaEuro(pagamenti.totalePagato)} tono="verde" />
              <Tile etichetta="Dovuto" valore={formattaEuro(pagamenti.totaleDovuto)} />
              <Tile etichetta="Scaduto" valore={formattaEuro(pagamenti.totaleScaduto)} tono="rosso" />
            </section>
            <Pannello className="flex flex-col gap-2.5 !p-4 sm:!p-5">
              {incassi.length === 0 && <p className="p-4 text-sm text-[#9AA6C7]">Nessun incasso registrato ancora.</p>}
              {incassi.map((inc: any) => (
                <button
                  key={inc.id}
                  onClick={() => apri(inc.iscrizione_id)}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[20px] bg-[#19234A] px-5 py-3.5 text-left transition-colors hover:bg-[#1f2c5c]"
                >
                  <span className="w-[130px] text-sm text-[#C3CCE8]">{formattaData(inc.data_pagamento)}</span>
                  <span className="min-w-[260px] flex-1">
                    <strong className="block text-[15px]">
                      {inc.iscrizioni?.atleta_nome} {inc.iscrizioni?.atleta_cognome}
                    </strong>
                    <span className="text-xs text-[#9AA6C7]">{testoDocumentoFiscale(inc)}</span>
                  </span>
                  <span className="w-[120px] text-[13px] font-semibold tracking-wider">{inc.iscrizioni?.codice}</span>
                  <span className="w-[140px] text-sm text-[#C3CCE8]">{inc.tipo}</span>
                  <span className="w-[90px]">
                    {inc.metodo_pagamento ? (
                      <span className="rounded-full bg-[#26336A] px-2.5 py-1 text-xs font-semibold text-[#DDE4FA]">{inc.metodo_pagamento}</span>
                    ) : (
                      <span className="text-[#6B77A0]">—</span>
                    )}
                  </span>
                  <span className={`${SG} w-[90px] text-right text-lg font-bold text-emerald-300`}>{formattaEuro(inc.importo)}</span>
                </button>
              ))}
            </Pannello>
          </div>
        )}

        {vista === "fiscale" && (
          <div className="flex flex-col gap-5">
            <Titolo sopra="Ricevute non fiscali e fatture per ogni incasso" titolo="Fiscale" />
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile etichetta="Incassi totali" valore={incassi.length} />
              <Tile etichetta="Con ricevuta" valore={incassi.filter((inc: any) => inc.ricevuta_numero).length} tono="verde" />
              <Tile etichetta="Fatture emesse" valore={incassi.filter((inc: any) => inc.fattura_numero).length} tono="verde" />
              <Tile etichetta="Fatture da emettere" valore={incassi.filter((inc: any) => !inc.fattura_numero).length} tono="ambra" />
            </section>
            {[
              { titolo: "Fatture da emettere", lista: incassi.filter((inc: any) => !inc.fattura_numero), emessa: false },
              { titolo: "Documenti completi", lista: incassi.filter((inc: any) => inc.fattura_numero), emessa: true },
            ].map((gruppo) => (
              <Pannello key={gruppo.titolo} className="flex flex-col gap-2.5 !p-4 sm:!p-5">
                <div className="flex items-center justify-between px-2 pb-1">
                  <h2 className={`${SG} text-xl font-semibold`}>{gruppo.titolo}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      gruppo.emessa ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-300/15 text-amber-300"
                    }`}
                  >
                    {gruppo.lista.length}
                  </span>
                </div>
                {gruppo.lista.length === 0 && <p className="px-2 pb-2 text-sm text-[#6B77A0]">Nessun elemento.</p>}
                {gruppo.lista.map((inc: any) => (
                  <button
                    key={inc.id}
                    onClick={() => apri(inc.iscrizione_id)}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[20px] bg-[#19234A] px-5 py-3.5 text-left transition-colors hover:bg-[#1f2c5c]"
                  >
                    <span className="min-w-[220px] flex-1">
                      <strong className="block text-[15px]">
                        {inc.iscrizioni?.atleta_nome} {inc.iscrizioni?.atleta_cognome}
                      </strong>
                      <span className="text-xs text-[#9AA6C7]">
                        {inc.iscrizioni?.codice} · {inc.tipo} · {formattaData(inc.data_pagamento)}
                      </span>
                    </span>
                    <span className="flex min-w-[200px] flex-1 flex-col gap-0.5">
                      <span className="text-xs text-[#9AA6C7]">Ricevuta non fiscale</span>
                      <strong className="text-sm">
                        {inc.ricevuta_numero ? `n.${inc.ricevuta_numero}${inc.ricevuta_blocco ? ` · blocco ${inc.ricevuta_blocco}` : ""}` : "—"}
                      </strong>
                    </span>
                    <span className={`${SG} w-[90px] text-right text-lg font-bold text-emerald-300`}>{formattaEuro(inc.importo)}</span>
                    <span className="flex w-[240px] justify-end">
                      {inc.fattura_numero ? (
                        <Pallino
                          stato={{
                            livello: "verde",
                            testo: `Fattura n.${inc.fattura_numero}${inc.fattura_data ? ` · ${formattaData(inc.fattura_data)}` : ""}`,
                          }}
                        />
                      ) : (
                        <Pallino stato={{ livello: "giallo", testo: "Fattura da emettere" }} />
                      )}
                    </span>
                  </button>
                ))}
              </Pannello>
            ))}
          </div>
        )}

        {vista === "ricevute" && (
          <div className="flex flex-col gap-5">
            <Titolo
              sopra="Archivio protetto delle ricevute emesse"
              titolo="Ricevute"
              destra={
                <input
                  value={ricercaRicevute}
                  onChange={(e) => setRicercaRicevute(e.target.value)}
                  aria-label="Cerca una ricevuta"
                  placeholder="Cerca per numero, cliente, causale…"
                  className={`${inputScuro} w-72 max-w-full`}
                />
              }
            />
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile etichetta="Emesse" valore={ricevute.filter((x: any) => x.stato === "emessa").length} />
              <Tile etichetta="Con PDF archiviato" valore={ricevute.filter((x: any) => x.pdf_path).length} tono="verde" />
              <Tile etichetta="PDF da rigenerare" valore={ricevute.filter((x: any) => !x.pdf_path).length} tono="ambra" />
              <Tile
                etichetta="Totale ricevute"
                valore={formattaEuro(ricevute.filter((x: any) => x.stato === "emessa").reduce((t: number, x: any) => t + Number(x.importo), 0))}
              />
            </section>
            <Pannello className="flex flex-col gap-2.5 !p-4 sm:!p-5">
              {ricevuteFiltrate.length === 0 && (
                <p className="p-4 text-sm text-[#9AA6C7]">
                  {ricevute.length === 0
                    ? "Nessuna ricevuta emessa ancora. Si emettono dalla scheda di ogni iscritto, su una rata incassata."
                    : "Nessuna ricevuta corrisponde alla ricerca."}
                </p>
              )}
              {ricevuteFiltrate.map((x: any) => (
                <div key={x.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[20px] bg-[#19234A] px-5 py-3.5">
                  <span className="w-[130px] text-sm text-[#C3CCE8]">{formattaData(x.data_pagamento)}</span>
                  <span className="w-[130px] text-sm font-bold tracking-wider">{x.numero_testo}</span>
                  <span className="min-w-[220px] flex-1">
                    <button
                      onClick={() => x.iscrizione_id && apri(x.iscrizione_id)}
                      className="block text-left text-[15px] font-semibold hover:underline"
                    >
                      {x.intestatario}
                    </button>
                    <span className="text-xs text-[#9AA6C7]">
                      {x.causale}
                      {x.atleta && x.atleta !== x.intestatario ? ` · atleta ${x.atleta}` : ""}
                    </span>
                  </span>
                  <span className="w-[90px] text-sm text-[#C3CCE8]">{x.metodo || "—"}</span>
                  <span className="w-[120px] truncate text-xs text-[#9AA6C7]" title={x.operatore ?? ""}>
                    {x.operatore || "—"}
                  </span>
                  <span className={`${SG} w-[90px] text-right text-lg font-bold text-emerald-300`}>{formattaEuro(x.importo)}</span>
                  <span className="w-[110px]">
                    <span className="rounded-full bg-[#26336A] px-2.5 py-1 text-xs font-semibold text-[#C3CCE8]">
                      {x.whatsapp_stato === "non_inviata" ? "WhatsApp: no" : x.whatsapp_stato}
                    </span>
                  </span>
                  <span className="flex w-[130px] justify-end">
                    {x.pdf_path ? (
                      <button onClick={() => apriPdfRicevuta(x.id)} className="rounded-full bg-[#C6F24E] px-4 py-1.5 text-xs font-bold text-[#0B1020] hover:bg-[#d4f77c]">
                        Apri PDF
                      </button>
                    ) : (
                      <button onClick={() => rigeneraRicevuta(x.id)} className="rounded-full border border-amber-300/40 px-4 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-300/10">
                        Rigenera PDF
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </Pannello>
          </div>
        )}

        {vista === "listino" && (
          <div className="flex flex-col gap-5">
            <Titolo sopra="Prezzi dei corsi e quota d'iscrizione" titolo="Listino" />

            <Pannello className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={`${SG} text-xl font-semibold`}>Quota d'iscrizione</h2>
                <p className="text-[13px] text-[#9AA6C7]">Kit abbigliamento e tessera FITP — si aggiunge a ogni corso</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#9AA6C7]">€</span>
                <input
                  aria-label="Quota d'iscrizione"
                  className={`${inputScuro} w-24 text-right`}
                  defaultValue={quotaIscrizione}
                  onChange={(e) => setQuotaModificata(e.target.value)}
                />
                <button
                  onClick={salvaQuota}
                  disabled={salvataggio === "quota"}
                  className="rounded-full bg-[#C6F24E] px-5 py-2 text-sm font-bold text-[#0B1020] hover:bg-[#d4f77c] disabled:opacity-60"
                >
                  {salvataggio === "quota" ? "Salvo…" : "Salva"}
                </button>
              </div>
            </Pannello>

            <Pannello>
              <h2 className={`${SG} text-xl font-semibold`}>Società che incassano</h2>
              <p className="mb-4 text-[13px] text-[#9AA6C7]">
                Dati ufficiali stampati sulle ricevute PDF. La numerazione è separata per società e per anno (prefisso + anno + numero).
              </p>
              <div className="flex flex-col gap-4">
                {societa.map((so: any) => (
                  <SchedaSocieta key={so.id} s={so} onSalva={salvaSocietaHandler} />
                ))}
              </div>
            </Pannello>

            {corsi.map((corso) => (
              <Pannello key={corso.id}>
                <h3 className={`${SG} mb-4 text-lg font-semibold`}>{corso.nome}</h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {corso.listini.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#19234A] px-4 py-3">
                      <span className="text-sm text-[#C3CCE8]">
                        {l.frequenza_settimanale}x/sett. — {l.numero_rate === 1 ? "unico" : `${l.numero_rate} rate`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#9AA6C7]">€</span>
                        <input
                          aria-label={`Importo ${corso.nome} ${l.frequenza_settimanale}x ${l.numero_rate} rate`}
                          className={`${inputScuro} w-24 text-right`}
                          defaultValue={l.importo_rata}
                          onChange={(e) => setImportiModificati((p) => ({ ...p, [l.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => salvaImporto(l.id)}
                          disabled={salvataggio === l.id}
                          className="text-xs font-bold text-[#C6F24E] underline underline-offset-2 hover:text-[#d4f77c] disabled:opacity-50"
                        >
                          {salvataggio === l.id ? "…" : "Salva"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Pannello>
            ))}

            <Pannello>
              <h2 className={`${SG} text-xl font-semibold`}>Riepilogo taglie kit</h2>
              <p className="mb-4 text-[13px] text-[#9AA6C7]">Totale su tutte le iscrizioni ricevute</p>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-7">
                {ORDINE_TAGLIE.filter((t) => taglie[t]).map((t) => (
                  <div key={t} className="rounded-2xl bg-[#19234A] px-3 py-3 text-center">
                    <p className={`${SG} text-2xl font-bold`}>{taglie[t]}</p>
                    <p className="text-xs text-[#9AA6C7]">{t}</p>
                  </div>
                ))}
                {taglie["Non indicata"] && (
                  <div className="rounded-2xl bg-amber-300/15 px-3 py-3 text-center">
                    <p className={`${SG} text-2xl font-bold text-amber-300`}>{taglie["Non indicata"]}</p>
                    <p className="text-xs text-amber-300/80">Non indicata</p>
                  </div>
                )}
                {Object.keys(taglie).length === 0 && <p className="col-span-full text-sm text-[#6B77A0]">Nessun dato ancora.</p>}
              </div>
            </Pannello>
          </div>
        )}
      </div>
    </div>
  );
}


function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#9AA6C7]">
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
      <dt className="text-[#9AA6C7]">{etichetta}</dt>
      <dd className="text-right font-medium text-[#EEF1FB]">
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

const classeInputPiccolo = "w-full rounded-lg border border-white/[0.1] bg-[#0F1630] px-2 py-1.5 text-sm text-[#EEF1FB]";

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
        <span className="text-[#9AA6C7]">{campo.etichetta}</span>
        <input type="checkbox" checked={!!valore} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      </label>
    );
  }
  if (campo.tipo === "select") {
    return (
      <label className="block text-sm">
        <span className="mb-1 block text-[#9AA6C7]">{campo.etichetta}</span>
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
      <span className="mb-1 block text-[#9AA6C7]">{campo.etichetta}</span>
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
  const [ricevuteIsc, setRicevuteIsc] = useState<any[]>([]);
  const [societaDisponibili, setSocietaDisponibili] = useState<any[]>([]);
  const [sceltaRicevuta, setSceltaRicevuta] = useState<Record<string, { societa: string; tipo: "ricevuta" | "conferma" }>>({});
  const [emissione, setEmissione] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    setCaricamentoRate(true);
    ottieniRatePagamento(r.id).then((risultato) => {
      if (attivo) {
        setRate(risultato);
        setCaricamentoRate(false);
      }
    });
    Promise.all([ricevutePerIscrizione(r.id), elencaSocieta()]).then(([rc, so]) => {
      if (attivo) {
        setRicevuteIsc(rc);
        setSocietaDisponibili(so.filter((x: any) => x.attiva));
      }
    });
    return () => {
      attivo = false;
    };
  }, [r.id]);

  async function ricaricaRicevute() {
    setRicevuteIsc(await ricevutePerIscrizione(r.id));
  }

  function sceltaPer(rataId: string) {
    return sceltaRicevuta[rataId] ?? { societa: societaDisponibili[0]?.id ?? "", tipo: "conferma" as const };
  }

  async function emetti(rataId: string) {
    const scelta = sceltaPer(rataId);
    if (!scelta.societa) {
      alert("Seleziona la società che incassa.");
      return;
    }
    setEmissione(rataId);
    try {
      const esito = await emettiRicevuta(rataId, scelta.societa, scelta.tipo);
      if (esito.avviso) {
        alert(`Ricevuta ${esito.numero} registrata, ma il PDF non è stato generato:\n${esito.avviso}\n\nUsa "Rigenera PDF" per riprovare: il numero resta lo stesso.`);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Emissione non riuscita.");
    }
    await ricaricaRicevute();
    setEmissione(null);
  }

  async function apriPdf(id: string) {
    try {
      window.open(await linkRicevuta(id), "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Impossibile aprire il PDF.");
    }
  }

  async function rigeneraPdf(id: string) {
    try {
      await rigeneraPdfRicevuta(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Rigenerazione non riuscita.");
    }
    await ricaricaRicevute();
  }

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
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/[0.07] pb-4">
        <button
          onClick={toggleConferma}
          disabled={azioneInCorso}
          className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${
            r.confermata ? "border border-white/[0.1] text-[#EEF1FB] hover:bg-[#19234A]" : "bg-[#C6F24E] text-[#0B1020] hover:bg-[#d4f77c]"
          }`}
        >
          {r.confermata ? "Annulla conferma" : "Conferma iscrizione"}
        </button>

        <button
          onClick={stampa}
          className="rounded-full border border-white/[0.1] px-4 py-1.5 text-sm font-medium text-[#EEF1FB] hover:bg-[#19234A]"
        >
          {r.stampata ? "🖨️ Ristampa" : "🖨️ Stampa scheda"}
        </button>

        {!modificaAttiva ? (
          <button
            onClick={iniziaModifica}
            className="rounded-full border border-white/[0.1] px-4 py-1.5 text-sm font-medium text-[#EEF1FB] hover:bg-[#19234A]"
          >
            Modifica
          </button>
        ) : (
          <>
            <button
              onClick={salvaModifiche}
              disabled={azioneInCorso}
              className="rounded-full bg-[#C6F24E] px-4 py-1.5 text-sm font-medium text-[#0B1020] disabled:opacity-60"
            >
              {azioneInCorso ? "Salvo…" : "Salva modifiche"}
            </button>
            <button
              onClick={() => setModificaAttiva(false)}
              className="rounded-full border border-white/[0.1] px-4 py-1.5 text-sm font-medium text-[#EEF1FB] hover:bg-[#19234A]"
            >
              Annulla
            </button>
          </>
        )}

        <button
          onClick={elimina}
          disabled={azioneInCorso}
          className="ml-auto rounded-full border border-rose-400/40 px-4 py-1.5 text-sm font-medium text-rose-300 hover:bg-rose-400/15 disabled:opacity-60"
        >
          Elimina
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] border border-white/[0.07] bg-[#121A33] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#9AA6C7]">Certificato medico</h4>
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

        <div className="rounded-[24px] border border-white/[0.07] bg-[#121A33] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#9AA6C7]">Tesseramento FITP</h4>
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

      <div className="mb-6 overflow-hidden rounded-[24px] border border-white/[0.07]">
        <div className="flex items-center justify-between bg-[#0B1020] px-4 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Pagamenti
          </h4>
          <button
            onClick={nuovaRata}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-[#19234A]/20"
          >
            + Aggiungi rata
          </button>
        </div>

        <div className="bg-[#121A33] p-4">
          {caricamentoRate ? (
            <p className="text-sm text-[#9AA6C7]">Caricamento…</p>
          ) : rate.length === 0 ? (
            <p className="text-sm text-[#9AA6C7]">
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
                        <p className="font-[family-name:var(--font-sg)] text-2xl font-bold text-[#EEF1FB]">
                          {formattaEuro(pagato)}{" "}
                          <span className="text-sm font-normal text-[#9AA6C7]">
                            di {formattaEuro(totale)}
                          </span>
                        </p>
                        <p className="text-xs text-[#9AA6C7]">
                          {rate.filter((x: any) => x.pagata).length} di {rate.length} rate incassate
                        </p>
                      </div>
                      <span
                        className={`font-[family-name:var(--font-sg)] text-xl font-bold ${
                          percentuale >= 100 ? "text-emerald-300" : "text-[#EEF1FB]"
                        }`}
                      >
                        {percentuale}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#26336A]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percentuale >= 100 ? "bg-emerald-400" : "bg-[#C6F24E]"
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
                      riga.pagata ? "bg-emerald-400/15" : "bg-[#19234A]"
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
                        className="min-w-[9rem] flex-1 border-b border-transparent bg-transparent text-sm font-medium text-[#EEF1FB] hover:border-white/[0.1] focus:border-[#C6F24E]/60 focus:outline-none"
                        defaultValue={riga.tipo}
                        onBlur={(e) => e.target.value !== riga.tipo && modificaCampoRata(riga.id, "tipo", e.target.value)}
                      />
                      <span className="text-xs text-[#9AA6C7]">€</span>
                      <input
                        type="number"
                        className="w-20 border-b border-transparent bg-transparent text-right text-sm font-medium text-[#EEF1FB] hover:border-white/[0.1] focus:border-[#C6F24E]/60 focus:outline-none"
                        defaultValue={riga.importo}
                        onBlur={(e) =>
                          Number(e.target.value) !== Number(riga.importo) &&
                          modificaCampoRata(riga.id, "importo", Number(e.target.value))
                        }
                      />
                      <button
                        onClick={() => rimuoviRata(riga.id)}
                        className="ml-auto shrink-0 text-[#EEF1FB]/30 hover:text-rose-300"
                        title="Elimina rata"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-6 text-xs text-[#9AA6C7]">
                      <label className="flex items-center gap-1">
                        Scadenza
                        <input
                          type="date"
                          className="rounded border border-white/[0.07] bg-[#121A33] px-1.5 py-0.5 text-[#EEF1FB]"
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
                              className="rounded border border-white/[0.07] bg-[#121A33] px-1.5 py-0.5 text-[#EEF1FB]"
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
                              className="rounded border border-white/[0.07] bg-[#121A33] px-1.5 py-0.5 text-[#EEF1FB]"
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
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-6 text-xs text-[#9AA6C7]">
                        <label className="flex items-center gap-1">
                          Ricevuta n.
                          <input
                            type="text"
                            className="w-16 rounded border border-white/[0.07] bg-[#121A33] px-1.5 py-0.5 text-[#EEF1FB]"
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
                            className="w-14 rounded border border-white/[0.07] bg-[#121A33] px-1.5 py-0.5 text-[#EEF1FB]"
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
                            className="w-16 rounded border border-white/[0.07] bg-[#121A33] px-1.5 py-0.5 text-[#EEF1FB]"
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
                            className="rounded border border-white/[0.07] bg-[#121A33] px-1.5 py-0.5 text-[#EEF1FB]"
                            defaultValue={riga.fattura_data ?? ""}
                            onBlur={(e) =>
                              e.target.value !== (riga.fattura_data ?? "") &&
                              modificaCampoRata(riga.id, "fattura_data", e.target.value)
                            }
                          />
                        </label>
                      </div>
                    )}
                    {riga.pagata && (() => {
                      const rc: any = ricevuteIsc.find((x: any) => x.rata_id === riga.id && x.stato === "emessa");
                      const scelta = sceltaPer(riga.id);
                      const classeSelect =
                        "rounded border border-white/[0.1] bg-[#0F1630] px-2 py-1 text-xs text-[#EEF1FB] focus:outline-none";
                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-6 text-xs text-[#9AA6C7]">
                          {rc ? (
                            <>
                              <span className="inline-flex items-center rounded-full bg-emerald-400/15 px-2.5 py-1 font-semibold text-emerald-300">
                                Ricevuta {rc.numero_testo}
                              </span>
                              {rc.pdf_path ? (
                                <button onClick={() => apriPdf(rc.id)} className="font-bold text-[#C6F24E] underline underline-offset-2">
                                  Apri PDF
                                </button>
                              ) : (
                                <button onClick={() => rigeneraPdf(rc.id)} className="font-bold text-amber-300 underline underline-offset-2">
                                  PDF mancante — rigenera
                                </button>
                              )}
                              <span>· WhatsApp: non ancora inviata</span>
                            </>
                          ) : (
                            <>
                              <span>Ricevuta:</span>
                              <select
                                aria-label="Società che incassa"
                                className={classeSelect}
                                value={scelta.societa}
                                onChange={(e) => setSceltaRicevuta((prev) => ({ ...prev, [riga.id]: { ...scelta, societa: e.target.value } }))}
                              >
                                {societaDisponibili.map((so: any) => (
                                  <option key={so.id} value={so.id}>
                                    {so.codice === "kickoff" ? "KICK OFF ACADEMY" : so.ragione_sociale}
                                  </option>
                                ))}
                              </select>
                              <select
                                aria-label="Tipo di documento"
                                className={classeSelect}
                                value={scelta.tipo}
                                onChange={(e) =>
                                  setSceltaRicevuta((prev) => ({ ...prev, [riga.id]: { ...scelta, tipo: e.target.value as "ricevuta" | "conferma" } }))
                                }
                              >
                                <option value="conferma">Conferma di pagamento</option>
                                <option value="ricevuta">Ricevuta di pagamento</option>
                              </select>
                              <button
                                onClick={() => emetti(riga.id)}
                                disabled={emissione === riga.id}
                                className="rounded-full bg-[#C6F24E] px-3.5 py-1 text-xs font-bold text-[#0B1020] hover:bg-[#d4f77c] disabled:opacity-60"
                              >
                                {emissione === riga.id ? "Emetto…" : "Emetti ricevuta"}
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <details className="group rounded-[24px] border border-white/[0.07] bg-[#121A33]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-[#9AA6C7]">
          <span>Altri dati — anagrafica, fatturazione, consensi, informazioni tecniche</span>
          <span className="text-[#6B77A0] transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="grid grid-cols-1 gap-6 border-t border-white/[0.07] px-5 py-5 sm:grid-cols-2">
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
