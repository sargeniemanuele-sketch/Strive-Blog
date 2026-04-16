import React, { useState } from 'react'
import { Form, Container, Row, Col, Card } from 'react-bootstrap'
import { useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL, redirectToGoogleAuth, setAuthToken } from '../../utils/api'
import FixedAlerts from '../../components/common/FixedAlerts'

const Register = () => {
  const [form, setForm] = useState({
    nome: '', cognome: '', email: '',
    password: '', dataDiNascita: '', bio: ''
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const hasMinLength = form.password.length >= 8
  const hasNumber = /\d/.test(form.password)
  const hasTypedPassword = form.password.length > 0
  const isPasswordValid = hasMinLength && hasNumber

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/authors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }

      // Login automatico subito dopo la registrazione
      const loginRes = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password })
      })
      const loginData = await loginRes.json()
      if (!loginRes.ok || !loginData.token) {
        setError(loginData.message || 'Registrazione completata, ma login automatico non riuscito')
        return
      }

      // Upload avatar opzionale con token appena ottenuto
      if (avatarFile) {
        const formData = new FormData()
        formData.append('avatar', avatarFile)
        await fetch(`${API_BASE_URL}/authors/${data._id}/avatar`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${loginData.token}` },
          body: formData
        })
      }

      setAuthToken(loginData.token)
      navigate('/', {
        state: { flash: 'Registrazione completata. Benvenuto su Strive Blog!' }
      })
    } catch {
      setError('Errore di connessione al server')
    }
  }

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Row className="justify-content-center">
        <Col md={9} lg={6}>
          <Card className="bg-body-tertiary border-0 shadow-sm">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-end mb-2">
                <Link to="/" className="btn btn-sm btn-outline-danger">Chiudi</Link>
              </div>
              <h1 className="h3 mb-2">Crea account</h1>
              <p className="text-body-secondary mb-4">Unisciti a Strive Blog come autore</p>
              <p className="small text-body-secondary mb-3">I campi con * sono obbligatori.</p>

              <Form onSubmit={handleSubmit}>
                <div className="d-flex gap-3">
                  <Form.Group className="mb-3 flex-fill">
                    <Form.Label>Nome *</Form.Label>
                    <Form.Control name="nome" value={form.nome} onChange={handleChange} placeholder="Mario" required />
                  </Form.Group>
                  <Form.Group className="mb-3 flex-fill">
                    <Form.Label>Cognome *</Form.Label>
                    <Form.Control name="cognome" value={form.cognome} onChange={handleChange} placeholder="Rossi" required />
                  </Form.Group>
                </div>
                <Form.Group className="mb-3">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control type="email" name="email" value={form.email} onChange={handleChange} placeholder="mario@email.com" required />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Password *</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                  <div className="small mt-2">
                    <div className={hasTypedPassword ? (hasMinLength ? 'text-success' : 'text-danger') : 'text-body-secondary'}>
                      {hasMinLength ? '✓' : '•'} Almeno 8 caratteri
                    </div>
                    <div className={hasTypedPassword ? (hasNumber ? 'text-success' : 'text-danger') : 'text-body-secondary'}>
                      {hasNumber ? '✓' : '•'} Almeno 1 numero
                    </div>
                  </div>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Data di nascita *</Form.Label>
                  <Form.Control type="date" name="dataDiNascita" value={form.dataDiNascita} onChange={handleChange} required />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Bio (facoltativa)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="bio"
                    value={form.bio}
                    onChange={handleChange}
                    maxLength={280}
                    placeholder="Racconta qualcosa di te..."
                  />
                  <Form.Text className="text-body-secondary">
                    {form.bio.length}/280
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>Avatar (file, facoltativo)</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    onChange={e => setAvatarFile(e.target.files?.[0] || null)}
                  />
                </Form.Group>
                <button type="submit" className="btn btn-dark w-100" disabled={!isPasswordValid}>Crea account</button>
              </Form>

              <div className="d-flex align-items-center gap-3 my-3 text-body-secondary small">
                <hr className="flex-grow-1 my-0 border-secondary" />
                <span>oppure</span>
                <hr className="flex-grow-1 my-0 border-secondary" />
              </div>

              <button
                type="button"
                className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
                onClick={redirectToGoogleAuth}
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  width={18}
                />
                Continua con Google
              </button>

              <p className="mb-0 mt-3 text-body-secondary">
                Hai già un account? <Link to="/login">Accedi</Link>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <FixedAlerts
        alerts={[
          {
            key: 'register-error',
            variant: 'danger',
            text: error,
            onClose: error ? () => setError('') : undefined
          }
        ]}
      />
    </Container>
  )
}

export default Register
