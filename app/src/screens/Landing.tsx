import { Button } from '../components/ui'

/** Pagine di presentazione: gli stessi testi di skilldeckpro.com/diventa-skipper e /diventa-crew. */
interface Step { tagline: string; title: string; desc: string }
interface Page {
  title: string; subtitle: string; steps: Step[]
  why: { title: string; paragraphs: string[]; strong?: string }
  test?: { title: string; desc: string; pass: string; fail: string; free: string }
  costs?: { title: string; free: string; paragraphs: string[]; datesTitle: string; datesIntro: string; dates: string[]; binding: string }
  ctaTitle: string; ctaSubtitle: string
}
const skipper: Page = {
  title: 'Diventa Skipper',
  subtitle: 'Water Tribe è un Tour Operator e un RYA Training Center, leader italiano da oltre 25 anni nelle vacanze in barca a vela, nei corsi di vela e nella certificazione dello staff marittimo. SkillDeck Pro è la piattaforma con cui gestiamo candidature, test e Career del nostro staff: qui sotto trovi il percorso completo, passo dopo passo.',
  steps: [
    { tagline: 'Raccontaci di te', title: 'Application', desc: 'Compila la candidatura qui su SkillDeck Pro: potrai raccontarci le esperienze maturate sul campo, le abilitazioni che hai conseguito e fornirci una tua autovalutazione su diverse tematiche tecniche. Crea un account registrandoti ed inizia a compilare la sezione Anagrafica, Documenti e certificazioni, Logbook e CV. Ti contatteremo per una breve intervista e per conoscerci meglio.' },
    { tagline: 'Partecipa al test', title: 'Invito', desc: 'Dopo l\'invio della candidatura riceverai una mail di convocazione al test, che potrà essere svolto solo su invito. Riceverai un link dove registrarti per il test WT che si terrà il giorno 16 novembre 2026.' },
    { tagline: 'Conferma le tue skills', title: 'Test', desc: '60 domande a risposta multipla online: con il 75% di risposte corrette si accede al percorso di selezione del nostro staff.' },
    { tagline: 'Allineati al nostro team', title: 'Career a terra', desc: 'La Skipper Career è il nostro processo annuale di selezione e allineamento. La parte teorica si articola su due appuntamenti serali nei quali affronteremo, con i nostri formatori RYA Yachtmaster, tutte le tematiche relative alle procedure dello staff, l\'analisi del meteo, la pianificazione della rotta e la gestione dell\'equipaggio. Superato il test riceverai una mail di conferma con un link per poterti registrare al corso Water Tribe Career 2027.' },
    { tagline: 'Allineati al nostro team', title: 'Career in mare', desc: 'La parte pratica della Skipper Career prevede 3 giornate in mare con i tuoi futuri colleghi e i nostri formatori RYA Yachtmaster. Affronterai il check dell\'imbarcazione, l\'analisi degli impianti, la risoluzione delle avarie, la gestione delle emergenze e le manovre a vela e motore. La prossima selezione avrà luogo in Grecia ad Atene i giorni 18-21 marzo 2027.' },
    { tagline: 'Sei a bordo', title: 'I tuoi ingaggi', desc: 'Se verrai selezionato/a come skipper o co-skipper, potrai far parte del nostro team e svolgere il lavoro più bello del mondo! Conoscerai oltre 300 persone che ogni stagione vengono ingaggiate in Mediterraneo, Mar dei Caraibi e Oceano Indiano. Ti verrà richiesta una disponibilità da un minimo di 1 a un massimo di 8 settimane l\'anno.' },
  ],
  why: {
    title: 'Perché lavorare con noi',
    paragraphs: [
      'Ogni anno Water Tribe gestisce più di 200 settimane di vacanze in flottiglia e charter in Mediterraneo, Mar dei Caraibi e Oceano Indiano.',
      'Collaborano con noi oltre 300 persone di staff tra steward, hostess, co-skipper e comandanti. Persone eccezionali alle quali forniamo annualmente un aggiornamento per essere a conoscenza di tutte le procedure in vigore nel turismo nautico: dalle policy sulla sicurezza, alle tutele assicurative, alle procedure adottate nel pre-partenza, durante la navigazione, lo sbarco, l\'analisi della meteo, le emergenze e le tecniche di ormeggio e ancoraggio in flotta. Un lavoro in continua evoluzione, sviluppato sulle centinaia di feedback che ogni anno analizziamo per aggiornare i nostri protocolli.',
    ],
    strong: 'Offriamo fino a 8 settimane di comando l\'anno a uno staff profilato per competenze, certificazioni, aree di navigazione conosciute e lingue parlate.',
  },
  test: {
    title: 'Come funziona il test',
    desc: 'Il test è composto da 60 domande a risposta multipla che dovranno essere svolte in 45 minuti.',
    pass: 'Con il 75% di risposte corrette (almeno 45 risposte corrette su 60) si accede al percorso di selezione Skipper Career.',
    fail: 'Un punteggio inferiore al 75% (meno di 45 risposte corrette su 60) non consente al candidato/a di partecipare al percorso di selezione.',
    free: 'La partecipazione al test è gratuita, ma solo su invito: dovrai prima creare il tuo profilo e caricare le tue certificazioni su SkillDeck Pro.',
  },
  costs: {
    title: 'Costi e prossime date',
    free: 'La partecipazione al test Water Tribe Standard è gratuita ma su invito.',
    paragraphs: [
      'Se avrai superato i requisiti minimi richiesti nel test, potrai iscriverti alla Skipper Career supportando i costi d\'iscrizione. I costi di partecipazione sono stati resi minimi e forfettari per rendere la partecipazione alla portata di tutti: per il 2027 la quota è stata calmierata a 290 € a persona per i 2 appuntamenti a terra e le 3 giornate in mare.',
      'Teniamo molto alla selezione, alla formazione e all\'allineamento dei nostri Skipper: per questo Water Tribe investe ingenti risorse ogni stagione per la tutela e la crescita del proprio staff, dalle gratuità e sconti nei percorsi formativi, alle assicurazioni RC Terzi sugli operatori, sui depositi cauzionali e alle divise.',
    ],
    datesTitle: 'Come funziona la selezione',
    datesIntro: 'La Skipper Career si sviluppa su 3 appuntamenti da gennaio a marzo:',
    dates: ['una parte a terra (2 serate online con test finale) il 18 gennaio e il 22 febbraio 2027;', 'una parte in mare (3 giornate di navigazione ad Atene) dal 18 al 21 marzo 2027.'],
    binding: 'La partecipazione al percorso di selezione è vincolante per entrare a far parte dello staff Water Tribe.',
  },
  ctaTitle: 'Pronto a salire a bordo?',
  ctaSubtitle: 'Il primo passo è la candidatura: raccontaci chi sei, le tue esperienze e le tue abilitazioni. Ti guideremo noi in tutto il resto.',
}
const crew: Page = {
  title: 'Diventa Crew Assistant',
  subtitle: 'Be Skilled è un Training Center della Royal Yachting Association, l\'ente di certificazione nautica più diffuso al mondo. Hanno navigato con noi oltre 20.000 velisti, 250 persone di staff e 180 aziende da tutta Europa. SkillDeck Pro è la piattaforma con cui gestiamo candidature, test e Career dello staff di bordo: Crew Assistant, Hostess e Steward. Qui sotto trovi il percorso completo, passo dopo passo.',
  steps: [
    { tagline: 'Raccontaci di te', title: 'Application', desc: 'Compila la candidatura qui su SkillDeck Pro: potrai raccontarci le esperienze maturate sul campo, le abilitazioni che hai conseguito e fornirci una tua autovalutazione su diverse tematiche tecniche.' },
    { tagline: 'Conosciamoci', title: 'Intervista', desc: 'Verrai contattato/a da un nostro referente alla selezione per una breve intervista online di 10 minuti, al termine della quale ti verrà confermata l\'idoneità a partecipare alla selezione. Potrai così procedere al test di ingresso.' },
    { tagline: 'Conferma le tue skills', title: 'Test', desc: 'Sostieni il test online di 30 domande a risposta multipla: con il 70% di risposte corrette accedi gratuitamente al percorso di allineamento; con almeno il 50% accedi a un percorso di formazione mirato a colmare il divario di competenze con i colleghi.' },
    { tagline: 'Allineati al nostro team', title: 'Career', desc: 'La Crew Assistant Career è il nostro processo annuale di selezione e allineamento. Si sviluppa in 1 giornata di attività online o presso la sede di Milano, durante la quale vengono trattate tutte le tematiche essenziali per svolgere a livello professionale le mansioni di Hostess o Steward di bordo.' },
    { tagline: 'Sei a bordo', title: 'I tuoi ingaggi', desc: 'Se verrai selezionato/a come Crew Assistant potrai far parte del nostro team e salpare con noi! Ti verrà richiesta una disponibilità da un minimo di 1 a un massimo di 8 settimane l\'anno.' },
  ],
  why: {
    title: 'Perché lavorare con noi',
    paragraphs: ['Entrerai in una squadra di oltre 250 persone che ogni stagione vengono ingaggiate nel Mediterraneo, nel Mar dei Caraibi e nell\'Oceano Indiano.'],
    strong: 'Disponibilità richiesta: da 1 a 8 settimane l\'anno.',
  },
  ctaTitle: 'Pronto/a a salire a bordo?',
  ctaSubtitle: 'Il primo passo è la candidatura: raccontaci chi sei, le tue esperienze e le tue abilitazioni. Ti guideremo noi in tutto il resto.',
}

