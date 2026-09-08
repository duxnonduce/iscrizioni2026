"use client";

import { useMemo, useState } from "react";
import { formattaEuro } from "@/lib/pricing";
import { inviaIscrizione, type DatiAnagrafica } from "./actions";

type Listino = {
  id: string;
  frequenza_settimanale: number;
  numero_rate: number;
  importo_rata: number;
};

type Corso = {
  id: string;
  codice: string;
  nome: string;
  fascia_eta: string | null;
  durata_lezione: string | null;
  listini: Listino[];
};

type Impostazioni = {
  stagione_etichetta: string;
  whatsapp_numero: string;
  quota_iscrizione: number;
  inizio_corsi: string | null;
  fine_corsi: string | null;
  rata1_scadenza: string | null;
  rata2_scadenza: string | null;
  rata3_scadenza: string | null;
};

function calcolaEta(dataNascita: string): number | null {
  if (!dataNascita) return null;
  const nascita = new Date(dataNascita);
  if (Number.isNaN(nascita.getTime())) return null;
  const oggi = new Date();
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const meseNonRaggiunto =
    oggi.getMonth() < nascita.getMonth() ||
    (oggi.getMonth() === nascita.getMonth() && oggi.getDate() < nascita.getDate());
  if (meseNonRaggiunto) eta--;
  return eta;
}

