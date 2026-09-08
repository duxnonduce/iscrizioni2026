import { getDatiIniziali } from "./actions";
import IscrizioneForm from "./IscrizioneForm";

export const dynamic = "force-dynamic";

export default async function PaginaIscrizione() {
  const { corsi, impostazioni } = await getDatiIniziali();

  return (
    <main className="min-h-screen bg-chalk">
      <IscrizioneForm corsi={corsi} impostazioni={impostazioni} />
    </main>
  );
}
