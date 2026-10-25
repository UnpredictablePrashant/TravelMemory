import React from "react";

// Placeholder shown while the trip list is loading
export default function SkeletonCard() {
  return (
    <div className="col">
      <div className="card tm-card h-100" aria-hidden="true">
        <div className="tm-card__image tm-skeleton"></div>
        <div className="card-body placeholder-glow">
          <span className="placeholder col-7 mb-2"></span>
          <span className="placeholder col-4 mb-3"></span>
          <span className="placeholder col-12"></span>
          <span className="placeholder col-10"></span>
        </div>
      </div>
    </div>
  );
}
