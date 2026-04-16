import { Badge, Card } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";

const stripHtml = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

const formatPublishedAt = (updatedAt, createdAt, id) => {
  const rawValue = updatedAt || createdAt || (id ? new Date(parseInt(String(id).slice(0, 8), 16) * 1000) : null)
  const date = rawValue instanceof Date ? rawValue : new Date(rawValue)
  if (Number.isNaN(date.getTime())) return "Data non disponibile"
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

const BlogItem = ({ title, cover, author, authorName, authorAvatar, authorId, category, readTime, content, _id, createdAt, updatedAt }) => {
  const navigate = useNavigate()
  const authorLabel = authorName || author
  const avatarName = encodeURIComponent(authorLabel || "Autore")
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${avatarName}&background=1f2937&color=ffffff&size=64`
  const avatarSrc = authorAvatar || fallbackAvatar
  const fallbackCover = "https://placehold.co/1200x675?text=Strive+Blog"
  const cleanContent = stripHtml(content)
  const previewText = cleanContent
    ? `${cleanContent.slice(0, 140)}${cleanContent.length > 140 ? "..." : ""}`
    : "Apri l'articolo per leggere il contenuto completo."
  const publishedAt = formatPublishedAt(updatedAt, createdAt, _id)

  const authorTo = authorId
    ? `/authors/${authorId}`
    : `/authors/deleted?name=${encodeURIComponent(authorLabel || 'Autore')}`

  return (
    <Card
      className="blog-card h-100"
      style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/blog/${_id}`)}
    >
      <div className="blog-card-media">
        <Card.Img variant="top" src={cover || fallbackCover} alt={title} className="w-100 h-100 object-fit-cover" />
        {category && (
          <Badge bg="primary" className="blog-card-category">
            {category}
          </Badge>
        )}
      </div>

      <Card.Body className="d-flex flex-column">
        <Card.Title className="blog-card-title">{title}</Card.Title>
        <Card.Text className="blog-card-preview">{previewText}</Card.Text>
        <div className="blog-card-readtime mt-auto">
          {readTime && <span>{readTime.value} {readTime.unit} di lettura</span>}
        </div>
        <div className="small text-body-secondary mt-1">
          Ultima modifica: {publishedAt}
        </div>
      </Card.Body>

      <Card.Footer className="blog-card-footer">
        <Link
          to={authorTo}
          className="blog-author-link d-flex align-items-center w-100"
          style={{ gap: '0.7rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={avatarSrc}
            alt={authorLabel || "Autore"}
            className="blog-card-author-avatar"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = fallbackAvatar
            }}
          />
          <div className="d-flex flex-column" style={{ lineHeight: 1.2, minWidth: 0 }}>
            <span className="blog-card-author-label">by</span>
            <span className="blog-card-author-name">{authorLabel || "Autore"}</span>
            <span className="blog-card-author-linkhint">Vai al profilo →</span>
          </div>
        </Link>
      </Card.Footer>
    </Card>
  )
}

export default BlogItem;
