import React, { useCallback, useEffect, useState } from "react";
import { Button, Col, Container, Form, Image, Modal, Row, Spinner } from "react-bootstrap";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { API_BASE_URL, authedFetch } from "../../utils/api";
import { getDisplayName, getTokenPayload } from "../../utils/token";
import { BLOG_CATEGORIES } from "../../utils/categories";
import PageSpinner from "../../components/common/PageSpinner";
import FixedAlerts from "../../components/common/FixedAlerts";

const Blog = () => {
  const location = useLocation();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(location.state?.flash || "");
  const [error, setError] = useState("");

  const [postForm, setPostForm] = useState({
    title: "",
    category: "",
    author: "",
    readTimeValue: 1,
    content: ""
  });
  const [coverFile, setCoverFile] = useState(null);

  // Payload JWT decodificato una sola volta — usato per tutti i controlli di ownership
  const tokenPayload = getTokenPayload()
  const isLoggedIn = Boolean(tokenPayload)
  const loggedName = getDisplayName()
  const isPrivilegedUser = tokenPayload?.role === 'admin' || tokenPayload?.role === 'superadmin'

  const [isEditing, setIsEditing] = useState(false);

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentForm, setCommentForm] = useState({ author: loggedName, content: "" });
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentForm, setEditingCommentForm] = useState({ author: "", content: "" });

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

  const syncPostFormFromBlog = (data) => {
    setPostForm({
      title: data.title || "",
      category: data.category || "",
      author: data.author || "",
      readTimeValue: data.readTime?.value || 1,
      content: data.content || ""
    });
  };

  const fetchBlog = useCallback(async () => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Blog post non trovato");

      setBlog(data);
      setComments(sortComments(data.comments || []));
      syncPostFormFromBlog(data);
      setLoading(false);
    } catch (err) {
      navigate("/");
    }
  }, [id, navigate]);

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

  const handleComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (commentForm.content.trim()) {
        const fakeEvent = { preventDefault: () => {} }
        handleCommentSubmit(fakeEvent)
      }
    }
  }

  const handleUpdatePost = async () => {
    try {
      const payload = {
        title: postForm.title,
        category: postForm.category,
        cover: blog.cover,
        author: postForm.author,
        readTime: {
          value: Number(postForm.readTimeValue),
          unit: "minuti"
        },
        content: postForm.content
      };

      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore aggiornamento post");
      setBlog(data);
      syncPostFormFromBlog(data);
      setSuccess("Post aggiornato");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleDeletePost = async () => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore eliminazione post");
      navigate("/");
    } catch (err) {
      setFailure(err.message);
    }
  };

  const handleUploadCover = async () => {
    if (!coverFile) {
      setFailure("Seleziona un file cover da caricare");
      return;
    }

    const formData = new FormData();
    formData.append("cover", coverFile);

    try {
      const res = await authedFetch(`${API_BASE_URL}/blogPosts/${id}/cover`, {
        method: "PATCH",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Errore upload cover");
      setBlog(data);
      syncPostFormFromBlog(data);
      setCoverFile(null);
      setSuccess("Cover aggiornata");
    } catch (err) {
      setFailure(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <PageSpinner text="Caricamento articolo..." />
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

            {/* Pulsante modifica — visibile solo a chi può modificare, quando non si sta già modificando */}
            {canEditPost && !isEditing && (
              <div className="mt-4">
                <Button variant="outline-primary" size="sm" onClick={() => setIsEditing(true)}>
                  Modifica articolo
                </Button>
              </div>
            )}

            {/* Pannello di gestione visibile solo all'autore del post o all'admin */}
            {canEditPost && isEditing && (
              <div className="mt-5 p-3 border rounded-3 bg-body-tertiary">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h2 className="h5 mb-0">Gestione articolo</h2>
                  <Button variant="outline-secondary" size="sm" onClick={() => setIsEditing(false)}>
                    Annulla
                  </Button>
                </div>
                <Row className="g-3">
                  <Col md={8}>
                    <Form.Label>Titolo</Form.Label>
                    <Form.Control
                      value={postForm.title}
                      onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Categoria</Form.Label>
                    <Form.Select
                      value={postForm.category}
                      onChange={(e) => setPostForm((p) => ({ ...p, category: e.target.value }))}
                    >
                      {postForm.category && !BLOG_CATEGORIES.includes(postForm.category) && (
                        <option value={postForm.category}>{postForm.category}</option>
                      )}
                      {BLOG_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={12}>
                    <Form.Label>Email autore</Form.Label>
                    <Form.Control
                      value={postForm.author}
                      onChange={(e) => setPostForm((p) => ({ ...p, author: e.target.value }))}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Tempo di lettura</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={postForm.readTimeValue}
                      onChange={(e) => setPostForm((p) => ({ ...p, readTimeValue: e.target.value }))}
                    />
                  </Col>
                  <Col xs={12}>
                    <Form.Label>Contenuto HTML</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={6}
                      value={postForm.content}
                      onChange={(e) => setPostForm((p) => ({ ...p, content: e.target.value }))}
                    />
                  </Col>
                  <Col xs={12} className="d-flex gap-2 flex-wrap">
                    <Button variant="primary" onClick={handleUpdatePost}>Aggiorna articolo</Button>
                    <Button variant="danger" onClick={handleDeletePost}>Elimina articolo</Button>
                  </Col>
                </Row>
                <hr className="my-3" />
                <Row className="g-2 align-items-end">
                  <Col md={8}>
                    <Form.Label>Carica copertina</Form.Label>
                    <Form.Control type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                  </Col>
                  <Col md={4} className="d-grid">
                    <Button variant="primary" onClick={handleUploadCover}>Carica copertina</Button>
                  </Col>
                </Row>
              </div>
            )}

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
                  <div className="d-flex gap-2 mt-2">
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
