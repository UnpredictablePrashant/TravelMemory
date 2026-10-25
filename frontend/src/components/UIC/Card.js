import React from "react";
import { Link } from "react-router-dom";
import TripImage from "./TripImage";
import { capitalize, formatDate } from "../../format";

export default function Card({ id, title, tripType, description, image, startDate, featured }) {
  return (
    <div className="col">
      <div className={`card tm-card h-100 ${featured ? "tm-card--featured" : ""}`}>
        <div className="tm-card__media">
          <TripImage image={image} alt={title} className="tm-card__image" />
          {featured && <span className="badge tm-badge-featured">★ Featured</span>}
        </div>
        <div className="card-body d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
            <h3 className="card-title h5 mb-0 text-truncate" title={title}>{title}</h3>
            {tripType && <span className={`badge tm-type tm-type--${tripType}`}>{capitalize(tripType)}</span>}
          </div>
          {startDate && <small className="text-body-secondary mb-2">{formatDate(startDate)}</small>}
          <p className="card-text tm-card__desc">{description}</p>
          <Link to={`/experiencedetails/${id}`} className="btn btn-outline-primary mt-auto stretched-link">
            More Details
          </Link>
        </div>
      </div>
    </div>
  );
}
