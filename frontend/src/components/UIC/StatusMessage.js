import React from "react";
import { Link } from "react-router-dom";

// Used for error, empty and not-found states so they all look the same
export default function StatusMessage({ icon = "🧭", title, message, onRetry, action }) {
  return (
    <div className="tm-status">
      <div className="tm-status__icon" aria-hidden="true">{icon}</div>
      <h2 className="h4">{title}</h2>
      {message && <p className="text-body-secondary">{message}</p>}
      <div className="d-flex gap-2 justify-content-center">
        {onRetry && (
          <button type="button" className="btn btn-outline-primary" onClick={onRetry}>
            Try again
          </button>
        )}
        {action && (
          <Link className="btn btn-primary" to={action.to}>
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
