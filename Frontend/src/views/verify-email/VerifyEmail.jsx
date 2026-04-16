import React, { useEffect, useState } from "react";
import { Container, Card, Spinner } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL, setAuthToken } from "../../utils/api";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMessage("Link di verifica non valido.");
      return;
    }

    fetch(`${API_BASE_URL}/authors/verify-email/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.token) {
          setAuthToken(data.token);
          navigate("/profilo", {
            replace: true,
            state: { flash: "Email verificata con successo. Benvenuto su Strive Blog!" }
          });
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Verifica fallita.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Errore di connessione al server.");
      });
  }, [searchParams, navigate]);

  return (
    <Container className="pt-5 mt-5 pb-5" style={{ maxWidth: 480 }}>
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-5 text-center">
          {status === "loading" && (
            <>
              <Spinner animation="border" className="mb-3" />
              <p className="text-body-secondary mb-0">Verifica in corso...</p>
            </>
          )}
          {status === "error" && (
            <>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px", opacity: 0.5 }}>✗</div>
              <h1 className="h4 mb-2">Link non valido</h1>
              <p className="text-body-secondary mb-0">
                {errorMessage}
              </p>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default VerifyEmail;