function formattaData(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const TOTALE_STEP = 5;

const statoIniziale = {
  // Allievo
  atletaNome: "",
  atletaCognome: "",
  atletaCodiceFiscale: "",
  atletaDataNascita: "",
  atletaLuogoNascita: "",
  atletaSesso: "",
  atletaCittadinanza: "Italiana",
  atletaIndirizzo: "",
  atletaComune: "",
  atletaProvincia: "",
  atletaCap: "",
  atletaTelefono: "",
  atletaEmail: "",

  // Genitore
  genitoreNome: "",
  genitoreCognome: "",
  genitoreCodiceFiscale: "",
  genitoreDataNascita: "",
  genitoreLuogoNascita: "",
  genitoreIndirizzo: "",
  genitoreComune: "",
  genitoreProvincia: "",
  genitoreCap: "",
  genitoreTelefono: "",
  genitoreWhatsapp: "",
  genitoreEmail: "",
  genitoreRapporto: "",
  secondoRecapitoNome: "",
  secondoRecapitoTelefono: "",
  emergenzaNome: "",
  emergenzaTelefono: "",
  personeAutorizzateRitiro: "",

  // Corso
  corsoId: "",
  frequenza: 1,
  listinoId: "",
  preferenzeGiorni: "",
  preferenzeOrari: "",
  noteEsigenze: "",

  // Fatturazione
  fatturazioneUgualeGenitore: true,
  fatturazioneIntestatario: "",
  fatturazioneCodiceFiscale: "",
  fatturazionePartitaIva: "",
  fatturazioneIndirizzo: "",
  fatturazioneComune: "",
  fatturazioneProvincia: "",
  fatturazioneCap: "",
  fatturazioneEmail: "",
  fatturazionePec: "",
  fatturazioneSdi: "",
  fatturazioneSoggettoPagante: "",
  fatturazioneMetodoPagamento: "",
  fatturazioneRichiestaDocumento: false,

  // Consensi
  consensoDatiCorretti: false,
  consensoRegolamento: false,
  consensoPrivacy: false,
  consensoAutorizzazione: false,
  consensoPromozionale: false,
  consensoFotoVideo: false,
  consensoWhatsappGruppi: false,
};

type FormState = typeof statoIniziale;

export default function IscrizioneForm({
  corsi,
  impostazioni,
}: {
  corsi: Corso[];
  impostazioni: Impostazioni;
}) {
  const [step, setStep] = useState(1);
  const [invio, setInvio] = useState<"idle" | "inviando" | "errore">("idle");
  const [erroreInvio, setErroreInvio] = useState("");
  const [risultato, setRisultato] = useState<Awaited<
    ReturnType<typeof inviaIscrizione>
  > | null>(null);

  const [form, setForm] = useState<FormState>({
    ...statoIniziale,
    corsoId: corsi[0]?.id ?? "",
    frequenza: corsi[0]?.listini[0]?.frequenza_settimanale ?? 1,
    listinoId: corsi[0]?.listini[0]?.id ?? "",
  });

  const eta = calcolaEta(form.atletaDataNascita);
  const minorenne = eta !== null && eta < 18;

  const corsoSelezionato = corsi.find((c) => c.id === form.corsoId);

  const frequenzeDisponibili = useMemo(() => {
    if (!corsoSelezionato) return [];
    return Array.from(
      new Set(corsoSelezionato.listini.map((l) => l.frequenza_settimanale))
    ).sort((a, b) => a - b);
  }, [corsoSelezionato]);

  const rateDisponibili = useMemo(() => {
    if (!corsoSelezionato) return [];
    return corsoSelezionato.listini
      .filter((l) => l.frequenza_settimanale === form.frequenza)
      .sort((a, b) => a.numero_rate - b.numero_rate);
  }, [corsoSelezionato, form.frequenza]);

  const listinoSelezionato = corsoSelezionato?.listini.find((l) => l.id === form.listinoId);

  const prezzoTotale = listinoSelezionato
    ? listinoSelezionato.importo_rata * listinoSelezionato.numero_rate +
      impostazioni.quota_iscrizione
    : null;

  function aggiorna<K extends keyof FormState>(campo: K, valore: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valore }));
  }

  function cambiaCorso(corsoId: string) {
    const corso = corsi.find((c) => c.id === corsoId);
    const primaFrequenza = corso?.listini[0]?.frequenza_settimanale ?? 1;
    const primoListino = corso?.listini.find((l) => l.frequenza_settimanale === primaFrequenza);
    setForm((f) => ({
      ...f,
      corsoId,
      frequenza: primaFrequenza,
      listinoId: primoListino?.id ?? "",
    }));
  }

  function cambiaFrequenza(frequenza: number) {
    const primoListino = corsoSelezionato?.listini.find(
      (l) => l.frequenza_settimanale === frequenza
    );
    setForm((f) => ({ ...f, frequenza, listinoId: primoListino?.id ?? "" }));
  }

  function validaStep(): string | null {
    if (step === 1) {
      if (!form.atletaNome || !form.atletaCognome || !form.atletaDataNascita) {
        return "Compila almeno nome, cognome e data di nascita dell'atleta.";
      }
      if (new Date(form.atletaDataNascita) > new Date()) {
        return "La data di nascita non può essere nel futuro.";
      }
      if (!minorenne && !form.atletaTelefono) {
        return "Inserisci un numero di telefono di contatto.";
      }
    }
    if (step === 2 && minorenne) {
      if (!form.genitoreNome || !form.genitoreCognome || !form.genitoreTelefono) {
        return "Compila almeno nome, cognome e telefono del genitore/tutore.";
      }
    }
    if (step === 3) {
      if (!form.listinoId) {
        return "Seleziona corso, frequenza e numero di rate.";
      }
    }
    if (step === 4) {
      if (!form.fatturazioneUgualeGenitore && !form.fatturazioneIntestatario) {
        return "Indica almeno l'intestatario della fatturazione.";
      }
    }
    if (step === 5) {
      if (
        !form.consensoDatiCorretti ||
        !form.consensoRegolamento ||
        !form.consensoPrivacy ||
        !form.consensoAutorizzazione
      ) {
        return "Devi accettare tutte le dichiarazioni obbligatorie per proseguire.";
      }
    }
    return null;
  }

  function avanti() {
    const erroreValidazione = validaStep();
    if (erroreValidazione) {
      setErroreInvio(erroreValidazione);
      return;
    }
    setErroreInvio("");
    // Salta lo step genitore se l'atleta è maggiorenne
    let prossimo = step + 1;
    if (prossimo === 2 && !minorenne) prossimo = 3;
    setStep(Math.min(TOTALE_STEP, prossimo));
  }

  function indietro() {
    setErroreInvio("");
    let precedente = step - 1;
    if (precedente === 2 && !minorenne) precedente = 1;
    setStep(Math.max(1, precedente));
  }

  async function conferma() {
    const erroreValidazione = validaStep();
    if (erroreValidazione) {
      setErroreInvio(erroreValidazione);
      return;
    }
    setInvio("inviando");
    setErroreInvio("");

    const payload: DatiAnagrafica = {
      atletaNome: form.atletaNome.trim(),
      atletaCognome: form.atletaCognome.trim(),
      atletaCodiceFiscale: form.atletaCodiceFiscale.trim().toUpperCase(),
      atletaDataNascita: form.atletaDataNascita,
      atletaLuogoNascita: form.atletaLuogoNascita.trim(),
      atletaSesso: form.atletaSesso,
      atletaCittadinanza: form.atletaCittadinanza.trim(),
      atletaIndirizzo: form.atletaIndirizzo.trim(),
      atletaComune: form.atletaComune.trim(),
      atletaProvincia: form.atletaProvincia.trim(),
      atletaCap: form.atletaCap.trim(),
      atletaTelefono: form.atletaTelefono.trim(),
      atletaEmail: form.atletaEmail.trim(),
      minorenne,
      preferenzeGiorni: form.preferenzeGiorni.trim(),
      preferenzeOrari: form.preferenzeOrari.trim(),
      noteEsigenze: form.noteEsigenze.trim(),

      genitoreNome: form.genitoreNome.trim(),
      genitoreCognome: form.genitoreCognome.trim(),
      genitoreCodiceFiscale: form.genitoreCodiceFiscale.trim().toUpperCase(),
      genitoreDataNascita: form.genitoreDataNascita || undefined,
      genitoreLuogoNascita: form.genitoreLuogoNascita.trim(),
      genitoreIndirizzo: form.genitoreIndirizzo.trim(),
      genitoreComune: form.genitoreComune.trim(),
      genitoreProvincia: form.genitoreProvincia.trim(),
      genitoreCap: form.genitoreCap.trim(),
      genitoreTelefono: form.genitoreTelefono.trim(),
      genitoreWhatsapp: form.genitoreWhatsapp.trim(),
      genitoreEmail: form.genitoreEmail.trim(),
      genitoreRapporto: form.genitoreRapporto.trim(),
      secondoRecapitoNome: form.secondoRecapitoNome.trim(),
      secondoRecapitoTelefono: form.secondoRecapitoTelefono.trim(),
      emergenzaNome: form.emergenzaNome.trim(),
      emergenzaTelefono: form.emergenzaTelefono.trim(),
      personeAutorizzateRitiro: form.personeAutorizzateRitiro.trim(),

      corsoCodice: corsoSelezionato?.codice ?? "",
      frequenzaSettimanale: form.frequenza,
      numeroRate: listinoSelezionato?.numero_rate ?? 1,

      fatturazioneUgualeGenitore: form.fatturazioneUgualeGenitore,
      fatturazioneIntestatario: form.fatturazioneIntestatario.trim(),
      fatturazioneCodiceFiscale: form.fatturazioneCodiceFiscale.trim().toUpperCase(),
      fatturazionePartitaIva: form.fatturazionePartitaIva.trim(),
      fatturazioneIndirizzo: form.fatturazioneIndirizzo.trim(),
      fatturazioneComune: form.fatturazioneComune.trim(),
      fatturazioneProvincia: form.fatturazioneProvincia.trim(),
      fatturazioneCap: form.fatturazioneCap.trim(),
      fatturazioneEmail: form.fatturazioneEmail.trim(),
      fatturazionePec: form.fatturazionePec.trim(),
      fatturazioneSdi: form.fatturazioneSdi.trim(),
      fatturazioneSoggettoPagante: form.fatturazioneSoggettoPagante.trim(),
      fatturazioneMetodoPagamento: form.fatturazioneMetodoPagamento.trim(),
      fatturazioneRichiestaDocumento: form.fatturazioneRichiestaDocumento,

      consensoDatiCorretti: form.consensoDatiCorretti,
      consensoRegolamento: form.consensoRegolamento,
      consensoPrivacy: form.consensoPrivacy,
      consensoAutorizzazione: form.consensoAutorizzazione,
      consensoPromozionale: form.consensoPromozionale,
      consensoFotoVideo: form.consensoFotoVideo,
      consensoWhatsappGruppi: form.consensoWhatsappGruppi,
    };

    try {
      const esito = await inviaIscrizione(payload);
      if (!esito.ok) {
        setInvio("errore");
        setErroreInvio(esito.errore);
        return;
      }
      setRisultato(esito);
      setInvio("idle");
      setStep(TOTALE_STEP + 1);
    } catch {
      setInvio("errore");
      setErroreInvio("Si è verificato un problema. Riprova tra qualche istante.");
    }
  }

  if (step === TOTALE_STEP + 1 && risultato?.ok) {
    return <SchermataFinale risultato={risultato} impostazioni={impostazioni} />;
  }

  const stepVisibile = step === 2 && !minorenne ? 3 : step;
  const stepMostratiTotali = minorenne ? TOTALE_STEP : TOTALE_STEP - 1;
  const indiceBarra = minorenne ? step : step > 2 ? step - 1 : step;

  return (
    <div>
      <div className="bg-navy px-5 py-8 text-center">
        <img
          src="/logo-micolani.png"
          alt="Micolani Tennis"
          className="mx-auto h-20 w-auto"
        />
        <p className="mt-3 text-sm text-white/60">
          Modulo di pre-iscrizione — stagione 20{impostazioni.stagione_etichetta}/
          {Number(impostazioni.stagione_etichetta) + 1}
        </p>
      </div>

      <div className="mx-auto max-w-lg px-5 py-8 sm:py-12">
        <BarraAvanzamento step={indiceBarra} totale={stepMostratiTotali} />

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-court/10">
        {step === 1 && <StepAllievo form={form} aggiorna={aggiorna} eta={eta} minorenne={minorenne} />}
        {step === 2 && minorenne && <StepGenitore form={form} aggiorna={aggiorna} />}
        {step === 3 && (
          <StepCorso
            form={form}
            corsi={corsi}
            frequenzeDisponibili={frequenzeDisponibili}
            rateDisponibili={rateDisponibili}
            cambiaCorso={cambiaCorso}
            cambiaFrequenza={cambiaFrequenza}
            aggiorna={aggiorna}
            prezzoTotale={prezzoTotale}
            quotaIscrizione={impostazioni.quota_iscrizione}
          />
        )}
        {step === 4 && <StepFatturazione form={form} aggiorna={aggiorna} minorenne={minorenne} />}
        {step === 5 && (
          <StepConsensi
            form={form}
            aggiorna={aggiorna}
            minorenne={minorenne}
            corso={corsoSelezionato}
            listino={listinoSelezionato}
            prezzoTotale={prezzoTotale}
          />
        )}

        {erroreInvio && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erroreInvio}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={indietro}
              className="rounded-full px-4 py-2 text-sm font-medium text-court-dark/70 hover:bg-ace/50"
            >
              Indietro
            </button>
          ) : (
            <span />
          )}

          {step < 5 && (
            <button
              type="button"
              onClick={avanti}
              className="rounded-full bg-court px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-court-dark"
            >
              Continua
            </button>
          )}

          {step === 5 && (
            <button
              type="button"
              onClick={conferma}
              disabled={invio === "inviando"}
              className="rounded-full bg-court px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-court-dark disabled:opacity-60"
            >
              {invio === "inviando" ? "Invio in corso…" : "Invia iscrizione"}
            </button>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

function BarraAvanzamento({ step, totale }: { step: number; totale: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totale }).map((_, i) => (
        <div
          key={i}
          className={`step-progress-dot h-1.5 flex-1 rounded-full ${
            i < step ? "bg-court" : "bg-ace"
          }`}
        />
      ))}
    </div>
  );
}

