import express from 'express'
import BlogPost from '../models/BlogPost.js'
import Author from '../models/Author.js'
import upload from '../middlewares/upload.js'
import { sendNewPostEmail, sendPostDeletedEmail, sendFirstCommentEmail } from '../services/email.js'
import authMiddleware from '../middlewares/authMiddleware.js'
import adminMiddleware from '../middlewares/adminMiddleware.js'
import { sanitizeContent } from '../utils/sanitize.js'
import { handleRouteError, sendValidationError } from '../utils/errorHandling.js'
import { validateBlogPostPayload, validateCommentPayload } from '../utils/validation.js'
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js'
import { parsePaginationParams } from '../utils/pagination.js'
import { isPrivilegedRole } from '../utils/roles.js'

const router = express.Router()

const enrichPostsWithAuthorData = async (posts) => {
  if (!Array.isArray(posts) || !posts.length) return []

  const normalizedPosts = posts.map((post) => (typeof post?.toObject === 'function' ? post.toObject() : post))
  const authorIds = [...new Set(normalizedPosts.map((post) => String(post.authorId || '')).filter(Boolean))]

  if (!authorIds.length) return normalizedPosts

  const authors = await Author.find({ _id: { $in: authorIds } })
    .select('_id avatar nome cognome')
    .lean()

  const authorById = new Map(authors.map((author) => [String(author._id), author]))

  return normalizedPosts.map((post) => {
    const authorData = post.authorId ? authorById.get(String(post.authorId)) : null
    const computedName = `${authorData?.nome || ''} ${authorData?.cognome || ''}`.trim()

    return {
      ...post,
      authorId: post.authorId || null,
      authorName: post.authorName || computedName || post.author,
      authorAvatar: authorData?.avatar || ''
    }
  })
}

// ─── Helper di autorizzazione ──────────────────────────────────────────────

// Il post può essere modificato/eliminato dall'autore (per ID) o da un admin.
// L'ID non cambia mai, a differenza dell'email.
const canModifyPost = (req, blogPost) =>
  isPrivilegedRole(req.user?.role) ||
  (blogPost.authorId && String(req.user?.id) === String(blogPost.authorId))

// Il commento può essere modificato/eliminato dal suo proprietario (per ID) o da un admin.
const canModifyComment = (req, comment) => {
  if (isPrivilegedRole(req.user?.role)) return true
  return comment.authorId && String(req.user?.id) === String(comment.authorId)
}

const getBlogPostByIdOr404 = async (res, postId) => {
  const blogPost = await BlogPost.findById(postId)
  if (!blogPost) {
    res.status(404).json({ message: 'Blog post non trovato' })
    return null
  }
  return blogPost
}

const getCommentByIdOr404 = (res, blogPost, commentId) => {
  const comment = blogPost.comments.id(commentId)
  if (!comment) {
    res.status(404).json({ message: 'Commento non trovato' })
    return null
  }
  return comment
}

// ─── LETTURA ───────────────────────────────────────────────────────────────

