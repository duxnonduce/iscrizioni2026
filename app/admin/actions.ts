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
  "fatturazione_uguale_genitore", "fatturazione_intestatario", "fatturazione_codice_fiscale",
  "fatturazione_partita_iva", "fatturazione_indirizzo", "fatturazione_comune",
  "fatturazione_provincia", "fatturazione_cap", "fatturazione_email", "fatturazione_pec",
  "fatturazione_sdi", "fatturazione_soggetto_pagante", "fatturazione_metodo_pagamento",
  "fatturazione_richiesta_documento",
  "consenso_dati_corretti", "consenso_regolamento", "consenso_privacy",
  "consenso_autorizzazione", "consenso_promozionale", "consenso_foto_video",
  "consenso_whatsapp_gruppi",
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
