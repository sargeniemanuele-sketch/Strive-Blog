import 'dotenv/config'
import mongoose from 'mongoose'
import Author from '../models/Author.js'
import { parseRole } from '../utils/roles.js'

const normalizeEmail = (email = '') => String(email).trim().toLowerCase()

const targetEmail = normalizeEmail(process.argv[2] || '')
const requestedRole = parseRole(process.argv[3] || '')

if (!targetEmail || !requestedRole) {
  console.error('Uso: npm run set-role -- <email> <user|admin|superadmin>')
  process.exit(1)
}

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI non configurata')
  process.exit(1)
}

try {
  await mongoose.connect(process.env.MONGODB_URI)

  const author = await Author.findOne({ email: targetEmail })
  if (!author) {
    console.error(`Utente non trovato: ${targetEmail}`)
    process.exitCode = 1
  } else {
    const previousRole = author.role || 'user'
    author.role = requestedRole
    await author.save()
    console.log(`Ruolo aggiornato: ${targetEmail} (${previousRole} -> ${requestedRole})`)
  }
} catch (err) {
  console.error('Errore durante il cambio ruolo:', err.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
