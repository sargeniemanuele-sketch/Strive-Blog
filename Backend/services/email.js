import sgMail from '@sendgrid/mail'

const hasEmailConfig = () => Boolean(process.env.SENDGRID_API_KEY && process.env.SENDER_EMAIL)

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const sendEmailSafely = async (msg, contextLabel) => {
  if (!hasEmailConfig()) {
    console.warn(`[email:${contextLabel}] Configurazione email incompleta, invio saltato`)
    return false
  }
  try {
    await sgMail.send(msg)
    return true
  } catch (error) {
    const providerMessage = error?.response?.body?.errors?.[0]?.message || error.message
    console.error(`[email:${contextLabel}] Invio fallito: ${providerMessage}`)
    return false
  }
}

// ─── Template condiviso ────────────────────────────────────────────────────────

const buildEmail = ({ headerColor = '#2563eb', headerTitle, body, footer }) => `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px 0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="background:${headerColor};padding:36px 32px;border-radius:10px 10px 0 0;text-align:center;">
      <p style="margin:0 0 6px 0;color:rgba(255,255,255,0.75);font-size:13px;letter-spacing:1px;text-transform:uppercase;">Strive Blog</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${headerTitle}</h1>
    </div>
    <div style="background:#ffffff;padding:36px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
      ${body}
    </div>
    <div style="background:#f9fafb;padding:20px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        ${footer || 'Questa email è stata inviata automaticamente da Strive Blog. Non rispondere a questo messaggio.'}
      </p>
    </div>
  </div>
</body>
</html>
`

const ctaButton = (href, label, color = '#2563eb') =>
  `<p style="margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:15px;">${label}</a>
  </p>`

const infoRow = (label, value) =>
  `<div style="display:flex;gap:8px;margin-bottom:8px;">
    <span style="color:#6b7280;min-width:110px;font-size:14px;">${label}</span>
    <span style="color:#111827;font-size:14px;font-weight:600;">${value}</span>
  </div>`

// ─── Conferma indirizzo email ──────────────────────────────────────────────────

const sendEmailVerificationEmail = async (author, verificationUrl) => {
  const displayName = `${author.nome || ''}`.trim() || 'utente'

  const html = buildEmail({
    headerColor: '#2563eb',
    headerTitle: 'Conferma il tuo indirizzo email',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Ciao <strong>${displayName}</strong>,</p>
      <p style="margin:0 0 20px 0;color:#374151;">
        Grazie per esserti registrato su Strive Blog! Clicca il pulsante qui sotto per confermare il tuo indirizzo email e attivare il tuo account.
      </p>
      ${ctaButton(verificationUrl, 'Conferma indirizzo email')}
      <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;">Se il pulsante non funziona, copia e incolla questo link nel browser:</p>
      <p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;">
        <a href="${verificationUrl}" style="color:#2563eb;">${verificationUrl}</a>
      </p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:13px;color:#991b1b;">Il link scade tra 24 ore. Se non verifichi l'email entro 7 giorni dalla registrazione, il tuo account verrà eliminato automaticamente. Se non sei stato tu a registrarti, ignora questa email.</p>
      </div>
    `
  })

  const msg = {
    to: author.email,
    from: process.env.SENDER_EMAIL,
    subject: 'Conferma il tuo indirizzo email — Strive Blog',
    html,
    text:
      `Ciao ${displayName},\n\n` +
      'Conferma il tuo indirizzo email aprendo questo link:\n' +
      `${verificationUrl}\n\n` +
      'Il link scade tra 24 ore. Se non sei stato tu a registrarti, ignora questa email.'
  }
  return sendEmailSafely(msg, 'email-verification')
}

// ─── Benvenuto ─────────────────────────────────────────────────────────────────

const sendWelcomeEmail = async (author) => {
  const displayName = `${author.nome || ''}`.trim() || 'utente'
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'

  const html = buildEmail({
    headerColor: '#2563eb',
    headerTitle: 'Benvenuto su Strive Blog!',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Ciao <strong>${displayName}</strong>,</p>
      <p style="margin:0 0 12px 0;color:#374151;">il tuo account è stato creato con successo. Da adesso puoi:</p>
      <ul style="margin:0 0 20px 0;padding-left:20px;color:#374151;line-height:1.8;">
        <li>Pubblicare articoli e condividere le tue idee</li>
        <li>Commentare i post degli altri autori</li>
        <li>Personalizzare il tuo profilo con avatar e bio</li>
      </ul>
      ${ctaButton(frontendUrl, 'Inizia a scrivere')}
      <p style="margin:0;font-size:13px;color:#9ca3af;">Se non sei stato tu a creare questo account, ignora questa email.</p>
    `
  })

  const msg = {
    to: author.email,
    from: process.env.SENDER_EMAIL,
    subject: 'Benvenuto su Strive Blog!',
    html,
    text:
      `Ciao ${displayName},\n\n` +
      'Il tuo account Strive Blog è stato creato con successo.\n\n' +
      `Inizia subito: ${frontendUrl}\n\n` +
      'Se non sei stato tu a creare questo account, ignora questa email.'
  }
  return sendEmailSafely(msg, 'welcome')
}

