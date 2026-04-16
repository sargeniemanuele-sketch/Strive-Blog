import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  author: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', default: null },
  authorEmail: { type: String, default: '' },
  content: { type: String, required: true }
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.authorEmail
      return ret
    }
  },
  toObject: {
    transform: (_doc, ret) => {
      delete ret.authorEmail
      return ret
    }
  }
})

const blogPostSchema = new mongoose.Schema({
  // Identificazione
  category: { type: String, required: true },
  title: { type: String, required: true },
  // Visuale
  cover: { type: String, required: true },
  // Corpo
  content: { type: String, required: true },
  readTime: {
    value: { type: Number, required: true },
    unit: { type: String, required: true }
  },
  // Autore
  author: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', default: null },
  authorName: { type: String, default: '' },
  // Interazioni
  comments: { type: [commentSchema], default: [] }
}, {
  timestamps: true
})

export default mongoose.model('BlogPost', blogPostSchema)
