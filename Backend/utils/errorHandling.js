const extractMongooseValidationMessage = (err) => {
  if (err?.name !== 'ValidationError' || !err.errors) return null
  const firstError = Object.values(err.errors)[0]
  return firstError?.message || 'Dati non validi'
}

export const sendValidationError = (res, errors) => {
  return res.status(400).json({
    message: errors[0] || 'Dati non validi',
    errors
  })
}

export const handleRouteError = (res, err, fallbackMessage = 'Richiesta non valida') => {
  if (err?.code === 11000) {
    return res.status(400).json({ message: 'Email già registrata' })
  }

  const validationMessage = extractMongooseValidationMessage(err)
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage })
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({ message: 'Formato dati non valido' })
  }

  if (err?.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.message || fallbackMessage })
  }

  return res.status(500).json({ message: 'Errore interno del server' })
}
