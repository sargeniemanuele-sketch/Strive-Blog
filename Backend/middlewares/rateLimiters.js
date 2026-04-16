import rateLimit from 'express-rate-limit'

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Troppi tentativi di login. Riprova tra 15 minuti.'
  }
})

export const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Troppi tentativi di registrazione. Riprova tra un'ora."
  }
})

export const resendVerificationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Hai richiesto troppi reinvii. Riprova tra un'ora."
  }
})
