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

function StatCard({
  etichetta,
  valore,
  tono = "default",
}: {
  etichetta: string;
  valore: string | number;
  tono?: "default" | "verde" | "ambra";
}) {
  const coloreValore =
    tono === "verde" ? "text-emerald-600" : tono === "ambra" ? "text-amber-600" : "text-court-dark";
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-court/10">
      <p className="text-xs font-medium uppercase tracking-wide text-court-dark/40">{etichetta}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${coloreValore}`}>{valore}</p>
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

  async function caricaTutto(termine = "") {
    setCaricamento(true);
    const [risultatiIscrizioni, risultatiCorsi, quota, conteggioTaglie] = await Promise.all([
      cercaIscrizioni(termine),
      elencaCorsiConListini(),
      ottieniQuotaIscrizione(),
      riepilogoTaglie(),
    ]);
    setIscrizioni(risultatiIscrizioni);
    setCorsi(risultatiCorsi);
    setQuotaIscrizione(quota);
    setTaglie(conteggioTaglie);
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

  const confermateCount = iscrizioni.filter((i) => (i as any).confermata).length;
  const daConfermareCount = iscrizioni.length - confermateCount;
  const incassoTotale = iscrizioni.reduce((tot, i) => tot + Number(i.prezzo_totale || 0), 0);

  return (
    <main className="min-h-screen bg-chalk pb-16">
      <div className="bg-navy px-5 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-micolani.png" alt="Micolani Tennis" className="h-9 w-auto" />
            <span className="font-display text-lg font-semibold text-white">Area segreteria</span>
          </div>
          <button
            onClick={esci}
            className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            Esci
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5">
        <div className="-mt-6 mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard etichetta="Iscrizioni" valore={iscrizioni.length} />
          <StatCard etichetta="Confermate" valore={confermateCount} tono="verde" />
          <StatCard etichetta="Da confermare" valore={daConfermareCount} tono="ambra" />
          <StatCard
            etichetta="Da stampare"
            valore={iscrizioni.filter((i) => !(i as any).stampata).length}
            tono="ambra"
          />
          <StatCard etichetta="Incasso atteso" valore={formattaEuro(incassoTotale)} />
        </div>

        <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-court/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-court-dark">
                Quota d'iscrizione
              </h2>
              <p className="text-xs text-court-dark/50">
                Kit abbigliamento e tessera FITP — si aggiunge a ogni corso
              </p>
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
                className="rounded-full bg-court px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-court-dark disabled:opacity-60"
              >
                {salvataggio === "quota" ? "Salvo…" : "Salva"}
              </button>
            </div>
          </div>

          <details className="group mt-6 border-t border-court/10 pt-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold text-court-dark">
              Listino corsi
              <span className="text-sm font-normal text-court-dark/40 transition-transform group-open:rotate-180">
                ⌄
              </span>
            </summary>
            <div className="mt-4 divide-y divide-court/5">
              {corsi.map((corso) => (
                <div key={corso.id} className="py-4 first:pt-0">
                  <h3 className="mb-3 text-sm font-semibold text-court-dark">{corso.nome}</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {corso.listini.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-chalk px-3 py-2"
                      >
                        <span className="text-sm text-court-dark/70">
                          {l.frequenza_settimanale}x/sett. —{" "}
                          {l.numero_rate === 1 ? "unico" : `${l.numero_rate} rate`}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-court-dark/40">€</span>
                          <input
                            className="w-16 rounded-md border border-court/20 bg-white px-1.5 py-1 text-right text-sm"
                            defaultValue={l.importo_rata}
                            onChange={(e) =>
                              setImportiModificati((p) => ({ ...p, [l.id]: e.target.value }))
                            }
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
          </details>
        </section>

        <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-court/10">
          <h2 className="font-display text-lg font-semibold text-court-dark">
            Riepilogo taglie kit
          </h2>
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
                <p className="font-display text-xl font-bold text-amber-700">
                  {taglie["Non indicata"]}
                </p>
                <p className="text-xs text-amber-700/70">Non indicata</p>
              </div>
            )}
            {Object.keys(taglie).length === 0 && (
              <p className="col-span-full text-sm text-court-dark/40">Nessun dato ancora.</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-court/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-court-dark">
                Anagrafiche ricevute
              </h2>
              <p className="text-xs text-court-dark/50">Clicca su una riga per il dettaglio</p>
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

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-court-dark/40">
                  <th className="pb-3 pr-3 font-medium">Atleta</th>
                  <th className="pb-3 pr-3 font-medium">Codice</th>
                  <th className="pb-3 pr-3 font-medium">Contatto</th>
                  <th className="pb-3 pr-3 font-medium">Corso</th>
                  <th className="pb-3 pr-3 font-medium">Totale</th>
                  <th className="pb-3 pr-3 font-medium">Stato</th>
                  <th className="pb-3 pr-3 font-medium">Stampa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-court/5">
                {caricamento && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-court-dark/40">
                      Caricamento…
                    </td>
                  </tr>
                )}
                {!caricamento && iscrizioni.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-court-dark/40">
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
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ace text-xs font-semibold text-court-dark">
                            {iniziali(i.atleta_nome, i.atleta_cognome)}
                          </span>
                          <div>
                            <p className="font-medium text-court-dark">
                              {i.atleta_nome} {i.atleta_cognome}
                            </p>
                            {i.minorenne && (
                              <p className="text-xs text-court-dark/40">minorenne</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-medium text-court">{i.codice}</td>
                      <td className="py-3 pr-3 text-court-dark/70">
                        {i.minorenne ? i.genitore_telefono : i.atleta_telefono}
                      </td>
                      <td className="py-3 pr-3 text-court-dark/70">
                        {(i as any).corsi?.nome ?? "-"}
                        <span className="text-court-dark/40"> · {i.frequenza_settimanale}x/sett.</span>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-court-dark">{formattaEuro(i.prezzo_totale)}</p>
                        {i.numero_rate > 1 && (
                          <p className="text-xs text-court-dark/40">
                            {i.numero_rate}×{formattaEuro(i.importo_rata)} + quota
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
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
                      <td className="py-3 pr-3">
                        {(i as any).stampata ? (
                          <span className="text-lg" title="Già stampata">🖨️✅</span>
                        ) : (
                          <span className="text-xs text-court-dark/30">—</span>
                        )}
                      </td>
                    </tr>
                    {espansa === i.id && (
                      <tr>
                        <td colSpan={7} className="rounded-2xl bg-chalk px-4 py-5">
                          <DettaglioIscrizione i={i} onCambiato={() => caricaTutto(ricerca)} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
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

function DettaglioIscrizione({ i, onCambiato }: { i: Iscrizione; onCambiato: () => void }) {
  const r = i as any;
  const [modificaAttiva, setModificaAttiva] = useState(false);
  const [bozza, setBozza] = useState<Record<string, any>>({});
  const [azioneInCorso, setAzioneInCorso] = useState(false);

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

  async function stampa() {
    window.open(`/admin/stampa/${r.id}`, "_blank");
    await segnaStampata(r.id);
    onCambiato();
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
