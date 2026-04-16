import React from "react";
import { Alert } from "react-bootstrap";

const FixedAlerts = ({ alerts = [] }) => {
  const visibleAlerts = alerts.filter((alert) => alert && alert.text);
  if (!visibleAlerts.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "16px",
        transform: "translateX(-50%)",
        width: "min(92vw, 760px)",
        zIndex: 2000,
        pointerEvents: "none"
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {visibleAlerts.map((alert, idx) => (
        <Alert
          key={alert.key || `${alert.variant}-${idx}`}
          variant={alert.variant || "info"}
          dismissible={Boolean(alert.onClose)}
          onClose={alert.onClose}
          className="mb-2 shadow-sm"
          style={{ pointerEvents: "auto" }}
        >
          {alert.text}
        </Alert>
      ))}
    </div>
  );
};

export default FixedAlerts;
