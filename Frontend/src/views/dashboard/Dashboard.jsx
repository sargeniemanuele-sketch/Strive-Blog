import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Container, Form, Modal, Row } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL, authedFetch, clearAuthToken } from "../../utils/api";
import PageSpinner from "../../components/common/PageSpinner";
import FixedAlerts from "../../components/common/FixedAlerts";

const Dashboard = () => {
  const navigate = useNavigate();
  const goBack = () => navigate(-1)
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [me, setMe] = useState(null);
  const [meAvatarSrc, setMeAvatarSrc] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [authorForm, setAuthorForm] = useState({
    nome: "",
    cognome: "",
    email: "",
    dataDiNascita: "",
    bio: ""
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmNewPassword: ""
  })
  const [myPosts, setMyPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleError = useCallback((text) => {
    setError(text);
    setMessage("");
  }, []);

  const handleMessage = useCallback((text) => {
    setMessage(text);
    setError("");
  }, []);

  const forceRelogin = useCallback((msg) => {
    clearAuthToken()
    navigate("/login", {
      replace: true,
      state: { errorFlash: msg || "Sessione non valida. Fai di nuovo login." }
    });
  }, [navigate]);

  const buildAvatarFallback = (author) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${author.nome || ""} ${author.cognome || ""}`.trim() || author.email || "User"
    )}&background=1f2937&color=ffffff&size=96`;

  const fetchMyPosts = useCallback(async (authorId) => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${authorId}/blogPosts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore nel caricamento articoli");
      setMyPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      handleError(err.message);
    }
  }, [handleError]);

  const fetchSavedPosts = useCallback(async () => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/bookmarks`);
      const data = await res.json();
      if (!res.ok) return;
      setSavedPosts(Array.isArray(data) ? data : []);
    } catch {
      // silenzioso: i bookmark non sono critici
    }
  }, []);

  const fetchMe = useCallback(async () => {
    setLoadingProfile(true)
    try {
      const res = await authedFetch(`${API_BASE_URL}/me`);
      const data = await res.json();
      if (res.status === 401 || res.status === 404) {
        const msg = data.code === 'ACCOUNT_DELETED'
          ? 'Il tuo account è stato eliminato.'
          : data.code === 'ACCOUNT_BLOCKED'
          ? 'Il tuo account è stato bloccato. Contatta un amministratore.'
          : undefined
        forceRelogin(msg);
        return;
      }
      if (!res.ok) throw new Error(data.message || "Errore nel caricamento profilo");

      setMe(data);
      setAuthorForm({
        nome: data.nome || "",
        cognome: data.cognome || "",
        email: data.email || "",
        dataDiNascita: data.dataDiNascita || "",
        bio: data.bio || ""
      });
      setMeAvatarSrc(data.avatar || buildAvatarFallback(data));
      fetchMyPosts(data._id);
      fetchSavedPosts();
    } catch (err) {
      handleError(err.message);
    } finally {
      setLoadingProfile(false)
    }
  }, [fetchMyPosts, fetchSavedPosts, forceRelogin, handleError]);

  const saveProfile = async () => {
    if (!me?._id) return;
    if (!authorForm.nome.trim() || !authorForm.cognome.trim() || !authorForm.email.trim()) {
      handleError("Compila tutti i campi obbligatori: Nome, Cognome, Email.");
      return;
    }

    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${me._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authorForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore nel salvataggio profilo");

      let updatedAuthor = data;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        const avatarRes = await authedFetch(`${API_BASE_URL}/authors/${me._id}/avatar`, {
          method: "PATCH",
          body: formData
        });
        const avatarData = await avatarRes.json();
        if (!avatarRes.ok) throw new Error(avatarData.message || "Errore upload avatar");
        updatedAuthor = avatarData;
        setAvatarFile(null);
      }

      setMe(updatedAuthor);
      setAuthorForm({
        nome: updatedAuthor.nome || "",
        cognome: updatedAuthor.cognome || "",
        email: updatedAuthor.email || "",
        dataDiNascita: updatedAuthor.dataDiNascita || "",
        bio: updatedAuthor.bio || ""
      });
      setMeAvatarSrc(updatedAuthor.avatar || buildAvatarFallback(updatedAuthor));
      handleMessage(avatarFile ? "Profilo e avatar aggiornati." : "Profilo aggiornato.");
      fetchMyPosts(updatedAuthor._id);
    } catch (err) {
      handleError(err.message);
    }
  };

  const changePassword = async () => {
    if (!me?._id) return

    if (!passwordForm.newPassword.trim() || !passwordForm.confirmNewPassword.trim()) {
      handleError("Inserisci e conferma la nuova password.")
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      handleError("La conferma della nuova password non coincide.")
      return
    }

    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${me._id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Errore nel cambio password")

      setPasswordForm({
        newPassword: "",
        confirmNewPassword: ""
      })
      handleMessage("Controlla la tua email: clicca il link di conferma per completare il cambio password.")
    } catch (err) {
      handleError(err.message)
    }
  }

  const deleteAccount = async () => {
    if (!me?._id) return
    setDeleteLoading(true)
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${me._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Errore durante l\'eliminazione')
      clearAuthToken()
      navigate('/login', { replace: true, state: { flash: 'Il tuo account è stato eliminato.' } })
    } catch (err) {
      handleError(err.message)
      setShowDeleteModal(false)
    } finally {
      setDeleteLoading(false)
    }
  }

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  if (loadingProfile) {
    return (
      <Container className="pt-5 mt-5 pb-5">
        <PageSpinner text="Caricamento profilo..." />
      </Container>
    )
  }

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={goBack}>
        Indietro
      </Button>
      <h1 className="h3 mb-4">Il mio profilo</h1>

      {me && !me.emailVerified && !me.googleId && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-4" role="alert">
          <span>⚠️</span>
          <span>
            Il tuo indirizzo email non è ancora verificato. Controlla la tua casella di posta e clicca il link che ti abbiamo inviato.{' '}
            <strong>Se non verifichi entro 7 giorni dalla registrazione, il tuo account verrà eliminato automaticamente.</strong>
          </span>
        </div>
      )}

      <Row className="g-4">
        <Col lg={5}>
          <Card className="bg-body-tertiary border-0 h-100">
            <Card.Body>
              <h2 className="h5 mb-3">Profilo</h2>
              {me ? (
                <div className="small">
                  <div><strong>ID:</strong> {me._id}</div>
                  <div><strong>Nome:</strong> {me.nome} {me.cognome}</div>
                  <div><strong>Email:</strong> {me.email}</div>
                  <div><strong>Data nascita:</strong> {me.dataDiNascita || "-"}</div>
                  <div><strong>Bio:</strong> {me.bio || "-"}</div>
                  <div className="mt-2">
                    <strong>Avatar:</strong>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <img
                        src={meAvatarSrc}
                        alt="Avatar profilo"
                        width={44}
                        height={44}
                        className="rounded-circle object-fit-cover"
                        onError={() => setMeAvatarSrc(buildAvatarFallback(me))}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-body-secondary mb-0">Profilo non caricato.</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card className="bg-body-tertiary border-0 h-100">
            <Card.Body>
              <h2 className="h5 mb-2">Aggiorna il tuo profilo</h2>
              <p className="small text-body-secondary mb-3">
                I campi con * sono obbligatori. Data di nascita e Avatar sono facoltativi.
              </p>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label>Nome *</Form.Label>
                  <Form.Control
                    required
                    value={authorForm.nome}
                    onChange={(e) => setAuthorForm((p) => ({ ...p, nome: e.target.value }))}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>Cognome *</Form.Label>
                  <Form.Control
                    required
                    value={authorForm.cognome}
                    onChange={(e) => setAuthorForm((p) => ({ ...p, cognome: e.target.value }))}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    required
                    type="email"
                    value={authorForm.email}
                    onChange={(e) => setAuthorForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>Data di nascita (facoltativa)</Form.Label>
                  <Form.Control
                    type="date"
                    value={authorForm.dataDiNascita ? authorForm.dataDiNascita.toString().slice(0, 10) : ""}
                    onChange={(e) => setAuthorForm((p) => ({ ...p, dataDiNascita: e.target.value }))}
                  />
                </Col>
                <Col xs={12}>
                  <Form.Label>Bio (facoltativa)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    maxLength={280}
                    value={authorForm.bio}
                    onChange={(e) => setAuthorForm((p) => ({ ...p, bio: e.target.value }))}
                    placeholder="Racconta qualcosa di te..."
                  />
                  <Form.Text className="text-body-secondary">
                    {authorForm.bio.length}/280
                  </Form.Text>
                </Col>
                <Col xs={12}>
                  <Form.Label>Avatar (facoltativo)</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  />
                </Col>
              </Row>

              <div className="d-flex gap-2 flex-wrap mt-3">
                <Button variant="primary" onClick={saveProfile}>
                  Salva modifiche
                </Button>
              </div>

              <hr className="my-4" />

              <h3 className="h6 mb-2">Cambia password</h3>
              {me?.googleId ? (
                <p className="small text-body-secondary mb-0">
                  Hai effettuato l'accesso con Google. Il cambio password non è disponibile per gli account Google.
                </p>
              ) : (
                <>
                  <p className="small text-body-secondary mb-3">
                    Per sicurezza invieremo una mail di conferma all'indirizzo del tuo profilo: <strong>{me?.email}</strong>.
                  </p>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Label>Nuova password *</Form.Label>
                      <Form.Control
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                      />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Conferma nuova password *</Form.Label>
                      <Form.Control
                        type="password"
                        value={passwordForm.confirmNewPassword}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, confirmNewPassword: e.target.value }))}
                      />
                    </Col>
                  </Row>
                  <div className="d-flex gap-2 flex-wrap mt-3">
                    <Button variant="outline-primary" onClick={changePassword}>
                      Aggiorna password
                    </Button>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="bg-body-tertiary border-0 mt-4">
        <Card.Body>
          <h3 className="h6 mb-3">I tuoi articoli ({myPosts.length})</h3>
          {myPosts.length === 0 ? (
            <p className="text-body-secondary mb-0">Nessun articolo trovato.</p>
          ) : (
            <div className="d-flex flex-column gap-2">
              {myPosts.map((post) => (
                <Link
                  key={post._id}
                  to={`/blog/${post._id}`}
                  className="d-flex justify-content-between align-items-center p-2 rounded-2 border text-decoration-none"
                >
                  <div>
                    <div className="small fw-semibold">{post.title}</div>
                    <div className="small text-body-secondary">{post.category}</div>
                  </div>
                  <span className="small text-body-secondary flex-shrink-0 ms-2">Apri</span>
                </Link>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
      <Card className="bg-body-tertiary border-0 mt-4">
        <Card.Body>
          <h3 className="h6 mb-3">Post salvati ({savedPosts.length})</h3>
          {savedPosts.length === 0 ? (
            <p className="text-body-secondary mb-0">Nessun post salvato. Usa il pulsante ☆ negli articoli per aggiungerli qui.</p>
          ) : (
            <div className="d-flex flex-column gap-2">
              {savedPosts.map((post) => (
                <Link
                  key={post._id}
                  to={`/blog/${post._id}`}
                  className="d-flex justify-content-between align-items-center p-2 rounded-2 border text-decoration-none"
                >
                  <div style={{ minWidth: 0 }} className="me-2">
                    <div className="small fw-semibold text-truncate">{post.title}</div>
                    <div className="small text-body-secondary">{post.category}</div>
                  </div>
                  <span className="small text-body-secondary flex-shrink-0">Apri</span>
                </Link>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      <Card className="border-danger border-opacity-50 mt-4">
        <Card.Body>
          <h3 className="h6 mb-1 text-danger">Zona pericolosa</h3>
          <p className="small text-body-secondary mb-3">
            L'eliminazione dell'account è irreversibile. I tuoi articoli rimarranno pubblicati.
          </p>
          {me?.role === 'user' ? (
            <Button variant="outline-danger" size="sm" onClick={() => setShowDeleteModal(true)}>
              Elimina il mio account
            </Button>
          ) : (
            <p className="small text-body-secondary mb-0">
              Il tuo account ha ruolo <strong>{me?.role}</strong>. Per eliminarlo devi prima trasferire il ruolo:{' '}
              <Button variant="link" size="sm" className="p-0 align-baseline" as={Link} to={`/authors/${me?._id}`}>
                vai al tuo profilo
              </Button>
              .
            </p>
          )}
        </Card.Body>
      </Card>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Elimina account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Sei sicuro di voler eliminare il tuo account?
          <br />
          <span className="text-danger small">Questa azione è irreversibile.</span>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
            Annulla
          </Button>
          <Button variant="danger" onClick={deleteAccount} disabled={deleteLoading}>
            {deleteLoading ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </Modal.Footer>
      </Modal>

      <FixedAlerts
        alerts={[
          {
            key: "dashboard-error",
            variant: "danger",
            text: error,
            onClose: error ? () => setError("") : undefined
          },
          {
            key: "dashboard-message",
            variant: "success",
            text: message,
            onClose: message ? () => setMessage("") : undefined
          }
        ]}
      />
    </Container>
  );
};

export default Dashboard;