// GET /blogPosts
router.get('/', async (req, res) => {
  try {
    const hasSearch = req.query.title || req.query.author || req.query.category
    const { page, limit, skip } = parsePaginationParams(req.query, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: hasSearch ? 500 : 50
    })

    const query = {}
    if (req.query.title) {
      const escaped = String(req.query.title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.title = { $regex: escaped, $options: 'i' }
    }
    if (req.query.author) {
      const escaped = String(req.query.author).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.authorName = { $regex: escaped, $options: 'i' }
    }
    if (req.query.category) {
      const escaped = String(req.query.category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.category = { $regex: escaped, $options: 'i' }
    }

    const total = await BlogPost.countDocuments(query)
    const blogPosts = await BlogPost.find(query).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit)
    const enrichedBlogPosts = await enrichPostsWithAuthorData(blogPosts)

    res.json({
      blogPosts: enrichedBlogPosts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalBlogPosts: total
    })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /blogPosts/filters
router.get('/filters', async (req, res) => {
  try {
    const [categoriesRaw, titlesRaw, authors] = await Promise.all([
      BlogPost.distinct('category', { category: { $nin: [null, ''] } }),
      BlogPost.distinct('title', { title: { $nin: [null, ''] } }),
      BlogPost.aggregate([
        { $match: { authorId: { $ne: null } } },
        {
          $group: {
            _id: '$authorId',
            authorName: { $first: '$authorName' },
            postsCount: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            value: { $toString: '$_id' },
            label: {
              $cond: [
                { $and: [{ $ne: ['$authorName', null] }, { $ne: ['$authorName', ''] }] },
                '$authorName',
                { $toString: '$_id' }
              ]
            },
            postsCount: 1
          }
        },
        { $sort: { label: 1 } }
      ])
    ])

    const categories = categoriesRaw
      .map((c) => String(c || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'it'))

    const titles = titlesRaw
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'it'))
      .slice(0, 300)

    res.json({ categories, titles, authors })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /blogPosts/authors
router.get('/authors', async (req, res) => {
  try {
    const authors = await BlogPost.aggregate([
      { $match: { authorId: { $ne: null } } },
      {
        $group: {
          _id: '$authorId',
          authorName: { $first: '$authorName' },
          postsCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          value: { $toString: '$_id' },
          label: {
            $cond: [
              { $and: [{ $ne: ['$authorName', null] }, { $ne: ['$authorName', ''] }] },
              '$authorName',
              { $toString: '$_id' }
            ]
          },
          postsCount: 1
        }
      },
      { $sort: { label: 1 } }
    ])

    res.json({ authors })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /blogPosts/admin/comments — tutti i commenti recenti (solo admin)
// DEVE stare prima di /:id altrimenti Express intercetta con id='admin'
router.get('/admin/comments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100
    })

    const result = await BlogPost.aggregate([
      { $unwind: '$comments' },
      { $sort: { 'comments.createdAt': -1 } },
      {
        $project: {
          _id: 0,
          postId: '$_id',
          postTitle: '$title',
          comment: '$comments'
        }
      },
      { $skip: skip },
      { $limit: limit }
    ])

    const total = await BlogPost.aggregate([
      { $project: { count: { $size: '$comments' } } },
      { $group: { _id: null, total: { $sum: '$count' } } }
    ])

    res.json({
      comments: result,
      currentPage: page,
      totalPages: Math.ceil((total[0]?.total || 0) / limit),
      totalComments: total[0]?.total || 0
    })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /blogPosts/:id
router.get('/:id', async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return
    const [enrichedPost] = await enrichPostsWithAuthorData([blogPost])
    res.json(enrichedPost)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /blogPosts/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return
    res.json(blogPost.comments)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// GET /blogPosts/:id/comments/:commentId
router.get('/:id/comments/:commentId', async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    const comment = getCommentByIdOr404(res, blogPost, req.params.commentId)
    if (!comment) return

    res.json(comment)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// ─── SCRITTURA POST ────────────────────────────────────────────────────────

// POST /blogPosts/cover-upload — pre-upload cover prima di creare il post
router.post('/cover-upload', authMiddleware, upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nessun file caricato' })
    const result = await uploadBufferToCloudinary(req.file.buffer, 'strive-blog/covers', {
      transformation: [{ width: 1200, height: 675, crop: 'fill', gravity: 'auto' }]
    })
    res.json({ url: result.secure_url })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// POST /blogPosts
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { errors, sanitized } = validateBlogPostPayload(req.body)
    if (errors.length) {
      return sendValidationError(res, errors)
    }

    // author e authorName ricavati dal token JWT — il client non può impostarli
    const authorName = `${req.user.nome || ''} ${req.user.cognome || ''}`.trim()

    // Sanitizza il content HTML prima di salvarlo — rimuove script e handler pericolosi
    const blogPost = new BlogPost({
      ...sanitized,
      author: req.user.email,   // forza dal token: nessun client può impersonare altri
      authorId: req.user.id,    // salvato definitivamente — resta anche se l'autore viene eliminato
      content: sanitizeContent(sanitized.content),
      authorName
    })
    const newBlogPost = await blogPost.save()

    await sendNewPostEmail(newBlogPost.author, newBlogPost.title, newBlogPost._id)

    res.status(201).json(newBlogPost)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PUT /blogPosts/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    if (!canModifyPost(req, blogPost)) {
      return res.status(403).json({ message: 'Non autorizzato: puoi modificare solo i tuoi articoli' })
    }

    const { errors, sanitized } = validateBlogPostPayload(req.body)
    if (errors.length) {
      return sendValidationError(res, errors)
    }

    // Sanitizza il content HTML se presente nel body dell'aggiornamento.
    // author e authorName non sono modificabili dal client.
    const updatePayload = {
      ...sanitized,
      content: sanitizeContent(sanitized.content)
    }
    delete updatePayload.author      // non si può cambiare la paternità del post
    delete updatePayload.authorName  // impostato solo alla creazione

    const updated = await BlogPost.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true
    })
    res.json(updated)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// DELETE /blogPosts/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    if (!canModifyPost(req, blogPost)) {
      return res.status(403).json({ message: 'Non autorizzato: puoi eliminare solo i tuoi articoli' })
    }

    await BlogPost.findByIdAndDelete(req.params.id)

    // Notifica all'autore solo se è stato eliminato da qualcun altro
    const deletedBySelf = blogPost.authorId && String(req.user?.id) === String(blogPost.authorId)
    if (!deletedBySelf && blogPost.author) {
      void sendPostDeletedEmail({
        authorEmail: blogPost.author,
        postTitle: blogPost.title,
        actor: { nome: req.user?.nome, cognome: req.user?.cognome, email: req.user?.email }
      })
    }

    res.json({ message: 'Blog post eliminato' })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PATCH /blogPosts/:blogPostId/cover
router.patch('/:blogPostId/cover', authMiddleware, upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nessun file caricato' })

    const blogPost = await getBlogPostByIdOr404(res, req.params.blogPostId)
    if (!blogPost) return

    if (!canModifyPost(req, blogPost)) {
      return res.status(403).json({ message: 'Non autorizzato: puoi modificare solo i tuoi articoli' })
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, 'strive-blog/covers', {
      transformation: [
        {
          width: 1200,
          height: 675,
          crop: 'fill',
          gravity: 'auto'
        }
      ]
    })

    blogPost.cover = result.secure_url
    await blogPost.save()
    res.json(blogPost)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PATCH /blogPosts/:id/like — toggle like (aggiunge o rimuove il like dell'utente corrente)
router.patch('/:id/like', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    const userId = String(req.user.id)
    const alreadyLiked = blogPost.likes.some((id) => String(id) === userId)

    if (alreadyLiked) {
      blogPost.likes = blogPost.likes.filter((id) => String(id) !== userId)
    } else {
      blogPost.likes.push(req.user.id)
    }

    await blogPost.save()
    res.json({ liked: !alreadyLiked, likesCount: blogPost.likes.length })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// ─── SCRITTURA COMMENTI ────────────────────────────────────────────────────

// POST /blogPosts/:id  — aggiungi un commento al post (spec consegna)
// authorId/authorEmail vengono ricavati dal token JWT, non dal body (non fidarsi del client)
router.post('/:id', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    const { errors, sanitized } = validateCommentPayload(req.body, { requireAuthor: false })
    if (errors.length) {
      return sendValidationError(res, errors)
    }

    const isFirstComment = blogPost.comments.length === 0
    const commenterName = sanitized.author || `${req.user.nome || ''} ${req.user.cognome || ''}`.trim()
    const isOwnPost = blogPost.authorId && String(req.user?.id) === String(blogPost.authorId)

    blogPost.comments.push({
      author: commenterName,
      authorId: req.user.id,
      authorEmail: req.user.email,
      content: sanitized.content
    })
    await blogPost.save()

    // Email solo al primo commento e solo se il commenter non è l'autore del post
    if (isFirstComment && !isOwnPost && blogPost.author) {
      void sendFirstCommentEmail({
        postAuthorEmail: blogPost.author,
        postTitle: blogPost.title,
        postId: blogPost._id,
        commenterName
      })
    }

    const newComment = blogPost.comments[blogPost.comments.length - 1]
    res.status(201).json(newComment)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PUT /blogPosts/:id/comment/:commentId  — modifica commento (spec consegna: singolare)
router.put('/:id/comment/:commentId', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    const comment = getCommentByIdOr404(res, blogPost, req.params.commentId)
    if (!comment) return

    if (!canModifyComment(req, comment)) {
      return res.status(403).json({ message: 'Non autorizzato: puoi modificare solo i tuoi commenti' })
    }

    const { errors, sanitized } = validateCommentPayload(req.body, { requireAuthor: false })
    if (errors.length) {
      return sendValidationError(res, errors)
    }

    if (sanitized.author) comment.author = sanitized.author
    comment.content = sanitized.content
    comment.updatedAt = new Date()

    await blogPost.save()
    res.json(comment)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// DELETE /blogPosts/:id/comment/:commentId  — elimina commento (spec consegna: singolare)
router.delete('/:id/comment/:commentId', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    const comment = getCommentByIdOr404(res, blogPost, req.params.commentId)
    if (!comment) return

    if (!canModifyComment(req, comment)) {
      return res.status(403).json({ message: 'Non autorizzato: puoi eliminare solo i tuoi commenti' })
    }

    comment.deleteOne()
    await blogPost.save()

    res.json({ message: 'Commento eliminato' })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// ─── SCRITTURA RISPOSTE AI COMMENTI ───────────────────────────────────────

// POST /blogPosts/:id/comment/:commentId/reply — aggiungi risposta a un commento
router.post('/:id/comment/:commentId/reply', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    const comment = getCommentByIdOr404(res, blogPost, req.params.commentId)
    if (!comment) return

    const { errors, sanitized } = validateCommentPayload(req.body, { requireAuthor: false })
    if (errors.length) return sendValidationError(res, errors)

    const replierName = sanitized.author || `${req.user.nome || ''} ${req.user.cognome || ''}`.trim()

    comment.replies.push({
      author: replierName,
      authorId: req.user.id,
      authorEmail: req.user.email,
      content: sanitized.content
    })
    await blogPost.save()

    const newReply = comment.replies[comment.replies.length - 1]
    res.status(201).json(newReply)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// PUT /blogPosts/:id/comment/:commentId/reply/:replyId — modifica risposta
router.put('/:id/comment/:commentId/reply/:replyId', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    const comment = getCommentByIdOr404(res, blogPost, req.params.commentId)
    if (!comment) return

    const reply = comment.replies.id(req.params.replyId)
    if (!reply) return res.status(404).json({ message: 'Risposta non trovata' })

    if (!canModifyComment(req, reply)) {
      return res.status(403).json({ message: 'Non autorizzato: puoi modificare solo le tue risposte' })
    }

    const { errors, sanitized } = validateCommentPayload(req.body, { requireAuthor: false })
    if (errors.length) return sendValidationError(res, errors)

    if (sanitized.author) reply.author = sanitized.author
    reply.content = sanitized.content
    reply.updatedAt = new Date()

    await blogPost.save()
    res.json(reply)
  } catch (err) {
    handleRouteError(res, err)
  }
})

// DELETE /blogPosts/:id/comment/:commentId/reply/:replyId — elimina risposta
router.delete('/:id/comment/:commentId/reply/:replyId', authMiddleware, async (req, res) => {
  try {
    const blogPost = await getBlogPostByIdOr404(res, req.params.id)
    if (!blogPost) return

    const comment = getCommentByIdOr404(res, blogPost, req.params.commentId)
    if (!comment) return

    const reply = comment.replies.id(req.params.replyId)
    if (!reply) return res.status(404).json({ message: 'Risposta non trovata' })

    if (!canModifyComment(req, reply)) {
      return res.status(403).json({ message: 'Non autorizzato: puoi eliminare solo le tue risposte' })
    }

    reply.deleteOne()
    await blogPost.save()
    res.json({ message: 'Risposta eliminata' })
  } catch (err) {
    handleRouteError(res, err)
  }
})

// ─── Error handler Multer ──────────────────────────────────────────────────
// Intercetta errori di upload (file troppo grande, MIME non ammesso)
// prima che raggiungano il client come 500 generico.
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