// ─── Nuovo post pubblicato ─────────────────────────────────────────────────────

const sendNewPostEmail = async (authorEmail, postTitle, postId) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
  const postUrl = postId ? `${frontendUrl}/blog/${postId}` : frontendUrl

  const html = buildEmail({
    headerColor: '#16a34a',
    headerTitle: 'Il tuo articolo è stato pubblicato!',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Il tuo articolo è online!</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;border-radius:0 6px 6px 0;margin:0 0 24px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#15803d;">${postTitle}</p>
      </div>
      <p style="margin:0 0 24px 0;color:#374151;">Il tuo articolo è ora visibile a tutti i lettori di Strive Blog.</p>
      ${ctaButton(postUrl, "Visualizza l'articolo", '#16a34a')}
    `
  })

  const msg = {
    to: authorEmail,
    from: process.env.SENDER_EMAIL,
    subject: `Articolo pubblicato: "${postTitle}"`,
    html,
    text:
      `Il tuo articolo "${postTitle}" è stato pubblicato su Strive Blog.\n\n` +
      `Leggilo qui: ${postUrl}`
  }
  return sendEmailSafely(msg, 'new-post')
}

// ─── Articolo eliminato ────────────────────────────────────────────────────────

const sendPostDeletedEmail = async ({ authorEmail, postTitle, actor }) => {
  const actorLabel = [actor?.nome, actor?.cognome].filter(Boolean).join(' ').trim() || actor?.email || 'un amministratore'
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'

  const html = buildEmail({
    headerColor: '#dc2626',
    headerTitle: 'Un tuo articolo è stato eliminato',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Il seguente articolo è stato eliminato:</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:0 6px 6px 0;margin:0 0 24px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#991b1b;">${postTitle}</p>
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px 18px;margin:0 0 24px 0;">
        ${infoRow('Eliminato da:', actorLabel)}
      </div>
      <p style="margin:0 0 20px 0;color:#374151;">Se ritieni che si tratti di un errore, contatta l'amministratore del sito.</p>
      ${ctaButton(frontendUrl, 'Vai al blog', '#6b7280')}
    `
  })

  const msg = {
    to: authorEmail,
    from: process.env.SENDER_EMAIL,
    subject: `Articolo eliminato: "${postTitle}"`,
    html,
    text:
      `Il tuo articolo "${postTitle}" è stato eliminato da ${actorLabel}.\n\n` +
      'Se ritieni che si tratti di un errore, contatta l\'amministratore del sito.'
  }
  return sendEmailSafely(msg, 'post-deleted')
}

// ─── Cambio ruolo ──────────────────────────────────────────────────────────────

