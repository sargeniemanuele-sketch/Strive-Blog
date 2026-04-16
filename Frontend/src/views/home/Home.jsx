import React, { useEffect, useState } from "react";
import { Alert, Container } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BlogList from "../../components/blog/blog-list/BlogList";
import useAuthStatus from "../../hooks/useAuthStatus";
import FixedAlerts from "../../components/common/FixedAlerts";

const Home = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStatus()
  const [flash, setFlash] = useState(location.state?.flash || '')

  useEffect(() => {
    if (location.state?.flash) {
      setFlash(location.state.flash)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(''), 4000)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <Container className="pt-5 mt-5 pb-5">
      {!isAuthenticated && (
        <Alert variant="info">
          Puoi leggere tutti gli articoli senza account. Se vuoi pubblicare, devi{" "}
          <Link to="/register">registrarti</Link>.
        </Alert>
      )}
      <p className="display-5 fw-semibold mb-3">Welcome to the Strive Blog!</p>
      <hr className="border-secondary opacity-50 mb-4" />
      <BlogList />
      <FixedAlerts
        alerts={[
          {
            key: "home-flash",
            variant: "success",
            text: flash,
            onClose: flash ? () => setFlash("") : undefined
          }
        ]}
      />
    </Container>
  )
}

export default Home;
