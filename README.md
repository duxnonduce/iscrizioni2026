# Micolani Tennis — Iscrizioni

Modulo pubblico di pre-iscrizione + vista segreteria. Stack: Next.js + Supabase + Vercel.

## 1. Supabase

1. Crea un progetto su supabase.com (o usane uno esistente).
2. Vai su **SQL Editor** → incolla tutto il contenuto di `supabase/schema.sql` → **Run**.
3. Vai su **Authentication → Users** → **Add user** → crea l'account della segreteria
   (email + password). È l'unico account che serve, non ci sono ruoli separati.
4. Vai su **Project Settings → API** e copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ tienila segreta, va solo su Vercel)

## 2. Corsi, listino prezzi e stagione

Lo schema è già popolato con i 6 corsi reali (Baby Tennis, Avviamento,
Agonistico, Agonistico Pro, Adulti Avviamento, Adulti Pro) e il listino
prezzi 2026/2027 preso dalle brochure. Ogni combinazione corso × frequenza
settimanale × numero rate ha un importo fisso (non è una divisione
proporzionale: pagare a rate costa di più del pagamento unico) — tutto
modificabile dalla vista segreteria una volta online, senza toccare il codice.

Nella tabella `impostazioni` (Table Editor su Supabase) puoi modificare:
- `whatsapp_numero`: numero WhatsApp Business della segreteria, con prefisso
  internazionale, solo cifre (es. `393331234567`)
- `quota_iscrizione`: quota fissa (kit + tessera FITP), default 100€
- `inizio_corsi` / `fine_corsi`: date informative della stagione
- `rata1_scadenza` / `rata2_scadenza` / `rata3_scadenza`: scadenze mostrate
  nella schermata di conferma quando l'iscrizione è a rate

**Sconto family**: il form NON lo calcola. Se più componenti dello stesso
nucleo si iscrivono, la segreteria applica lo sconto del 5% manualmente
(fuori da questo sistema).

## 3. GitHub + Vercel

1. Crea un nuovo repository su GitHub e carica tutti questi file (drag & drop
   della cartella funziona).
2. Su Vercel: **Add New Project** → importa il repository.
3. In **Environment Variables** aggiungi le tre chiavi di Supabase (punto 1).
4. Deploy.

## Pagine

- `/iscrizione` — modulo pubblico (è anche la home page, `/` reindirizza qui)
- `/admin` — login segreteria
- `/admin/dashboard` — elenco anagrafiche, ricerca, modifica prezzi corsi

## Note

- Non c'è area atleti/genitori dopo l'invio: una volta inviata l'anagrafica,
  l'utente vede solo la schermata di conferma con il codice.
- Il codice di conferma (es. `MIC-26-A7K4P`) evita caratteri ambigui (niente O/0, I/1).
- Il prezzo viene ricalcolato anche lato server al momento dell'invio, non ci
  si fida del valore mostrato nel browser.
- La conferma su WhatsApp è manuale: il messaggio precompilato arriva alla
  segreteria, che verifica il codice nel pannello.
