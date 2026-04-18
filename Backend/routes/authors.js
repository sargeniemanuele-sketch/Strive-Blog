import express from 'express'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import Author from '../models/Author.js'
import BlogPost from '../models/BlogPost.js'
import upload from '../middlewares/upload.js'
import {
  sendAccountDeletedEmail,
  sendBlockEmail,
  sendEmailVerificationEmail,
  sendPasswordChangeConfirmationEmail,
  sendRoleChangedEmail,
  sendUnblockEmail,
  sendWelcomeEmail
} from '../services/email.js'
import authMiddleware from '../middlewares/authMiddleware.js'
import adminMiddleware from '../middlewares/adminMiddleware.js'
import superAdminMiddleware from '../middlewares/superAdminMiddleware.js'
import { handleRouteError, sendValidationError } from '../utils/errorHandling.js'
import { registrationRateLimiter, resendVerificationRateLimiter } from '../middlewares/rateLimiters.js'
import { validateAuthorProfileUpdate, validateAuthorRegistration, validatePasswordChangeRequestInput } from '../utils/validation.js'
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js'
import { parsePaginationParams } from '../utils/pagination.js'
import RoleChangeAudit from '../models/RoleChangeAudit.js'
import { isPrivilegedRole, normalizeRole, parseRole, ROLES } from '../utils/roles.js'

const router = express.Router()
const PASSWORD_CHANGE_TOKEN_TTL_MINUTES = Number.parseInt(process.env.PASSWORD_CHANGE_TOKEN_TTL_MINUTES, 10)

// Può accedere se è admin oppure se è la propria risorsa
const canAccess = (req, authorId) =>
  isPrivilegedRole(req.user?.role) || String(req.user?.id) === String(authorId)

const isSelfTarget = (req, authorId) => String(req.user?.id) === String(authorId)

const canBlockTarget = (actorRole, targetRole, selfTarget) => {
  if (selfTarget) return false
  if (actorRole === ROLES.SUPERADMIN) return targetRole === ROLES.ADMIN || targetRole === ROLES.USER
  if (actorRole === ROLES.ADMIN) return targetRole === ROLES.USER
  return false
}

const buildSelfDeletionCandidates = async (author) => {
  const role = normalizeRole(author.role)

  if (role === ROLES.ADMIN) {
    const candidates = await Author.find({
      _id: { $ne: author._id },
      role: ROLES.USER
    }).select('nome cognome email role')

    return {
      requiredRole: ROLES.ADMIN,
      sourcePoolRole: ROLES.USER,
      candidates
    }
  }

  if (role === ROLES.SUPERADMIN) {
    const adminCandidates = await Author.find({
      _id: { $ne: author._id },
      role: ROLES.ADMIN
    }).select('nome cognome email role')

    if (adminCandidates.length) {
      return {
        requiredRole: ROLES.SUPERADMIN,
        sourcePoolRole: ROLES.ADMIN,
        candidates: adminCandidates
      }
    }

    const userCandidates = await Author.find({
      _id: { $ne: author._id },
      role: ROLES.USER
    }).select('nome cognome email role')

    return {
      requiredRole: ROLES.SUPERADMIN,
      sourcePoolRole: ROLES.USER,
      candidates: userCandidates
    }
  }

  return {
    requiredRole: null,
    sourcePoolRole: null,
    candidates: []
  }
}

const toPublicAuthorPayload = (authorDoc) => {
  if (!authorDoc) return null
  const author = typeof authorDoc.toObject === 'function' ? authorDoc.toObject() : authorDoc
  return {
    _id: author._id,
    nome: author.nome || '',
    cognome: author.cognome || '',
    email: author.email || '',
    avatar: author.avatar || '',
    bio: author.bio || '',
    role: normalizeRole(author.role),
    emailVerified: author.googleId ? true : Boolean(author.emailVerified)
  }
}

