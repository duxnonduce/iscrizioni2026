"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function verificaSessione() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Sessione non valida.");
  }
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
    .select("id, tipo, importo, data_pagamento, metodo_pagamento, iscrizioni(codice, atleta_nome, atleta_cognome)")
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
