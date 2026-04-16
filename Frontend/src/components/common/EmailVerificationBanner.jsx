import React, { useEffect, useState } from 'react'
import { Spinner } from 'react-bootstrap'
import { API_BASE_URL, authedFetch } from '../../utils/api'
import useAuthStatus from '../../hooks/useAuthStatus'

const EmailVerificationBanner = () => {
  const { isAuthenticated } = useAuthStatus()
  const [emailVerified, setEmailVerified] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Si riesegue ogni volta che il token cambia (auth-changed event)
  // "version" incrementa a ogni auth-changed, forzando il re-fetch di /me
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const handler = () => setVersion(v => v + 1)
    window.addEventListener('auth-changed', handler)
    return () => window.removeEventListener('auth-changed', handler)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setEmailVerified(null)
      setSent(false)
      setError('')
      return
    }
    authedFetch(`${API_BASE_URL}/me`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          // Gli account Google hanno sempre l'email verificata da Google
          setEmailVerified(Boolean(data.emailVerified) || Boolean(data.googleId))
        }
      })
      .catch(() => {})
  }, [isAuthenticated, version])

  const handleResend = async () => {
    setSending(true)
    setError('')
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/resend-verification`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || 'Errore nel reinvio')
        return
      }
      setSent(true)
    } catch {
      setError('Errore di connessione')
    } finally {
      setSending(false)
    }
  }

  if (!isAuthenticated || emailVerified !== false) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '57px',
        left: 0,
        right: 0,
        zIndex: 1029,
        background: 'rgba(255, 193, 7, 0.12)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 193, 7, 0.25)',
        padding: '7px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        fontSize: '0.82rem',
        color: 'rgba(255,255,255,0.85)'
      }}
    >
      <span>
        <strong>Verifica la tua email</strong> — il tuo account verrà eliminato automaticamente se non verifichi entro 7 giorni dalla registrazione.
      </span>

      {sent ? (
        <span style={{ color: '#86efac', fontWeight: 500 }}>
          ✓ Email inviata. Controlla la tua casella.
        </span>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          style={{
            background: 'rgba(255,193,7,0.25)',
            border: '1px solid rgba(255,193,7,0.5)',
            color: '#ffc107',
            borderRadius: '6px',
            padding: '3px 12px',
            fontSize: '0.8rem',
            cursor: sending ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
            transition: 'background 0.15s'
          }}
        >
          {sending && <Spinner animation="border" size="sm" style={{ width: '12px', height: '12px' }} />}
          {sending ? 'Invio...' : 'Reinvia email di verifica'}
        </button>
      )}

      {error && (
        <span style={{ color: '#f87171', fontSize: '0.78rem' }}>{error}</span>
      )}
    </div>
  )
}

export default EmailVerificationBanner
