import { ottieniIscrizionePerStampa } from "../../actions";
import PulsanteStampa from "./PulsanteStampa";

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

function formattaEuro(valore: number | null): string {
  if (valore === null || valore === undefined) return "-";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(valore);
}

function SezioneStampa({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-court pb-1 font-display text-base font-bold uppercase tracking-wide text-court">
        {titolo}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

function RigaStampa({ etichetta, valore }: { etichetta: string; valore: any }) {
  const testo =
    valore === null || valore === undefined || valore === ""
      ? "—"
      : typeof valore === "boolean"
        ? valore
          ? "Sì"
          : "No"
        : String(valore);
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-court/15 py-1">
      <dt className="text-court-dark/60">{etichetta}</dt>
      <dd className="text-right font-medium text-court-dark">{testo}</dd>
    </div>
  );
}

export default async function PaginaStampaIscrizione({ params }: { params: { id: string } }) {
  const r: any = await ottieniIscrizionePerStampa(params.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 text-court-dark">
      <style>{`
        @media print {
          * { color: #000 !important; border-color: #000 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <PulsanteStampa />

      <div className="mb-6 flex items-center justify-between border-b-4 border-navy pb-4">
        <div>
          <img src="/logo-micolani.png" alt="Micolani Tennis" className="h-14 w-auto" />
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold text-court">{r.codice}</p>
          <p className="text-xs text-court-dark/50">Scheda di iscrizione</p>
        </div>
      </div>

      <SezioneStampa titolo="Allievo">
        <RigaStampa etichetta="Nome" valore={`${r.atleta_nome} ${r.atleta_cognome}`} />
        <RigaStampa etichetta="Codice fiscale" valore={r.atleta_codice_fiscale} />
        <RigaStampa etichetta="Data di nascita" valore={formattaData(r.atleta_data_nascita)} />
        <RigaStampa etichetta="Luogo di nascita" valore={r.atleta_luogo_nascita} />
        <RigaStampa etichetta="Sesso" valore={r.atleta_sesso} />
        <RigaStampa etichetta="Cittadinanza" valore={r.atleta_cittadinanza} />
        <RigaStampa
          etichetta="Residenza"
          valore={[r.atleta_indirizzo, r.atleta_comune, r.atleta_provincia, r.atleta_cap].filter(Boolean).join(", ")}
        />
        <RigaStampa etichetta="Telefono" valore={r.atleta_telefono} />
        <RigaStampa etichetta="Email" valore={r.atleta_email} />
        <RigaStampa etichetta="Minorenne" valore={r.minorenne} />
        <RigaStampa etichetta="Preferenze giorni" valore={r.preferenze_giorni} />
        <RigaStampa etichetta="Preferenze orari" valore={r.preferenze_orari} />
        <RigaStampa etichetta="Esigenze particolari" valore={r.note_esigenze} />
      </SezioneStampa>

      {r.minorenne && (
        <SezioneStampa titolo="Genitore / tutore">
          <RigaStampa etichetta="Nome" valore={`${r.genitore_nome ?? ""} ${r.genitore_cognome ?? ""}`} />
          <RigaStampa etichetta="Rapporto" valore={r.genitore_rapporto} />
          <RigaStampa etichetta="Codice fiscale" valore={r.genitore_codice_fiscale} />
          <RigaStampa etichetta="Data di nascita" valore={formattaData(r.genitore_data_nascita)} />
          <RigaStampa etichetta="Luogo di nascita" valore={r.genitore_luogo_nascita} />
          <RigaStampa
            etichetta="Residenza"
            valore={[r.genitore_indirizzo, r.genitore_comune, r.genitore_provincia, r.genitore_cap].filter(Boolean).join(", ")}
          />
          <RigaStampa etichetta="Telefono" valore={r.genitore_telefono} />
          <RigaStampa etichetta="WhatsApp" valore={r.genitore_whatsapp} />
          <RigaStampa etichetta="Email" valore={r.genitore_email} />
          <RigaStampa etichetta="Secondo referente" valore={r.secondo_recapito_nome} />
          <RigaStampa etichetta="Tel. secondo referente" valore={r.secondo_recapito_telefono} />
          <RigaStampa etichetta="Contatto emergenza" valore={r.emergenza_nome} />
          <RigaStampa etichetta="Tel. emergenza" valore={r.emergenza_telefono} />
          <RigaStampa etichetta="Autorizzati al ritiro" valore={r.persone_autorizzate_ritiro} />
        </SezioneStampa>
      )}

      <SezioneStampa titolo="Corso e prezzo">
        <RigaStampa etichetta="Corso" valore={r.corsi?.nome} />
        <RigaStampa etichetta="Fascia età" valore={r.corsi?.fascia_eta} />
        <RigaStampa etichetta="Frequenza settimanale" valore={`${r.frequenza_settimanale}x/sett.`} />
        <RigaStampa etichetta="Numero rate" valore={r.numero_rate} />
        <RigaStampa etichetta="Importo per rata" valore={formattaEuro(r.importo_rata)} />
        <RigaStampa etichetta="Quota iscrizione" valore={formattaEuro(r.quota_iscrizione)} />
        <RigaStampa etichetta="Prezzo totale" valore={formattaEuro(r.prezzo_totale)} />
        <RigaStampa etichetta="Taglia kit" valore={r.taglia_kit} />
      </SezioneStampa>

      <SezioneStampa titolo="Fatturazione">
        <RigaStampa etichetta="Uguale al genitore/allievo" valore={r.fatturazione_uguale_genitore} />
        <RigaStampa etichetta="Intestatario" valore={r.fatturazione_intestatario} />
        <RigaStampa etichetta="Codice fiscale" valore={r.fatturazione_codice_fiscale} />
        <RigaStampa etichetta="Partita IVA" valore={r.fatturazione_partita_iva} />
        <RigaStampa
          etichetta="Indirizzo"
          valore={[r.fatturazione_indirizzo, r.fatturazione_comune, r.fatturazione_provincia, r.fatturazione_cap].filter(Boolean).join(", ")}
        />
        <RigaStampa etichetta="Email" valore={r.fatturazione_email} />
        <RigaStampa etichetta="PEC" valore={r.fatturazione_pec} />
        <RigaStampa etichetta="Codice SDI" valore={r.fatturazione_sdi} />
        <RigaStampa etichetta="Soggetto pagante" valore={r.fatturazione_soggetto_pagante} />
        <RigaStampa etichetta="Metodo di pagamento" valore={r.fatturazione_metodo_pagamento} />
        <RigaStampa etichetta="Richiede documento fiscale" valore={r.fatturazione_richiesta_documento} />
      </SezioneStampa>

      <SezioneStampa titolo="Consensi">
        <RigaStampa etichetta="Dati corretti" valore={r.consenso_dati_corretti} />
        <RigaStampa etichetta="Regolamento" valore={r.consenso_regolamento} />
        <RigaStampa etichetta="Privacy" valore={r.consenso_privacy} />
        <RigaStampa etichetta="Autorizzazione" valore={r.consenso_autorizzazione} />
        <RigaStampa etichetta="Promozionale" valore={r.consenso_promozionale} />
        <RigaStampa etichetta="Foto/video" valore={r.consenso_foto_video} />
        <RigaStampa etichetta="Gruppi WhatsApp" valore={r.consenso_whatsapp_gruppi} />
        <RigaStampa etichetta="Versione informativa" valore={r.versione_informativa} />
      </SezioneStampa>

      <SezioneStampa titolo="Stato pratica">
        <RigaStampa etichetta="Inviata il" valore={formattaOra(r.created_at)} />
        <RigaStampa etichetta="Confermata" valore={r.confermata} />
        <RigaStampa etichetta="Confermata il" valore={formattaOra(r.confermata_il)} />
      </SezioneStampa>

      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-8 border-b border-court-dark/40 pt-8">&nbsp;</p>
          <p className="text-xs text-court-dark/50">Firma del genitore/tutore o dell'allievo maggiorenne</p>
        </div>
        <div>
          <p className="mb-8 border-b border-court-dark/40 pt-8">&nbsp;</p>
          <p className="text-xs text-court-dark/50">Verificato dalla segreteria — data e firma</p>
        </div>
      </div>
    </main>
  );
}
