// Alfabeto senza caratteri ambigui: niente O/0, I/1
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generaCodiceGrezzo(stagione: string): string {
  let parte = "";
  for (let i = 0; i < 5; i++) {
    parte += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return `MIC-${stagione}-${parte}`;
}
