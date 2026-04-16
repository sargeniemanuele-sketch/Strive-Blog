import multer from 'multer'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE_MB = 5

/**
 * Filtra i file accettati: solo immagini tra i tipi ammessi, max 5 MB.
 * In caso di file non valido restituisce un errore 400 chiaro, non un crash.
 */
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      Object.assign(new Error(`Tipo file non supportato: ${file.mimetype}. Formati ammessi: JPEG, PNG, WebP, GIF.`), { status: 400 }),
      false
    )
  }
}

const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },  // 5 MB
  fileFilter
})

export default upload