// POST /authors - pubblica (registrazione)
router.post('/', registrationRateLimiter, async (req, res) => {
  try {
    const { errors, sanitized } = validateAuthorRegistration(req.body)
    if (errors.length) {
      return sendValidationError(res, errors)
    }

    const hashedPassword = await bcrypt.hash(sanitized.password, 10)
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const author = new Author({
      ...sanitized,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    })
    const newAuthor = await author.save()

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`
    void sendEmailVerificationEmail(newAuthor, verificationUrl)
    void sendWelcomeEmail(newAuthor)

    res.status(201).json(newAuthor) // toJSON transform rimuove password e campi sensibili
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/verify-email/:token - pubblica
router.get('/verify-email/:token', async (req, res) => {
  try {
    const author = await Author.findOne({
      emailVerificationToken: req.params.token,
      emailVerificationExpiresAt: { $gt: new Date() }
    })

    if (!author) {
      return res.status(400).json({ message: 'Link di verifica non valido o scaduto.' })
    }

    author.emailVerified = true
    author.emailVerificationToken = ''
    author.emailVerificationExpiresAt = null
    await author.save()

    const token = jwt.sign(
      { id: author._id, email: author.email, nome: author.nome, cognome: author.cognome, role: normalizeRole(author.role) },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ message: 'Email verificata con successo.', token })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// POST /authors/password-change/confirm - pubblica (via link email)
router.post('/password-change/confirm', async (req, res) => {
  try {
    const rawToken = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    if (!rawToken) {
      return res.status(400).json({ message: 'Token di conferma mancante' })
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const author = await Author.findOne({
      passwordChangeTokenHash: tokenHash,
      passwordChangeExpiresAt: { $gt: new Date() }
    })

    if (!author || !author.pendingPasswordHash) {
      return res.status(400).json({ message: 'Link non valido o scaduto' })
    }

    author.password = author.pendingPasswordHash
    author.pendingPasswordHash = ''
    author.passwordChangeTokenHash = ''
    author.passwordChangeExpiresAt = null
    await author.save()

    const token = jwt.sign(
      { id: author._id, email: author.email, nome: author.nome, cognome: author.cognome, role: normalizeRole(author.role) },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ message: 'Password aggiornata con successo', token })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/public/:id - profilo autore pubblico
router.get('/public/:id', async (req, res) => {
  try {
    const author = await Author.findById(req.params.id).select('nome cognome email avatar bio role emailVerified googleId')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })
    res.json(toPublicAuthorPayload(author))
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/public/:id/blogPosts - post pubblici dell'autore
router.get('/public/:id/blogPosts', async (req, res) => {
  try {
    const author = await Author.findById(req.params.id).select('_id')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    const blogPosts = await BlogPost.find({ authorId: author._id }).sort({ createdAt: -1, _id: -1 })
    res.json(blogPosts)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// Tutte le rotte successive richiedono autenticazione
router.use(authMiddleware)

// POST /authors/resend-verification - reinvia email di verifica all'utente loggato
router.post('/resend-verification', resendVerificationRateLimiter, async (req, res) => {
  try {
    const author = await Author.findById(req.user.id)
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    if (author.emailVerified) {
      return res.status(400).json({ message: 'Email già verificata' })
    }

    const verificationToken = crypto.randomBytes(32).toString('hex')
    author.emailVerificationToken = verificationToken
    author.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    await author.save()

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`
    await sendEmailVerificationEmail(author, verificationUrl)

    res.json({ message: 'Email di verifica inviata. Controlla la tua casella.' })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/bookmarks - post salvati dell'utente corrente (con dati completi del post)
router.get('/bookmarks', authMiddleware, async (req, res) => {
  try {
    const author = await Author.findById(req.user.id).select('savedPosts')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    if (!author.savedPosts.length) return res.json([])

    const posts = await BlogPost.find({ _id: { $in: author.savedPosts } })
      .select('title category cover readTime authorName authorId updatedAt createdAt')
      .sort({ updatedAt: -1 })

    res.json(posts)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PATCH /authors/bookmarks/:postId - toggle post salvato
router.patch('/bookmarks/:postId', authMiddleware, async (req, res) => {
  try {
    const author = await Author.findById(req.user.id).select('savedPosts')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    const postId = req.params.postId
    const alreadySaved = author.savedPosts.some((id) => String(id) === postId)

    if (alreadySaved) {
      author.savedPosts = author.savedPosts.filter((id) => String(id) !== postId)
    } else {
      // Verifica che il post esista prima di salvarlo
      const exists = await BlogPost.exists({ _id: postId })
      if (!exists) return res.status(404).json({ message: 'Post non trovato' })
      author.savedPosts.push(postId)
    }

    await author.save()
    res.json({ saved: !alreadySaved, savedCount: author.savedPosts.length })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/stats - statistiche aggregate (solo admin)
router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalAuthors,
      newAuthorsLastMonth,
      postStats,
      topPosts
    ] = await Promise.all([
      Author.countDocuments(),
      Author.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
      BlogPost.aggregate([
        {
          $group: {
            _id: null,
            totalPosts: { $sum: 1 },
            totalComments: { $sum: { $size: { $ifNull: ['$comments', []] } } },
            totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } }
          }
        }
      ]),
      BlogPost.aggregate([
        {
          $project: {
            title: 1,
            commentsCount: { $size: { $ifNull: ['$comments', []] } },
            likesCount: { $size: { $ifNull: ['$likes', []] } }
          }
        },
        { $sort: { commentsCount: -1 } },
        { $limit: 5 }
      ])
    ])

    res.json({
      totalAuthors,
      newAuthorsLastMonth,
      totalPosts: postStats[0]?.totalPosts || 0,
      totalComments: postStats[0]?.totalComments || 0,
      totalLikes: postStats[0]?.totalLikes || 0,
      topPosts
    })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors - solo admin, lista paginata con ricerca opzionale per nome/cognome/email
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 100
    })

    const query = {}
    if (req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = { $regex: escaped, $options: 'i' }
      query.$or = [{ nome: regex }, { cognome: regex }, { email: regex }]
    }

    const total = await Author.countDocuments(query)

    // Ordine: superadmin → admin → user, poi alfabetico per cognome dentro ogni gruppo
    const authors = await Author.aggregate([
      { $match: query },
      {
        $addFields: {
          _rolePriority: {
            $switch: {
              branches: [
                { case: { $eq: ['$role', 'superadmin'] }, then: 0 },
                { case: { $eq: ['$role', 'admin'] },      then: 1 },
              ],
              default: 2
            }
          }
        }
      },
      { $sort: { _rolePriority: 1, cognome: 1, nome: 1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { password: 0, _rolePriority: 0 } }
    ])

    res.json({
      authors,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalAuthors: total
    })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/role-audit - solo superadmin
router.get('/role-audit', superAdminMiddleware, async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100
    })

    const total = await RoleChangeAudit.countDocuments()
    const entries = await RoleChangeAudit.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actorId', 'nome cognome email role')
      .populate('targetId', 'nome cognome email role')

    res.json({
      audits: entries,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalAudits: total
    })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/:id/deletion-candidates - solo self-delete admin/superadmin
router.get('/:id/deletion-candidates', async (req, res) => {
  try {
    if (!isSelfTarget(req, req.params.id)) {
      return res.status(403).json({ message: 'Puoi vedere i candidati solo per il tuo account' })
    }

    const author = await Author.findById(req.params.id).select('nome cognome email role')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    const role = normalizeRole(author.role)
    if (!isPrivilegedRole(role)) {
      return res.status(400).json({ message: 'Il passaggio ruolo è richiesto solo per admin/superadmin' })
    }

    const data = await buildSelfDeletionCandidates(author)
    res.json({
      requiredRole: data.requiredRole,
      sourcePoolRole: data.sourcePoolRole,
      candidates: data.candidates
    })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/:id
router.get('/:id', async (req, res) => {
  try {
    if (!canAccess(req, req.params.id)) {
      return res.status(403).json({ message: 'Non autorizzato' })
    }
    const author = await Author.findById(req.params.id).select('-password')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })
    res.json(author)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /authors/:id/blogPosts
router.get('/:id/blogPosts', async (req, res) => {
  try {
    if (!canAccess(req, req.params.id)) {
      return res.status(403).json({ message: 'Non autorizzato' })
    }
    const author = await Author.findById(req.params.id).select('_id')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    const blogPosts = await BlogPost.find({ authorId: author._id })
    res.json(blogPosts)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PUT /authors/:id
router.put('/:id', async (req, res) => {
  try {
    if (!canAccess(req, req.params.id)) {
      return res.status(403).json({ message: 'Non autorizzato' })
    }

    const { errors, sanitized } = validateAuthorProfileUpdate(req.body)
    if (errors.length) {
      return sendValidationError(res, errors)
    }

    const updates = { ...sanitized }
    // Campi non modificabili da questa rotta
    delete updates.role
    delete updates.blocked
    delete updates.blockedUntil

    const author = await Author.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    }).select('-password')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })
    res.json(author)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PATCH /authors/:id/password - solo account proprietario
router.patch('/:id/password', async (req, res) => {
  try {
    if (!isSelfTarget(req, req.params.id)) {
      return res.status(403).json({ message: 'Puoi cambiare solo la password del tuo account' })
    }

    const author = await Author.findById(req.params.id)
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    if (author.googleId) {
      return res.status(400).json({ message: 'Gli account Google non possono cambiare la password da qui' })
    }

    const { errors, sanitized } = validatePasswordChangeRequestInput(req.body)
    if (errors.length) {
      return sendValidationError(res, errors)
    }

    if (author.password) {
      const isSamePassword = await bcrypt.compare(sanitized.newPassword, author.password)
      if (isSamePassword) {
        return res.status(400).json({ message: 'La nuova password deve essere diversa da quella attuale' })
      }
    }

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + PASSWORD_CHANGE_TOKEN_TTL_MINUTES * 60 * 1000)
    const pendingPasswordHash = await bcrypt.hash(sanitized.newPassword, 10)

    author.pendingPasswordHash = pendingPasswordHash
    author.passwordChangeTokenHash = tokenHash
    author.passwordChangeExpiresAt = expiresAt
    await author.save()

    const confirmationUrl = `${process.env.FRONTEND_URL}/confirm-password-change?token=${encodeURIComponent(token)}`
    await sendPasswordChangeConfirmationEmail({
      author,
      confirmationUrl
    })

    res.json({ message: 'Ti abbiamo inviato una email di conferma per completare il cambio password' })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PATCH /authors/:id/role - solo superadmin
router.patch('/:id/role', superAdminMiddleware, async (req, res) => {
  try {
    if (isSelfTarget(req, req.params.id)) {
      return res.status(400).json({ message: 'Non puoi cambiare il tuo ruolo' })
    }

    const requestedRole = parseRole(req.body?.role)
    if (!requestedRole) {
      return res.status(400).json({ message: 'Ruolo non valido' })
    }

    const author = await Author.findById(req.params.id)
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    const fromRole = normalizeRole(author.role)
    if (fromRole === requestedRole) {
      return res.json(author) // toJSON transform rimuove i campi sensibili
    }

    author.role = requestedRole
    await author.save()

    await RoleChangeAudit.create({
      actorId: req.user.id,
      actorName: `${req.user.nome || ''} ${req.user.cognome || ''}`.trim(),
      actorEmail: req.user.email || '',
      targetId: author._id,
      targetName: `${author.nome || ''} ${author.cognome || ''}`.trim(),
      targetEmail: author.email || '',
      fromRole,
      toRole: requestedRole,
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || ''
    })

    void sendRoleChangedEmail({
      author: { email: author.email, nome: author.nome },
      fromRole,
      toRole: requestedRole,
      actor: { nome: req.user?.nome, cognome: req.user?.cognome, email: req.user?.email }
    })

    res.json(author) // toJSON transform rimuove automaticamente i campi sensibili
  } catch (err) {
    handleRouteError(res, err)
  }
})

// DELETE /authors/:id - self-delete (qualsiasi utente) o admin
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const author = await Author.findById(req.params.id)
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    const actorRole = normalizeRole(req.user?.role)
    const targetRole = normalizeRole(author.role)
    const selfDelete = isSelfTarget(req, author._id)

    // Un utente normale può eliminare solo se stesso
    if (!selfDelete && !isPrivilegedRole(actorRole)) {
      return res.status(403).json({ message: 'Non autorizzato: puoi eliminare solo il tuo account' })
    }

    if (!selfDelete && targetRole !== ROLES.USER) {
      return res.status(403).json({ message: 'Puoi eliminare solo account user (o il tuo account)' })
    }

    let transferInfo = null

    if (selfDelete && isPrivilegedRole(actorRole)) {
      const { transferRoleTo } = req.body || {}
      if (!transferRoleTo) {
        return res.status(400).json({ message: 'Se elimini il tuo profilo devi indicare a chi passare il ruolo' })
      }

      const candidatesData = await buildSelfDeletionCandidates(author)
      if (!candidatesData.candidates.length) {
        return res.status(400).json({ message: 'Nessun candidato disponibile per il passaggio ruolo' })
      }

      const recipient = candidatesData.candidates.find((c) => String(c._id) === String(transferRoleTo))
      if (!recipient) {
        return res.status(400).json({ message: 'Destinatario ruolo non valido' })
      }

      const recipientAuthor = await Author.findById(recipient._id)
      if (!recipientAuthor) {
        return res.status(404).json({ message: 'Destinatario ruolo non trovato' })
      }

      const fromRole = normalizeRole(recipientAuthor.role)
      const toRole = candidatesData.requiredRole

      recipientAuthor.role = toRole
      await recipientAuthor.save()

      await RoleChangeAudit.create({
        actorId: req.user.id,
        actorName: `${req.user.nome || ''} ${req.user.cognome || ''}`.trim(),
        actorEmail: req.user.email || '',
        targetId: recipientAuthor._id,
        targetName: `${recipientAuthor.nome || ''} ${recipientAuthor.cognome || ''}`.trim(),
        targetEmail: recipientAuthor.email || '',
        fromRole,
        toRole,
        ip: req.ip || '',
        userAgent: req.headers['user-agent'] || ''
      })

      transferInfo = {
        role: toRole,
        toName: `${recipientAuthor.nome || ''} ${recipientAuthor.cognome || ''}`.trim() || recipientAuthor.email,
        toEmail: recipientAuthor.email
      }
    }

    await Author.findByIdAndDelete(req.params.id)

    await sendAccountDeletedEmail({
      deletedAuthor: { nome: author.nome, email: author.email },
      actor: { nome: req.user?.nome, cognome: req.user?.cognome, email: req.user?.email },
      selfDelete,
      transfer: transferInfo
    })

    res.json({ message: 'Autore eliminato' })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PATCH /authors/:id/block - solo admin
router.patch('/:id/block', adminMiddleware, async (req, res) => {
  try {
    const target = await Author.findById(req.params.id)
    if (!target) return res.status(404).json({ message: 'Autore non trovato' })

    const actorRole = normalizeRole(req.user?.role)
    const targetRole = normalizeRole(target.role)
    const selfTarget = isSelfTarget(req, target._id)
    if (!canBlockTarget(actorRole, targetRole, selfTarget)) {
      return res.status(403).json({ message: 'Non autorizzato a bloccare/sbloccare questo account' })
    }

    const { duration } = req.body
    let update

    if (duration === 'unblock') {
      update = { blocked: false, blockedUntil: null }
    } else if (duration === 'permanent') {
      update = { blocked: true, blockedUntil: null }
    } else {
      const daysMap = { '1d': 1, '3d': 3, '7d': 7, '30d': 30 }
      const days = daysMap[duration]
      if (!days) return res.status(400).json({ message: 'Durata di blocco non valida' })
      update = { blocked: true, blockedUntil: new Date(Date.now() + days * 86400000) }
    }

    const author = await Author.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password')

    const actor = { nome: req.user?.nome, cognome: req.user?.cognome, email: req.user?.email }
    if (duration === 'unblock') {
      void sendUnblockEmail({ author: { email: target.email, nome: target.nome }, actor })
    } else {
      void sendBlockEmail({
        author: { email: target.email, nome: target.nome },
        blockedUntil: author.blockedUntil,
        actor
      })
    }

    res.json(author)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PATCH /authors/:authorId/avatar
router.patch('/:authorId/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!canAccess(req, req.params.authorId)) {
      return res.status(403).json({ message: 'Non autorizzato' })
    }
    if (!req.file) return res.status(400).json({ message: 'Nessun file caricato' })

    const author = await Author.findById(req.params.authorId).select('-password')
    if (!author) return res.status(404).json({ message: 'Autore non trovato' })

    const result = await uploadBufferToCloudinary(req.file.buffer, 'strive-blog/avatars')

    author.avatar = result.secure_url
    await author.save()
    res.json(author)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// ─── Error handler Multer ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File troppo grande. Dimensione massima: 5 MB.' })
  }
  if (err.status === 400) {
    return res.status(400).json({ message: err.message || 'Richiesta non valida' })
  }
  next(err)
})

export default router
