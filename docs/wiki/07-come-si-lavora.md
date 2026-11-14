# 07 · Come si lavora

## Procedura per ogni modifica

1. Leggere la [Bussola](00-bussola.md).
2. Se serve il database: scrivere la migrazione, applicarla al collaudo, provarla in una transazione poi annullata, salvare il file in `supabase/migrations`.
3. Scrivere il codice. Nella cartella `app`: `npx tsc -b`, `npm test`, `npx vite build`. Tutti e tre devono passare prima di pubblicare.
4. Guardare la schermata in locale (`npx vite --port 5199`, esempi con `?demo=registrato|percorso|ready|admin`).
5. Pubblicare su `main`: il sito di collaudo si aggiorna da solo. Controllare che la pubblicazione sia andata a buon fine.
6. Aggiornare Bussola, tabella delle funzioni e, se cambia il prodotto, il documento unico.

## Vincoli

- La piattaforma attuale (skilldeckpro.com, repository beskilled, progetto Lovable) è in **sola lettura**. Il test del 16/11/2026 non si tocca.
- Nessun segreto, chiave o dato personale in chat, nel codice o nella wiki.
- Nessuna email, WhatsApp o pubblicazione verso persone vere senza comando esplicito dell'owner.
- Mai cancellare dati di persone.
- Le password le inserisce solo l'owner.

## Limiti dell'ambiente di lavoro di Claude

- Non raggiunge né il sito di collaudo né Supabase dal proprio computer di lavoro: parla col database solo attraverso il connettore, e le prove dal vivo le fa l'owner. Per questo esiste il registro degli errori.
- Il connettore del database vuole il testo intero della migrazione.

## Trappole già incontrate

| Trappola | Rimedio |
|---|---|
| Un'importazione non usata blocca la pubblicazione | Eseguire sempre `npx tsc -b` prima di pubblicare |
| Il telefono mostrava una versione vecchia | Avviso di versione nuova e pagine senza memoria temporanea |
| La posta di prova di Supabase rifiuta molti indirizzi e ha un tetto orario | Serve la posta sul dominio prima di aprire agli utenti |
| Le tabelle nuove nascevano con permessi di base troppo larghi | Corretto alla radice nella migrazione 0015; lo verifica il controllo di salute |
| Nelle funzioni del database un nome di colonna uguale a un nome di variabile dà errore | Dare sempre un alias alle colonne |
| Ora dei colloqui | Sempre ora di Roma, mai l'ora del dispositivo |

## Prova di una regola sul database

```sql
begin;
do $$ begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"<id utente>","role":"authenticated"}', true);
  -- operazione da provare
  raise exception 'ESITO %', 'testo';
end $$;
rollback;
```
