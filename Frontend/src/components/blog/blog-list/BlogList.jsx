import React, { useEffect, useState } from "react";
import { Button, Col, Form, InputGroup, Row } from "react-bootstrap";
import BlogItem from "../blog-item/BlogItem";
import { API_BASE_URL, getAuthHeader } from "../../../utils/api";
import PageSpinner from "../../common/PageSpinner";
import FixedAlerts from "../../common/FixedAlerts";

const POSTS_PER_PAGE = 6

const fetchWithAuthFallback = async (url, signal) => {
  const authHeaders = { ...getAuthHeader() }
  let res = await fetch(url, { headers: authHeaders, signal })
  if ((res.status === 401 || res.status === 403) && authHeaders.Authorization) {
    res = await fetch(url, { signal })
  }
  return res
}

const MODES = [
  { key: "title",    label: "Titolo",    placeholder: "Cerca titolo..."     },
  { key: "category", label: "Categoria", placeholder: "Ricerca categoria..." },
  { key: "author",   label: "Autore",    placeholder: "Ricerca autore..."    },
]

const BlogList = () => {
  const [posts, setPosts]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState("")
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)

  const [searchMode,  setSearchMode]  = useState("title")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const [categoryOptions, setCategoryOptions] = useState([])
  const [authorOptions,   setAuthorOptions]   = useState([])
  const [titleOptions,    setTitleOptions]    = useState([])

  // Debounce: aspetta 300ms dopo l'ultima digitazione, poi aggiorna debouncedSearch e torna a pagina 1
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Fetch principale con AbortController
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")

    const params = new URLSearchParams()
    if (debouncedSearch) {
      // Ricerca attiva: limit alto per restituire tutti i match dal DB (backend cap: 500)
      params.set(searchMode, debouncedSearch)
      params.set("page", "1")
      params.set("limit", "500")
    } else {
      // Navigazione normale: paginazione standard
      params.set("page", String(page))
      params.set("limit", String(POSTS_PER_PAGE))
    }

    const url = `${API_BASE_URL}/blogPosts?${params}`

    fetchWithAuthFallback(url, controller.signal)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "Errore nel caricamento degli articoli")
        setPosts(data.blogPosts || [])
        setTotalPages(data.totalPages || 1)
        setTotalPosts(data.totalBlogPosts || 0)
      })
      .catch(err => {
        if (err.name === "AbortError") return
        setPosts([])
        setTotalPages(1)
        setTotalPosts(0)
        setError(err.message || "Errore nel caricamento degli articoli")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [page, searchMode, debouncedSearch])

  // Opzioni autocomplete da DB
  useEffect(() => {
    fetchWithAuthFallback(`${API_BASE_URL}/blogPosts/filters`)
      .then(res => res.json())
      .then(data => {
        setCategoryOptions(Array.isArray(data.categories) ? data.categories : [])
        setTitleOptions(Array.isArray(data.titles) ? data.titles : [])
        setAuthorOptions(Array.isArray(data.authors) ? data.authors : [])
      })
      .catch(() => {})
  }, [])

  const handleModeChange = (mode) => {
    setSearchMode(mode)
    setSearchInput("")
    setDebouncedSearch("")
    setPage(1)
  }

  const goToPage = (n) => {
    if (n < 1 || n > totalPages) return
    setPage(n)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const currentMode = MODES.find(m => m.key === searchMode)

  const datalistId = `search-suggestions-${searchMode}`

  const datalistOptions = () => {
    if (searchMode === "title")    return titleOptions.map(t => <option key={t} value={t} />)
    if (searchMode === "category") return categoryOptions.map(c => <option key={c} value={c} />)
    if (searchMode === "author")   return authorOptions.map(a => <option key={a.value} value={a.label} />)
    return null
  }

  const emptyMessage = () => {
    if (debouncedSearch) {
      const modeLabel = currentMode?.label.toLowerCase()
      return `Nessun articolo trovato per ${modeLabel} "${debouncedSearch}".`
    }
    return "Nessun articolo pubblicato."
  }

  return (
    <div>
      {/* ── Barra di ricerca ── */}
      <Row className="g-2 align-items-end mb-4">
        <Col xs="auto">
          <Form.Label className="small mb-1">Cerca per</Form.Label>
          <Form.Select
            value={searchMode}
            onChange={e => handleModeChange(e.target.value)}
          >
            {MODES.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </Form.Select>
        </Col>
        <Col>
          <Form.Label className="small mb-1">{currentMode?.label}</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder={currentMode?.placeholder}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              list={datalistId}
              autoComplete="off"
            />
            <datalist id={datalistId}>
              {datalistOptions()}
            </datalist>
            {searchInput && (
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => { setSearchInput(""); setDebouncedSearch(""); setPage(1) }}
              >
                ✕
              </Button>
            )}
          </InputGroup>
        </Col>
        {!loading && (
          <Col xs={12} lg="auto" className="ms-lg-auto">
            <span className="small text-body-secondary">
              {debouncedSearch
                ? `${posts.length} risultat${posts.length === 1 ? "o" : "i"}`
                : `${totalPosts > 0 ? `${totalPosts} articoli totali · ` : ""}pagina ${page} di ${totalPages}`
              }
            </span>
          </Col>
        )}
      </Row>

      {/* ── Lista articoli ── */}
      {loading ? (
        <PageSpinner text="Caricamento articoli..." />
      ) : (
        <>
          {posts.length === 0 && (
            <p className="text-body-secondary small">{emptyMessage()}</p>
          )}
          {posts.length > 0 && (
            <Row className="g-3 row-cols-1 row-cols-md-2 row-cols-xl-3">
              {posts.map(post => (
                <Col key={post._id}>
                  <BlogItem {...post} />
                </Col>
              ))}
            </Row>
          )}
        </>
      )}

      {/* ── Paginazione (nascosta durante la ricerca) ── */}
      {!loading && !debouncedSearch && totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-3 mt-4 pt-2 border-top">
          <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            Precedente
          </Button>
          <span className="small text-body-secondary">
            Pagina <strong>{page}</strong> di <strong>{totalPages}</strong>
          </span>
          <Button size="sm" variant="outline-secondary" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
            Successiva
          </Button>
        </div>
      )}

      <FixedAlerts
        alerts={[{
          key: "blog-list-error",
          variant: "danger",
          text: error,
          onClose: error ? () => setError("") : undefined
        }]}
      />
    </div>
  )
}

export default BlogList;
