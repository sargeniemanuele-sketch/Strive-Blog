# Strive Blog

Blog full-stack con autenticazione, area personale e pannello admin.

## Stack
| Layer | Tecnologia |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | MongoDB |
| Auth | Email/Password · Google OAuth 2.0 (JWT) |
| Media | Cloudinary |
| Email | SendGrid |

## Struttura
```
Strive Blog/
├── Backend/    → API REST
└── Frontend/   → interfaccia utente
```

## Come funziona (in breve)
1. L'utente si registra con email/password: riceve un'email con un link di verifica. Finché non clicca il link l'account esiste ma un banner lo avvisa di verificare la casella. Eventuali account non verificati da più di 7 giorni vengono eliminati automaticamente ogni notte.
2. In alternativa l'utente fa login tramite Google: l'account Google non richiede verifica email.
3. Il backend emette un JWT che il frontend salva nel `localStorage` e usa per tutte le richieste protette.
4. Gli utenti creano e modificano articoli; i commenti sono embedded nel post.
5. Cliccando su nome o avatar di un autore si apre il suo profilo pubblico con la lista dei suoi articoli.
6. Se un account viene eliminato, i post rimangono e il profilo mostra "Account eliminato".
7. Admin e Superadmin gestiscono utenti dal pannello `/admin`; solo il Superadmin cambia i ruoli.
8. Il cambio password richiede una conferma via link email (la password non cambia finché non si clicca il link).
9. Il frontend fa polling ogni 30 secondi: se l'account viene bloccato o eliminato mentre l'utente è loggato, viene reindirizzato al login con un messaggio.

## Ruoli
- **user** — crea post e commenti, gestisce il proprio profilo
- **admin** — gestisce utenti `user`, accede al pannello admin
- **superadmin** — gestisce ruoli, audit, gestisce `admin` e `user`

## Sicurezza
- JWT, CORS, Helmet, rate limit sul login e sulla registrazione
- Sanitizzazione HTML (backend: sanitize-html, frontend: DOMPurify)
- Cambio password in due fasi con conferma email (token hash SHA-256, TTL configurabile)
- Verifica email obbligatoria per nuovi account email/password

## Documentazione di dettaglio
- [Backend/README.md](Backend/README.md)
- [Frontend/README.md](Frontend/README.md)