const card = 'rounded-2xl border border-line bg-card p-5'
export default function Landing({ kind }: { kind: 'skipper' | 'crew' }) {
  const p = kind === 'skipper' ? skipper : crew
  const apply = `#/candidatura/${kind}`
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <a href="#/" className="flex items-center gap-2 text-sm font-semibold text-ink"><span aria-hidden>‹</span><img src="/logo-mark.png" alt="" className="h-8 w-8" />SkillDeck Pro</a>
          <a href={apply} className="grid h-11 place-items-center rounded-xl bg-ink px-4 text-sm font-semibold text-white">Compila la candidatura</a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold lg:text-4xl">{p.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-ink-soft">{p.subtitle}</p>
        </div>
        <ol className="space-y-3">
          {p.steps.map((s, i) => (
            <li key={s.title} className={`${card} flex gap-4`}>
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-base font-semibold text-white">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-sea uppercase">{s.tagline}</p>
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <section className={card}>
          <h2 className="text-lg font-semibold">{p.why.title}</h2>
          <div className="mt-2 space-y-2 text-sm text-ink-soft">
            {p.why.paragraphs.map((t) => <p key={t}>{t}</p>)}
            {p.why.strong && <p className="font-semibold text-ink">{p.why.strong}</p>}
          </div>
        </section>
        {p.test && (
          <section className={card}>
            <h2 className="text-lg font-semibold">{p.test.title}</h2>
            <div className="mt-2 space-y-2 text-sm text-ink-soft">
              <p>{p.test.desc}</p>
              <p className="flex gap-2"><span aria-hidden className="font-semibold text-ok">✓</span><span>{p.test.pass}</span></p>
              <p className="flex gap-2"><span aria-hidden className="font-semibold text-bad">✕</span><span>{p.test.fail}</span></p>
              <p className="font-semibold text-ink">{p.test.free}</p>
            </div>
          </section>
        )}
        {p.costs && (
          <section className={card}>
            <h2 className="text-lg font-semibold">{p.costs.title}</h2>
            <div className="mt-2 space-y-2 text-sm text-ink-soft">
              <p className="font-semibold text-ink">{p.costs.free}</p>
              {p.costs.paragraphs.map((t) => <p key={t}>{t}</p>)}
              <div className="rounded-xl bg-sand p-4">
                <p className="font-semibold text-ink">{p.costs.datesTitle}</p>
                <p className="mt-1">{p.costs.datesIntro}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">{p.costs.dates.map((d) => <li key={d}>{d}</li>)}</ul>
                <p className="mt-2 font-semibold text-ink">{p.costs.binding}</p>
              </div>
            </div>
          </section>
        )}
        <section className="rounded-2xl bg-ink p-6 text-center text-white">
          <h2 className="text-xl font-semibold">{p.ctaTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">{p.ctaSubtitle}</p>
          <a href={apply} className="mx-auto mt-4 grid h-12 max-w-xs place-items-center rounded-xl bg-white text-base font-semibold text-ink">Compila la candidatura</a>
        </section>
        <a href="#/"><Button variant="ghost">Hai già un accesso? Entra</Button></a>
      </main>
    </div>
  )
}
