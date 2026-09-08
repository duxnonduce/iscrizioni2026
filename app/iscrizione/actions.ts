"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generaCodiceGrezzo } from "@/lib/codeGenerator";

const VERSIONE_INFORMATIVA = "1.0 - settembre 2026";

export async function getDatiIniziali() {
  const supabase = createAdminClient();

  const { data: corsi, error: erroreCorsi } = await supabase
    .from("corsi")
    .select("id, codice, nome, fascia_eta, durata_lezione, listini(id, frequenza_settimanale, numero_rate, importo_rata)")
    .eq("attivo", true)
    .order("ordine", { ascending: true });

  const { data: impostazioni, error: erroreImpostazioni } = await supabase
    .from("impostazioni")
    .select(
      "stagione_etichetta, whatsapp_numero, quota_iscrizione, inizio_corsi, fine_corsi, rata1_scadenza, rata2_scadenza, rata3_scadenza"
    )
    .eq("id", 1)
    .single();

  if (erroreCorsi || erroreImpostazioni) {
    throw new Error("Impossibile caricare i dati iniziali del modulo.");
  }

  return { corsi: corsi ?? [], impostazioni };
}

export type DatiAnagrafica = {
  // Allievo
  atletaNome: string;
  atletaCognome: string;
  atletaCodiceFiscale: string;
  atletaDataNascita: string;
  atletaLuogoNascita: string;
  atletaSesso: string;
  atletaCittadinanza: string;
  atletaIndirizzo: string;
  atletaComune: string;
  atletaProvincia: string;
  atletaCap: string;
  atletaTelefono: string;
  atletaEmail: string;
  minorenne: boolean;
  preferenzeGiorni: string;
  preferenzeOrari: string;
  noteEsigenze: string;

  // Genitore/tutore
  genitoreNome?: string;
  genitoreCognome?: string;
  genitoreCodiceFiscale?: string;
  genitoreDataNascita?: string;
  genitoreLuogoNascita?: string;
  genitoreIndirizzo?: string;
  genitoreComune?: string;
  genitoreProvincia?: string;
  genitoreCap?: string;
  genitoreTelefono?: string;
  genitoreWhatsapp?: string;
  genitoreEmail?: string;
  genitoreRapporto?: string;
  secondoRecapitoNome?: string;
  secondoRecapitoTelefono?: string;
  emergenzaNome?: string;
  emergenzaTelefono?: string;
  personeAutorizzateRitiro?: string;

  // Corso
  listinoId?: string;
  corsoCodice: string;
  frequenzaSettimanale: number;
  numeroRate: number;

  // Fatturazione
  fatturazioneUgualeGenitore: boolean;
  fatturazioneIntestatario?: string;
  fatturazioneCodiceFiscale?: string;
  fatturazionePartitaIva?: string;
  fatturazioneIndirizzo?: string;
  fatturazioneComune?: string;
  fatturazioneProvincia?: string;
  fatturazioneCap?: string;
  fatturazioneEmail?: string;
  fatturazionePec?: string;
  fatturazioneSdi?: string;
  fatturazioneSoggettoPagante?: string;
  fatturazioneMetodoPagamento?: string;
  fatturazioneRichiestaDocumento: boolean;

  // Consensi
  consensoDatiCorretti: boolean;
  consensoRegolamento: boolean;
  consensoPrivacy: boolean;
  consensoAutorizzazione: boolean;
  consensoPromozionale: boolean;
  consensoFotoVideo: boolean;
  consensoWhatsappGruppi: boolean;
};

