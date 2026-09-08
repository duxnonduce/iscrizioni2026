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
          <div className="flex items-center gap-3">
            <img src="/logo-micolani.png" alt="Micolani Tennis" className="h-10 w-auto" />
            <div>
              <h1 className="font-display text-2xl font-bold text-court-dark">
                Area segreteria
              </h1>
            </div>
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

          <p className="mt-2 text-xs text-court-dark/50">
            Clicca su una riga per vedere tutti i dati raccolti.
          </p>

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
                  <>
                    <tr
                      key={i.id}
                      onClick={() => setEspansa(espansa === i.id ? null : i.id)}
                      className="cursor-pointer border-b border-court/5 hover:bg-chalk"
                    >
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
                    {espansa === i.id && (
                      <tr>
                        <td colSpan={6} className="bg-chalk px-3 py-4">
                          <DettaglioIscrizione i={i} />
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

function DettaglioIscrizione({ i }: { i: Iscrizione }) {
  const r = i as any;
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Sezione titolo="Allievo">
        <Riga etichetta="Nome" valore={`${r.atleta_nome} ${r.atleta_cognome}`} />
        <Riga etichetta="Codice fiscale" valore={r.atleta_codice_fiscale} />
        <Riga etichetta="Data di nascita" valore={formattaData(r.atleta_data_nascita)} />
        <Riga etichetta="Luogo di nascita" valore={r.atleta_luogo_nascita} />
        <Riga etichetta="Sesso" valore={r.atleta_sesso} />
        <Riga etichetta="Cittadinanza" valore={r.atleta_cittadinanza} />
        <Riga
          etichetta="Residenza"
          valore={[r.atleta_indirizzo, r.atleta_comune, r.atleta_provincia, r.atleta_cap]
            .filter(Boolean)
            .join(", ")}
        />
        <Riga etichetta="Telefono" valore={r.atleta_telefono} />
        <Riga etichetta="Email" valore={r.atleta_email} />
        <Riga etichetta="Preferenze giorni" valore={r.preferenze_giorni} />
        <Riga etichetta="Preferenze orari" valore={r.preferenze_orari} />
        <Riga etichetta="Esigenze" valore={r.note_esigenze} />
      </Sezione>

      {r.minorenne && (
        <Sezione titolo="Genitore/tutore">
          <Riga etichetta="Nome" valore={`${r.genitore_nome ?? ""} ${r.genitore_cognome ?? ""}`} />
          <Riga etichetta="Rapporto" valore={r.genitore_rapporto} />
          <Riga etichetta="Codice fiscale" valore={r.genitore_codice_fiscale} />
          <Riga etichetta="Data di nascita" valore={formattaData(r.genitore_data_nascita)} />
          <Riga etichetta="Luogo di nascita" valore={r.genitore_luogo_nascita} />
          <Riga
            etichetta="Residenza"
            valore={[r.genitore_indirizzo, r.genitore_comune, r.genitore_provincia, r.genitore_cap]
              .filter(Boolean)
              .join(", ")}
          />
          <Riga etichetta="Telefono" valore={r.genitore_telefono} />
          <Riga etichetta="WhatsApp" valore={r.genitore_whatsapp} />
          <Riga etichetta="Email" valore={r.genitore_email} />
          <Riga etichetta="Secondo referente" valore={r.secondo_recapito_nome} />
          <Riga etichetta="Tel. secondo referente" valore={r.secondo_recapito_telefono} />
          <Riga etichetta="Contatto emergenza" valore={r.emergenza_nome} />
          <Riga etichetta="Tel. emergenza" valore={r.emergenza_telefono} />
          <Riga etichetta="Autorizzati al ritiro" valore={r.persone_autorizzate_ritiro} />
        </Sezione>
      )}

      <Sezione titolo="Fatturazione">
        <Riga
          etichetta="Uguale al genitore/allievo"
          valore={r.fatturazione_uguale_genitore}
        />
        {!r.fatturazione_uguale_genitore && (
          <>
            <Riga etichetta="Intestatario" valore={r.fatturazione_intestatario} />
            <Riga etichetta="Codice fiscale" valore={r.fatturazione_codice_fiscale} />
            <Riga etichetta="Partita IVA" valore={r.fatturazione_partita_iva} />
            <Riga
              etichetta="Indirizzo"
              valore={[r.fatturazione_indirizzo, r.fatturazione_comune, r.fatturazione_provincia, r.fatturazione_cap]
                .filter(Boolean)
                .join(", ")}
            />
            <Riga etichetta="Email" valore={r.fatturazione_email} />
            <Riga etichetta="PEC" valore={r.fatturazione_pec} />
            <Riga etichetta="Codice SDI" valore={r.fatturazione_sdi} />
            <Riga etichetta="Soggetto pagante" valore={r.fatturazione_soggetto_pagante} />
          </>
        )}
        <Riga etichetta="Metodo di pagamento" valore={r.fatturazione_metodo_pagamento} />
        <Riga etichetta="Richiede documento fiscale" valore={r.fatturazione_richiesta_documento} />
      </Sezione>

      <Sezione titolo="Consensi">
        <Riga etichetta="Dati corretti" valore={r.consenso_dati_corretti} />
        <Riga etichetta="Regolamento" valore={r.consenso_regolamento} />
        <Riga etichetta="Privacy" valore={r.consenso_privacy} />
        <Riga etichetta="Autorizzazione" valore={r.consenso_autorizzazione} />
        <Riga etichetta="Promozionale" valore={r.consenso_promozionale} />
        <Riga etichetta="Foto/video" valore={r.consenso_foto_video} />
        <Riga etichetta="Gruppi WhatsApp" valore={r.consenso_whatsapp_gruppi} />
        <Riga etichetta="Versione informativa" valore={r.versione_informativa} />
      </Sezione>

      <Sezione titolo="Dati tecnici">
        <Riga etichetta="Inviata il" valore={formattaOra(r.created_at)} />
        <Riga etichetta="Indirizzo IP" valore={r.ip_address} />
        <Riga etichetta="Dispositivo/browser" valore={r.user_agent} />
      </Sezione>
    </div>
  );
}