const sendRoleChangedEmail = async ({ author, fromRole, toRole, actor }) => {
  const displayName = `${author.nome || ''}`.trim() || 'utente'
  const actorLabel = [actor?.nome, actor?.cognome].filter(Boolean).join(' ').trim() || actor?.email || 'un amministratore'
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'

  const roleDescriptions = {
    user: 'Utente — puoi pubblicare articoli e commentare',
    admin: 'Amministratore — puoi gestire gli utenti e accedere al pannello admin',
    superadmin: 'Super Amministratore — hai accesso completo alla piattaforma'
  }

  const html = buildEmail({
    headerColor: '#7c3aed',
    headerTitle: 'Il tuo ruolo è stato aggiornato',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Ciao <strong>${displayName}</strong>,</p>
      <p style="margin:0 0 20px 0;color:#374151;">Il tuo ruolo su Strive Blog è stato modificato.</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px 18px;margin:0 0 24px 0;">
        ${infoRow('Ruolo precedente:', fromRole)}
        ${infoRow('Nuovo ruolo:', toRole)}
        ${infoRow('Modificato da:', actorLabel)}
      </div>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;"><strong>Cosa puoi fare con il nuovo ruolo:</strong></p>
      <p style="margin:0 0 24px 0;font-size:14px;color:#6b7280;">${roleDescriptions[toRole] || toRole}</p>
      ${ctaButton(frontendUrl, 'Vai al blog', '#7c3aed')}
    `
  })

  const msg = {
    to: author.email,
    from: process.env.SENDER_EMAIL,
    subject: `Il tuo ruolo è cambiato: ora sei ${toRole}`,
    html,
    text:
      `Ciao ${displayName},\n\n` +
      `Il tuo ruolo su Strive Blog è stato modificato da ${actorLabel}.\n` +
      `Ruolo precedente: ${fromRole}\n` +
      `Nuovo ruolo: ${toRole}\n\n` +
      `${roleDescriptions[toRole] || ''}`
  }
  return sendEmailSafely(msg, 'role-changed')
}

// ─── Blocco account ────────────────────────────────────────────────────────────

const sendBlockEmail = async ({ author, blockedUntil, actor }) => {
  const displayName = `${author.nome || ''}`.trim() || 'utente'
  const actorLabel = [actor?.nome, actor?.cognome].filter(Boolean).join(' ').trim() || actor?.email || 'un amministratore'

  const durata = blockedUntil
    ? new Date(blockedUntil).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })
    : 'Permanente'

  const html = buildEmail({
    headerColor: '#ea580c',
    headerTitle: 'Il tuo account è stato bloccato',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Ciao <strong>${displayName}</strong>,</p>
      <p style="margin:0 0 20px 0;color:#374151;">Il tuo account Strive Blog è stato temporaneamente bloccato.</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:16px 18px;margin:0 0 24px 0;">
        ${infoRow('Bloccato da:', actorLabel)}
        ${infoRow('Bloccato fino al:', durata)}
      </div>
      <p style="margin:0;font-size:13px;color:#9ca3af;">Durante il blocco non potrai accedere al tuo account. Se ritieni che si tratti di un errore, contatta l'amministratore.</p>
    `
  })

  const msg = {
    to: author.email,
    from: process.env.SENDER_EMAIL,
    subject: 'Il tuo account Strive Blog è stato bloccato',
    html,
    text:
      `Ciao ${displayName},\n\n` +
      `Il tuo account è stato bloccato da ${actorLabel}.\n` +
      `Bloccato fino al: ${durata}\n\n` +
      'Se ritieni che si tratti di un errore, contatta l\'amministratore.'
  }
  return sendEmailSafely(msg, 'block')
}

// ─── Sblocco account ───────────────────────────────────────────────────────────

const sendUnblockEmail = async ({ author, actor }) => {
  const displayName = `${author.nome || ''}`.trim() || 'utente'
  const actorLabel = [actor?.nome, actor?.cognome].filter(Boolean).join(' ').trim() || actor?.email || 'un amministratore'
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'

  const html = buildEmail({
    headerColor: '#16a34a',
    headerTitle: 'Il tuo account è stato sbloccato',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Ciao <strong>${displayName}</strong>,</p>
      <p style="margin:0 0 20px 0;color:#374151;">
        Il tuo account Strive Blog è stato sbloccato da <strong>${actorLabel}</strong>. Puoi ora accedere normalmente.
      </p>
      ${ctaButton(frontendUrl, 'Accedi al blog', '#16a34a')}
    `
  })

  const msg = {
    to: author.email,
    from: process.env.SENDER_EMAIL,
    subject: 'Il tuo account Strive Blog è stato sbloccato',
    html,
    text:
      `Ciao ${displayName},\n\n` +
      `Il tuo account è stato sbloccato da ${actorLabel}.\n\n` +
      `Puoi ora accedere normalmente: ${frontendUrl}`
  }
  return sendEmailSafely(msg, 'unblock')
}

// ─── Account eliminato ─────────────────────────────────────────────────────────

const sendAccountDeletedEmail = async ({ deletedAuthor, actor, selfDelete, transfer }) => {
  const displayName = deletedAuthor.nome || 'utente'
  const actorLabel = selfDelete
    ? 'te stesso'
    : ([actor?.nome, actor?.cognome].filter(Boolean).join(' ').trim() || actor?.email || 'un amministratore')

  const introText = selfDelete
    ? 'Hai eliminato il tuo account Strive Blog.'
    : `Il tuo account Strive Blog è stato eliminato da <strong>${actorLabel}</strong>.`

  const transferBlock = transfer
    ? `<div style="background:#fef9c3;border-left:4px solid #ca8a04;padding:14px 18px;border-radius:0 6px 6px 0;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#854d0e;">
          Il ruolo <strong>${transfer.role}</strong> è stato trasferito a <strong>${transfer.toName}</strong> (${transfer.toEmail}).
        </p>
       </div>`
    : ''

  const html = buildEmail({
    headerColor: '#6b7280',
    headerTitle: 'Il tuo account è stato eliminato',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Ciao <strong>${displayName}</strong>,</p>
      <p style="margin:0 0 12px 0;color:#374151;">${introText}</p>
      <p style="margin:0 0 20px 0;color:#374151;">
        I tuoi articoli pubblicati rimarranno visibili sul blog, ma il tuo profilo non è più accessibile.
      </p>
      ${transferBlock}
      <p style="margin:0;font-size:13px;color:#9ca3af;">Se ritieni che questa azione sia avvenuta per errore, contatta l'amministratore del sito.</p>
    `
  })

  const msg = {
    to: deletedAuthor.email,
    from: process.env.SENDER_EMAIL,
    subject: 'Il tuo account Strive Blog è stato eliminato',
    html,
    text:
      `Ciao ${displayName},\n\n` +
      (selfDelete
        ? 'Hai eliminato il tuo account Strive Blog.\n'
        : `Il tuo account Strive Blog è stato eliminato da ${actorLabel}.\n`) +
      (transfer ? `Il ruolo ${transfer.role} è stato trasferito a ${transfer.toName} (${transfer.toEmail}).\n` : '') +
      '\nI tuoi articoli pubblicati rimarranno visibili sul blog.'
  }
  return sendEmailSafely(msg, 'account-deleted')
}

