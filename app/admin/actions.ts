"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { generaPdfRicevuta } from "@/lib/ricevuta/pdf";

async function verificaSessione(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Sessione non valida.");
  }
  return session.user?.email ?? null;
}

export async function cercaIscrizioni(ricerca: string) {
  await verificaSessione();
  const supabase = createAdminClient();

  let query = supabase
    .from("iscrizioni")
    .select("*, corsi(nome)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (ricerca.trim()) {
    const termine = ricerca.trim();
    query = query.or(
      `codice.ilike.%${termine}%,atleta_nome.ilike.%${termine}%,atleta_cognome.ilike.%${termine}%,atleta_telefono.ilike.%${termine}%,genitore_telefono.ilike.%${termine}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function elencaCorsiConListini() {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("corsi")
    .select("id, nome, ordine, listini(id, frequenza_settimanale, numero_rate, importo_rata)")
    .order("ordine", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    ...c,
    listini: [...c.listini].sort(
      (a, b) => a.frequenza_settimanale - b.frequenza_settimanale || a.numero_rate - b.numero_rate
    ),
  }));
}

export async function aggiornaImportoRata(listinoId: string, nuovoImporto: number) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("listini")
    .update({ importo_rata: nuovoImporto })
    .eq("id", listinoId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function ottieniQuotaIscrizione() {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("impostazioni")
    .select("quota_iscrizione")
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return data?.quota_iscrizione ?? 0;
}

export async function aggiornaQuotaIscrizione(nuovaQuota: number) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("impostazioni")
    .update({ quota_iscrizione: nuovaQuota })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function confermaIscrizione(id: string, confermata: boolean) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("iscrizioni")
    .update({ confermata, confermata_il: confermata ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function eliminaIscrizione(id: string) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase.from("iscrizioni").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

// Campi che la segreteria può modificare manualmente dal pannello.
// Volutamente esclusi: id, codice, created_at, ip_address, user_agent,
// versione_informativa — sono dati di identificazione o audit tecnico.
const CAMPI_MODIFICABILI = new Set([
  "atleta_nome", "atleta_cognome", "atleta_codice_fiscale", "atleta_data_nascita",
  "atleta_luogo_nascita", "atleta_sesso", "atleta_cittadinanza", "atleta_indirizzo",
  "atleta_comune", "atleta_provincia", "atleta_cap", "atleta_telefono", "atleta_email",
  "minorenne", "preferenze_giorni", "preferenze_orari", "note_esigenze",
  "genitore_nome", "genitore_cognome", "genitore_codice_fiscale", "genitore_data_nascita",
  "genitore_luogo_nascita", "genitore_indirizzo", "genitore_comune", "genitore_provincia",
  "genitore_cap", "genitore_telefono", "genitore_whatsapp", "genitore_email",
  "genitore_rapporto", "secondo_recapito_nome", "secondo_recapito_telefono",
  "emergenza_nome", "emergenza_telefono", "persone_autorizzate_ritiro",
  "frequenza_settimanale", "numero_rate", "importo_rata", "quota_iscrizione", "prezzo_totale",
  "taglia_kit",
  "fatturazione_uguale_genitore", "fatturazione_intestatario", "fatturazione_codice_fiscale",
  "fatturazione_partita_iva", "fatturazione_indirizzo", "fatturazione_comune",
  "fatturazione_provincia", "fatturazione_cap", "fatturazione_email", "fatturazione_pec",
  "fatturazione_sdi", "fatturazione_soggetto_pagante", "fatturazione_metodo_pagamento",
  "fatturazione_richiesta_documento",
  "consenso_dati_corretti", "consenso_regolamento", "consenso_privacy",
  "consenso_autorizzazione", "consenso_promozionale", "consenso_foto_video",
  "consenso_whatsapp_gruppi",
  "certificato_tipo", "certificato_scadenza",
  "tesseramento_numero", "tesseramento_tipo", "tesseramento_data", "tesseramento_scadenza",
  "tesseramento_societa",
]);

export async function aggiornaIscrizione(id: string, campi: Record<string, unknown>) {
  await verificaSessione();
  const supabase = createAdminClient();

  const aggiornamento: Record<string, unknown> = {};
  for (const [chiave, valore] of Object.entries(campi)) {
    if (CAMPI_MODIFICABILI.has(chiave)) {
      aggiornamento[chiave] = valore === "" ? null : valore;
    }
  }
  if (Object.keys(aggiornamento).length === 0) return;

  const { error } = await supabase.from("iscrizioni").update(aggiornamento).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function riepilogoTaglie() {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("iscrizioni").select("taglia_kit");
  if (error) throw new Error(error.message);

  const conteggio: Record<string, number> = {};
  for (const riga of data ?? []) {
    const taglia = riga.taglia_kit || "Non indicata";
    conteggio[taglia] = (conteggio[taglia] ?? 0) + 1;
  }
  return conteggio;
}

export async function segnaStampata(id: string) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("iscrizioni")
    .update({ stampata: true, stampata_il: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function annullaStampata(id: string) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("iscrizioni")
    .update({ stampata: false, stampata_il: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function ottieniIscrizionePerStampa(id: string) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("iscrizioni")
    .select("*, corsi(nome, fascia_eta, durata_lezione)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function ottieniRatePagamento(iscrizioneId: string) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rate_pagamento")
    .select("*")
    .eq("iscrizione_id", iscrizioneId)
    .order("ordine", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function segnaRataPagamento(rataId: string, pagata: boolean) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rate_pagamento")
    .update({ pagata, data_pagamento: pagata ? new Date().toISOString().split("T")[0] : null })
    .eq("id", rataId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function aggiornaRata(
  rataId: string,
  campi: {
    tipo?: string;
    importo?: number;
    scadenza?: string | null;
    data_pagamento?: string | null;
    metodo_pagamento?: string | null;
    ricevuta_numero?: string | null;
    ricevuta_blocco?: string | null;
    fattura_numero?: string | null;
    fattura_data?: string | null;
  }
) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase.from("rate_pagamento").update(campi).eq("id", rataId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function aggiungiRata(
  iscrizioneId: string,
  dati: { tipo: string; importo: number; scadenza: string | null }
) {
  await verificaSessione();
  const supabase = createAdminClient();

  const { data: esistenti } = await supabase
    .from("rate_pagamento")
    .select("ordine")
    .eq("iscrizione_id", iscrizioneId)
    .order("ordine", { ascending: false })
    .limit(1);

  const prossimoOrdine = (esistenti?.[0]?.ordine ?? -1) + 1;

  const { error } = await supabase.from("rate_pagamento").insert({
    iscrizione_id: iscrizioneId,
    tipo: dati.tipo,
    importo: dati.importo,
    scadenza: dati.scadenza,
    ordine: prossimoOrdine,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function eliminaRata(rataId: string) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { error } = await supabase.from("rate_pagamento").delete().eq("id", rataId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function mappaPagamentiPerIscrizione() {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rate_pagamento")
    .select("iscrizione_id, importo, pagata, scadenza");
  if (error) throw new Error(error.message);

  const oggi = new Date().toISOString().split("T")[0];
  const mappa: Record<string, { totale: number; pagato: number; scaduto: boolean; numeroRate: number; numeroPagate: number }> = {};

  for (const riga of data ?? []) {
    if (!mappa[riga.iscrizione_id]) {
      mappa[riga.iscrizione_id] = { totale: 0, pagato: 0, scaduto: false, numeroRate: 0, numeroPagate: 0 };
    }
    const voce = mappa[riga.iscrizione_id];
    voce.totale += Number(riga.importo);
    voce.numeroRate += 1;
    if (riga.pagata) {
      voce.pagato += Number(riga.importo);
      voce.numeroPagate += 1;
    } else if (riga.scadenza && riga.scadenza < oggi) {
      voce.scaduto = true;
    }
  }

  return mappa;
}

export async function riepilogoPagamenti() {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("rate_pagamento").select("importo, pagata, scadenza");
  if (error) throw new Error(error.message);

  const oggi = new Date().toISOString().split("T")[0];
  let totalePagato = 0;
  let totaleDovuto = 0;
  let totaleScaduto = 0;

  for (const riga of data ?? []) {
    if (riga.pagata) {
      totalePagato += Number(riga.importo);
    } else {
      totaleDovuto += Number(riga.importo);
      if (riga.scadenza && riga.scadenza < oggi) {
        totaleScaduto += Number(riga.importo);
      }
    }
  }

  return { totalePagato, totaleDovuto, totaleScaduto };
}

export async function elencoIncassi(limite: number = 100) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rate_pagamento")
    .select(
      "id, iscrizione_id, tipo, importo, data_pagamento, metodo_pagamento, ricevuta_numero, ricevuta_blocco, fattura_numero, fattura_data, iscrizioni(codice, atleta_nome, atleta_cognome)"
    )
    .eq("pagata", true)
    .order("data_pagamento", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Utility una tantum: genera le rate per le iscrizioni ricevute prima
// dell'introduzione della gestione pagamenti (che quindi non ne hanno ancora).
export async function generaRateMancanti() {
  await verificaSessione();
  const supabase = createAdminClient();

  const { data: tutteIscrizioni, error: erroreIscrizioni } = await supabase
    .from("iscrizioni")
    .select("id, quota_iscrizione, numero_rate, importo_rata");
  if (erroreIscrizioni) throw new Error(erroreIscrizioni.message);

  const { data: rateEsistenti, error: erroreRate } = await supabase
    .from("rate_pagamento")
    .select("iscrizione_id");
  if (erroreRate) throw new Error(erroreRate.message);

  const idConRate = new Set((rateEsistenti ?? []).map((r) => r.iscrizione_id));
  const daCompletare = (tutteIscrizioni ?? []).filter((i) => !idConRate.has(i.id));

  if (daCompletare.length === 0) return { create: 0 };

  const { data: impostazioni } = await supabase
    .from("impostazioni")
    .select("inizio_corsi, rata1_scadenza, rata2_scadenza, rata3_scadenza")
    .eq("id", 1)
    .single();

  const scadenzeRate = [
    impostazioni?.rata1_scadenza ?? null,
    impostazioni?.rata2_scadenza ?? null,
    impostazioni?.rata3_scadenza ?? null,
  ];

  const righe = daCompletare.flatMap((i) => [
    {
      iscrizione_id: i.id,
      tipo: "Quota iscrizione",
      importo: i.quota_iscrizione,
      scadenza: impostazioni?.inizio_corsi ?? null,
      ordine: 0,
    },
    ...Array.from({ length: i.numero_rate }).map((_, indice) => ({
      iscrizione_id: i.id,
      tipo: i.numero_rate === 1 ? "Corso — pagamento unico" : `Corso — rata ${indice + 1}`,
      importo: i.importo_rata,
      scadenza: scadenzeRate[indice] ?? null,
      ordine: indice + 1,
    })),
  ]);

  const { error } = await supabase.from("rate_pagamento").insert(righe);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
  return { create: daCompletare.length };
}


// ===================================================================
// Ricevute PDF
// ===================================================================

const BUCKET_RICEVUTE = "ricevute";

export async function elencaSocieta() {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("societa_emittenti")
    .select("*")
    .order("ordine", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const CAMPI_SOCIETA = new Set(["ragione_sociale", "indirizzo", "partita_iva", "codice_fiscale", "prefisso", "dicitura", "attiva"]);

export async function salvaSocieta(id: string, campi: Record<string, unknown>) {
  await verificaSessione();
  const supabase = createAdminClient();
  const aggiornamento: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(campi)) {
    if (CAMPI_SOCIETA.has(k)) aggiornamento[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  if (aggiornamento.ragione_sociale === null) throw new Error("La ragione sociale è obbligatoria.");
  if (aggiornamento.prefisso === null) throw new Error("Il prefisso della numerazione è obbligatorio.");
  const { error } = await supabase.from("societa_emittenti").update(aggiornamento).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/dashboard");
}

export async function elencoRicevute(limite: number = 300) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ricevute")
    .select("*, societa_emittenti(codice, ragione_sociale)")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function ricevutePerIscrizione(iscrizioneId: string) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ricevute")
    .select("*, societa_emittenti(codice, ragione_sociale)")
    .eq("iscrizione_id", iscrizioneId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Genera il PDF di una ricevuta già numerata e lo archivia (usata anche per rigenerare, senza cambiare numero)
async function generaEArchiviaPdf(ricevutaId: string) {
  const supabase = createAdminClient();
  const { data: r, error } = await supabase
    .from("ricevute")
    .select("*, societa_emittenti(*)")
    .eq("id", ricevutaId)
    .single();
  if (error || !r) throw new Error(error?.message ?? "Ricevuta non trovata.");
  const soc = (r as any).societa_emittenti;

  const pdf = await generaPdfRicevuta({
    tipo: r.tipo === "ricevuta" ? "ricevuta" : "conferma",
    numero: r.numero_testo,
    dataPagamento: r.data_pagamento,
    intestatario: r.intestatario ?? "",
    atleta: r.atleta ?? "",
    causale: r.causale ?? "",
    importo: Number(r.importo),
    metodo: r.metodo,
    operatore: r.operatore,
    emessaIl: r.created_at,
    societa: {
      ragioneSociale: soc.ragione_sociale,
      indirizzo: soc.indirizzo,
      partitaIva: soc.partita_iva,
      codiceFiscale: soc.codice_fiscale,
      dicitura: soc.dicitura,
    },
  });

  const percorso = `${soc.codice}/${r.anno}/${r.numero_testo}.pdf`;
  const { error: erroreUpload } = await supabase.storage
    .from(BUCKET_RICEVUTE)
    .upload(percorso, pdf, { contentType: "application/pdf", upsert: true });
  if (erroreUpload) throw new Error(`Archiviazione del PDF non riuscita: ${erroreUpload.message}`);

  const { error: erroreAggiornamento } = await supabase.from("ricevute").update({ pdf_path: percorso }).eq("id", ricevutaId);
  if (erroreAggiornamento) throw new Error(erroreAggiornamento.message);
}

export async function emettiRicevuta(rataId: string, societaId: string, tipo: "ricevuta" | "conferma") {
  const operatore = await verificaSessione();
  const supabase = createAdminClient();

  const { data: rata, error: erroreRata } = await supabase.from("rate_pagamento").select("*").eq("id", rataId).single();
  if (erroreRata || !rata) throw new Error("Rata non trovata.");
  if (!rata.pagata) throw new Error("La ricevuta si può emettere solo per una rata già incassata.");

  const { data: isc, error: erroreIsc } = await supabase
    .from("iscrizioni")
    .select("*, corsi(nome)")
    .eq("id", rata.iscrizione_id)
    .single();
  if (erroreIsc || !isc) throw new Error("Iscrizione non trovata.");

  const { data: imp } = await supabase.from("impostazioni").select("stagione_etichetta").eq("id", 1).single();
  const anno1 = 2000 + Number(imp?.stagione_etichetta ?? "26");
  const stagione = `${anno1}/${anno1 + 1}`;

  const atleta = `${isc.atleta_nome} ${isc.atleta_cognome}`.trim();
  let intestatario = atleta;
  if (!isc.fatturazione_uguale_genitore && isc.fatturazione_intestatario) {
    intestatario = isc.fatturazione_intestatario;
  } else if (isc.minorenne && isc.genitore_nome) {
    intestatario = `${isc.genitore_nome} ${isc.genitore_cognome ?? ""}`.trim();
  }

  const tipoRata = String(rata.tipo ?? "").replace(/^Corso\s*—\s*/i, "");
  const causale =
    rata.tipo === "Quota iscrizione"
      ? `Quota iscrizione ${stagione}`
      : `${(isc as any).corsi?.nome ?? "Corso"} ${stagione} — ${tipoRata}`;

  const { data: socCheck } = await supabase
    .from("societa_emittenti")
    .select("ragione_sociale, indirizzo, partita_iva, codice_fiscale, attiva")
    .eq("id", societaId)
    .single();
  if (!socCheck || !socCheck.attiva) throw new Error("Società non valida o non attiva.");
  if (!socCheck.indirizzo || (!socCheck.partita_iva && !socCheck.codice_fiscale)) {
    throw new Error(
      `Completa prima i dati ufficiali di "${socCheck.ragione_sociale}" (indirizzo e partita IVA o codice fiscale) nella scheda Listino.`
    );
  }

  const { data: ricevuta, error } = await supabase.rpc("assegna_ricevuta", {
    p_rata_id: rata.id,
    p_iscrizione_id: isc.id,
    p_societa_id: societaId,
    p_tipo: tipo,
    p_data_pagamento: rata.data_pagamento,
    p_intestatario: intestatario,
    p_atleta: atleta,
    p_causale: causale,
    p_importo: rata.importo,
    p_metodo: rata.metodo_pagamento,
    p_operatore: operatore,
  });
  if (error || !ricevuta) throw new Error(error?.message ?? "Impossibile assegnare il numero di ricevuta.");

  // Il numero è già assegnato e salvato: se il PDF fallisce, si può rigenerare senza creare un'altra ricevuta
  let avviso: string | null = null;
  try {
    await generaEArchiviaPdf((ricevuta as any).id);
  } catch (e) {
    avviso = e instanceof Error ? e.message : "Generazione del PDF non riuscita.";
  }

  revalidatePath("/admin/dashboard");
  return { id: (ricevuta as any).id as string, numero: (ricevuta as any).numero_testo as string, avviso };
}

export async function rigeneraPdfRicevuta(ricevutaId: string) {
  await verificaSessione();
  await generaEArchiviaPdf(ricevutaId);
  revalidatePath("/admin/dashboard");
}

// Link temporaneo (60 secondi) per vedere/scaricare il PDF dall'archivio privato
export async function linkRicevuta(ricevutaId: string) {
  await verificaSessione();
  const supabase = createAdminClient();
  const { data: r, error } = await supabase.from("ricevute").select("pdf_path, numero_testo").eq("id", ricevutaId).single();
  if (error || !r) throw new Error("Ricevuta non trovata.");
  if (!r.pdf_path) throw new Error("Il PDF di questa ricevuta non è ancora stato generato.");
  const { data, error: erroreLink } = await supabase.storage
    .from(BUCKET_RICEVUTE)
    .createSignedUrl(r.pdf_path, 60, { download: `${r.numero_testo}.pdf` });
  if (erroreLink || !data) throw new Error(erroreLink?.message ?? "Impossibile creare il link.");
  return data.signedUrl;
}
