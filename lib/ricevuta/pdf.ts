import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { LOGO_PNG_BASE64 } from "../logoMicolani";

export type DatiRicevuta = {
  tipo: "ricevuta" | "conferma";
  numero: string;
  dataPagamento: string | null; // ISO yyyy-mm-dd
  intestatario: string;
  atleta: string;
  causale: string;
  importo: number;
  metodo: string | null;
  operatore: string | null;
  emessaIl: string; // ISO datetime
  societa: {
    ragioneSociale: string;
    indirizzo: string | null;
    partitaIva: string | null;
    codiceFiscale: string | null;
    dicitura: string | null;
  };
};

// Il font standard del PDF supporta il set Latin-1 + €: sostituisco il resto
function pulisci(testo: string): string {
  return (testo ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC\u2018\u2019\u201C\u201D\u2013\u2014\u2022]/g, "?");
}

function avvolgi(testo: string, font: PDFFont, size: number, larghezzaMax: number): string[] {
  const parole = pulisci(testo).split(/\s+/).filter(Boolean);
  const righe: string[] = [];
  let corrente = "";
  for (const parola of parole) {
    const prova = corrente ? `${corrente} ${parola}` : parola;
    if (font.widthOfTextAtSize(prova, size) <= larghezzaMax) {
      corrente = prova;
    } else {
      if (corrente) righe.push(corrente);
      corrente = parola;
    }
  }
  if (corrente) righe.push(corrente);
  return righe.length ? righe : [""];
}

function formattaEuro(valore: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(valore);
}