function Campo({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-court-dark/80">{etichetta}</span>
      {children}
    </label>
  );
}

const classeInput =
  "w-full rounded-lg border border-court/20 bg-white px-3 py-2.5 text-base text-court-dark placeholder:text-court-dark/30";

function StepAllievo({
  form,
  aggiorna,
  eta,
  minorenne,
}: {
  form: FormState;
  aggiorna: any;
  eta: number | null;
  minorenne: boolean;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-court-dark">Dati dell'allievo</h2>

      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Nome">
          <input className={classeInput} value={form.atletaNome} onChange={(e) => aggiorna("atletaNome", e.target.value)} />
        </Campo>
        <Campo etichetta="Cognome">
          <input className={classeInput} value={form.atletaCognome} onChange={(e) => aggiorna("atletaCognome", e.target.value)} />
        </Campo>
      </div>

      <Campo etichetta="Codice fiscale">
        <input
          className={classeInput}
          style={{ textTransform: "uppercase" }}
          maxLength={16}
          value={form.atletaCodiceFiscale}
          onChange={(e) => aggiorna("atletaCodiceFiscale", e.target.value.toUpperCase())}
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Data di nascita">
          <input
            type="date"
            max={new Date().toISOString().split("T")[0]}
            className={classeInput}
            value={form.atletaDataNascita}
            onChange={(e) => aggiorna("atletaDataNascita", e.target.value)}
          />
        </Campo>
        <Campo etichetta="Luogo di nascita">
          <input className={classeInput} value={form.atletaLuogoNascita} onChange={(e) => aggiorna("atletaLuogoNascita", e.target.value)} />
        </Campo>
      </div>

      {eta !== null && (
        <p className="text-sm text-court-dark/60">
          {minorenne
            ? `Atleta minorenne (${eta} anni) — nel prossimo passaggio servono i dati del genitore/tutore.`
            : `Età: ${eta} anni.`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Sesso">
          <select className={classeInput} value={form.atletaSesso} onChange={(e) => aggiorna("atletaSesso", e.target.value)}>
            <option value="">Seleziona</option>
            <option value="Maschile">Maschile</option>
            <option value="Femminile">Femminile</option>
            <option value="Preferisco non specificare">Preferisco non specificare</option>
          </select>
        </Campo>
        <Campo etichetta="Cittadinanza">
          <input className={classeInput} value={form.atletaCittadinanza} onChange={(e) => aggiorna("atletaCittadinanza", e.target.value)} />
        </Campo>
      </div>

      <Campo etichetta="Indirizzo di residenza">
        <input className={classeInput} value={form.atletaIndirizzo} onChange={(e) => aggiorna("atletaIndirizzo", e.target.value)} />
      </Campo>
      <div className="grid grid-cols-3 gap-3">
        <Campo etichetta="Comune">
          <input className={classeInput} value={form.atletaComune} onChange={(e) => aggiorna("atletaComune", e.target.value)} />
        </Campo>
        <Campo etichetta="Provincia">
          <input className={classeInput} maxLength={2} style={{ textTransform: "uppercase" }} value={form.atletaProvincia} onChange={(e) => aggiorna("atletaProvincia", e.target.value.toUpperCase())} />
        </Campo>
        <Campo etichetta="CAP">
          <input className={classeInput} value={form.atletaCap} onChange={(e) => aggiorna("atletaCap", e.target.value)} />
        </Campo>
      </div>

      {!minorenne && (
        <Campo etichetta="Telefono">
          <input type="tel" className={classeInput} value={form.atletaTelefono} onChange={(e) => aggiorna("atletaTelefono", e.target.value)} />
        </Campo>
      )}
      <Campo etichetta={minorenne ? "Email dell'allievo (facoltativa)" : "Email"}>
        <input type="email" className={classeInput} value={form.atletaEmail} onChange={(e) => aggiorna("atletaEmail", e.target.value)} />
      </Campo>
    </div>
  );
}

function StepGenitore({ form, aggiorna }: { form: FormState; aggiorna: any }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-court-dark">
        Dati del genitore/tutore
      </h2>
      <p className="text-sm text-court-dark/60">
        Da compilare obbligatoriamente perché l'allievo è minorenne.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Nome">
          <input className={classeInput} value={form.genitoreNome} onChange={(e) => aggiorna("genitoreNome", e.target.value)} />
        </Campo>
        <Campo etichetta="Cognome">
          <input className={classeInput} value={form.genitoreCognome} onChange={(e) => aggiorna("genitoreCognome", e.target.value)} />
        </Campo>
      </div>

      <Campo etichetta="Codice fiscale">
        <input
          className={classeInput}
          style={{ textTransform: "uppercase" }}
          maxLength={16}
          value={form.genitoreCodiceFiscale}
          onChange={(e) => aggiorna("genitoreCodiceFiscale", e.target.value.toUpperCase())}
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Data di nascita">
          <input type="date" max={new Date().toISOString().split("T")[0]} className={classeInput} value={form.genitoreDataNascita} onChange={(e) => aggiorna("genitoreDataNascita", e.target.value)} />
        </Campo>
        <Campo etichetta="Luogo di nascita">
          <input className={classeInput} value={form.genitoreLuogoNascita} onChange={(e) => aggiorna("genitoreLuogoNascita", e.target.value)} />
        </Campo>
      </div>

      <Campo etichetta="Indirizzo di residenza">
        <input className={classeInput} value={form.genitoreIndirizzo} onChange={(e) => aggiorna("genitoreIndirizzo", e.target.value)} />
      </Campo>
      <div className="grid grid-cols-3 gap-3">
        <Campo etichetta="Comune">
          <input className={classeInput} value={form.genitoreComune} onChange={(e) => aggiorna("genitoreComune", e.target.value)} />
        </Campo>
        <Campo etichetta="Provincia">
          <input className={classeInput} maxLength={2} style={{ textTransform: "uppercase" }} value={form.genitoreProvincia} onChange={(e) => aggiorna("genitoreProvincia", e.target.value.toUpperCase())} />
        </Campo>
        <Campo etichetta="CAP">
          <input className={classeInput} value={form.genitoreCap} onChange={(e) => aggiorna("genitoreCap", e.target.value)} />
        </Campo>
      </div>

      <Campo etichetta="Rapporto con il minore">
        <select className={classeInput} value={form.genitoreRapporto} onChange={(e) => aggiorna("genitoreRapporto", e.target.value)}>
          <option value="">Seleziona</option>
          <option value="Madre">Madre</option>
          <option value="Padre">Padre</option>
          <option value="Tutore">Tutore</option>
          <option value="Altro">Altro</option>
        </select>
      </Campo>

      <Campo etichetta="Telefono (contatto WhatsApp principale)">
        <input type="tel" className={classeInput} value={form.genitoreTelefono} onChange={(e) => aggiorna("genitoreTelefono", e.target.value)} />
      </Campo>
      <Campo etichetta="Numero WhatsApp, se diverso dal telefono">
        <input type="tel" className={classeInput} value={form.genitoreWhatsapp} onChange={(e) => aggiorna("genitoreWhatsapp", e.target.value)} />
      </Campo>
      <Campo etichetta="Email">
        <input type="email" className={classeInput} value={form.genitoreEmail} onChange={(e) => aggiorna("genitoreEmail", e.target.value)} />
      </Campo>

      <div className="space-y-3 rounded-xl bg-chalk p-4">
        <h3 className="font-display text-lg font-semibold text-court-dark">
          Secondo recapito e contatti utili
        </h3>
        <Campo etichetta="Nome del secondo genitore/referente (facoltativo)">
          <input className={classeInput} value={form.secondoRecapitoNome} onChange={(e) => aggiorna("secondoRecapitoNome", e.target.value)} />
        </Campo>
        <Campo etichetta="Telefono del secondo referente (facoltativo)">
          <input type="tel" className={classeInput} value={form.secondoRecapitoTelefono} onChange={(e) => aggiorna("secondoRecapitoTelefono", e.target.value)} />
        </Campo>
        <Campo etichetta="Contatto per le emergenze — nome">
          <input className={classeInput} value={form.emergenzaNome} onChange={(e) => aggiorna("emergenzaNome", e.target.value)} />
        </Campo>
        <Campo etichetta="Contatto per le emergenze — telefono">
          <input type="tel" className={classeInput} value={form.emergenzaTelefono} onChange={(e) => aggiorna("emergenzaTelefono", e.target.value)} />
        </Campo>
        <Campo etichetta="Persone autorizzate al ritiro del minore">
          <textarea
            className={classeInput}
            rows={2}
            placeholder="Nome e cognome delle persone autorizzate"
            value={form.personeAutorizzateRitiro}
            onChange={(e) => aggiorna("personeAutorizzateRitiro", e.target.value)}
          />
        </Campo>
      </div>

      <p className="rounded-lg bg-ace/30 p-3 text-xs leading-relaxed text-court-dark/70">
        Il/la sottoscritto/a dichiara di essere genitore, tutore o altro soggetto legittimato a
        esercitare la responsabilità sul minore e di essere autorizzato/a a effettuare la presente
        iscrizione. Dichiara inoltre che l'iscrizione è effettuata nel rispetto delle decisioni
        condivise con l'altro genitore, ove previste, assumendosi ogni responsabilità in merito
        alla correttezza e alla veridicità delle dichiarazioni rese. Questa dichiarazione viene
        confermata con il consenso finale nell'ultimo passaggio.
      </p>
    </div>
  );
}

function StepCorso({
  form,
  corsi,
  frequenzeDisponibili,
  rateDisponibili,
  cambiaCorso,
  cambiaFrequenza,
  aggiorna,
  prezzoTotale,
  quotaIscrizione,
}: {
  form: FormState;
  corsi: Corso[];
  frequenzeDisponibili: number[];
  rateDisponibili: Listino[];
  cambiaCorso: (id: string) => void;
  cambiaFrequenza: (f: number) => void;
  aggiorna: any;
  prezzoTotale: number | null;
  quotaIscrizione: number;
}) {
  const corso = corsi.find((c) => c.id === form.corsoId);
  const listinoSelezionato = rateDisponibili.find((l) => l.id === form.listinoId);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-court-dark">Corso</h2>

      <Campo etichetta="Corso">
        <select className={classeInput} value={form.corsoId} onChange={(e) => cambiaCorso(e.target.value)}>
          {corsi.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} {c.fascia_eta ? `(${c.fascia_eta})` : ""}
            </option>
          ))}
        </select>
      </Campo>

      {corso?.durata_lezione && <p className="text-sm text-court-dark/60">{corso.durata_lezione}</p>}

      <Campo etichetta="Frequenza settimanale">
        <select className={classeInput} value={form.frequenza} onChange={(e) => cambiaFrequenza(Number(e.target.value))}>
          {frequenzeDisponibili.map((f) => (
            <option key={f} value={f}>
              {f} {f === 1 ? "volta" : "volte"} a settimana
            </option>
          ))}
        </select>
      </Campo>

      <Campo etichetta="Numero di rate">
        <select className={classeInput} value={form.listinoId} onChange={(e) => aggiorna("listinoId", e.target.value)}>
          {rateDisponibili.map((l) => (
            <option key={l.id} value={l.id}>
              {l.numero_rate === 1
                ? `Pagamento unico — ${formattaEuro(l.importo_rata)}`
                : `${l.numero_rate} rate da ${formattaEuro(l.importo_rata)}`}
            </option>
          ))}
        </select>
      </Campo>

      {prezzoTotale !== null && listinoSelezionato && (
        <div className="rounded-xl bg-ace/40 p-4">
          <p className="font-display text-2xl font-bold text-court">{formattaEuro(prezzoTotale)}</p>
          <p className="text-sm text-court-dark/70">
            {listinoSelezionato.numero_rate > 1
              ? `${listinoSelezionato.numero_rate} rate da ${formattaEuro(listinoSelezionato.importo_rata)}`
              : "Pagamento unico"}{" "}
            + quota d'iscrizione {formattaEuro(quotaIscrizione)} (kit e tessera FITP)
          </p>
        </div>
      )}

      <Campo etichetta="Preferenze sui giorni (facoltativo)">
        <input className={classeInput} value={form.preferenzeGiorni} onChange={(e) => aggiorna("preferenzeGiorni", e.target.value)} />
      </Campo>
      <Campo etichetta="Preferenze sulle fasce orarie (facoltativo)">
        <input className={classeInput} value={form.preferenzeOrari} onChange={(e) => aggiorna("preferenzeOrari", e.target.value)} />
      </Campo>
      <Campo etichetta="Esigenze organizzative o sportive (facoltativo)">
        <textarea className={classeInput} rows={2} value={form.noteEsigenze} onChange={(e) => aggiorna("noteEsigenze", e.target.value)} />
      </Campo>
      <p className="text-xs text-court-dark/50">
        Le preferenze indicate saranno valutate dalla segreteria e non costituiscono conferma del
        gruppo, dei giorni o degli orari.
      </p>
    </div>
  );
}

