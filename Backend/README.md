# Backend — Strive Blog API

API REST che gestisce autenticazione, utenti, articoli e commenti.

## Avvio
```bash
npm install
npm run dev   # nodemon
npm start     # produzione
```

### Configurazione variabili d'ambiente
Copia il file di esempio e compilalo con i tuoi valori:
```bash
cp .env.example .env
```

| Variabile | Dove trovarla |
|---|---|
| `PORT` | Porta del server Express (default `3000`) |
| `MONGODB_URI` | [MongoDB Atlas](https://cloud.mongodb.com) → Connect → Drivers |
| `JWT_SECRET` | Stringa casuale lunga almeno 32 caratteri |
| `CLOUDINARY_CLOUD_NAME` | [Cloudinary Console](https://cloudinary.com/console) → Dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary Console → Dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary Console → Dashboard |
| `SENDGRID_API_KEY` | [SendGrid](https://app.sendgrid.com/settings/api_keys) → Create API Key |
| `SENDER_EMAIL` | L'email mittente verificata su SendGrid |
| `GOOGLE_CLIENT_ID` | [Google Console](https://console.cloud.google.com) → Credenziali → OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | Google Console → Credenziali → OAuth 2.0 |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3000/auth/google/callback` (dev) |
| `FRONTEND_URL` | `http://localhost:3001` (dev) |
| `PASSWORD_CHANGE_TOKEN_TTL_MINUTES` | Minuti di validità del link cambio password (es. `30`) |

## Modelli principali

**Author** — `nome`, `cognome`, `email`, `dataDiNascita`, `avatar`, `bio`, `role`, `blocked`, `blockedUntil`, `googleId`, `password`, `emailVerified`, `savedPosts[]`

**BlogPost** — `category`, `title`, `cover`, `content`, `readTime`, `author` (email), `authorId`, `authorName`, `likes[]`, `comments[]`

**Comment** (embedded nel BlogPost) — `author`, `authorId`, `content`, `replies[]`

**Reply** (embedded nel Comment) — `author`, `authorId`, `content`

**RoleChangeAudit** — `actorId/Name/Email`, `targetId/Name/Email`, `fromRole`, `toRole`, `ip`, `userAgent`

> I campi sensibili (hash password, token email, `authorEmail` nei commenti/risposte) vengono rimossi automaticamente da tutte le risposte JSON tramite transform `toJSON` su ogni schema Mongoose.

## Rotte

### Autenticazione
| Metodo | Rotta | Auth | Descrizione |
|---|---|---|---|
| POST | `/login` | — | Login email/password → JWT |
| GET | `/auth/google` | — | Avvia Google OAuth |
| GET | `/auth/google/callback` | — | Chiude OAuth → redirect frontend con token |
| GET | `/me` | JWT | Dati dell'utente corrente (usato anche per il polling di sessione) |

### Autori
| Metodo | Rotta | Auth | Descrizione |
|---|---|---|---|
| POST | `/authors` | — | Registrazione; invia email di verifica |
| GET | `/authors/verify-email/:token` | — | Verifica l'email dal link ricevuto → JWT |
| POST | `/authors/password-change/confirm` | — | Conferma cambio password dal link email → JWT |
| GET | `/authors/public/:id` | — | Profilo pubblico autore |
| GET | `/authors/public/:id/blogPosts` | — | Post pubblici di un autore |
| POST | `/authors/resend-verification` | JWT | Re-invia email di verifica all'utente loggato |
| GET | `/authors/bookmarks` | JWT | Post salvati dall'utente corrente |
| PATCH | `/authors/bookmarks/:postId` | JWT | Toggle salva/rimuovi post dai preferiti |
| GET | `/authors/stats` | JWT + admin | Statistiche piattaforma (autori, post, commenti, like, top post) |
| GET | `/authors` | JWT + admin | Lista paginata di tutti gli autori |
| GET | `/authors/role-audit` | JWT + superadmin | Log storico cambi ruolo |
| GET | `/authors/:id` | JWT | Dettaglio autore (sé stesso o admin) |
| GET | `/authors/:id/blogPosts` | JWT | Post dell'autore (sé stesso o admin) |
| PUT | `/authors/:id` | JWT | Modifica profilo (sé stesso o admin) |
| PATCH | `/authors/:id/avatar` | JWT | Upload avatar su Cloudinary |
| PATCH | `/authors/:id/password` | JWT | Richiesta cambio password (invia email di conferma) |
| PATCH | `/authors/:id/role` | JWT + superadmin | Cambia ruolo; salva audit; invia email notifica |
| PATCH | `/authors/:id/block` | JWT + admin | Blocca/sblocca utente (permanente o a tempo) |
| DELETE | `/authors/:id` | JWT | Elimina account; admin/superadmin devono trasferire il ruolo prima |

### Blog post
| Metodo | Rotta | Auth | Descrizione |
|---|---|---|---|
| GET | `/blogPosts` | — | Lista post paginata; filtri: `title`, `author`, `category` |
| GET | `/blogPosts/filters` | — | Valori disponibili per i filtri (categorie, titoli, autori) |
| GET | `/blogPosts/authors` | — | Lista autori che hanno almeno un post |
| GET | `/blogPosts/admin/comments` | JWT + admin | Tutti i commenti di tutti i post (moderazione) |
| GET | `/blogPosts/:id` | — | Dettaglio post (con `authorAvatar` arricchito live) |
| GET | `/blogPosts/:id/comments` | — | Lista commenti del post |
| GET | `/blogPosts/:id/comments/:commentId` | — | Singolo commento |
| POST | `/blogPosts` | JWT | Crea post; autore ricavato dal token, non dal body |
| PUT | `/blogPosts/:id` | JWT | Modifica post (owner o admin) |
| DELETE | `/blogPosts/:id` | JWT | Elimina post (owner o admin) |
| PATCH | `/blogPosts/:id/like` | JWT | Toggle like al post |
| POST | `/blogPosts/:id` | JWT | Aggiunge un commento al post |
| PUT | `/blogPosts/:id/comment/:commentId` | JWT | Modifica commento (owner o admin) |
| DELETE | `/blogPosts/:id/comment/:commentId` | JWT | Elimina commento (owner o admin) |
| POST | `/blogPosts/:id/comment/:commentId/reply` | JWT | Aggiunge una risposta a un commento |
| PUT | `/blogPosts/:id/comment/:commentId/reply/:replyId` | JWT | Modifica risposta (owner o admin) |
| DELETE | `/blogPosts/:id/comment/:commentId/reply/:replyId` | JWT | Elimina risposta (owner o admin) |
| PATCH | `/blogPosts/:blogPostId/cover` | JWT | Upload cover su Cloudinary (1200×675, crop auto) |

## Regole di autorizzazione
- Ogni utente agisce solo sulle proprie risorse.
- `admin` gestisce utenti `user`; `superadmin` gestisce anche `admin`.
- Nessun utente può cambiarsi ruolo da solo.
- Self-delete di `admin`/`superadmin` richiede di indicare a chi passare il proprio ruolo.
- Commenti e risposte possono essere creati solo da utenti autenticati.

## Email inviate automaticamente
| Evento | Destinatario |
|---|---|
| Registrazione | Link di verifica email (scade in 24 ore) |
| Verifica email completata | Benvenuto |
| Nuovo post pubblicato | Autore del post |
| Primo commento al post | Autore del post (solo se il commenter non è l'autore stesso) |
| Post eliminato da un admin | Autore del post |
| Blocco account | Utente bloccato |
| Sblocco account | Utente sbloccato |
| Cambio ruolo | Utente interessato |
| Eliminazione account | Utente eliminato |
| Richiesta cambio password | Utente — link di conferma |

## Cron job
Ogni notte a mezzanotte il server elimina automaticamente gli account email/password che non hanno completato la verifica entro **24 ore** dalla registrazione. Gli account Google non vengono toccati.

## Primo avvio — assegnare il ruolo superadmin
```bash
npm run set-role -- email@esempio.com superadmin
```
