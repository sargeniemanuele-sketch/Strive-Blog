import { useEffect, useState } from "react";
import { Button, Container, Form, Row, Col, Card, Spinner } from "react-bootstrap";
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaQuoteLeft } from 'react-icons/fa'
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, authedFetch, getAuthToken } from "../../utils/api";
import { BLOG_CATEGORIES } from "../../utils/categories";
import FixedAlerts from "../../components/common/FixedAlerts";

const ToolbarBtn = ({ active, onClick, children }) => (
  <Button
    type="button"
    size="sm"
    variant={active ? 'secondary' : 'outline-secondary'}
    onClick={onClick}
  >
    {children}
  </Button>
)

const EditorToolbar = ({ editor }) => {
  if (!editor) return null
  return (
    <div className="new-editor-toolbar">
      <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><FaBold /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><FaItalic /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><FaUnderline /></ToolbarBtn>
      <span className="new-editor-sep" />
      <ToolbarBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarBtn>
      <span className="new-editor-sep" />
      <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><FaListUl /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><FaListOl /></ToolbarBtn>
      <ToolbarBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><FaQuoteLeft /></ToolbarBtn>
    </div>
  )
}

const NewBlogPost = () => {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(BLOG_CATEGORIES[0])
  const [coverFile, setCoverFile] = useState(null)
  const [author, setAuthor] = useState('')
  const [readTimeValue, setReadTimeValue] = useState(1)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const navigate = useNavigate()
  const goBack = () => navigate(-1)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Scrivi il contenuto dell'articolo..." }),
      Underline,
    ],
    onUpdate: ({ editor }) => setContent(editor.getHTML()),
  })

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login', { state: { flash: 'Devi essere autenticato per creare un articolo.' } })
      return
    }
    authedFetch(`${API_BASE_URL}/me`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.email) setAuthor(data.email) })
      .catch(() => {})
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setPublishing(true)
    const plainContent = content.replace(/<[^>]*>/g, '').trim()
    if (!coverFile) {
      setError('Seleziona un file per la cover')
      setPublishing(false)
      return
    }
    if (!plainContent) {
      setError("Inserisci il contenuto dell'articolo")
      setPublishing(false)
      return
    }
    try {
      // Step 1: upload cover su Cloudinary — se fallisce non viene creato nulla nel DB
      const formData = new FormData()
      formData.append('cover', coverFile)
      const coverRes = await authedFetch(`${API_BASE_URL}/blogPosts/cover-upload`, {
        method: 'POST',
        body: formData
      })
      const coverData = await coverRes.json()
      if (!coverRes.ok) {
        setError(coverData.message || "Errore durante l'upload della cover")
        setPublishing(false)
        return
      }

      // Step 2: crea il post con l'URL reale della cover
      const res = await authedFetch(`${API_BASE_URL}/blogPosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          cover: coverData.url,
          author,
          readTime: { value: Number(readTimeValue), unit: 'minuti' },
          content
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message)
        setPublishing(false)
        return
      }

      navigate('/', { state: { flash: 'Articolo creato con successo.' } })
    } catch (err) {
      setError('Errore di connessione al server')
      setPublishing(false)
    }
  }

  const handleReset = () => {
    setTitle('')
    setCategory(BLOG_CATEGORIES[0])
    setCoverFile(null)
    setReadTimeValue(1)
    setContent('')
    setError('')
    setResetKey(k => k + 1)
    editor?.commands.clearContent(true)
  }

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Row className="justify-content-center">
        <Col lg={8}>
          <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={goBack}>
            Indietro
          </Button>
          <Card className="new-article-card border-0 shadow-sm">
            <Card.Body className="p-4 p-md-5">
              <h1 className="h3 mb-2">Nuovo articolo</h1>
              <p className="text-light-emphasis mb-4">Compila i campi e pubblica il tuo contenuto.</p>
              <p className="small text-light-emphasis mb-4">I campi con * sono obbligatori.</p>

              <Form className="new-form" onSubmit={handleSubmit}>
                <Row className="g-3">
                  <Col md={8}>
                    <Form.Group controlId="blog-form">
                      <Form.Label className="fw-semibold">Titolo *</Form.Label>
                      <Form.Control
                        size="lg"
                        placeholder="Inserisci il titolo dell'articolo"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group controlId="blog-category">
                      <Form.Label className="fw-semibold">Categoria *</Form.Label>
                      <Form.Select size="lg" value={category} onChange={e => setCategory(e.target.value)}>
                        {BLOG_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={7}>
                    <Form.Group controlId="blog-cover">
                      <Form.Label className="fw-semibold">Cover (file) *</Form.Label>
                      <Form.Control
                        key={resetKey}
                        size="lg"
                        type="file"
                        accept="image/*"
                        onChange={e => setCoverFile(e.target.files?.[0] || null)}
                        required
                      />
                      <Form.Text className="text-body-secondary">
                        {coverFile ? `Selezionato: ${coverFile.name}` : "Formato consigliato: JPG o PNG, orientamento orizzontale."}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={5}>
                    <Form.Group controlId="blog-readtime">
                      <Form.Label className="fw-semibold">Tempo di lettura (minuti) *</Form.Label>
                      <Form.Control size="lg" type="number" min="1" value={readTimeValue} onChange={e => setReadTimeValue(e.target.value)} required />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group controlId="blog-author">
                      <Form.Label className="fw-semibold">Email autore</Form.Label>
                      <Form.Control
                        size="lg"
                        value={author}
                        readOnly
                        plaintext
                        className="text-body-secondary"
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group controlId="blog-content">
                      <Form.Label className="fw-semibold">Contenuto *</Form.Label>
                      <div className="new-editor">
                        <EditorToolbar editor={editor} />
                        <EditorContent editor={editor} />
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="d-flex mt-4 gap-2 pb-5">
                  <Button type="button" variant="outline-secondary" className="flex-fill text-nowrap" onClick={() => navigate('/')}>
                    Annulla
                  </Button>
                  <Button type="reset" variant="secondary" className="flex-fill text-nowrap" onClick={handleReset}>
                    Reset
                  </Button>
                  <Button type="submit" variant="primary" className="flex-fill text-nowrap" disabled={publishing}>
                    {publishing
                      ? <><Spinner animation="border" size="sm" className="me-2" />Pubblicazione...</>
                      : 'Pubblica articolo'
                    }
                  </Button>
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <FixedAlerts
        alerts={[{
          key: "new-error",
          variant: "danger",
          text: error,
          onClose: error ? () => setError("") : undefined
        }]}
      />
    </Container>
  )
}

export default NewBlogPost
