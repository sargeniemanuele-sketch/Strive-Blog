import React from "react";
import { Button, Card, Container } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";

const DeletedAuthorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const name = searchParams.get("name") || "Autore";

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Button type="button" variant="secondary" size="sm" className="btn-nav mb-4" onClick={() => navigate(-1)}>
        Indietro
      </Button>
      <Card className="bg-body-tertiary border-0">
        <Card.Body className="py-5 text-center">
          <div className="mb-3" style={{ fontSize: "2.5rem", opacity: 0.4 }}>👤</div>
          <h2 className="h5 mb-1">Account eliminato</h2>
          {name && name !== "Autore" && (
            <p className="text-body-secondary small mb-2">{name}</p>
          )}
          <p className="text-body-secondary mb-0">
            Questo profilo non è più disponibile. L'account è stato eliminato.
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default DeletedAuthorPage;
