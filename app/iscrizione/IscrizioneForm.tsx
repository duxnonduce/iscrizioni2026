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

const TOTALE_STEP = 4;

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

  const [form, setForm] = useState({
    atletaNome: "",
    atletaCognome: "",
    atletaDataNascita: "",
    atletaTelefono: "",
    atletaEmail: "",
    genitoreNome: "",
    genitoreCognome: "",
    genitoreTelefono: "",
    genitoreEmail: "",
    corsoId: corsi[0]?.id ?? "",
    frequenza: corsi[0]?.listini[0]?.frequenza_settimanale ?? 1,
    listinoId: corsi[0]?.listini[0]?.id ?? "",
    consensoPrivacy: false,
    consensoGenitore: false,
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

  const listinoSelezionato = corsoSelezionato?.listini.find(
    (l) => l.id === form.listinoId
  );

  const prezzoTotale = listinoSelezionato
    ? listinoSelezionato.importo_rata * listinoSelezionato.numero_rate +
      impostazioni.quota_iscrizione
    : null;

  function aggiorna<K extends keyof typeof form>(campo: K, valore: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valore }));
  }

  function cambiaCorso(corsoId: string) {
    const corso = corsi.find((c) => c.id === corsoId);
    const primaFrequenza = corso?.listini[0]?.frequenza_settimanale ?? 1;
    const primoListino = corso?.listini.find(
      (l) => l.frequenza_settimanale === primaFrequenza
    );
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
        return "Compila nome, cognome e data di nascita dell'atleta.";
      }
      if (new Date(form.atletaDataNascita) > new Date()) {
        return "La data di nascita non può essere nel futuro.";
      }
      if (minorenne) {
        if (!form.genitoreNome || !form.genitoreCognome || !form.genitoreTelefono) {
          return "Compila i dati del genitore/tutore.";
        }
      } else if (!form.atletaTelefono) {
        return "Inserisci un numero di telefono di contatto.";
      }
    }
    if (step === 2) {
      if (!form.listinoId) {
        return "Seleziona corso, frequenza e numero di rate.";
      }
    }
    if (step === 3) {
      if (!form.consensoPrivacy) {
        return "Devi accettare l'informativa privacy per proseguire.";
      }
      if (minorenne && !form.consensoGenitore) {
        return "È richiesta l'autorizzazione del genitore/tutore.";
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
    setStep((s) => Math.min(TOTALE_STEP, s + 1));
  }

  function indietro() {
    setErroreInvio("");
    setStep((s) => Math.max(1, s - 1));
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
      atletaDataNascita: form.atletaDataNascita,
      atletaTelefono: form.atletaTelefono.trim(),
      atletaEmail: form.atletaEmail.trim(),
      minorenne,
      genitoreNome: form.genitoreNome.trim(),
      genitoreCognome: form.genitoreCognome.trim(),
      genitoreTelefono: form.genitoreTelefono.trim(),
      genitoreEmail: form.genitoreEmail.trim(),
      listinoId: form.listinoId,
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

  return (
    <div className="mx-auto max-w-lg px-5 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <p className="font-display text-3xl font-bold tracking-tight text-court">
          Entra in campo con Micolani Tennis
        </p>
        <p className="mt-1 text-sm text-court-dark/70">
          Modulo di pre-iscrizione — stagione 20{impostazioni.stagione_etichetta}/
          {Number(impostazioni.stagione_etichetta) + 1}
        </p>
      </header>

      <BarraAvanzamento step={step} totale={TOTALE_STEP} />

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-court/10">
        {step === 1 && (
          <StepAtleta form={form} aggiorna={aggiorna} eta={eta} minorenne={minorenne} />
        )}
        {step === 2 && (
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
        {step === 3 && (
          <StepRiepilogo
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

          {step < 3 && (
            <button
              type="button"
              onClick={avanti}
              className="rounded-full bg-court px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-court-dark"
            >
              Continua
            </button>
          )}

          {step === 3 && (
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

function StepAtleta({
  form,
  aggiorna,
  eta,
  minorenne,
}: {
  form: any;
  aggiorna: any;
  eta: number | null;
  minorenne: boolean;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-court-dark">Dati dell'atleta</h2>

      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Nome">
          <input
            className={classeInput}
            value={form.atletaNome}
            onChange={(e) => aggiorna("atletaNome", e.target.value)}
          />
        </Campo>
        <Campo etichetta="Cognome">
          <input
            className={classeInput}
            value={form.atletaCognome}
            onChange={(e) => aggiorna("atletaCognome", e.target.value)}
          />
        </Campo>
      </div>

      <Campo etichetta="Data di nascita">
        <input
          type="date"
          max={new Date().toISOString().split("T")[0]}
          className={classeInput}
          value={form.atletaDataNascita}
          onChange={(e) => aggiorna("atletaDataNascita", e.target.value)}
        />
      </Campo>

      {eta !== null && (
        <p className="text-sm text-court-dark/60">
          {minorenne
            ? `Atleta minorenne (${eta} anni) — servono i dati del genitore/tutore.`
            : `Età: ${eta} anni.`}
        </p>
      )}

      {!minorenne && (
        <Campo etichetta="Telefono dell'atleta">
          <input
            type="tel"
            className={classeInput}
            value={form.atletaTelefono}
            onChange={(e) => aggiorna("atletaTelefono", e.target.value)}
          />
        </Campo>
      )}

      <Campo etichetta="Email dell'atleta (facoltativa)">
        <input
          type="email"
          className={classeInput}
          value={form.atletaEmail}
          onChange={(e) => aggiorna("atletaEmail", e.target.value)}
        />
      </Campo>

      {minorenne && (
        <div className="mt-2 space-y-4 rounded-xl bg-chalk p-4">
          <h3 className="font-display text-lg font-semibold text-court-dark">
            Dati del genitore/tutore
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="Nome">
              <input
                className={classeInput}
                value={form.genitoreNome}
                onChange={(e) => aggiorna("genitoreNome", e.target.value)}
              />
            </Campo>
            <Campo etichetta="Cognome">
              <input
                className={classeInput}
                value={form.genitoreCognome}
                onChange={(e) => aggiorna("genitoreCognome", e.target.value)}
              />
            </Campo>
          </div>
          <Campo etichetta="Telefono (contatto WhatsApp principale)">
            <input
              type="tel"
              className={classeInput}
              value={form.genitoreTelefono}
              onChange={(e) => aggiorna("genitoreTelefono", e.target.value)}
            />
          </Campo>
          <Campo etichetta="Email (facoltativa)">
            <input
              type="email"
              className={classeInput}
              value={form.genitoreEmail}
              onChange={(e) => aggiorna("genitoreEmail", e.target.value)}
            />
          </Campo>
        </div>
      )}
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
  form: any;
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
        <select
          className={classeInput}
          value={form.corsoId}
          onChange={(e) => cambiaCorso(e.target.value)}
        >
          {corsi.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} {c.fascia_eta ? `(${c.fascia_eta})` : ""}
            </option>
          ))}
        </select>
      </Campo>

      {corso?.durata_lezione && (
        <p className="text-sm text-court-dark/60">{corso.durata_lezione}</p>
      )}

      <Campo etichetta="Frequenza settimanale">
        <select
          className={classeInput}
          value={form.frequenza}
          onChange={(e) => cambiaFrequenza(Number(e.target.value))}
        >
          {frequenzeDisponibili.map((f) => (
            <option key={f} value={f}>
              {f} {f === 1 ? "volta" : "volte"} a settimana
            </option>
          ))}
        </select>
      </Campo>

      <Campo etichetta="Numero di rate">
        <select
          className={classeInput}
          value={form.listinoId}
          onChange={(e) => aggiorna("listinoId", e.target.value)}
        >
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
          <p className="font-display text-2xl font-bold text-court">
            {formattaEuro(prezzoTotale)}
          </p>
          <p className="text-sm text-court-dark/70">
            {listinoSelezionato.numero_rate > 1
              ? `${listinoSelezionato.numero_rate} rate da ${formattaEuro(
                  listinoSelezionato.importo_rata
                )}`
              : "Pagamento unico"}{" "}
            + quota d'iscrizione {formattaEuro(quotaIscrizione)} (kit e tessera FITP)
          </p>
        </div>
      )}
    </div>
  );
}

function StepRiepilogo({
  form,
  aggiorna,
  minorenne,
  corso,
  listino,
  prezzoTotale,
}: {
  form: any;
  aggiorna: any;
  minorenne: boolean;
  corso?: Corso;
  listino?: Listino;
  prezzoTotale: number | null;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-court-dark">
        Riepilogo e conferma
      </h2>

      <dl className="space-y-1.5 rounded-xl bg-chalk p-4 text-sm">
        <RigaRiepilogo etichetta="Atleta" valore={`${form.atletaNome} ${form.atletaCognome}`} />
        {minorenne && (
          <RigaRiepilogo
            etichetta="Genitore/tutore"
            valore={`${form.genitoreNome} ${form.genitoreCognome}`}
          />
        )}
        <RigaRiepilogo etichetta="Corso" valore={corso?.nome ?? "-"} />
        {listino && (
          <RigaRiepilogo
            etichetta="Frequenza"
            valore={`${listino.frequenza_settimanale}x a settimana`}
          />
        )}
        {prezzoTotale !== null && (
          <RigaRiepilogo etichetta="Totale" valore={formattaEuro(prezzoTotale)} />
        )}
      </dl>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={form.consensoPrivacy}
          onChange={(e) => aggiorna("consensoPrivacy", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-court/40"
        />
        <span className="text-sm text-court-dark/80">
          Ho preso visione dell'informativa privacy e acconsento al trattamento dei dati
          necessario all'iscrizione. Dichiaro che i dati inseriti sono corretti.
        </span>
      </label>

      {minorenne && (
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={form.consensoGenitore}
            onChange={(e) => aggiorna("consensoGenitore", e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-court/40"
          />
          <span className="text-sm text-court-dark/80">
            Confermo di essere genitore/tutore dell'atleta e autorizzo l'iscrizione.
          </span>
        </label>
      )}
    </div>
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
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 py-12 text-center">
      <div className="w-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-court/10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ace">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-court" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
            {impostazioni.rata3_scadenza &&
              risultato.numeroRate > 2 &&
              `, ${formattaData(impostazioni.rata3_scadenza)}`}
          </p>
        )}

        <p className="mt-4 text-sm text-court-dark/70">
          Conserva questo codice. Per completare la procedura premi il pulsante qui sotto.
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
