# Wiki di SkillDeck V3

Questa cartella è la memoria tecnica del progetto. Vive nel repository, quindi cambia insieme al codice e ogni modifica resta nella storia.

**Regola unica:** chi lavora sul progetto (persona o Claude) legge la [Bussola](00-bussola.md) prima di cominciare e la aggiorna prima di chiudere. Se una pagina non è più vera, si corregge nello stesso commit che ha cambiato le cose.

| Pagina | A cosa serve |
|---|---|
| [00 · Bussola](00-bussola.md) | Dove siamo: cosa funziona, cosa va sistemato, cosa manca, cosa viene dopo |
| [01 · Visione e regole](01-visione-e-regole.md) | Perché esiste la V3 e le regole che non si discutono |
| [02 · Architettura](02-architettura.md) | Come sono collegati GitHub, Firebase e Supabase; mappa dei file |
| [03 · Database](03-database.md) | Tabelle, migrazioni, comandi, modello di sicurezza |
| [04 · Funzioni](04-funzioni.md) | Ogni funzione costruita, con lo stato di verifica |
| [05 · Salute e qualità](05-salute-e-qualita.md) | Controllo di salute, registro errori, prove automatiche, ruoli di revisione |
| [06 · Decisioni](06-decisioni.md) | Le decisioni prese, con data e motivo |
| [07 · Come si lavora](07-come-si-lavora.md) | Procedura, vincoli dell'ambiente, trappole già incontrate |

Il progetto del prodotto (cosa deve fare la piattaforma, per chi, con quali regole) sta nel **documento unico**: https://claude.ai/artifact/SBTsE6g2bZByfVmKcACM2q. La wiki non lo ripete: dice come è costruito e a che punto è.

Livelli di verifica usati in tutta la wiki:
- **Provato dal vivo**: l'owner l'ha usato sul sito di collaudo.
- **Provato sul database**: comando o regola eseguiti sul database di collaudo in una transazione poi annullata.
- **Provato in locale**: schermata aperta in locale con dati di esempio, oppure prova automatica.
- **Solo compilato**: il codice compila, nessuno l'ha ancora eseguito.
