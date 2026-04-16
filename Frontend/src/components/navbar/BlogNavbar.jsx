import React, { useEffect, useState } from "react";
import { Button, Container, Navbar } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.png";
import useAuthStatus from "../../hooks/useAuthStatus";

const NavBar = () => {
  const { isAuthenticated, isAdminUser } = useAuthStatus()
  const [scrolled, setScrolled] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const location = useLocation()

  // Chiudi il menu mobile ad ogni cambio di pagina
  useEffect(() => {
    setExpanded(false)
  }, [location.pathname])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <Navbar
      className={`blog-navbar ${scrolled ? 'scrolled' : ''}`}
      fixed="top"
      expand="md"
      expanded={expanded}
      onToggle={setExpanded}
    >
      <Container>
        <Navbar.Brand as={Link} to="/">
          <img className="blog-navbar-brand" alt="logo" src={logo} />
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-navbar" />
        <Navbar.Collapse id="main-navbar" className="justify-content-end mt-3 mt-md-0">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {isAuthenticated ? (
              <>
                <Button as={Link} to="/new" variant="primary" size="sm">
                  Nuovo articolo
                </Button>
                <Button as={Link} to="/profilo" variant="secondary" size="sm">
                  Profilo
                </Button>
                {isAdminUser && (
                  <Button as={Link} to="/admin" variant="warning" size="sm">
                    Area Admin
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button as={Link} to="/login" variant="secondary" size="sm">Login</Button>
                <Button as={Link} to="/register" variant="primary" size="sm">Registrati</Button>
              </>
            )}
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}

export default NavBar;