export async function inviaIscrizione(dati: DatiAnagrafica) {
  const supabase = createAdminClient();
  const intestazioni = headers();

  const { data: corso, error: erroreCorso } = await supabase
    .from("corsi")
    .select("id")
    .eq("codice", dati.corsoCodice)
    .single();

  if (!corso) {
    console.error("Errore recupero corso:", erroreCorso);
    return {
      ok: false as const,
      errore: `Corso non trovato (codice: ${dati.corsoCodice}). ${erroreCorso?.message ?? ""}`,
    };
  }

  const { data: listino, error: erroreListino } = await supabase
    .from("listini")
    .select("id, corso_id, frequenza_settimanale, numero_rate, importo_rata")
    .eq("corso_id", corso.id)
    .eq("frequenza_settimanale", dati.frequenzaSettimanale)
    .eq("numero_rate", dati.numeroRate)
    .single();

  const { data: impostazioni, error: erroreImpostazioni } = await supabase
    .from("impostazioni")
    .select("stagione_etichetta, whatsapp_numero, quota_iscrizione")
    .eq("id", 1)
    .single();

  if (!listino || !impostazioni) {
    console.error("Errore recupero listino:", erroreListino);
    console.error("Errore recupero impostazioni:", erroreImpostazioni);
    const dettaglio = erroreListino?.message || erroreImpostazioni?.message || "motivo sconosciuto";
    return {
      ok: false as const,
      errore: `Listino non trovato (${dettaglio}). corso: ${dati.corsoCodice}, frequenza: ${dati.frequenzaSettimanale}, rate: ${dati.numeroRate}`,
    };
  }

  if (
    !dati.consensoDatiCorretti ||
    !dati.consensoRegolamento ||
    !dati.consensoPrivacy ||
    !dati.consensoAutorizzazione
  ) {
    return { ok: false as const, errore: "Mancano uno o più consensi obbligatori." };
  }

  const prezzoTotale =
    listino.importo_rata * listino.numero_rate + impostazioni.quota_iscrizione;

  const ip =
    intestazioni.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    intestazioni.get("x-real-ip") ||
    null;
  const userAgent = intestazioni.get("user-agent") || null;

  let codice = "";
  let inserito = null;
  let ultimoErrore = null;

  for (let tentativo = 0; tentativo < 5; tentativo++) {
    codice = generaCodiceGrezzo(impostazioni.stagione_etichetta);

    const { data, error } = await supabase
      .from("iscrizioni")
      .insert({
        codice,

        atleta_nome: dati.atletaNome,
        atleta_cognome: dati.atletaCognome,
        atleta_codice_fiscale: dati.atletaCodiceFiscale || null,
        atleta_data_nascita: dati.atletaDataNascita,
        atleta_luogo_nascita: dati.atletaLuogoNascita || null,
        atleta_sesso: dati.atletaSesso || null,
        atleta_cittadinanza: dati.atletaCittadinanza || null,
        atleta_indirizzo: dati.atletaIndirizzo || null,
        atleta_comune: dati.atletaComune || null,
        atleta_provincia: dati.atletaProvincia || null,
        atleta_cap: dati.atletaCap || null,
        atleta_telefono: dati.atletaTelefono || null,
        atleta_email: dati.atletaEmail || null,
        minorenne: dati.minorenne,
        preferenze_giorni: dati.preferenzeGiorni || null,
        preferenze_orari: dati.preferenzeOrari || null,
        note_esigenze: dati.noteEsigenze || null,

        genitore_nome: dati.genitoreNome || null,
        genitore_cognome: dati.genitoreCognome || null,
        genitore_codice_fiscale: dati.genitoreCodiceFiscale || null,
        genitore_data_nascita: dati.genitoreDataNascita || null,
        genitore_luogo_nascita: dati.genitoreLuogoNascita || null,
        genitore_indirizzo: dati.genitoreIndirizzo || null,
        genitore_comune: dati.genitoreComune || null,
        genitore_provincia: dati.genitoreProvincia || null,
        genitore_cap: dati.genitoreCap || null,
        genitore_telefono: dati.genitoreTelefono || null,
        genitore_whatsapp: dati.genitoreWhatsapp || null,
        genitore_email: dati.genitoreEmail || null,
        genitore_rapporto: dati.genitoreRapporto || null,
        secondo_recapito_nome: dati.secondoRecapitoNome || null,
        secondo_recapito_telefono: dati.secondoRecapitoTelefono || null,
        emergenza_nome: dati.emergenzaNome || null,
        emergenza_telefono: dati.emergenzaTelefono || null,
        persone_autorizzate_ritiro: dati.personeAutorizzateRitiro || null,

        corso_id: listino.corso_id,
        listino_id: listino.id,
        frequenza_settimanale: listino.frequenza_settimanale,
        numero_rate: listino.numero_rate,
        importo_rata: listino.importo_rata,
        quota_iscrizione: impostazioni.quota_iscrizione,
        prezzo_totale: prezzoTotale,

        fatturazione_uguale_genitore: dati.fatturazioneUgualeGenitore,
        fatturazione_intestatario: dati.fatturazioneIntestatario || null,
        fatturazione_codice_fiscale: dati.fatturazioneCodiceFiscale || null,
        fatturazione_partita_iva: dati.fatturazionePartitaIva || null,
        fatturazione_indirizzo: dati.fatturazioneIndirizzo || null,
        fatturazione_comune: dati.fatturazioneComune || null,
        fatturazione_provincia: dati.fatturazioneProvincia || null,
        fatturazione_cap: dati.fatturazioneCap || null,
        fatturazione_email: dati.fatturazioneEmail || null,
        fatturazione_pec: dati.fatturazionePec || null,
        fatturazione_sdi: dati.fatturazioneSdi || null,
        fatturazione_soggetto_pagante: dati.fatturazioneSoggettoPagante || null,
        fatturazione_metodo_pagamento: dati.fatturazioneMetodoPagamento || null,
        fatturazione_richiesta_documento: dati.fatturazioneRichiestaDocumento,

        consenso_dati_corretti: dati.consensoDatiCorretti,
        consenso_regolamento: dati.consensoRegolamento,
        consenso_privacy: dati.consensoPrivacy,
        consenso_autorizzazione: dati.consensoAutorizzazione,
        consenso_promozionale: dati.consensoPromozionale,
        consenso_foto_video: dati.consensoFotoVideo,
        consenso_whatsapp_gruppi: dati.consensoWhatsappGruppi,
        versione_informativa: VERSIONE_INFORMATIVA,

        ip_address: ip,
        user_agent: userAgent,
      })
      .select("id, codice")
      .single();

    if (!error) {
      inserito = data;
      break;
    }

    if (error.code !== "23505") {
      ultimoErrore = error;
      break;
    }
  }

  if (!inserito) {
    return {
      ok: false as const,
      errore: ultimoErrore?.message || "Impossibile generare un codice univoco, riprova.",
    };
  }

  const contattoPrincipale = dati.minorenne ? dati.genitoreTelefono : dati.atletaTelefono;

  const testoMessaggio = encodeURIComponent(
    `Buongiorno, ho completato l'anagrafica per l'iscrizione a Micolani Tennis. Allievo: ${dati.atletaNome} ${dati.atletaCognome}. Il mio codice di riferimento è ${inserito.codice}. Desidero confermare la richiesta d'iscrizione. Invierò a breve anche il certificato medico (se disponibile) ed eventuali altri documenti richiesti.`
  );

  const numeroWhatsapp = impostazioni.whatsapp_numero.replace(/\D/g, "");
  const linkWhatsapp = `https://wa.me/${numeroWhatsapp}?text=${testoMessaggio}`;

  return {
    ok: true as const,
    codice: inserito.codice,
    prezzoTotale,
    importoRata: listino.importo_rata,
    numeroRate: listino.numero_rate,
    quotaIscrizione: impostazioni.quota_iscrizione,
    linkWhatsapp,
    contattoPrincipale,
  };
}
