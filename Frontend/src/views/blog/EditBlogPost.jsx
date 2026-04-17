import { useEffect, useState } from "react";
import { Button, Container, Form, Row, Col, Card, Spinner, Image } from "react-bootstrap";
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaQuoteLeft } from 'react-icons/fa'
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, authedFetch } from "../../utils/api";
import { BLOG_CATEGORIES } from "../../utils/categories";
import FixedAlerts from "../../components/common/FixedAlerts";
import PageSpinner from "../../components/common/PageSpinner";

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

const EditBlogPost = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(BLOG_CATEGORIES[0])
  const [author, setAuthor] = useState('')
  const [readTimeValue, setReadTimeValue] = useState(1)
  const [currentCover, setCurrentCover] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Scrivi il contenuto dell'articolo..." }),
      Underline,
    ],
  })

  useEffect(() => {
    authedFetch(`${API_BASE_URL}/blogPosts/${id}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setTitle(data.title || '')
        setCategory(data.category || BLOG_CATEGORIES[0])
        setAuthor(data.author || '')
        setReadTimeValue(data.readTime?.value || 1)
        setCurrentCover(data.cover || '')
        if (editor) {
          editor.commands.setContent(data.content || '', false)
        }
        setLoading(false)
      })
      .catch(() => navigate('/'))
  }, [id, navigate, editor])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const content = editor ? editor.getHTML() : ''
    const plainContent = content.replace(/<[^>]*>/g, '').trim()
    if (!plainContent) {
      setError("Inserisci il contenuto dell'articolo")
      setSaving(false)
      return
    }

    try {
      let coverUrl = currentCover

      if (coverFile) {
        const formData = new FormData()
        formData.append('cover', coverFile)
        const coverRes = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/cover`, {
          method: 'PATCH',
          body: formData
        })
        const coverData = await coverRes.json()
        if (!coverRes.ok) {
          setError(coverData.message || "Errore durante l'upload della cover")
          setSaving(false)
          return
        }
        coverUrl = coverData.cover
      }

      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          cover: coverUrl,
          author,
          readTime: { value: Number(readTimeValue), unit: 'minuti' },
          content
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Errore aggiornamento articolo')
        setSaving(false)
        return
      }

      navigate(`/blog/${id}`, { state: { flash: 'Articolo aggiornato con successo.' } })
    } catch {
      setError('Errore di connessione al server')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Sei sicuro di voler eliminare questo articolo?')) return
    setDeleting(true)
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Errore eliminazione articolo')
        setDeleting(false)
        return
      }
      navigate('/', { state: { flash: 'Articolo eliminato.' } })
    } catch {
      setError('Errore di connessione al server')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <PageSpinner text="Caricamento articolo..." />
      </div>
    )
  }

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Row className="justify-content-center">
        <Col lg={8}>
          <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={() => navigate(`/blog/${id}`)}>
            Indietro
          </Button>
          <Card className="new-article-card border-0 shadow-sm">
            <Card.Body className="p-4 p-md-5">
              <h1 className="h3 mb-2">Modifica articolo</h1>
              <p className="text-light-emphasis mb-4">Modifica i campi e salva le modifiche.</p>
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
                        {category && !BLOG_CATEGORIES.includes(category) && (
                          <option value={category}>{category}</option>
                        )}
                        {BLOG_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={7}>
                    <Form.Group controlId="blog-cover">
                      <Form.Label className="fw-semibold">Cover</Form.Label>
                      {currentCover && (
                        <div className="mb-2">
                          <Image src={currentCover} rounded fluid style={{ maxHeight: 120, objectFit: 'cover' }} />
                          <div className="small text-body-secondary mt-1">Cover attuale</div>
                        </div>
                      )}
                      <Form.Control
                        key={resetKey}
                        size="lg"
                        type="file"
                        accept="image/*"
                        onChange={e => setCoverFile(e.target.files?.[0] || null)}
                      />
                      <Form.Text className="text-body-secondary">
                        {coverFile ? `Selezionato: ${coverFile.name}` : "Lascia vuoto per mantenere la cover attuale."}
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

                <Form.Group className="d-flex mt-4 gap-2 pb-5 flex-wrap">
                  <Button type="button" variant="outline-secondary" className="flex-fill text-nowrap" onClick={() => navigate(`/blog/${id}`)}>
                    Annulla
                  </Button>
                  <Button
                    type="button"
                    variant="outline-danger"
                    className="flex-fill text-nowrap"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? <Spinner animation="border" size="sm" /> : 'Elimina articolo'}
                  </Button>
                  <Button type="submit" variant="primary" className="flex-fill text-nowrap" disabled={saving}>
                    {saving
                      ? <><Spinner animation="border" size="sm" className="me-2" />Salvataggio...</>
                      : 'Salva modifiche'
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
          key: "edit-error",
          variant: "danger",
          text: error,
          onClose: error ? () => setError("") : undefined
        }]}
      />
    </Container>
  )
}

export default EditBlogPost
