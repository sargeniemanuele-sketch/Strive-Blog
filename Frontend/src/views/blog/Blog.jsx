import React, { useCallback, useEffect, useState } from "react";
import { Button, Col, Container, Form, Image, Modal, Row, Spinner } from "react-bootstrap";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { API_BASE_URL, authedFetch } from "../../utils/api";
import { getDisplayName, getTokenPayload } from "../../utils/token";
import PageSpinner from "../../components/common/PageSpinner";
import FixedAlerts from "../../components/common/FixedAlerts";

const Blog = () => {
  const location = useLocation();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState(location.state?.flash || "");
  const [error, setError] = useState("");

  // Payload JWT decodificato una sola volta — usato per tutti i controlli di ownership
  const tokenPayload = getTokenPayload()
  const isLoggedIn = Boolean(tokenPayload)
  const loggedName = getDisplayName()
  const isPrivilegedUser = tokenPayload?.role === 'admin' || tokenPayload?.role === 'superadmin'

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [saved, setSaved] = useState(false);

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentForm, setCommentForm] = useState({ author: loggedName, content: "" });
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentForm, setEditingCommentForm] = useState({ author: "", content: "" });
  const [replyingToCommentId, setReplyingToCommentId] = useState("");
  const [replyForm, setReplyForm] = useState({ content: "" });
  const [editingReply, setEditingReply] = useState({ commentId: "", replyId: "" });
  const [editingReplyForm, setEditingReplyForm] = useState({ content: "" });

  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = () => navigate(-1)

  // L'utente può modificare il post se è l'autore (per ID) o admin.
  // Dipende da `blog` che viene caricato async: finché blog è null, vale false.
  const canEditPost = Boolean(blog) && isLoggedIn && (
    isPrivilegedUser || (blog?.authorId && String(tokenPayload?.id) === String(blog?.authorId))
  )

  // Ownership tramite authorId — l'ID non cambia mai, a differenza dell'email.
  const canModifyComment = (comment) =>
    isLoggedIn && (
      isPrivilegedUser ||
      (comment.authorId && String(comment.authorId) === String(tokenPayload?.id))
    )

  const setSuccess = (text) => {
    setMessage(text);
    setError("");
  };

  const setFailure = (text) => {
    setError(text);
    setMessage("");
  };

  const fetchBlog = useCallback(async () => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Blog post non trovato");

      setBlog(data);
      setComments(sortComments(data.comments || []));
      const likes = data.likes || [];
      setLikesCount(likes.length);
      if (tokenPayload) {
        setLiked(likes.some((id) => String(id) === String(tokenPayload.id)));
      }
      setLoading(false);
    } catch (err) {
      setNotFound(true);
      setLoading(false);
    }
  }, [id]);

  const fetchComments = async () => {
    setLoadingComments(true)
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/comments?t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" },
        cache: "no-store"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore caricamento commenti");
      setComments(sortComments(Array.isArray(data) ? data : []));
      setSuccess("Commenti aggiornati");
    } catch (err) {
      setFailure(err.message);
    } finally {
      setLoadingComments(false)
    }
  };

  useEffect(() => {
    fetchBlog();
  }, [fetchBlog]);

  // Controlla se il post è già salvato (solo se loggato)
  useEffect(() => {
    if (!isLoggedIn) return;
    authedFetch(`${API_BASE_URL}/authors/bookmarks`)
      .then(res => res.ok ? res.json() : [])
      .then(posts => {
        if (Array.isArray(posts)) {
          setSaved(posts.some(p => String(p._id) === String(id)));
        }
      })
      .catch(() => {});
  }, [id, isLoggedIn]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commentForm)
      });
      const newComment = await res.json();
      if (!res.ok) throw new Error(newComment.message || "Errore pubblicazione commento");
      setComments((prev) => [...prev, newComment]);
      setCommentForm({ author: loggedName, content: "" });
      setSuccess("Commento pubblicato");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const formatDateTime = (value, objectIdFallback = "") => {
    const fallbackDate = objectIdFallback
      ? new Date(parseInt(String(objectIdFallback).slice(0, 8), 16) * 1000)
      : null
    const parsed = value ? new Date(value) : fallbackDate
    if (!parsed || Number.isNaN(parsed.getTime())) return "Data non disponibile"
    return parsed.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const sortComments = (arr) =>
    [...arr].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))

  const getAvatarUrl = (nameOrEmail = "") =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(nameOrEmail || "User")}&background=111827&color=ffffff&size=64`

  const handleUpdateComment = async (commentId) => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/comment/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCommentForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore aggiornamento commento");
      setComments((prev) => sortComments(prev.map((c) => (c._id === commentId ? data : c))));
      setEditingCommentId("");
      setSuccess("Commento aggiornato");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/comment/${commentId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore eliminazione commento");
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      setSuccess("Commento eliminato");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleLike = async () => {
    if (!isLoggedIn) return;
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/like`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore");
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleReplySubmit = async (commentId) => {
    if (!replyForm.content.trim()) return;
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/comment/${commentId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyForm.content })
      });
      const newReply = await res.json();
      if (!res.ok) throw new Error(newReply.message || "Errore");
      setComments(prev => prev.map(c =>
        c._id === commentId ? { ...c, replies: [...(c.replies || []), newReply] } : c
      ));
      setReplyForm({ content: "" });
      setReplyingToCommentId("");
      setSuccess("Risposta pubblicata");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleUpdateReply = async (commentId, replyId) => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/comment/${commentId}/reply/${replyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingReplyForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore");
      setComments(prev => prev.map(c =>
        c._id === commentId
          ? { ...c, replies: (c.replies || []).map(r => r._id === replyId ? data : r) }
          : c
      ));
      setEditingReply({ commentId: "", replyId: "" });
      setSuccess("Risposta aggiornata");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleDeleteReply = async (commentId, replyId) => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/comment/${commentId}/reply/${replyId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore");
      setComments(prev => prev.map(c =>
        c._id === commentId
          ? { ...c, replies: (c.replies || []).filter(r => r._id !== replyId) }
          : c
      ));
      setSuccess("Risposta eliminata");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleSave = async () => {
    if (!isLoggedIn) return;
    try {
      const res = await authedFetch(`${API_BASE_URL}/authors/bookmarks/${id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore");
      setSaved(data.saved);
      setSuccess(data.saved ? "Articolo salvato nei tuoi bookmark." : "Articolo rimosso dai bookmark.");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (commentForm.content.trim()) {
        const fakeEvent = { preventDefault: () => {} }
        handleCommentSubmit(fakeEvent)
      }
    }
  }


  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <PageSpinner text="Caricamento articolo..." />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <Container className="text-center py-5">
          <div className="mb-3" style={{ fontSize: "4rem", opacity: 0.15, fontWeight: 700, lineHeight: 1 }}>
            404
          </div>
          <h1 className="h4 fw-bold mb-2">Articolo non trovato</h1>
          <p className="text-body-secondary mb-4">
            Questo articolo non esiste o è stato rimosso.
          </p>
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="secondary" size="sm" onClick={goBack}>
              Indietro
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate("/")}>
              Vai alla home
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="pt-5 mt-4 pb-5">
      <Container>
        <Row className="justify-content-center">
          <Col lg={8}>
            <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={goBack}>
              Indietro
            </Button>

            <Image
              src={blog.cover}
              fluid
              rounded
              className="w-100 object-fit-cover mb-4 opacity-75"
              style={{ maxHeight: 400 }}
            />

            {blog.category && (
              <span className="badge text-bg-secondary mb-2">{blog.category}</span>
            )}
            <h1 className="h2 fw-bold mb-3">{blog.title}</h1>

            <div className="d-flex align-items-end justify-content-between flex-wrap gap-3 mb-4">
              <Link
                to={blog.authorId
                  ? `/authors/${blog.authorId}`
                  : `/authors/deleted?name=${encodeURIComponent(blog.authorName || blog.author || 'Autore')}`
                }
                className="d-flex align-items-center gap-2 text-decoration-none"
              >
                <Image
                  src={blog.authorAvatar || getAvatarUrl(blog.authorName || blog.author)}
                  roundedCircle
                  width={40}
                  height={40}
                  className="object-fit-cover"
                  alt={blog.authorName || blog.author || "Autore"}
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = getAvatarUrl(blog.authorName || blog.author)
                  }}
                />
                <div>
                  <div className="text-body-secondary small">Autore</div>
                  <div className="fw-semibold">{blog.authorName || blog.author}</div>
                  <div className="small text-primary">Vai al profilo →</div>
                </div>
              </Link>
              <div className="text-body-secondary small text-end">
                <div>{blog.readTime.value} {blog.readTime.unit} di lettura</div>
                <div>Ultima modifica: {formatDateTime(blog.updatedAt || blog.createdAt, blog._id)}</div>
              </div>
            </div>

            <div
              className="blog-details-content lh-lg"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blog.content) }}
            />

            <div className="d-flex align-items-center gap-3 mt-4 flex-wrap">
              <button
                className={`like-btn${liked ? " like-btn--active" : ""}`}
                onClick={handleLike}
                disabled={!isLoggedIn}
                title={isLoggedIn ? (liked ? "Rimuovi like" : "Metti like") : "Accedi per mettere like"}
                aria-label={liked ? "Rimuovi like" : "Metti like"}
              >
                <span className="like-btn__icon">{liked ? "♥" : "♡"}</span>
                <span className="like-btn__count">{likesCount}</span>
              </button>
              <button
                className={`like-btn${saved ? " like-btn--active" : ""}`}
                onClick={handleSave}
                disabled={!isLoggedIn}
                title={isLoggedIn ? (saved ? "Rimuovi dai salvati" : "Salva articolo") : "Accedi per salvare"}
                aria-label={saved ? "Rimuovi dai salvati" : "Salva articolo"}
                style={saved ? { borderColor: '#818cf8', color: '#818cf8', background: 'rgba(129,140,248,0.12)' } : {}}
              >
                <span className="like-btn__icon">{saved ? "★" : "☆"}</span>
                <span className="like-btn__count">{saved ? "Salvato" : "Salva"}</span>
              </button>
              {canEditPost && (
                <Button variant="outline-primary" size="sm" onClick={() => navigate(`/blog/${id}/edit`)}>
                  Modifica articolo
                </Button>
              )}
            </div>

            {/* Sezione commenti */}
            <div className="mt-5">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <p className="h6 mb-0">{comments.length} commenti</p>
                <div className="d-flex gap-2">
                  <Button size="sm" variant="outline-secondary" onClick={() => setShowCommentsModal(true)}>
                    Apri commenti
                  </Button>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Container>

      <Modal
        show={showCommentsModal}
        onHide={() => setShowCommentsModal(false)}
        centered={false}
        dialogClassName="comments-bottom-sheet"
      >
        <Modal.Header closeButton>
          <Modal.Title className="h6 mb-0">{comments.length} commenti</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingComments && (
            <div className="d-flex align-items-center gap-2 small text-body-secondary mb-3">
              <Spinner as="span" size="sm" animation="border" />
              <span>Aggiornamento commenti...</span>
            </div>
          )}

          {comments.map((c) => (
            <div key={c._id} className="comment-card border rounded-3 p-3 mb-2 bg-body-tertiary">
              {editingCommentId === c._id ? (
                <>
                  <Form.Control
                    className="mb-2"
                    value={editingCommentForm.author}
                    onChange={(e) => setEditingCommentForm((p) => ({ ...p, author: e.target.value }))}
                  />
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={editingCommentForm.content}
                    onChange={(e) => setEditingCommentForm((p) => ({ ...p, content: e.target.value }))}
                  />
                  <div className="d-flex gap-2 mt-2">
                    <Button size="sm" variant="dark" onClick={() => handleUpdateComment(c._id)}>
                      Salva
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => setEditingCommentId("")}>
                      Annulla
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="d-flex align-items-start gap-2">
                    {c.authorId ? (
                      <Link to={`/authors/${c.authorId}`} className="comment-avatar-link">
                        <img
                          src={getAvatarUrl(c.author)}
                          alt={c.author || "Utente"}
                          width={34}
                          height={34}
                          className="rounded-circle flex-shrink-0"
                        />
                      </Link>
                    ) : (
                      <img
                        src={getAvatarUrl(c.author)}
                        alt={c.author || "Utente"}
                        width={34}
                        height={34}
                        className="rounded-circle flex-shrink-0"
                      />
                    )}
                    <div className="w-100">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        {c.authorId ? (
                          <Link to={`/authors/${c.authorId}`} className="comment-author-link fw-semibold">
                            {c.author}
                          </Link>
                        ) : (
                          <span className="fw-semibold">{c.author}</span>
                        )}
                        <span className="comment-meta small">
                          {formatDateTime(c.createdAt)}
                          {c.updatedAt && c.createdAt && new Date(c.updatedAt) > new Date(c.createdAt) && (
                            <span className="ms-1 text-body-secondary fst-italic">(modificato)</span>
                          )}
                        </span>
                      </div>
                      <div className="comment-content">{c.content}</div>
                    </div>
                  </div>
                  <div className="d-flex gap-2 mt-2 flex-wrap">
                    {isLoggedIn && (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => {
                          setReplyingToCommentId(replyingToCommentId === c._id ? "" : c._id);
                          setReplyForm({ content: "" });
                        }}
                      >
                        {replyingToCommentId === c._id ? "Annulla" : "Rispondi"}
                      </Button>
                    )}
                    {canModifyComment(c) && (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setEditingCommentId(c._id);
                            setEditingCommentForm({ author: c.author, content: c.content });
                          }}
                        >
                          Modifica
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteComment(c._id)}>
                          Elimina
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Form risposta inline */}
                  {replyingToCommentId === c._id && (
                    <div className="mt-2 d-flex gap-2 align-items-start">
                      <Form.Control
                        as="textarea"
                        rows={1}
                        size="sm"
                        className="comments-composer-input"
                        placeholder="Scrivi una risposta..."
                        value={replyForm.content}
                        onChange={e => setReplyForm({ content: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (replyForm.content.trim()) handleReplySubmit(c._id);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        className="flex-shrink-0"
                        disabled={!replyForm.content.trim()}
                        onClick={() => handleReplySubmit(c._id)}
                      >
                        Invia
                      </Button>
                    </div>
                  )}

                  {/* Risposte al commento */}
                  {(c.replies || []).length > 0 && (
                    <div className="mt-2 ps-3 border-start border-secondary border-opacity-25">
                      {(c.replies || []).map(reply => (
                        <div key={reply._id} className="comment-card border rounded-3 p-2 mb-1 bg-body-tertiary" style={{ fontSize: '0.92rem' }}>
                          {editingReply.commentId === c._id && editingReply.replyId === reply._id ? (
                            <>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                size="sm"
                                value={editingReplyForm.content}
                                onChange={e => setEditingReplyForm({ content: e.target.value })}
                              />
                              <div className="d-flex gap-2 mt-2">
                                <Button size="sm" variant="dark" onClick={() => handleUpdateReply(c._id, reply._id)}>Salva</Button>
                                <Button size="sm" variant="outline-secondary" onClick={() => setEditingReply({ commentId: "", replyId: "" })}>Annulla</Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="d-flex align-items-start gap-2">
                                <img
                                  src={getAvatarUrl(reply.author)}
                                  alt={reply.author}
                                  width={26}
                                  height={26}
                                  className="rounded-circle flex-shrink-0"
                                />
                                <div className="w-100">
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className="fw-semibold">{reply.author}</span>
                                    <span className="comment-meta" style={{ fontSize: '0.78rem' }}>{formatDateTime(reply.createdAt)}</span>
                                  </div>
                                  <div className="comment-content">{reply.content}</div>
                                  {(isPrivilegedUser || (reply.authorId && String(reply.authorId) === String(tokenPayload?.id))) && (
                                    <div className="d-flex gap-2 mt-1">
                                      <Button size="sm" variant="primary" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                                        onClick={() => { setEditingReply({ commentId: c._id, replyId: reply._id }); setEditingReplyForm({ content: reply.content }); }}
                                      >Modifica</Button>
                                      <Button size="sm" variant="danger" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                                        onClick={() => handleDeleteReply(c._id, reply._id)}
                                      >Elimina</Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </Modal.Body>
        {isLoggedIn ? (
          <Modal.Footer className="comments-composer-wrap">
            <div className="comments-composer d-flex align-items-center gap-2 w-100">
              <img
                src={getAvatarUrl(loggedName || tokenPayload?.email)}
                alt={loggedName || "Profilo"}
                width={36}
                height={36}
                className="rounded-circle flex-shrink-0"
              />
              <Form.Control
                as="textarea"
                rows={1}
                className="comments-composer-input"
                placeholder="Cosa ne pensi?"
                value={commentForm.content}
                onChange={(e) => setCommentForm((f) => ({ ...f, content: e.target.value }))}
                onKeyDown={handleComposerKeyDown}
              />
              <Button
                size="sm"
                variant="primary"
                className="flex-shrink-0"
                disabled={!commentForm.content.trim()}
                onClick={() => handleCommentSubmit({ preventDefault: () => {} })}
              >
                Pubblica
              </Button>
            </div>
          </Modal.Footer>
        ) : (
          <Modal.Footer className="comments-composer-wrap justify-content-center">
            <Link to="/login" className="btn btn-sm btn-dark">Accedi per commentare</Link>
          </Modal.Footer>
        )}
      </Modal>

      <FixedAlerts
        alerts={[
          {
            key: "blog-error",
            variant: "danger",
            text: error,
            onClose: error ? () => setError("") : undefined
          },
          {
            key: "blog-message",
            variant: "success",
            text: message,
            onClose: message ? () => setMessage("") : undefined
          }
        ]}
      />
    </div>
  );
};

export default Blog;
