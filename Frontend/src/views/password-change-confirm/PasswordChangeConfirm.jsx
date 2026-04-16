import React, { useEffect, useState } from "react";
import { Card, Container, Spinner } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL, setAuthToken } from "../../utils/api";

const PasswordChangeConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Token di conferma mancante.");
      return;
    }

    fetch(`${API_BASE_URL}/authors/password-change/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.token) {
          setAuthToken(data.token);
          navigate("/profilo", {
            replace: true,
            state: { flash: "Password aggiornata con successo." }
          });
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Link non valido o scaduto.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Errore di connessione al server.");
      });
  }, [token, navigate]);

  return (
    <Container className="pt-5 mt-5 pb-5">
      <Card className="bg-body-tertiary border-0 mx-auto" style={{ maxWidth: 560 }}>
        <Card.Body className="p-5 text-center">
          {status === "loading" && (
            <div className="d-flex align-items-center justify-content-center gap-2 text-body-secondary">
              <Spinner animation="border" size="sm" />
              <span>Conferma in corso...</span>
            </div>
          )}
          {status === "error" && (
            <>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px", opacity: 0.5 }}>✗</div>
              <h1 className="h4 mb-2">Link non valido</h1>
              <p className="text-body-secondary mb-0">{errorMessage}</p>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default PasswordChangeConfirm;
