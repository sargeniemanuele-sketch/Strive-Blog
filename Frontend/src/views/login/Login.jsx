import React, { useEffect, useState } from 'react'
import { Form, Container, Row, Col, Card } from 'react-bootstrap'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { API_BASE_URL, redirectToGoogleAuth, setAuthToken } from '../../utils/api'
import FixedAlerts from '../../components/common/FixedAlerts'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const queryError = new URLSearchParams(location.search).get('error')

  useEffect(() => {
    if (location.state?.flash) setSuccess(location.state.flash)
    if (location.state?.errorFlash) setError(location.state.errorFlash)
  }, [location.state])

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(''), 4000)
    return () => clearTimeout(t)
  }, [success])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) {
          setError(data.message || 'Troppi tentativi di login. Riprova più tardi.')
          return
        }
        setError(data.message || 'Credenziali non valide')
        return
      }
      setAuthToken(data.token)
      navigate('/', { state: { flash: 'Login effettuato con successo.' } })
    } catch {
      setError('Errore di connessione al server')
    }
  }

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Row className="justify-content-center">
        <Col md={8} lg={5}>
          <Card className="bg-body-tertiary border-0 shadow-sm">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-end mb-2">
                <Link to="/" className="btn btn-sm btn-outline-danger">Chiudi</Link>
              </div>
              <h1 className="h3 mb-2">Bentornato</h1>
              <p className="text-body-secondary mb-4">Accedi al tuo account Strive Blog</p>

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="nome@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </Form.Group>
                <button type="submit" className="btn btn-dark w-100">Accedi</button>
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
                Non hai un account? <Link to="/register">Registrati</Link>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <FixedAlerts
        alerts={[
          {
            key: 'login-success',
            variant: 'success',
            text: success,
            onClose: success ? () => setSuccess('') : undefined
          },
          {
            key: 'login-query-error',
            variant: 'danger',
            text: queryError,
            onClose: queryError ? () => navigate('/login', { replace: true }) : undefined
          },
          {
            key: 'login-error',
            variant: 'danger',
            text: error,
            onClose: error ? () => setError('') : undefined
          }
        ]}
      />
    </Container>
  )
}

export default Login
