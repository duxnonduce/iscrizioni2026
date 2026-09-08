-- ===================================================================
-- Micolani Tennis - Schema iscrizioni (v2 - listini prezzi reali)
-- Incolla questo intero script nel Supabase SQL Editor ed esegui.
-- Se stai aggiornando da una versione precedente, esegui prima:
--   drop table if exists iscrizioni;
--   drop table if exists listini;
--   drop table if exists corsi;
--   drop table if exists impostazioni;
-- ===================================================================

create extension if not exists pgcrypto;

-- Impostazioni generali (riga singola)
create table if not exists impostazioni (
  id int primary key default 1,
  stagione_etichetta text not null default '26',
  whatsapp_numero text not null,
  quota_iscrizione numeric not null default 100,
  inizio_corsi date,
  fine_corsi date,
  rata1_scadenza date,
  rata2_scadenza date,
  rata3_scadenza date,
  constraint una_sola_riga check (id = 1)
);

insert into impostazioni (
  id, stagione_etichetta, whatsapp_numero, quota_iscrizione,
  inizio_corsi, fine_corsi, rata1_scadenza, rata2_scadenza, rata3_scadenza
)
values (
  1, '26', '393518167085', 100,
  '2026-09-14', '2027-07-11', '2026-09-20', '2026-12-20', '2027-03-21'
)
on conflict (id) do nothing;

-- Corsi
create table if not exists corsi (
  id uuid primary key default gen_random_uuid(),
  codice text unique not null,
  nome text not null,
  fascia_eta text,
  durata_lezione text,
  attivo boolean not null default true,
  ordine int not null default 0
);

insert into corsi (codice, nome, fascia_eta, durata_lezione, ordine) values
  ('baby_tennis', 'Baby Tennis', '3-5 anni', 'Seduta di 1 ora', 1),
  ('avviamento', 'Corso Avviamento', '5-17 anni', 'Seduta di 2 ore', 2),
  ('agonistico', 'Corso Agonistico', '5-17 anni', '2h30, di cui 90 min tennis e 60 min atletica', 3),
  ('agonistico_pro', 'Corso Agonistico Pro', '5-17 anni - rapporto 1:2', '2h30, di cui 90 min tennis e 60 min atletica', 4),
  ('adulti_avviamento', 'Adulti Avviamento', '18+ anni', 'Seduta di 60 minuti', 5),
  ('adulti_pro', 'Adulti Pro', '18+ anni', 'Seduta di 90 minuti', 6)
on conflict (codice) do nothing;