function StepFatturazione({
  form,
  aggiorna,
  minorenne,
}: {
  form: FormState;
  aggiorna: any;
  minorenne: boolean;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-court-dark">Dati per fatturazione</h2>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={form.fatturazioneUgualeGenitore}
          onChange={(e) => aggiorna("fatturazioneUgualeGenitore", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-court/40"
        />
        <span className="text-sm text-court-dark/80">
          I dati per la fatturazione corrispondono a quelli {minorenne ? "del genitore/tutore" : "dell'allievo"} già inseriti.
        </span>
      </label>

      {!form.fatturazioneUgualeGenitore && (
        <div className="space-y-3">
          <Campo etichetta="Intestatario (nome/cognome o ragione sociale)">
            <input className={classeInput} value={form.fatturazioneIntestatario} onChange={(e) => aggiorna("fatturazioneIntestatario", e.target.value)} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="Codice fiscale">
              <input className={classeInput} style={{ textTransform: "uppercase" }} value={form.fatturazioneCodiceFiscale} onChange={(e) => aggiorna("fatturazioneCodiceFiscale", e.target.value.toUpperCase())} />
            </Campo>
            <Campo etichetta="Partita IVA (se presente)">
              <input className={classeInput} value={form.fatturazionePartitaIva} onChange={(e) => aggiorna("fatturazionePartitaIva", e.target.value)} />
            </Campo>
          </div>
          <Campo etichetta="Indirizzo / sede legale">
            <input className={classeInput} value={form.fatturazioneIndirizzo} onChange={(e) => aggiorna("fatturazioneIndirizzo", e.target.value)} />
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo etichetta="Comune">
              <input className={classeInput} value={form.fatturazioneComune} onChange={(e) => aggiorna("fatturazioneComune", e.target.value)} />
            </Campo>
            <Campo etichetta="Provincia">
              <input className={classeInput} maxLength={2} style={{ textTransform: "uppercase" }} value={form.fatturazioneProvincia} onChange={(e) => aggiorna("fatturazioneProvincia", e.target.value.toUpperCase())} />
            </Campo>
            <Campo etichetta="CAP">
              <input className={classeInput} value={form.fatturazioneCap} onChange={(e) => aggiorna("fatturazioneCap", e.target.value)} />
            </Campo>
          </div>
          <Campo etichetta="Email">
            <input type="email" className={classeInput} value={form.fatturazioneEmail} onChange={(e) => aggiorna("fatturazioneEmail", e.target.value)} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="PEC (se presente)">
              <input className={classeInput} value={form.fatturazionePec} onChange={(e) => aggiorna("fatturazionePec", e.target.value)} />
            </Campo>
            <Campo etichetta="Codice destinatario SDI (se presente)">
              <input className={classeInput} value={form.fatturazioneSdi} onChange={(e) => aggiorna("fatturazioneSdi", e.target.value)} />
            </Campo>
          </div>
          <Campo etichetta="Soggetto che effettua il pagamento">
            <input className={classeInput} value={form.fatturazioneSoggettoPagante} onChange={(e) => aggiorna("fatturazioneSoggettoPagante", e.target.value)} />
          </Campo>
        </div>
      )}

      <Campo etichetta="Metodo di pagamento preferito">
        <select className={classeInput} value={form.fatturazioneMetodoPagamento} onChange={(e) => aggiorna("fatturazioneMetodoPagamento", e.target.value)}>
          <option value="">Seleziona</option>
          <option value="Carta di credito/debito (PayPal)">Carta di credito/debito (PayPal)</option>
          <option value="Bonifico bancario">Bonifico bancario</option>
          <option value="Pagamento in sede">Pagamento in sede (carta o contanti)</option>
        </select>
      </Campo>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={form.fatturazioneRichiestaDocumento}
          onChange={(e) => aggiorna("fatturazioneRichiestaDocumento", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-court/40"
        />
        <span className="text-sm text-court-dark/80">
          Richiedo un documento valido ai fini fiscali (fattura/ricevuta).
        </span>
      </label>
    </div>
  );
}

function StepConsensi({
  form,
  aggiorna,
  minorenne,
  corso,
  listino,
  prezzoTotale,
}: {
  form: FormState;
  aggiorna: any;
  minorenne: boolean;
  corso?: Corso;
  listino?: Listino;
  prezzoTotale: number | null;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-court-dark">
        Riepilogo, informativa e consensi
      </h2>

      <dl className="space-y-1.5 rounded-xl bg-chalk p-4 text-sm">
        <RigaRiepilogo etichetta="Atleta" valore={`${form.atletaNome} ${form.atletaCognome}`} />
        {minorenne && (
          <RigaRiepilogo etichetta="Genitore/tutore" valore={`${form.genitoreNome} ${form.genitoreCognome}`} />
        )}
        <RigaRiepilogo etichetta="Corso" valore={corso?.nome ?? "-"} />
        {listino && <RigaRiepilogo etichetta="Frequenza" valore={`${listino.frequenza_settimanale}x a settimana`} />}
        {prezzoTotale !== null && <RigaRiepilogo etichetta="Totale" valore={formattaEuro(prezzoTotale)} />}
      </dl>

      <details className="rounded-xl bg-chalk p-4 text-xs leading-relaxed text-court-dark/70">
        <summary className="cursor-pointer text-sm font-semibold text-court-dark">
          Informativa sul trattamento dei dati personali (GDPR)
        </summary>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
          <p>
            Ai sensi degli articoli 13 e 14 del Regolamento UE 2016/679 ("GDPR"), Micolani Tennis
            informa l'interessato sulle modalità di trattamento dei dati raccolti tramite questo
            modulo.
          </p>
          <p>
            <strong>Titolare:</strong> Micolani Tennis, Via Vecchia San Donato ang. Via Pepini,
            73020 Cavallino (LE). Email: segreteriamicolanitennis@gmail.com — Tel: +39 351 8167085.
          </p>
          <p>
            <strong>Dati trattati:</strong> dati anagrafici e di contatto, dati del genitore/tutore,
            dati amministrativi e fiscali, informazioni sul corso, dati di tesseramento, dati
            relativi alla salute nei limiti strettamente necessari, dati tecnici della procedura
            online.
          </p>
          <p>
            <strong>Finalità:</strong> gestire l'iscrizione, organizzare corsi e gruppi, contattare
            la famiglia, gestire pagamenti e fatturazione, adempiere a obblighi fiscali e sportivi,
            tesseramento FITP, tutelare la salute e la sicurezza, gestire emergenze, e — solo previo
            consenso specifico — inviare comunicazioni promozionali o utilizzare foto/video.
          </p>
          <p>
            <strong>Basi giuridiche:</strong> esecuzione del rapporto contrattuale, adempimento di
            obblighi di legge, legittimo interesse del titolare, consenso dell'interessato dove
            richiesto; per i dati sanitari, le condizioni dell'art. 9 GDPR e la tutela della salute
            e sicurezza.
          </p>
          <p>
            <strong>Comunicazione a terzi:</strong> FITP e organismi sportivi, assicurazioni,
            consulenti fiscali/legali, fornitori informatici, istituti bancari, strutture sanitarie
            in caso di emergenza, autorità pubbliche quando previsto dalla legge. Nessuna cessione a
            terzi per finalità commerciali senza consenso specifico.
          </p>
          <p>
            <strong>Conservazione:</strong> per il tempo necessario alla gestione del rapporto
            sportivo e, successivamente, per i termini previsti dagli obblighi fiscali,
            assicurativi e legali.
          </p>
          <p>
            <strong>Diritti dell'interessato:</strong> accesso, rettifica, cancellazione,
            limitazione, portabilità, opposizione e revoca del consenso, da esercitare scrivendo a
            segreteriamicolanitennis@gmail.com. È possibile presentare reclamo al Garante per la
            protezione dei dati personali.
          </p>
        </div>
      </details>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-court-dark">Dichiarazioni obbligatorie</p>
        <ConsensoCheckbox
          checked={form.consensoDatiCorretti}
          onChange={(v) => aggiorna("consensoDatiCorretti", v)}
          testo="Dichiaro che i dati inseriti sono completi, corretti e veritieri e mi impegno a comunicare tempestivamente qualsiasi variazione."
        />
        <ConsensoCheckbox
          checked={form.consensoRegolamento}
          onChange={(v) => aggiorna("consensoRegolamento", v)}
          testo="Dichiaro di aver letto e accettato il regolamento della Micolani Tennis, le condizioni economiche, le modalità di pagamento e le disposizioni relative ad assenze, recuperi e certificazione medica."
        />
        <ConsensoCheckbox
          checked={form.consensoPrivacy}
          onChange={(v) => aggiorna("consensoPrivacy", v)}
          testo="Dichiaro di aver letto e compreso l'informativa sul trattamento dei dati personali."
        />
        <ConsensoCheckbox
          checked={form.consensoAutorizzazione}
          onChange={(v) => aggiorna("consensoAutorizzazione", v)}
          testo={
            minorenne
              ? "Autorizzo la partecipazione dell'allievo alle attività sportive scelte e dichiaro di essere genitore, tutore o soggetto legittimato a effettuare la presente iscrizione, nel rispetto delle decisioni condivise con l'altro genitore ove previste."
              : "Autorizzo la mia partecipazione alle attività sportive scelte."
          }
        />

        <p className="pt-2 text-sm font-semibold text-court-dark">Consensi facoltativi</p>
        <ConsensoCheckbox
          checked={form.consensoPromozionale}
          onChange={(v) => aggiorna("consensoPromozionale", v)}
          testo="Acconsento all'invio di comunicazioni promozionali relative a corsi, eventi e iniziative della Micolani Tennis."
        />
        <ConsensoCheckbox
          checked={form.consensoFotoVideo}
          onChange={(v) => aggiorna("consensoFotoVideo", v)}
          testo="Acconsento alla realizzazione e all'utilizzo di fotografie e video dell'allievo per il sito, i social network e il materiale informativo della Micolani Tennis."
        />
        <ConsensoCheckbox
          checked={form.consensoWhatsappGruppi}
          onChange={(v) => aggiorna("consensoWhatsappGruppi", v)}
          testo="Acconsento all'inserimento del mio numero nei gruppi WhatsApp organizzativi, consapevole che sarà visibile agli altri partecipanti."
        />
        <p className="text-xs text-court-dark/50">
          Il mancato consenso alle finalità facoltative non impedisce l'iscrizione.
        </p>
      </div>

      <p className="rounded-lg bg-ace/30 p-3 text-xs leading-relaxed text-court-dark/70">
        Inviando questo modulo dichiari di aver letto e verificato la correttezza dei dati inseriti
        e di accettare il regolamento, le condizioni economiche e le dichiarazioni sopra selezionate.
        La procedura registra data, ora e gli elementi tecnici necessari a garantire la tracciabilità
        dell'operazione.
      </p>
    </div>
  );
}

function ConsensoCheckbox({
  checked,
  onChange,
  testo,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  testo: string;
}) {
  return (
    <label className="flex items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-court/40"
      />
      <span className="text-sm text-court-dark/80">{testo}</span>
    </label>
  );
}

function RigaRiepilogo({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-court-dark/60">{etichetta}</dt>
      <dd className="text-right font-medium text-court-dark">{valore}</dd>
    </div>
  );
}

function SchermataFinale({
  risultato,
  impostazioni,
}: {
  risultato: Extract<Awaited<ReturnType<typeof inviaIscrizione>>, { ok: true }>;
  impostazioni: Impostazioni;
}) {
  const [copiato, setCopiato] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center bg-navy px-5 py-12 text-center">
      <img src="/logo-micolani.png" alt="Micolani Tennis" className="mx-auto mb-6 h-16 w-auto" />
      <div className="w-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-court/10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ace">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-court" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-bold text-court-dark">
          Anagrafica registrata correttamente
        </h1>
        <p className="mt-2 text-sm text-court-dark/70">Il tuo codice di riferimento è</p>
        <p className="mt-1 font-display text-3xl font-bold tracking-wide text-court">
          {risultato.codice}
        </p>

        {risultato.numeroRate > 1 && (
          <p className="mt-4 text-xs text-court-dark/60">
            Scadenze rate: {formattaData(impostazioni.rata1_scadenza)}
            {impostazioni.rata2_scadenza && `, ${formattaData(impostazioni.rata2_scadenza)}`}
            {impostazioni.rata3_scadenza && risultato.numeroRate > 2 && `, ${formattaData(impostazioni.rata3_scadenza)}`}
          </p>
        )}

        <p className="mt-4 text-sm text-court-dark/70">
          Conserva questo codice. Per completare la procedura premi il pulsante qui sotto.
        </p>

        <p className="mt-4 rounded-lg bg-ace/40 p-3 text-xs leading-relaxed text-court-dark/80">
          Ricordati di inviare via WhatsApp, insieme alla conferma, il <strong>certificato medico</strong>{" "}
          (se già disponibile) ed eventuali altri documenti richiesti dalla segreteria.
        </p>

        <a
          href={risultato.linkWhatsapp}
          className="mt-6 block rounded-full bg-court px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-court-dark"
        >
          Conferma su WhatsApp
        </a>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(risultato.codice);
            setCopiato(true);
            setTimeout(() => setCopiato(false), 2000);
          }}
          className="mt-3 block w-full rounded-full border border-court/20 px-6 py-3 text-sm font-medium text-court-dark hover:bg-chalk"
        >
          {copiato ? "Codice copiato" : "Copia codice"}
        </button>
      </div>
    </div>
  );
}