// ─── Primo commento su un proprio post ────────────────────────────────────────

const sendFirstCommentEmail = async ({ postAuthorEmail, postTitle, postId, commenterName }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
  const postUrl = postId ? `${frontendUrl}/blog/${postId}` : frontendUrl

  const html = buildEmail({
    headerColor: '#0891b2',
    headerTitle: 'Qualcuno ha commentato il tuo articolo!',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Il tuo articolo ha ricevuto il suo primo commento!</p>
      <div style="background:#f0f9ff;border-left:4px solid #0891b2;padding:14px 18px;border-radius:0 6px 6px 0;margin:0 0 24px 0;">
        <p style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:#0e7490;">${postTitle}</p>
        <p style="margin:0;font-size:14px;color:#374151;">Commentato da: <strong>${commenterName}</strong></p>
      </div>
      ${ctaButton(postUrl, 'Leggi il commento', '#0891b2')}
    `
  })

  const msg = {
    to: postAuthorEmail,
    from: process.env.SENDER_EMAIL,
    subject: `Nuovo commento su "${postTitle}"`,
    html,
    text:
      `Il tuo articolo "${postTitle}" ha ricevuto il suo primo commento da ${commenterName}.\n\n` +
      `Leggi qui: ${postUrl}`
  }
  return sendEmailSafely(msg, 'first-comment')
}

// ─── Cambio password ───────────────────────────────────────────────────────────

const sendPasswordChangeConfirmationEmail = async ({ author, confirmationUrl }) => {
  const displayName = `${author.nome || ''}`.trim() || 'utente'

  const html = buildEmail({
    headerColor: '#2563eb',
    headerTitle: 'Conferma cambio password',
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;">Ciao <strong>${displayName}</strong>,</p>
      <p style="margin:0 0 20px 0;color:#374151;">
        Abbiamo ricevuto una richiesta di cambio password per il tuo account Strive Blog.
        Clicca il pulsante qui sotto per confermare la modifica.
      </p>
      ${ctaButton(confirmationUrl, 'Conferma cambio password')}
      <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;">Se il pulsante non funziona, copia e incolla questo link nel browser:</p>
      <p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;">
        <a href="${confirmationUrl}" style="color:#2563eb;">${confirmationUrl}</a>
      </p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:13px;color:#991b1b;">Se non hai richiesto tu questa modifica, ignora questa email. La tua password resterà invariata.</p>
      </div>
    `
  })

  const msg = {
    to: author.email,
    from: process.env.SENDER_EMAIL,
    subject: 'Conferma cambio password — Strive Blog',
    html,
    text:
      `Ciao ${displayName},\n\n` +
      'Hai richiesto la modifica della password per il tuo account Strive Blog.\n\n' +
      `Conferma il cambio aprendo questo link:\n${confirmationUrl}\n\n` +
      'Se non hai fatto tu questa richiesta, ignora questa email. La tua password resterà invariata.'
  }
  return sendEmailSafely(msg, 'password-change-confirmation')
}

export {
  sendEmailVerificationEmail,
  sendWelcomeEmail,
  sendNewPostEmail,
  sendPostDeletedEmail,
  sendRoleChangedEmail,
  sendBlockEmail,
  sendUnblockEmail,
  sendAccountDeletedEmail,
  sendFirstCommentEmail,
  sendPasswordChangeConfirmationEmail
}
