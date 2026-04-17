import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Col, Container, Form, Modal, Row, Spinner } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, authedFetch, clearAuthToken } from "../../utils/api";
import { getTokenPayload, isAdmin, isSuperAdmin } from "../../utils/token";
import { canBlockTarget, canDeleteTarget, roleBadgeVariant, StatusBadge } from "../../utils/adminHelpers";
import PageSpinner from "../../components/common/PageSpinner";
import FixedAlerts from "../../components/common/FixedAlerts";

const AuthorProfile = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const currentUser = getTokenPayload()
  const currentUserRole = currentUser?.role || 'user'
  const isAdminUser = isAdmin()
  const isSuperAdminUser = isSuperAdmin()
  const isSelf = Boolean(currentUser) && String(currentUser.id) === String(id)

  // ── Dati pubblici ──────────────────────────────────────────────────────────
  const [author, setAuthor] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ── Dati completi (solo admin) ─────────────────────────────────────────────
  const [fullAuthor, setFullAuthor] = useState(null);

  // ── Stato modal blocco ─────────────────────────────────────────────────────
  const [showBlock, setShowBlock] = useState(false);
  const [blockDuration, setBlockDuration] = useState('7d');

  // ── Stato modal cambio ruolo ───────────────────────────────────────────────
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [nextRole, setNextRole] = useState('user');

  // ── Stato modal eliminazione ───────────────────────────────────────────────
  const [showDelete, setShowDelete] = useState(false);
  const [deleteCandidates, setDeleteCandidates] = useState([]);
  const [requiredTransferRole, setRequiredTransferRole] = useState('');
  const [sourcePoolRole, setSourcePoolRole] = useState('');
  const [transferRoleTo, setTransferRoleTo] = useState('');
  const [loadingDeleteCandidates, setLoadingDeleteCandidates] = useState(false);

  const requiresTransferBeforeDelete = isSelf && (currentUserRole === 'admin' || currentUserRole === 'superadmin')

  // ── Fetch profilo pubblico + articoli ──────────────────────────────────────
  useEffect(() => {
    const fetchAuthorProfile = async () => {
      setLoading(true);
      setError("");
      setNotFound(false);
      try {
        const [authorRes, postsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/authors/public/${id}`),
          fetch(`${API_BASE_URL}/authors/public/${id}/blogPosts`)
        ]);

        // 404 = account eliminato: caso speciale con schermata dedicata
        if (authorRes.status === 404) {
          setNotFound(true);
          // Prova comunque a caricare i post residui
          if (postsRes.ok) {
            const postsData = await postsRes.json();
            setPosts(Array.isArray(postsData) ? postsData : []);
          }
          return;
        }

        const authorData = await authorRes.json();
        const postsData = await postsRes.json();

        if (!authorRes.ok) throw new Error(authorData.message || "Errore nel caricamento autore");
        if (!postsRes.ok) throw new Error(postsData.message || "Errore nel caricamento articoli autore");

        setAuthor(authorData);
        setPosts(Array.isArray(postsData) ? postsData : []);
      } catch (err) {
        setError(err.message || "Errore nel caricamento profilo autore");
      } finally {
        setLoading(false);
      }
    };

    fetchAuthorProfile();
  }, [id]);

  // ── Fetch dati completi (solo se admin) ────────────────────────────────────
  const fetchFullAuthor = useCallback(async () => {
    if (!isAdminUser) return
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setFullAuthor(data)
    } catch {
      // Silenzioso: se la fetch fallisce le azioni admin non vengono mostrate
    }
  }, [id, isAdminUser])

  useEffect(() => {
    fetchFullAuthor()
  }, [fetchFullAuthor])

  // Auto-dismiss messaggio successo
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(""), 4000)
    return () => clearTimeout(t)
  }, [message])

  // ── Handlers azioni admin ──────────────────────────────────────────────────

  const confirmBlock = async () => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${id}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: blockDuration })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      const action = blockDuration === 'unblock' ? 'sbloccato' : 'bloccato'
      setMessage(`${author.nome} ${author.cognome} ${action}.`)
      setFullAuthor(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setShowBlock(false)
    }
  }

  const confirmRoleChange = async () => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setMessage(`${author.nome} ${author.cognome} ora è ${data.role}.`)
      setFullAuthor(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setShowRoleModal(false)
      setNextRole('user')
    }
  }

  const resetDeleteState = () => {
    setShowDelete(false)
    setDeleteCandidates([])
    setRequiredTransferRole('')
    setSourcePoolRole('')
    setTransferRoleTo('')
    setLoadingDeleteCandidates(false)
  }

  const openDeleteModal = async () => {
    setShowDelete(true)
    if (!requiresTransferBeforeDelete) return
    setLoadingDeleteCandidates(true)
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${id}/deletion-candidates`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setDeleteCandidates(data.candidates || [])
      setRequiredTransferRole(data.requiredRole || '')
      setSourcePoolRole(data.sourcePoolRole || '')
      setTransferRoleTo(data.candidates?.[0]?._id || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDeleteCandidates(false)
    }
  }

  const confirmDelete = async () => {
    try {
      if (requiresTransferBeforeDelete && !transferRoleTo) {
        throw new Error('Seleziona un utente a cui passare il ruolo prima di eliminare il profilo')
      }
      const res = await authedFetch(`${API_BASE_URL}/authors/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requiresTransferBeforeDelete ? { transferRoleTo } : {})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      if (isSelf) {
        clearAuthToken()
        navigate('/login', { replace: true })
        return
      }
      navigate(-1)
    } catch (err) {
      setError(err.message)
    } finally {
      resetDeleteState()
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const fallbackAvatar = (data) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${data?.nome || ""} ${data?.cognome || ""}`.trim() || "Autore"
    )}&background=1f2937&color=ffffff&size=128`;

  if (loading) {
    return (
      <Container className="pt-5 mt-5 pb-5">
        <PageSpinner text="Caricamento profilo autore..." />
      </Container>
    );
  }

  // Account eliminato (404)
  if (notFound) {
    return (
      <Container className="pt-5 mt-5 pb-5">
        <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={() => navigate(-1)}>
          Indietro
        </Button>
        <Card className="bg-body-tertiary border-0 mb-4">
          <Card.Body className="py-5 text-center">
            <div className="mb-3" style={{ fontSize: '2.5rem', opacity: 0.4 }}>👤</div>
            <h2 className="h5 mb-2">Account eliminato</h2>
            <p className="text-body-secondary mb-0">
              Questo profilo non è più disponibile. L'account è stato eliminato.
            </p>
          </Card.Body>
        </Card>
        {posts.length > 0 && (
          <Card className="bg-body-tertiary border-0">
            <Card.Body>
              <h2 className="h6 mb-3">Articoli pubblicati ({posts.length})</h2>
              <Row className="g-2">
                {posts.map((post) => (
                  <Col xs={12} key={post._id}>
                    <a
                      href={`/blog/${post._id}`}
                      onClick={(e) => { e.preventDefault(); navigate(`/blog/${post._id}`) }}
                      className="d-flex justify-content-between align-items-center p-2 rounded-2 border text-decoration-none"
                    >
                      <div style={{ minWidth: 0 }} className="me-2">
                        <div className="small fw-semibold text-truncate">{post.title}</div>
                        <div className="small text-body-secondary">{post.category}</div>
                      </div>
                      <span className="small text-body-secondary flex-shrink-0">Apri</span>
                    </a>
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>
        )}
      </Container>
    );
  }

  // Errore generico (non 404)
  if (!author) {
    return (
      <Container className="pt-5 mt-5 pb-5">
        <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={() => navigate(-1)}>
          Indietro
        </Button>
        <p className="text-body-secondary">Profilo autore non disponibile.</p>
        <FixedAlerts
          alerts={[{ key: "author-profile-error-empty", variant: "danger", text: error, onClose: error ? () => setError("") : undefined }]}
        />
      </Container>
    );
  }

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={() => navigate(-1)}>
        Indietro
      </Button>

      {/* ── Profilo ── */}
      <Card className="bg-body-tertiary border-0 mb-4">
        <Card.Body>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <img
              src={author.avatar || fallbackAvatar(author)}
              alt={`${author.nome} ${author.cognome}`.trim() || "Autore"}
              width={80}
              height={80}
              className="rounded-circle object-fit-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = fallbackAvatar(author);
              }}
            />
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                <h1 className="h4 mb-0">{author.nome} {author.cognome}</h1>
                {isSelf && (
                  <Button as={Link} to="/profilo" size="sm" variant="outline-secondary">
                    Modifica il tuo profilo
                  </Button>
                )}
              </div>
              {author.email && <div className="small text-body-secondary mb-1">{author.email}</div>}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="small text-body-secondary text-uppercase">{author.role || "user"}</span>
                {isAdminUser && fullAuthor && <StatusBadge author={fullAuthor} />}
                {author.emailVerified
                  ? <Badge bg="success" className="fw-normal">Email verificata</Badge>
                  : <Badge bg="warning" text="dark" className="fw-normal">Email non verificata</Badge>
                }
              </div>
            </div>
          </div>
          <hr />
          <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
            {String(author.bio || "").trim() || "Nessuna bio disponibile."}
          </p>
        </Card.Body>
      </Card>

      {/* ── Gestione account (solo admin) ── */}
      {isAdminUser && fullAuthor && (
        <Card className="bg-body-tertiary border-0 mb-4">
          <Card.Body>
            <h2 className="h6 mb-3">Gestione account</h2>
            <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
              <Badge bg={roleBadgeVariant(fullAuthor.role)}>{fullAuthor.role || 'user'}</Badge>
              <StatusBadge author={fullAuthor} />
              <span className="small text-body-secondary">
                Login: {fullAuthor.googleId ? 'Google OAuth' : 'Email/Password'}
              </span>
            </div>
            {fullAuthor.blocked && fullAuthor.blockedUntil && (
              <div className="small text-body-secondary mb-3">
                Bloccato fino al: {new Date(fullAuthor.blockedUntil).toLocaleString('it-IT')}
              </div>
            )}
            <div className="d-flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={fullAuthor.blocked ? 'success' : 'warning'}
                disabled={!canBlockTarget(currentUserRole, fullAuthor.role, isSelf)}
                onClick={() => { setBlockDuration(fullAuthor.blocked ? 'unblock' : '7d'); setShowBlock(true) }}
              >
                {fullAuthor.blocked ? 'Sblocca' : 'Blocca'}
              </Button>
              {isSuperAdminUser && !isSelf && (
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => { setNextRole(fullAuthor.role || 'user'); setShowRoleModal(true) }}
                >
                  Cambia ruolo
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                disabled={!canDeleteTarget(currentUserRole, fullAuthor.role, isSelf)}
                onClick={openDeleteModal}
              >
                Elimina autore
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* ── Articoli pubblicati ── */}
      <Card className="bg-body-tertiary border-0">
        <Card.Body>
          <h2 className="h6 mb-3">Articoli pubblicati ({posts.length})</h2>
          {posts.length === 0 ? (
            <p className="text-body-secondary mb-0">Nessun articolo pubblicato.</p>
          ) : (
            <Row className="g-2">
              {posts.map((post) => (
                <Col xs={12} key={post._id}>
                  <a
                    href={`/blog/${post._id}`}
                    onClick={(e) => { e.preventDefault(); navigate(`/blog/${post._id}`) }}
                    className="d-flex justify-content-between align-items-center p-2 rounded-2 border text-decoration-none"
                  >
                    <div style={{ minWidth: 0 }} className="me-2">
                      <div className="small fw-semibold text-truncate">{post.title}</div>
                      <div className="small text-body-secondary">{post.category}</div>
                    </div>
                    <span className="small text-body-secondary flex-shrink-0">Apri</span>
                  </a>
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>

      {/* ── Modal blocco/sblocco ── */}
      <Modal show={showBlock} onHide={() => setShowBlock(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{fullAuthor?.blocked ? 'Sblocca' : 'Blocca'} autore</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {fullAuthor?.blocked ? (
            <p className="mb-0">
              Sbloccare <strong>{author.nome} {author.cognome}</strong>?
            </p>
          ) : (
            <>
              <p>Blocca <strong>{author.nome} {author.cognome}</strong> per:</p>
              <Form.Select value={blockDuration} onChange={e => setBlockDuration(e.target.value)}>
                <option value="1d">1 giorno</option>
                <option value="3d">3 giorni</option>
                <option value="7d">1 settimana</option>
                <option value="30d">1 mese</option>
                <option value="permanent">Permanente</option>
              </Form.Select>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowBlock(false)}>Annulla</Button>
          <Button variant={fullAuthor?.blocked ? 'success' : 'warning'} onClick={confirmBlock}>
            {fullAuthor?.blocked ? 'Sblocca' : 'Blocca'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Modal cambio ruolo ── */}
      <Modal show={showRoleModal} onHide={() => setShowRoleModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cambia ruolo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Imposta il ruolo per <strong>{author.nome} {author.cognome}</strong>:
          </p>
          <Form.Select value={nextRole} onChange={e => setNextRole(e.target.value)}>
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option value="superadmin">superadmin</option>
          </Form.Select>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowRoleModal(false)}>Annulla</Button>
          <Button variant="primary" onClick={confirmRoleChange}>Salva ruolo</Button>
        </Modal.Footer>
      </Modal>

      {/* ── Modal eliminazione ── */}
      <Modal show={showDelete} onHide={resetDeleteState} centered>
        <Modal.Header closeButton>
          <Modal.Title>Elimina autore</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {requiresTransferBeforeDelete ? (
            <>
              <p>
                Stai eliminando il tuo profilo <strong>{currentUserRole}</strong>.
              </p>
              <p className="mb-2">
                Prima di procedere devi trasferire il ruolo{' '}
                <strong>{requiredTransferRole || currentUserRole}</strong>{' '}
                a un account {sourcePoolRole ? <strong>{sourcePoolRole}</strong> : 'idoneo'}.
              </p>
              {loadingDeleteCandidates ? (
                <div className="d-flex align-items-center gap-2 small text-body-secondary">
                  <Spinner animation="border" size="sm" />
                  <span>Caricamento candidati...</span>
                </div>
              ) : deleteCandidates.length === 0 ? (
                <p className="text-danger small mb-0">
                  Nessun candidato disponibile: non puoi eliminare il tuo profilo finché non esiste almeno un account idoneo.
                </p>
              ) : (
                <Form.Select value={transferRoleTo} onChange={e => setTransferRoleTo(e.target.value)}>
                  {deleteCandidates.map(candidate => (
                    <option key={candidate._id} value={candidate._id}>
                      {candidate.nome} {candidate.cognome} ({candidate.email}) - {candidate.role}
                    </option>
                  ))}
                </Form.Select>
              )}
            </>
          ) : (
            <>
              Sei sicuro di voler eliminare{' '}
              <strong>{author.nome} {author.cognome}</strong>?
              <br />
              <span className="text-danger small">Questa azione è irreversibile.</span>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={resetDeleteState}>Annulla</Button>
          <Button
            variant="danger"
            onClick={confirmDelete}
            disabled={loadingDeleteCandidates || (requiresTransferBeforeDelete && (!deleteCandidates.length || !transferRoleTo))}
          >
            Elimina
          </Button>
        </Modal.Footer>
      </Modal>

      <FixedAlerts
        alerts={[
          { key: "author-profile-error", variant: "danger", text: error, onClose: error ? () => setError("") : undefined },
          { key: "author-profile-message", variant: "success", text: message, onClose: message ? () => setMessage("") : undefined }
        ]}
      />
    </Container>
  );
};

export default AuthorProfile;