function formattaData(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export async function generaPdfRicevuta(dati: DatiRicevuta): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = pagina.getSize();
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);

  const inchiostro = rgb(0.06, 0.09, 0.2);
  const grigio = rgb(0.4, 0.43, 0.5);
  const linea = rgb(0.85, 0.87, 0.9);
  const margine = 50;
  const larghezzaUtile = width - margine * 2;

  // --- Intestazione: logo + titolo documento ---
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const altezzaLogo = 70;
  const larghezzaLogo = (logo.width / logo.height) * altezzaLogo;
  pagina.drawImage(logo, { x: margine, y: height - margine - altezzaLogo, width: larghezzaLogo, height: altezzaLogo });

  const titolo = dati.tipo === "ricevuta" ? "RICEVUTA DI PAGAMENTO" : "CONFERMA DI PAGAMENTO";
  const larghezzaTitolo = grassetto.widthOfTextAtSize(titolo, 17);
  pagina.drawText(titolo, {
    x: width - margine - larghezzaTitolo,
    y: height - margine - 22,
    size: 17,
    font: grassetto,
    color: inchiostro,
  });
  const testoNumero = `N. ${dati.numero}`;
  const larghezzaNumero = grassetto.widthOfTextAtSize(testoNumero, 13);
  pagina.drawText(testoNumero, {
    x: width - margine - larghezzaNumero,
    y: height - margine - 44,
    size: 13,
    font: grassetto,
    color: rgb(0.2, 0.36, 0.8),
  });
  const testoData = `Data pagamento: ${formattaData(dati.dataPagamento)}`;
  const larghezzaData = normale.widthOfTextAtSize(pulisci(testoData), 10);
  pagina.drawText(pulisci(testoData), {
    x: width - margine - larghezzaData,
    y: height - margine - 62,
    size: 10,
    font: normale,
    color: grigio,
  });

  let y = height - margine - altezzaLogo - 30;
  pagina.drawLine({ start: { x: margine, y }, end: { x: width - margine, y }, thickness: 1, color: linea });
  y -= 26;

  // --- Soggetto che incassa ---
  pagina.drawText("EMESSO DA", { x: margine, y, size: 8.5, font: grassetto, color: grigio });
  y -= 15;
  for (const riga of avvolgi(dati.societa.ragioneSociale, grassetto, 11, larghezzaUtile)) {
    pagina.drawText(riga, { x: margine, y, size: 11, font: grassetto, color: inchiostro });
    y -= 15;
  }
  const righeAnagrafica = [
    dati.societa.indirizzo,
    [dati.societa.partitaIva ? `P.IVA ${dati.societa.partitaIva}` : null, dati.societa.codiceFiscale ? `C.F. ${dati.societa.codiceFiscale}` : null]
      .filter(Boolean)
      .join("  -  "),
  ].filter((r): r is string => !!r && r.length > 0);
  for (const r of righeAnagrafica) {
    for (const sub of avvolgi(r, normale, 10, larghezzaUtile)) {
      pagina.drawText(sub, { x: margine, y, size: 10, font: normale, color: grigio });
      y -= 14;
    }
  }
  y -= 16;

  // --- Dati del pagamento ---
  const righe: Array<[string, string]> = [["Intestatario", dati.intestatario]];
  if (dati.atleta && dati.atleta.trim().toLowerCase() !== dati.intestatario.trim().toLowerCase()) {
    righe.push(["Atleta", dati.atleta]);
  }
  righe.push(["Descrizione", dati.causale]);
  righe.push(["Metodo di pagamento", dati.metodo || "-"]);

  const colonnaValore = margine + 150;
  for (const [etichetta, valore] of righe) {
    pagina.drawText(pulisci(etichetta), { x: margine, y, size: 10, font: normale, color: grigio });
    const sub = avvolgi(valore, grassetto, 11, larghezzaUtile - 150);
    for (const s of sub) {
      pagina.drawText(s, { x: colonnaValore, y, size: 11, font: grassetto, color: inchiostro });
      y -= 16;
    }
    y -= 6;
    pagina.drawLine({ start: { x: margine, y: y + 8 }, end: { x: width - margine, y: y + 8 }, thickness: 0.5, color: linea });
    y -= 8;
  }

  // --- Importo in evidenza ---
  y -= 10;
  pagina.drawRectangle({ x: margine, y: y - 52, width: larghezzaUtile, height: 62, color: rgb(0.94, 0.96, 1) });
  pagina.drawText("IMPORTO VERSATO", { x: margine + 18, y: y - 14, size: 9, font: grassetto, color: grigio });
  const testoImporto = pulisci(formattaEuro(dati.importo));
  pagina.drawText(testoImporto, { x: margine + 18, y: y - 42, size: 24, font: grassetto, color: inchiostro });
  y -= 90;

  // --- Informazioni fiscali ---
  const note: string[] = [];
  if (dati.societa.dicitura && dati.societa.dicitura.trim()) {
    note.push(dati.societa.dicitura.trim());
  }
  if (dati.tipo === "conferma") {
    note.push("Il presente documento è una conferma di avvenuto pagamento e non ha valore fiscale.");
  }
  for (const nota of note) {
    for (const sub of avvolgi(nota, normale, 9.5, larghezzaUtile)) {
      pagina.drawText(sub, { x: margine, y, size: 9.5, font: normale, color: grigio });
      y -= 13;
    }
    y -= 4;
  }

  // --- Piè di pagina ---
  const piede = [
    dati.operatore ? `Registrato da: ${dati.operatore}` : null,
    `Documento generato il ${new Date(dati.emessaIl).toLocaleString("it-IT")}`,
  ]
    .filter(Boolean)
    .join("   -   ");
  pagina.drawLine({ start: { x: margine, y: 62 }, end: { x: width - margine, y: 62 }, thickness: 0.5, color: linea });
  pagina.drawText(pulisci(piede), { x: margine, y: 46, size: 8.5, font: normale, color: grigio });
  const grazie = "Grazie per aver scelto Micolani Tennis";
  const larghezzaGrazie = grassetto.widthOfTextAtSize(grazie, 9);
  pagina.drawText(grazie, { x: width - margine - larghezzaGrazie, y: 46, size: 9, font: grassetto, color: inchiostro });

  pdf.setTitle(`${titolo} ${dati.numero}`);
  pdf.setAuthor(pulisci(dati.societa.ragioneSociale));
  pdf.setCreator("Micolani Tennis - gestionale iscrizioni");
  return await pdf.save();
}
