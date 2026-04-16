const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_NUMBER_REGEX = /\d/
const ALLOWED_READ_TIME_UNITS = ['minuto', 'minuti', 'minute', 'minutes']
const BIO_MAX_LENGTH = 280

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '')
const stripHtml = (value) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const isValidDateString = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed <= new Date()
}

const isValidUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const validateAuthorRegistration = (payload = {}) => {
  const errors = []

  const nome = toTrimmedString(payload.nome)
  const cognome = toTrimmedString(payload.cognome)
  const email = toTrimmedString(payload.email).toLowerCase()
  const password = typeof payload.password === 'string' ? payload.password : ''
  const dataDiNascita = toTrimmedString(payload.dataDiNascita)
  const bio = toTrimmedString(payload.bio)

  if (!nome) errors.push('Il nome è obbligatorio')
  if (!cognome) errors.push('Il cognome è obbligatorio')
  if (!email) errors.push("L'email è obbligatoria")
  else if (!EMAIL_REGEX.test(email)) errors.push("L'email non è valida")

  if (!password.trim()) errors.push('La password è obbligatoria')
  else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`La password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri`)
  } else if (!PASSWORD_NUMBER_REGEX.test(password)) {
    errors.push('La password deve contenere almeno un numero')
  }

  if (!dataDiNascita) errors.push('La data di nascita è obbligatoria')
  else if (!isValidDateString(dataDiNascita)) {
    errors.push('La data di nascita non è valida')
  }
  if (bio.length > BIO_MAX_LENGTH) {
    errors.push(`La bio non può superare ${BIO_MAX_LENGTH} caratteri`)
  }

  return {
    errors,
    sanitized: {
      ...payload,
      nome,
      cognome,
      email,
      dataDiNascita,
      bio
    }
  }
}

export const validateAuthorProfileUpdate = (payload = {}) => {
  const errors = []
  const nome = toTrimmedString(payload.nome)
  const cognome = toTrimmedString(payload.cognome)
  const email = toTrimmedString(payload.email).toLowerCase()
  const dataDiNascita = toTrimmedString(payload.dataDiNascita)
  const bio = toTrimmedString(payload.bio)

  if (!nome) errors.push('Il nome è obbligatorio')
  if (!cognome) errors.push('Il cognome è obbligatorio')
  if (!email) errors.push("L'email è obbligatoria")
  else if (!EMAIL_REGEX.test(email)) errors.push("L'email non è valida")

  if (dataDiNascita && !isValidDateString(dataDiNascita)) {
    errors.push('La data di nascita non è valida')
  }

  if (bio.length > BIO_MAX_LENGTH) {
    errors.push(`La bio non può superare ${BIO_MAX_LENGTH} caratteri`)
  }

  return {
    errors,
    sanitized: {
      ...payload,
      nome,
      cognome,
      email,
      dataDiNascita,
      bio
    }
  }
}

export const validateLoginInput = (payload = {}) => {
  const errors = []
  const email = toTrimmedString(payload.email).toLowerCase()
  const password = typeof payload.password === 'string' ? payload.password : ''

  if (!email) errors.push("L'email è obbligatoria")
  else if (!EMAIL_REGEX.test(email)) errors.push("L'email non è valida")

  if (!password.trim()) errors.push('La password è obbligatoria')

  return { errors, sanitized: { email, password } }
}

