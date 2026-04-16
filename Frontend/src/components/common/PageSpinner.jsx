import { Spinner } from "react-bootstrap";

const PageSpinner = ({ text = "Caricamento..." }) => {
  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: 120, gap: '0.75rem' }}
      role="status"
      aria-live="polite"
    >
      <Spinner animation="border" variant="secondary" />
      <span className="text-body-secondary small">{text}</span>
    </div>
  );
};

export default PageSpinner;
