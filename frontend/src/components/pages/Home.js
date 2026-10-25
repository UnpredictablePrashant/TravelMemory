import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../UIC/Card";
import SkeletonCard from "../UIC/SkeletonCard";
import StatusMessage from "../UIC/StatusMessage";
import { api, getErrorMessage } from "../../api";

const TRIP_TYPES = ["all", "backpacking", "leisure", "business"];

function TripGrid({ trips }) {
  return (
    <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
      {trips.map((e) => (
        <Card
          key={e._id}
          id={e._id}
          title={e.tripName}
          tripType={e.tripType}
          description={e.shortDescription}
          image={e.image}
          startDate={e.startDateOfJourney}
          featured={e.featured}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const load = useCallback((signal) => {
    setError(null);
    setData(null);
    api
      .get("/trip", { signal })
      .then((res) => setData(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        const message = getErrorMessage(err, "Could not load trips.");
        if (message) setError(message);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter(
      (t) =>
        (type === "all" || t.tripType === type) &&
        (!q || [t.tripName, t.shortDescription, t.placesVisited].some((v) => v && v.toLowerCase().includes(q)))
    );
  }, [data, search, type]);

  const featured = filtered.filter((t) => t.featured);
  const others = filtered.filter((t) => !t.featured);

  let content;
  if (error) {
    content = <StatusMessage icon="⚠️" title="Couldn't load your trips" message={error} onRetry={() => load()} />;
  } else if (!data) {
    content = (
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4" aria-busy="true" aria-label="Loading trips">
        {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  } else if (data.length === 0) {
    content = (
      <StatusMessage
        icon="🗺️"
        title="No memories yet"
        message="Start your travel journal by adding your first trip."
        action={{ to: "/addexperience", label: "+ Add your first trip" }}
      />
    );
  } else if (filtered.length === 0) {
    content = <StatusMessage icon="🔍" title="No trips match your filters" message="Try a different search or trip type." />;
  } else {
    content = (
      <>
        {featured.length > 0 && (
          <section className="mb-5">
            <h2 className="tm-section-title">Featured trips</h2>
            <TripGrid trips={featured} />
          </section>
        )}
        {others.length > 0 && (
          <section>
            <h2 className="tm-section-title">All trips</h2>
            <TripGrid trips={others} />
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <section className="tm-hero">
        <div className="container">
          <h1 className="display-6 fw-bold">Your journeys, remembered.</h1>
          <p className="lead mb-4">Collect the places, stays and stories from every trip you take.</p>
          <Link to="/addexperience" className="btn btn-light btn-lg">+ Add Experience</Link>
        </div>
      </section>

      <div className="container py-4">
        {data && data.length > 0 && (
          <div className="row g-2 mb-4">
            <div className="col-md-8">
              <input
                type="search"
                className="form-control"
                placeholder="Search by name, place or description"
                aria-label="Search trips"
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <select className="form-select" aria-label="Filter by trip type" value={type} onChange={(e) => setType(e.target.value)}>
                {TRIP_TYPES.map((t) => (
                  <option key={t} value={t}>{t === "all" ? "All trip types" : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {content}
      </div>
    </>
  );
}
