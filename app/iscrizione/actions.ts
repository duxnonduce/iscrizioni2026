"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { generaCodiceGrezzo } from "@/lib/codeGenerator";

export async function getDatiIniziali() {
  const supabase = createAdminClient();

  const { data: corsi, error: erroreCorsi } = await supabase
    .from("corsi")
    .select("id, nome, fascia_eta, durata_lezione, listini(id, frequenza_settimanale, numero_rate, importo_rata)")
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
  atletaNome: string;
  atletaCognome: string;
  atletaDataNascita: string;
  atletaTelefono: string;
  atletaEmail: string;
  minorenne: boolean;
  genitoreNome?: string;
  genitoreCognome?: string;
  genitoreTelefono?: string;
  genitoreEmail?: string;
  listinoId: string;
};

export async function inviaIscrizione(dati: DatiAnagrafica) {
  const supabase = createAdminClient();

  const { data: listino } = await supabase
    .from("listini")
    .select("id, corso_id, frequenza_settimanale, numero_rate, importo_rata")
    .eq("id", dati.listinoId)
    .single();

  const { data: impostazioni } = await supabase
    .from("impostazioni")
    .select("stagione_etichetta, whatsapp_numero, quota_iscrizione")
    .eq("id", 1)
    .single();

  if (!listino || !impostazioni) {
    return { ok: false as const, errore: "Corso o listino non trovati." };
  }

  const prezzoTotale =
    listino.importo_rata * listino.numero_rate + impostazioni.quota_iscrizione;

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
        atleta_data_nascita: dati.atletaDataNascita,
        atleta_telefono: dati.atletaTelefono || null,
        atleta_email: dati.atletaEmail || null,
        minorenne: dati.minorenne,
        genitore_nome: dati.genitoreNome || null,
        genitore_cognome: dati.genitoreCognome || null,
        genitore_telefono: dati.genitoreTelefono || null,
        genitore_email: dati.genitoreEmail || null,
        corso_id: listino.corso_id,
        listino_id: listino.id,
        frequenza_settimanale: listino.frequenza_settimanale,
        numero_rate: listino.numero_rate,
        importo_rata: listino.importo_rata,
        quota_iscrizione: impostazioni.quota_iscrizione,
        prezzo_totale: prezzoTotale,
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
    `Buongiorno, ho completato l'anagrafica per l'iscrizione a Micolani Tennis. Allievo: ${dati.atletaNome} ${dati.atletaCognome}. Il mio codice di riferimento è ${inserito.codice}. Desidero confermare la richiesta d'iscrizione.`
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
