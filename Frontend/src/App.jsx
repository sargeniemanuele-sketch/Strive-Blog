import React, { useEffect } from "react";
import NavBar from "./components/navbar/BlogNavbar";
import Footer from "./components/footer/Footer";
import Home from "./views/home/Home";
import Blog from "./views/blog/Blog";
import NewBlogPost from "./views/new/New";
import Login from "./views/login/Login";
import Register from "./views/register/Register";
import Dashboard from "./views/dashboard/Dashboard";
import AdminPanel from "./views/admin/AdminPanel";
import AuthorProfile from "./views/author-profile/AuthorProfile";
import DeletedAuthorPage from "./views/author-profile/DeletedAuthorPage";
import PasswordChangeConfirm from "./views/password-change-confirm/PasswordChangeConfirm";
import VerifyEmail from "./views/verify-email/VerifyEmail";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { clearAuthToken, setAuthToken, getAuthToken, getAuthHeader, API_BASE_URL } from "./utils/api";
import useAuthStatus from "./hooks/useAuthStatus";
import EmailVerificationBanner from "./components/common/EmailVerificationBanner";

const LogoutButton = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStatus()

  if (!isAuthenticated) return null

  const handleLogout = () => {
    clearAuthToken()
    navigate('/login')
  }

  return (
    <button
      onClick={handleLogout}
      title="Logout"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: 'none',
        background: 'rgba(220,53,69,0.85)',
        color: '#fff',
        fontSize: '18px',
        cursor: 'pointer',
        zIndex: 1055,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        transition: 'background 0.2s, transform 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      ⏻
    </button>
  )
}

const TokenHandler = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setAuthToken(token)
      navigate('/', {
        replace: true,
        state: { flash: 'Login con Google effettuato con successo.' }
      })
    }
  }, [navigate])

  useEffect(() => {
    const handleKick = (e) => {
      const msg = e.detail?.code === 'ACCOUNT_BLOCKED'
        ? 'Il tuo account è stato bloccato. Contatta un amministratore.'
        : e.detail?.code === 'ACCOUNT_DELETED'
          ? 'Il tuo account è stato eliminato.'
          : 'La sessione è scaduta. Effettua di nuovo il login.'
      navigate('/login', { replace: true, state: { errorFlash: msg } })
    }
    window.addEventListener('auth-kick', handleKick)
    return () => window.removeEventListener('auth-kick', handleKick)
  }, [navigate])

  // Polling ogni 30 secondi: kicca l'utente se il suo account è stato eliminato o bloccato
  useEffect(() => {
    const checkSession = async () => {
      if (!getAuthToken()) return
      try {
        const res = await fetch(`${API_BASE_URL}/me`, { headers: getAuthHeader() })
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}))
          clearAuthToken()
          const msg = data.code === 'ACCOUNT_BLOCKED'
            ? 'Il tuo account è stato bloccato. Contatta un amministratore.'
            : data.code === 'ACCOUNT_DELETED'
              ? 'Il tuo account è stato eliminato.'
              : 'La sessione è scaduta. Effettua di nuovo il login.'
          navigate('/login', { replace: true, state: { errorFlash: msg } })
        }
      } catch { }
    }

    const interval = setInterval(checkSession, 30000)
    return () => clearInterval(interval)
  }, [navigate])

  return null
}

function App() {
  return (
    <Router>
      <TokenHandler />
      <LogoutButton />
      <NavBar />
      <EmailVerificationBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blog/:id" element={<Blog />} />
        {/* <Route path="/new" element={<NewBlogPost />} /> */}
        <Route path="/profilo" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/authors/deleted" element={<DeletedAuthorPage />} />
        <Route path="/authors/:id" element={<AuthorProfile />} />
        <Route path="/confirm-password-change" element={<PasswordChangeConfirm />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;
