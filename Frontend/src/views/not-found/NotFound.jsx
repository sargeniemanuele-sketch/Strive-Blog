import React from "react";
import { Button, Container } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <Container className="text-center py-5">
        <div className="mb-3" style={{ fontSize: "4rem", opacity: 0.15, fontWeight: 700, lineHeight: 1 }}>
          404
        </div>
        <h1 className="h4 fw-bold mb-2">Pagina non trovata</h1>
        <p className="text-body-secondary mb-4">
          La pagina che stai cercando non esiste o è stata rimossa.
        </p>
        <div className="d-flex gap-2 justify-content-center">
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            Indietro
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate("/")}>
            Vai alla home
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default NotFound;
