import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Loader from "../UIC/Loader";
import StatusMessage from "../UIC/StatusMessage";
import TripImage from "../UIC/TripImage";
import { api, getErrorMessage } from "../../api";
import { capitalize, formatCost, formatDate } from "../../format";

function Detail({ label, value }) {
  return (
    <div className="col-6 col-md-4">
      <div className="tm-detail">
        <div className="tm-detail__label">{label}</div>
        <div className="tm-detail__value">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function ExperienceDetails() {
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(Boolean(location.state?.created));

  const load = useCallback((signal) => {
    setError(null);
    setData(null);
    api
      .get(`/trip/${encodeURIComponent(id)}`, { signal })
      .then((res) => setData(res.data))
      .catch((err) => {
        const status = err.response?.status;
        if (status === 404 || status === 400) return setError({ notFound: true });
        const message = getErrorMessage(err, "Could not load this trip.");
        if (message) setError({ message });
      });
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (error?.notFound) {
    return (
      <div className="container py-5">
        <StatusMessage icon="🧳" title="Trip not found" message="This trip doesn't exist or may have been removed." action={{ to: "/", label: "Back to all trips" }} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container py-5">
        <StatusMessage icon="⚠️" title="Couldn't load this trip" message={error.message} onRetry={() => load()} />
      </div>
    );
  }
  if (!data) {
    return <Loader label="Loading trip..." />;
  }

  return (
    <article className="container py-4 tm-details">
      {created && (
        <div className="alert alert-success alert-dismissible" role="alert">
          Your trip was saved successfully!
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setCreated(false)}></button>
        </div>
      )}

      <Link to="/" className="btn btn-link px-0 mb-3">← Back to all trips</Link>

      <div className="tm-details__hero mb-4">
        <TripImage image={data.image} alt={data.tripName} className="tm-details__image" />
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h1 className="mb-0 me-2">{data.tripName}</h1>
        {data.tripType && <span className={`badge tm-type tm-type--${data.tripType}`}>{capitalize(data.tripType)}</span>}
        {data.featured && <span className="badge tm-badge-featured position-static">★ Featured</span>}
      </div>
      {data.shortDescription && <p className="lead text-body-secondary">{data.shortDescription}</p>}

      <div className="card tm-card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <Detail label="Start date" value={formatDate(data.startDateOfJourney)} />
            <Detail label="End date" value={formatDate(data.endDateOfJourney)} />
            <Detail label="Total cost" value={formatCost(data.totalCost)} />
            <Detail label="Hotels" value={data.nameOfHotels} />
            <Detail label="Places visited" value={data.placesVisited} />
            <Detail label="Trip type" value={capitalize(data.tripType)} />
          </div>
        </div>
      </div>

      {data.experience && (
        <section>
          <h2 className="tm-section-title">The experience</h2>
          {/* Rendered as plain text (React escapes it), so user content can never inject HTML */}
          <p className="tm-experience">{data.experience}</p>
        </section>
      )}
    </article>
  );
}