-- Listino: una riga per ogni combinazione corso x frequenza settimanale x numero rate.
-- L'importo per rata NON e' una divisione proporzionale del totale: e' un valore
-- fisso di listino (pagare a rate costa di piu' del pagamento unico).
create table if not exists listini (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references corsi(id) on delete cascade,
  frequenza_settimanale int not null,
  numero_rate int not null,
  importo_rata numeric not null,
  unique (corso_id, frequenza_settimanale, numero_rate)
);

-- Popola il listino con i prezzi reali (stagione 2026/2027)
do $$
declare
  id_baby uuid; id_avv uuid; id_ago uuid; id_ago_pro uuid; id_ad_avv uuid; id_ad_pro uuid;
begin
  select id into id_baby from corsi where codice = 'baby_tennis';
  select id into id_avv from corsi where codice = 'avviamento';
  select id into id_ago from corsi where codice = 'agonistico';
  select id into id_ago_pro from corsi where codice = 'agonistico_pro';
  select id into id_ad_avv from corsi where codice = 'adulti_avviamento';
  select id into id_ad_pro from corsi where codice = 'adulti_pro';

  insert into listini (corso_id, frequenza_settimanale, numero_rate, importo_rata) values
    (id_baby, 1, 1, 350),
    (id_baby, 1, 5, 80)
  on conflict do nothing;

  insert into listini (corso_id, frequenza_settimanale, numero_rate, importo_rata) values
    (id_avv, 1, 1, 531), (id_avv, 1, 2, 280), (id_avv, 1, 3, 195),
    (id_avv, 2, 1, 950), (id_avv, 2, 2, 500), (id_avv, 2, 3, 350),
    (id_avv, 3, 1, 1266), (id_avv, 3, 2, 666), (id_avv, 3, 3, 466)
  on conflict do nothing;

  insert into listini (corso_id, frequenza_settimanale, numero_rate, importo_rata) values
    (id_ad_avv, 1, 1, 475), (id_ad_avv, 1, 2, 250), (id_ad_avv, 1, 3, 175),
    (id_ad_avv, 2, 1, 855), (id_ad_avv, 2, 2, 450), (id_ad_avv, 2, 3, 316),
    (id_ad_avv, 3, 1, 1140), (id_ad_avv, 3, 2, 600), (id_ad_avv, 3, 3, 420)
  on conflict do nothing;

  insert into listini (corso_id, frequenza_settimanale, numero_rate, importo_rata) values
    (id_ad_pro, 1, 1, 665), (id_ad_pro, 1, 2, 350), (id_ad_pro, 1, 3, 245),
    (id_ad_pro, 2, 1, 1140), (id_ad_pro, 2, 2, 600), (id_ad_pro, 2, 3, 420),
    (id_ad_pro, 3, 1, 1614), (id_ad_pro, 3, 2, 850), (id_ad_pro, 3, 3, 595)
  on conflict do nothing;

  insert into listini (corso_id, frequenza_settimanale, numero_rate, importo_rata) values
    (id_ago, 2, 1, 1330), (id_ago, 2, 2, 700), (id_ago, 2, 3, 490),
    (id_ago, 3, 1, 1710), (id_ago, 3, 2, 900), (id_ago, 3, 3, 630),
    (id_ago, 4, 1, 2090), (id_ago, 4, 2, 1100), (id_ago, 4, 3, 770),
    (id_ago, 5, 1, 2470), (id_ago, 5, 2, 1300), (id_ago, 5, 3, 910)
  on conflict do nothing;

  insert into listini (corso_id, frequenza_settimanale, numero_rate, importo_rata) values
    (id_ago_pro, 2, 1, 2660), (id_ago_pro, 2, 2, 1400), (id_ago_pro, 2, 3, 980),
    (id_ago_pro, 3, 1, 3420), (id_ago_pro, 3, 2, 1800), (id_ago_pro, 3, 3, 1260),
    (id_ago_pro, 4, 1, 4180), (id_ago_pro, 4, 2, 2200), (id_ago_pro, 4, 3, 1540),
    (id_ago_pro, 5, 1, 4940), (id_ago_pro, 5, 2, 2600), (id_ago_pro, 5, 3, 1820)
  on conflict do nothing;
end $$;

-- Iscrizioni ricevute dal form pubblico
create table if not exists iscrizioni (
  id uuid primary key default gen_random_uuid(),
  codice text unique not null,

  -- Dati allievo
  atleta_nome text not null,
  atleta_cognome text not null,
  atleta_codice_fiscale text,
  atleta_data_nascita date not null,
  atleta_luogo_nascita text,
  atleta_sesso text,
  atleta_cittadinanza text,
  atleta_indirizzo text,
  atleta_comune text,
  atleta_provincia text,
  atleta_cap text,
  atleta_telefono text,
  atleta_email text,
  minorenne boolean not null default false,
  preferenze_giorni text,
  preferenze_orari text,
  note_esigenze text,

  -- Dati genitore/tutore (obbligatori se minorenne)
  genitore_nome text,
  genitore_cognome text,
  genitore_codice_fiscale text,
  genitore_data_nascita date,
  genitore_luogo_nascita text,
  genitore_indirizzo text,
  genitore_comune text,
  genitore_provincia text,
  genitore_cap text,
  genitore_telefono text,
  genitore_whatsapp text,
  genitore_email text,
  genitore_rapporto text,
  secondo_recapito_nome text,
  secondo_recapito_telefono text,
  emergenza_nome text,
  emergenza_telefono text,
  persone_autorizzate_ritiro text,

  -- Corso
  corso_id uuid references corsi(id),
  listino_id uuid references listini(id),
  frequenza_settimanale int not null,
  numero_rate int not null,
  importo_rata numeric not null,
  quota_iscrizione numeric not null,
  prezzo_totale numeric not null,

  -- Dati per fatturazione
  fatturazione_uguale_genitore boolean not null default true,
  fatturazione_intestatario text,
  fatturazione_codice_fiscale text,
  fatturazione_partita_iva text,
  fatturazione_indirizzo text,
  fatturazione_comune text,
  fatturazione_provincia text,
  fatturazione_cap text,
  fatturazione_email text,
  fatturazione_pec text,
  fatturazione_sdi text,
  fatturazione_soggetto_pagante text,
  fatturazione_metodo_pagamento text,
  fatturazione_richiesta_documento boolean not null default false,

  -- Consensi
  consenso_dati_corretti boolean not null default false,
  consenso_regolamento boolean not null default false,
  consenso_privacy boolean not null default false,
  consenso_autorizzazione boolean not null default false,
  consenso_promozionale boolean not null default false,
  consenso_foto_video boolean not null default false,
  consenso_whatsapp_gruppi boolean not null default false,
  versione_informativa text,

  -- Dati tecnici della procedura online
  ip_address text,
  user_agent text,

  -- Conferma manuale da parte della segreteria
  confermata boolean not null default false,
  confermata_il timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists idx_iscrizioni_codice on iscrizioni (codice);
create index if not exists idx_iscrizioni_created_at on iscrizioni (created_at desc);

-- Migrazione idempotente: se la tabella esisteva già senza queste colonne
-- (installazione precedente), le aggiunge senza bisogno di ricreare tutto.
alter table iscrizioni add column if not exists confermata boolean not null default false;
alter table iscrizioni add column if not exists confermata_il timestamptz;

alter table impostazioni enable row level security;
alter table corsi enable row level security;
alter table listini enable row level security;
alter table iscrizioni enable row level security;
