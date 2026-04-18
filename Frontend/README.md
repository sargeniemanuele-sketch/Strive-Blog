# Frontend — Strive Blog

Interfaccia React che consuma le API backend.

## Avvio
```bash
npm install
npm run dev
```

### Configurazione variabili d'ambiente
Copia il file di esempio e compilalo con i tuoi valori:
```bash
cp .env.example .env
```

| Variabile | Valore |
|---|---|
| `VITE_API_BASE_URL` | URL del backend — `http://localhost:3000` in locale, URL Heroku in produzione |

## Pagine

| Rotta | Descrizione | Accesso |
|---|---|---|
| `/` | Lista articoli con filtri (titolo, categoria, autore) | Tutti |
| `/blog/:id` | Dettaglio post + like + commenti + risposte ai commenti | Tutti |
| `/blog/:id/edit` | Modifica un post esistente con anteprima live | Autore del post / Admin / Superadmin |
| `/new` | Crea nuovo post con anteprima live | Autenticati |
| `/profilo` | Modifica profilo, avatar, password; post salvati | Autenticati |
| `/authors/:id` | Profilo pubblico autore con lista dei suoi post | Tutti |
| `/authors/deleted` | Pagina "Account eliminato" (link da post/commenti di account cancellati) | Tutti |
| `/admin` | Pannello gestione utenti, statistiche, moderazione commenti | Admin / Superadmin |
| `/verify-email` | Pagina di atterraggio dal link di verifica email; contatta il backend e fa login automatico | Tutti |
| `/confirm-password-change` | Conferma cambio password dal link email; fa login automatico con nuova password | Tutti |
| `/login` | Accesso email/password o Google | Pubblico |
| `/register` | Registrazione | Pubblico |
| `*` | Pagina 404 — qualsiasi rotta non riconosciuta | Tutti |

## Autenticazione lato client
Il token JWT viene salvato in `localStorage` e incluso in tutte le richieste protette tramite l'header `Authorization: Bearer <token>`. Se il token è assente o scaduto, le pagine protette reindirizzano al login.

Il frontend fa **polling ogni 30 secondi** su `/me`: se nel frattempo l'account viene bloccato o eliminato da un admin, l'utente viene disconnesso immediatamente con un messaggio esplicativo.

Il Google OAuth restituisce il token come query param nel redirect; `TokenHandler` in `App.jsx` lo legge, lo salva e porta l'utente alla home.

## Banner di verifica email
Gli utenti registrati con email/password che non hanno ancora verificato la casella vedono un banner fisso in cima alla pagina (`EmailVerificationBanner`). Il banner permette anche di richiedere un nuovo link di verifica se quello precedente è scaduto. Gli account non verificati vengono eliminati automaticamente dopo **24 ore** dalla registrazione.

## Cosa vede ogni ruolo
- **user** — crea post (con anteprima), commenta, risponde ai commenti, mette like ai post, salva post nei preferiti, modifica il proprio profilo
- **admin** — tutto di user + pannello admin con gestione utenti `user` (blocco, eliminazione), statistiche piattaforma, moderazione commenti
- **superadmin** — tutto di admin + cambio ruoli + audit log ruoli

## Note UI
- I commenti si aprono in un bottom-sheet (modale dal basso).
- Le risposte ai commenti sono visibili inline sotto ogni commento, rientrate.
- Nome e avatar dell'autore nei post e nei commenti sono cliccabili e aprono il profilo pubblico.
- Se un account è stato eliminato, il clic porta alla pagina "Account eliminato".
- Gli errori e i messaggi di successo appaiono come notifiche fisse in basso (`FixedAlerts`).
- Il pulsante di logout è fisso in basso a sinistra, visibile solo quando si è loggati.
- L'anteprima del post (copertina, titolo, contenuto HTML) è disponibile sia in `/new` che in `/blog/:id/edit` prima della pubblicazione.
