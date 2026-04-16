import sanitizeHtml from 'sanitize-html'

/**
 * Sanitizza HTML proveniente dall'utente prima di salvarlo nel database.
 * Rimuove <script>, event handler (onclick, onerror…), attributi pericolosi
 * e qualsiasi tag non esplicitamente consentito, preservando la formattazione
 * legittima prodotta dall'editor WYSIWYG (Draft.js).
 */
export const sanitizeContent = (html) => {
  if (!html || typeof html !== 'string') return ''

  return sanitizeHtml(html, {
    // Tag sicuri — coprono tutto ciò che Draft.js/draftjs-to-html produce
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'div', 'span',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
      'figure', 'figcaption'
    ],

    allowedAttributes: {
      // Link — target e rel ammessi, href solo con schemi sicuri
      'a': ['href', 'name', 'target', 'rel'],
      // Immagini — no event handler, solo attributi descrittivi
      'img': ['src', 'alt', 'width', 'height', 'title'],
      // Stile inline e classe su tutti i tag (Draft.js li usa per bold/color/align)
      '*': ['style', 'class']
    },

    // Schemi URL ammessi per href/src — blocca javascript: data: su link
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data']   // data: necessario per immagini base64 inline
    },

    // Forza rel="noopener noreferrer" su link con target="_blank"
    transformTags: {
      'a': (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === '_blank'
            ? { rel: 'noopener noreferrer' }
            : {})
        }
      })
    }
  })
}
