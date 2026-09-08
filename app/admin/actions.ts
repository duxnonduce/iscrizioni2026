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
    .select(
      "id, codice, atleta_nome, atleta_cognome, atleta_telefono, genitore_nome, genitore_cognome, genitore_telefono, minorenne, frequenza_settimanale, numero_rate, importo_rata, quota_iscrizione, prezzo_totale, created_at, corsi(nome)"
    )
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
