import React, { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, Col, Container, Form, InputGroup, Modal, Row, Spinner, Table } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE_URL, authedFetch, clearAuthToken } from '../../utils/api'
import { getTokenPayload, isAdmin, isSuperAdmin } from '../../utils/token'
import { canBlockTarget, canDeleteTarget, roleBadgeVariant, StatusBadge } from '../../utils/adminHelpers'
import PageSpinner from '../../components/common/PageSpinner'
import FixedAlerts from '../../components/common/FixedAlerts'

const avatarUrl = (author) =>
  author.avatar ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    `${author.nome || ''} ${author.cognome || ''}`.trim() || author.email
  )}&background=1f2937&color=ffffff&size=40`

const isPrivilegedRole = (role) => role === 'admin' || role === 'superadmin'

const getBioPreview = (bio = '', limit = 90) => {
  const normalized = String(bio || '').trim()
  if (!normalized) return '—'
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized
}

const AdminPanel = () => {
  const navigate = useNavigate()
  const goBack = () => navigate(-1)
  const currentUser = getTokenPayload()
  const currentUserRole = currentUser?.role || 'user'
  const canManageRoles = isSuperAdmin()

  const [authors, setAuthors] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const getLimit = () => window.innerWidth < 768 ? 5 : 10
  const [pageLimit, setPageLimit] = useState(getLimit)

  const [selected, setSelected] = useState(null)
  const [selectedPosts, setSelectedPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleteCandidates, setDeleteCandidates] = useState([])
  const [requiredTransferRole, setRequiredTransferRole] = useState('')
  const [sourcePoolRole, setSourcePoolRole] = useState('')
  const [transferRoleTo, setTransferRoleTo] = useState('')
  const [loadingDeleteCandidates, setLoadingDeleteCandidates] = useState(false)

  const [showBlock, setShowBlock] = useState(false)
  const [toBlock, setToBlock] = useState(null)
  const [blockDuration, setBlockDuration] = useState('7d')
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [toChangeRole, setToChangeRole] = useState(null)
  const [nextRole, setNextRole] = useState('user')
  const [showBioModal, setShowBioModal] = useState(false)
  const [bioModalAuthor, setBioModalAuthor] = useState(null)

  // Protezione: solo admin
  useEffect(() => {
    if (!isAdmin()) navigate('/', { replace: true })
  }, [navigate])

  // Debounce ricerca: aspetta 300ms, poi aggiorna searchQuery e torna a pag 1
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setSearchQuery(searchInput.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Limite responsivo: 5 su mobile, 10 su desktop (debounce 200ms per non sparare ad ogni pixel)
  useEffect(() => {
    let t
    const handleResize = () => {
      clearTimeout(t)
      t = setTimeout(() => setPageLimit(getLimit()), 200)
    }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(t) }
  }, [])

  const fetchAuthors = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(pageLimit) })
      if (searchQuery) params.set('search', searchQuery)
      const res = await authedFetch(`${API_BASE_URL}/authors?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setAuthors(data.authors || [])
      setPage(data.currentPage || p)
      setTotalPages(data.totalPages || 1)
      setTotal(data.totalAuthors || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [pageLimit, searchQuery])

  const fetchAuthorPosts = async (authorId) => {
    setLoadingPosts(true)
    setSelectedPosts([])
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${authorId}/blogPosts`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setSelectedPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPosts(false)
    }
  }

  const handleRowClick = (author) => {
    if (selected?._id === author._id) {
      setSelected(null)
      setSelectedPosts([])
    } else {
      setSelected(author)
      fetchAuthorPosts(author._id)
    }
  }

  const resetDeleteState = () => {
    setShowDelete(false)
    setToDelete(null)
    setDeleteCandidates([])
    setRequiredTransferRole('')
    setSourcePoolRole('')
    setTransferRoleTo('')
    setLoadingDeleteCandidates(false)
  }

  const requiresTransferBeforeDelete = (author) =>
    Boolean(author) &&
    String(currentUser?.id) === String(author._id) &&
    (author.role === 'admin' || author.role === 'superadmin')

  const openDeleteModal = async (author) => {
    setToDelete(author)
    setShowDelete(true)

    if (!requiresTransferBeforeDelete(author)) return

    setLoadingDeleteCandidates(true)
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${author._id}/deletion-candidates`)
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
      const selfDelete = String(currentUser?.id) === String(toDelete?._id)
      const needsTransfer = requiresTransferBeforeDelete(toDelete)
      if (needsTransfer && !transferRoleTo) {
        throw new Error('Seleziona un utente a cui passare il ruolo prima di eliminare il profilo')
      }

      const res = await authedFetch(`${API_BASE_URL}/authors/${toDelete._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsTransfer ? { transferRoleTo } : {})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setMessage(`Autore ${toDelete.nome} ${toDelete.cognome} eliminato.`)
      if (selfDelete) {
        clearAuthToken()
        navigate('/login', { replace: true })
        return
      }
      if (selected?._id === toDelete._id) { setSelected(null); setSelectedPosts([]) }
      fetchAuthors(page)
    } catch (err) {
      setError(err.message)
    } finally {
      resetDeleteState()
    }
  }

  const confirmBlock = async () => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${toBlock._id}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: blockDuration })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      const action = blockDuration === 'unblock' ? 'sbloccato' : 'bloccato'
      setMessage(`${toBlock.nome} ${toBlock.cognome} ${action}.`)
      if (selected?._id === toBlock._id) setSelected(data)
      fetchAuthors(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setShowBlock(false)
      setToBlock(null)
    }
  }

  const confirmRoleChange = async () => {
    if (!toChangeRole) return
    if (String(currentUser?.id) === String(toChangeRole?._id)) {
      setError('Non puoi cambiare il tuo ruolo')
      setShowRoleModal(false)
      setToChangeRole(null)
      setNextRole('user')
      return
    }
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/${toChangeRole._id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      setMessage(`${toChangeRole.nome} ${toChangeRole.cognome} ora è ${data.role}.`)
      if (selected?._id === toChangeRole._id) {
        setSelected(data)
      }
      fetchAuthors(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setShowRoleModal(false)
      setToChangeRole(null)
      setNextRole('user')
    }
  }

  const openBioModal = (author) => {
    setBioModalAuthor(author)
    setShowBioModal(true)
  }

  useEffect(() => { fetchAuthors(1) }, [fetchAuthors])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(t)
  }, [message])

  if (loading) {
    return (
      <Container className="pt-5 mt-5 pb-5">
        <PageSpinner text="Caricamento pannello admin..." />
      </Container>
    )
  }

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={goBack}>
        Indietro
      </Button>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-0">Pannello Admin</h1>
          <p className="text-body-secondary small mb-0">{total} autori registrati</p>
        </div>
        <Button size="sm" variant="outline-secondary" onClick={() => fetchAuthors(page)}>
          Aggiorna
        </Button>
      </div>

      <Row className="mb-3 g-2 align-items-center">
        <Col xs={12} md={6} lg={4}>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Cerca per nome, cognome o email..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <Button variant="outline-secondary" onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1) }}>
                ✕
              </Button>
            )}
          </InputGroup>
        </Col>
        {searchQuery && (
          <Col xs="auto">
            <span className="small text-body-secondary">
              {total} risultat{total === 1 ? 'o' : 'i'} per "{searchQuery}"
            </span>
          </Col>
        )}
      </Row>

      <Card className="bg-body-tertiary border-0">
        <Card.Body className="p-0">
          {authors.length === 0 ? (
            <p className="text-body-secondary small p-4 mb-0">Nessun autore trovato.</p>
          ) : (
            <>
              {/* ── MOBILE: lista card (visibile solo sotto md) ── */}
              <div className="d-md-none">
                {authors.map((author, idx) => (
                  <div key={author._id}>
                    {idx > 0 && <hr className="my-0" />}
                    <div
                      className={['p-3 d-flex align-items-center gap-3',
                        isPrivilegedRole(author.role) ? 'admin-row-mobile' : '',
                        selected?._id === author._id ? 'admin-row-selected' : ''
                      ].filter(Boolean).join(' ')}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(author)}
                    >
                      <img
                        src={avatarUrl(author)}
                        width={40} height={40}
                        className="rounded-circle object-fit-cover flex-shrink-0"
                        alt=""
                      />
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="fw-semibold">{author.nome} {author.cognome}</div>
                        <div className="small text-body-secondary text-truncate">{author.email}</div>
                        <div className="small text-body-secondary">Data nascita: {author.dataDiNascita || '—'}</div>
                        <div className="small text-body-secondary">Login: {author.googleId ? 'Google OAuth' : 'Email/Password'}</div>
                        <div className="small text-body-secondary text-truncate">ID: {author._id}</div>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-start text-decoration-none admin-bio-preview"
                          onClick={(e) => {
                            e.stopPropagation()
                            openBioModal(author)
                          }}
                        >
                          Bio: {getBioPreview(author.bio)}
                        </button>
                        <div className="d-flex gap-1 mt-1 flex-wrap">
                          <StatusBadge author={author} />
                          <Badge bg={roleBadgeVariant(author.role)}>
                            {author.role || 'user'}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={selected?._id === author._id ? 'secondary' : 'outline-secondary'}
                        className="flex-shrink-0"
                        onClick={e => { e.stopPropagation(); handleRowClick(author) }}
                      >
                        {selected?._id === author._id ? 'Chiudi' : 'Dettagli'}
                      </Button>
                    </div>

                    {selected?._id === author._id && (
                      <div className="p-3 bg-body border-top">
                        <Link
                          to={`/authors/${author._id}`}
                          className="d-flex align-items-center gap-2 mb-3 text-decoration-none text-body admin-author-link"
                        >
                          <img src={avatarUrl(author)} width={40} height={40} className="rounded-circle object-fit-cover flex-shrink-0" alt="" />
                          <div>
                            <div className="fw-semibold">{author.nome} {author.cognome} <span className="text-body-secondary">→</span></div>
                            <div className="small text-body-secondary">{author.email}</div>
                          </div>
                        </Link>
                        <h6 className="mb-3 fw-semibold">Informazioni personali</h6>
                        <div className="small d-flex flex-column gap-2 mb-3">
                          <div>
                            <span className="text-body-secondary">ID: </span>
                            <span className="font-monospace" style={{ wordBreak: 'break-all' }}>{author._id}</span>
                          </div>
                          <div><span className="text-body-secondary">Data nascita: </span>{author.dataDiNascita || '—'}</div>
                          <div><span className="text-body-secondary">Ruolo: </span>{author.role || 'user'}</div>
                          <div><span className="text-body-secondary">Login: </span>{author.googleId ? 'Google OAuth' : 'Email/Password'}</div>
                          <div><span className="text-body-secondary">Stato: </span><StatusBadge author={author} /></div>
                          <div>
                            <span className="text-body-secondary">Bio: </span>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none admin-bio-preview"
                              onClick={(e) => {
                                e.stopPropagation()
                                openBioModal(author)
                              }}
                            >
                              {getBioPreview(author.bio)}
                            </button>
                          </div>
                          {author.blocked && author.blockedUntil && (
                            <div>
                              <span className="text-body-secondary">Bloccato fino: </span>
                              {new Date(author.blockedUntil).toLocaleString('it-IT')}
                            </div>
                          )}
                        </div>
                        <div className="d-flex gap-2 mb-4 flex-wrap">
                          {String(currentUser?.id) === String(author._id) && (
                            <Button size="sm" variant="outline-secondary" as={Link} to="/profilo">
                              Modifica il tuo profilo
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={author.blocked ? 'success' : 'warning'}
                            disabled={!canBlockTarget(currentUserRole, author.role, String(currentUser?.id) === String(author._id))}
                            onClick={() => { setToBlock(author); setBlockDuration(author.blocked ? 'unblock' : '7d'); setShowBlock(true) }}
                          >
                            {author.blocked ? 'Sblocca' : 'Blocca'}
                          </Button>
                          {canManageRoles && String(currentUser?.id) !== String(author._id) && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => {
                                setToChangeRole(author)
                                setNextRole(author.role || 'user')
                                setShowRoleModal(true)
                              }}
                            >
                              Cambia ruolo
                            </Button>
                          )}
                          <Button
                            size="sm" variant="danger"
                            disabled={!canDeleteTarget(currentUserRole, author.role, String(currentUser?.id) === String(author._id))}
                            onClick={() => openDeleteModal(author)}
                          >
                            Elimina autore
                          </Button>
                        </div>

                        <h6 className="mb-3 fw-semibold">
                          Articoli pubblicati ({loadingPosts ? '…' : selectedPosts.length})
                        </h6>
                        {loadingPosts ? (
                          <div className="d-flex align-items-center gap-2 small text-body-secondary">
                            <Spinner animation="border" size="sm" /><span>Caricamento...</span>
                          </div>
                        ) : selectedPosts.length === 0 ? (
                          <p className="small text-body-secondary mb-0">Nessun articolo pubblicato.</p>
                        ) : (
                          <div className="d-flex flex-column gap-2">
                            {selectedPosts.map(post => (
                              <div key={post._id} className="d-flex justify-content-between align-items-center p-2 rounded-2 border">
                                <div style={{ minWidth: 0 }} className="me-2">
                                  <div className="small fw-semibold text-truncate">{post.title}</div>
                                  <div className="small text-body-secondary">{post.category}</div>
                                </div>
                                <Link to={`/blog/${post._id}`} className="btn btn-sm btn-outline-secondary flex-shrink-0">Apri</Link>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── DESKTOP: tabella (visibile solo da md in su) ── */}
              <div className="d-none d-md-block">
                <Table className="mb-0 align-middle" hover>
                  <thead className="border-bottom">
                    <tr>
                      <th className="ps-4">Autore</th>
                      <th>Data nascita</th>
                      <th>Login</th>
                      <th>ID</th>
                      <th>Bio</th>
                      <th>Ruolo</th>
                      <th>Stato</th>
                      <th className="pe-4 text-end">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authors.map(author => (
                      <React.Fragment key={author._id}>
                        <tr
                          style={{ cursor: 'pointer' }}
                          className={[
                            selected?._id === author._id ? 'table-active' : '',
                            isPrivilegedRole(author.role) ? 'admin-row' : ''
                          ].filter(Boolean).join(' ')}
                          onClick={() => handleRowClick(author)}
                        >
                          <td className="ps-4">
                            <div className="d-flex align-items-center gap-2">
                              <img src={avatarUrl(author)} width={36} height={36} className="rounded-circle object-fit-cover flex-shrink-0" alt="" />
                              <div>
                                <div className="fw-semibold">{author.nome} {author.cognome}</div>
                                <div className="text-body-secondary small">{author.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="small">{author.dataDiNascita || '—'}</td>
                          <td className="small">{author.googleId ? 'Google OAuth' : 'Email/Password'}</td>
                          <td className="small">
                            <span className="font-monospace admin-id-cell">{author._id}</span>
                          </td>
                          <td className="small">
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-start text-decoration-none admin-bio-preview"
                              onClick={(e) => {
                                e.stopPropagation()
                                openBioModal(author)
                              }}
                            >
                              {getBioPreview(author.bio)}
                            </button>
                          </td>
                          <td>
                            <Badge bg={roleBadgeVariant(author.role)}>{author.role || 'user'}</Badge>
                          </td>
                          <td><StatusBadge author={author} /></td>
                          <td className="pe-4 text-end">
                            <Button
                              size="sm"
                              variant={selected?._id === author._id ? 'secondary' : 'outline-secondary'}
                              onClick={e => { e.stopPropagation(); handleRowClick(author) }}
                            >
                              {selected?._id === author._id ? 'Chiudi' : 'Dettagli'}
                            </Button>
                          </td>
                        </tr>

                        {selected?._id === author._id && (
                          <tr>
                            <td colSpan={8} className="p-0">
                              <div className="p-4 border-top border-bottom bg-body">
                                <Row className="g-4">
                                  <Col md={4}>
                                    <h6 className="mb-3 fw-semibold">Informazioni personali</h6>
                                    <Link to={`/authors/${author._id}`} className="admin-author-link d-flex align-items-center mb-3 text-decoration-none text-body" style={{ gap: '0.7rem' }}>
                                      <img src={avatarUrl(author)} className="admin-author-avatar" alt="" />
                                      <div className="d-flex flex-column" style={{ lineHeight: 1.2, minWidth: 0 }}>
                                        <span className="admin-author-name">{author.nome} {author.cognome}</span>
                                        <span className="admin-author-email">{author.email}</span>
                                        <span className="admin-author-linkhint">Vai al profilo →</span>
                                      </div>
                                    </Link>
                                    <div className="small d-flex flex-column gap-1">
                                      <div><span className="text-body-secondary">ID: </span><span className="font-monospace">{author._id}</span></div>
                                      <div><span className="text-body-secondary">Data nascita: </span>{author.dataDiNascita || '—'}</div>
                                      <div><span className="text-body-secondary">Ruolo: </span>{author.role || 'user'}</div>
                                      <div><span className="text-body-secondary">Login: </span>{author.googleId ? 'Google OAuth' : 'Email/Password'}</div>
                                      <div><span className="text-body-secondary">Stato: </span><StatusBadge author={author} /></div>
                                      <div>
                                        <span className="text-body-secondary">Bio: </span>
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm p-0 text-decoration-none admin-bio-preview"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openBioModal(author)
                                          }}
                                        >
                                          {getBioPreview(author.bio)}
                                        </button>
                                      </div>
                                      {author.blocked && author.blockedUntil && (
                                        <div><span className="text-body-secondary">Bloccato fino: </span>{new Date(author.blockedUntil).toLocaleString('it-IT')}</div>
                                      )}
                                    </div>
                                    <div className="d-flex gap-2 mt-3 flex-wrap">
                                      {String(currentUser?.id) === String(author._id) && (
                                        <Button size="sm" variant="outline-secondary" as={Link} to="/profilo">
                                          Modifica il tuo profilo
                                        </Button>
                                      )}
                                      <Button size="sm" variant={author.blocked ? 'success' : 'warning'}
                                        disabled={!canBlockTarget(currentUserRole, author.role, String(currentUser?.id) === String(author._id))}
                                        onClick={() => { setToBlock(author); setBlockDuration(author.blocked ? 'unblock' : '7d'); setShowBlock(true) }}
                                      >
                                        {author.blocked ? 'Sblocca' : 'Blocca'}
                                      </Button>
                                      {canManageRoles && String(currentUser?.id) !== String(author._id) && (
                                        <Button
                                          size="sm"
                                          variant="outline-primary"
                                          onClick={() => {
                                            setToChangeRole(author)
                                            setNextRole(author.role || 'user')
                                            setShowRoleModal(true)
                                          }}
                                        >
                                          Cambia ruolo
                                        </Button>
                                      )}
                                      <Button size="sm" variant="danger" disabled={!canDeleteTarget(currentUserRole, author.role, String(currentUser?.id) === String(author._id))}
                                        onClick={() => openDeleteModal(author)}
                                      >
                                        Elimina autore
                                      </Button>
                                    </div>
                                  </Col>
                                  <Col md={8}>
                                    <h6 className="mb-3 fw-semibold">Articoli pubblicati ({loadingPosts ? '…' : selectedPosts.length})</h6>
                                    {loadingPosts ? (
                                      <div className="d-flex align-items-center gap-2 small text-body-secondary">
                                        <Spinner animation="border" size="sm" /><span>Caricamento...</span>
                                      </div>
                                    ) : selectedPosts.length === 0 ? (
                                      <p className="small text-body-secondary mb-0">Nessun articolo pubblicato.</p>
                                    ) : (
                                      <div className="d-flex flex-column gap-2">
                                        {selectedPosts.map(post => (
                                          <div key={post._id} className="d-flex justify-content-between align-items-center p-2 rounded-2 border">
                                            <div className="me-2" style={{ minWidth: 0 }}>
                                              <div className="small fw-semibold text-truncate">{post.title}</div>
                                              <div className="small text-body-secondary">{post.category}</div>
                                            </div>
                                            <Link to={`/blog/${post._id}`} className="btn btn-sm btn-outline-secondary flex-shrink-0">Apri</Link>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </Col>
                                </Row>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-3 mt-3">
          <Button
            size="sm" variant="outline-secondary"
            disabled={page <= 1}
            onClick={() => fetchAuthors(page - 1)}
          >
            Precedente
          </Button>
          <span className="small text-body-secondary">Pagina {page} di {totalPages}</span>
          <Button
            size="sm" variant="outline-secondary"
            disabled={page >= totalPages}
            onClick={() => fetchAuthors(page + 1)}
          >
            Successiva
          </Button>
        </div>
      )}

      {/* Modal cambio ruolo */}
      <Modal show={showRoleModal} onHide={() => setShowRoleModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cambia ruolo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Imposta il ruolo per <strong>{toChangeRole?.nome} {toChangeRole?.cognome}</strong>:
          </p>
          <Form.Select value={nextRole} onChange={(e) => setNextRole(e.target.value)}>
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option value="superadmin">superadmin</option>
          </Form.Select>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowRoleModal(false)}>Annulla</Button>
          <Button
            variant="primary"
            onClick={confirmRoleChange}
          >
            Salva ruolo
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal bio completa */}
      <Modal show={showBioModal} onHide={() => setShowBioModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Bio autore</Modal.Title>
        </Modal.Header>
        <Modal.Body className="admin-bio-modal-body">
          <div className="small text-body-secondary mb-2">
            {bioModalAuthor?.nome} {bioModalAuthor?.cognome} · {bioModalAuthor?.email}
          </div>
          <p className="mb-0 admin-bio-modal-text">
            {String(bioModalAuthor?.bio || '').trim() || 'Nessuna bio disponibile.'}
          </p>
        </Modal.Body>
      </Modal>

      {/* Modal eliminazione */}
      <Modal show={showDelete} onHide={resetDeleteState} centered>
        <Modal.Header closeButton>
          <Modal.Title>Elimina autore</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {requiresTransferBeforeDelete(toDelete) ? (
            <>
              <p>
                Stai eliminando il tuo profilo <strong>{toDelete?.role}</strong>.
              </p>
              <p className="mb-2">
                Prima di procedere devi trasferire il ruolo{' '}
                <strong>{requiredTransferRole || toDelete?.role}</strong>{' '}
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
                <Form.Select value={transferRoleTo} onChange={(e) => setTransferRoleTo(e.target.value)}>
                  {deleteCandidates.map((candidate) => (
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
              <strong>{toDelete?.nome} {toDelete?.cognome}</strong>?
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
            disabled={loadingDeleteCandidates || (requiresTransferBeforeDelete(toDelete) && (!deleteCandidates.length || !transferRoleTo))}
          >
            Elimina
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal blocco/sblocco */}
      <Modal show={showBlock} onHide={() => setShowBlock(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {toBlock?.blocked ? 'Sblocca' : 'Blocca'} autore
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {toBlock?.blocked ? (
            <p className="mb-0">
              Sbloccare <strong>{toBlock?.nome} {toBlock?.cognome}</strong>?
            </p>
          ) : (
            <>
              <p>
                Blocca <strong>{toBlock?.nome} {toBlock?.cognome}</strong> per:
              </p>
              <Form.Select
                value={blockDuration}
                onChange={e => setBlockDuration(e.target.value)}
              >
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
          <Button
            variant={toBlock?.blocked ? 'success' : 'warning'}
            onClick={confirmBlock}
          >
            {toBlock?.blocked ? 'Sblocca' : 'Blocca'}
          </Button>
        </Modal.Footer>
      </Modal>
      <FixedAlerts
        alerts={[
          {
            key: 'admin-error',
            variant: 'danger',
            text: error,
            onClose: error ? () => setError('') : undefined
          },
          {
            key: 'admin-message',
            variant: 'success',
            text: message,
            onClose: message ? () => setMessage('') : undefined
          }
        ]}
      />
    </Container>
  )
}

export default AdminPanel