export const validatePasswordChangeInput = (payload = {}, options = {}) => {
  const errors = []
  const confirmEmail = toTrimmedString(payload.confirmEmail).toLowerCase()
  const expectedEmail = toTrimmedString(options.expectedEmail).toLowerCase()
  const requiresCurrentPassword = Boolean(options.requiresCurrentPassword)
  const currentPassword = typeof payload.currentPassword === 'string' ? payload.currentPassword : ''
  const newPassword = typeof payload.newPassword === 'string' ? payload.newPassword : ''
  const confirmNewPassword = typeof payload.confirmNewPassword === 'string' ? payload.confirmNewPassword : ''

  if (!confirmEmail) errors.push("L'email di conferma è obbligatoria")
  else if (!EMAIL_REGEX.test(confirmEmail)) errors.push("L'email di conferma non è valida")
  else if (expectedEmail && confirmEmail !== expectedEmail) errors.push("L'email di conferma non corrisponde al tuo account")

  if (requiresCurrentPassword && !currentPassword.trim()) {
    errors.push('La password attuale è obbligatoria')
  }

  if (!newPassword.trim()) errors.push('La nuova password è obbligatoria')
  else if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.push(`La nuova password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri`)
  } else if (!PASSWORD_NUMBER_REGEX.test(newPassword)) {
    errors.push('La nuova password deve contenere almeno un numero')
  }

  if (!confirmNewPassword.trim()) errors.push('La conferma della nuova password è obbligatoria')
  else if (newPassword !== confirmNewPassword) errors.push('La conferma della nuova password non coincide')

  return {
    errors,
    sanitized: {
      confirmEmail,
      currentPassword,
      newPassword
    }
  }
}

export const validatePasswordChangeRequestInput = (payload = {}) => {
  const errors = []
  const newPassword = typeof payload.newPassword === 'string' ? payload.newPassword : ''
  const confirmNewPassword = typeof payload.confirmNewPassword === 'string' ? payload.confirmNewPassword : ''

  if (!newPassword.trim()) errors.push('La nuova password è obbligatoria')
  else if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.push(`La nuova password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri`)
  } else if (!PASSWORD_NUMBER_REGEX.test(newPassword)) {
    errors.push('La nuova password deve contenere almeno un numero')
  }

  if (!confirmNewPassword.trim()) errors.push('La conferma della nuova password è obbligatoria')
  else if (newPassword !== confirmNewPassword) errors.push('La conferma della nuova password non coincide')

  return {
    errors,
    sanitized: {
      newPassword
    }
  }
}

export const validateBlogPostPayload = (payload = {}) => {
  const errors = []
  const category = toTrimmedString(payload.category)
  const title = toTrimmedString(payload.title)
  const cover = toTrimmedString(payload.cover)
  const content = toTrimmedString(payload.content)
  const plainContent = typeof payload.content === 'string' ? stripHtml(payload.content) : ''
  const readTimeValue = Number(payload?.readTime?.value)
  const readTimeUnit = toTrimmedString(payload?.readTime?.unit).toLowerCase()

  if (!category) errors.push('La categoria è obbligatoria')
  if (!title) errors.push('Il titolo è obbligatorio')
  if (!cover) errors.push('La cover è obbligatoria')
  else if (!isValidUrl(cover)) errors.push('La cover deve essere un URL valido')

  if (!Number.isFinite(readTimeValue) || readTimeValue <= 0) {
    errors.push('readTime.value deve essere un numero positivo')
  }
  if (!readTimeUnit) errors.push('readTime.unit è obbligatorio')
  else if (!ALLOWED_READ_TIME_UNITS.includes(readTimeUnit)) {
    errors.push(`readTime.unit non valido. Valori ammessi: ${ALLOWED_READ_TIME_UNITS.join(', ')}`)
  }

  if (!content || !plainContent) errors.push('Il contenuto è obbligatorio')

  return {
    errors,
    sanitized: {
      ...payload,
      category,
      title,
      cover,
      readTime: {
        value: readTimeValue,
        unit: readTimeUnit
      },
      content
    }
  }
}

export const validateCommentPayload = (payload = {}, { requireAuthor = false } = {}) => {
  const errors = []
  const author = toTrimmedString(payload.author)
  const content = toTrimmedString(payload.content)
  const hasAuthorField = Object.prototype.hasOwnProperty.call(payload, 'author')

  if (requireAuthor && !author) {
    errors.push("L'autore del commento è obbligatorio")
  }
  if (hasAuthorField && !author) {
    errors.push("L'autore del commento non può essere vuoto")
  }
  if (!content) {
    errors.push('Il contenuto del commento è obbligatorio')
  }

  return {
    errors,
    sanitized: {
      ...payload,
      author,
      content
    }
  }
}

