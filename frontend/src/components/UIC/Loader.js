import React from "react";

export default function Loader({ label = "Loading...", fullPage = true }) {
  return (
    <div className={fullPage ? "tm-loader tm-loader--page" : "tm-loader"} role="status" aria-live="polite">
      <div className="spinner-border text-primary" aria-hidden="true"></div>
      <span className="tm-loader__label">{label}</span>
    </div>
  );
}
