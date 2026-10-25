import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_MB, api, getErrorMessage } from "../../api";

const INITIAL_FORM = {
  tripName: "",
  startDateOfJourney: "",
  endDateOfJourney: "",
  nameOfHotels: "",
  placesVisited: "",
  totalCost: "",
  experience: "",
  image: "",
  tripType: "",
  featured: false,
  shortDescription: "",
};

const LIMITS = { tripName: 50, nameOfHotels: 300, placesVisited: 300, shortDescription: 300, experience: 10000 };

// Mirrors the backend rules so most mistakes are caught before a request is sent
function validate(form, imageMode, file) {
  const errors = {};
  if (!form.tripName.trim()) errors.tripName = "Trip name is required";
  if (!form.startDateOfJourney) errors.startDateOfJourney = "Start date is required";
  if (!form.endDateOfJourney) errors.endDateOfJourney = "End date is required";
  else if (form.startDateOfJourney && form.endDateOfJourney < form.startDateOfJourney) {
    errors.endDateOfJourney = "End date cannot be before the start date";
  }
  if (!form.shortDescription.trim()) errors.shortDescription = "Short description is required";
  if (form.totalCost !== "" && (Number.isNaN(Number(form.totalCost)) || Number(form.totalCost) < 0)) {
    errors.totalCost = "Total cost must be a positive number";
  }
  for (const [field, max] of Object.entries(LIMITS)) {
    if (form[field].length > max) errors[field] = `Must be at most ${max} characters`;
  }
  if (imageMode === "link" && form.image.trim() && !/^https?:\/\/\S+$/i.test(form.image.trim())) {
    errors.image = "Enter a valid link starting with http:// or https://";
  }
  if (imageMode === "upload" && file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) errors.image = "Only JPEG, PNG, GIF or WEBP images are allowed";
    else if (file.size > MAX_IMAGE_MB * 1024 * 1024) errors.image = `Image must be smaller than ${MAX_IMAGE_MB} MB`;
  }
  return errors;
}

function Field({ id, label, error, required, hint, children }) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">
        {label} {required && <span className="text-danger" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? <div className="invalid-feedback d-block">{error}</div> : hint && <div className="form-text">{hint}</div>}
    </div>
  );
}

export default function AddExperience() {
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const [formdata, setFormdata] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageMode, setImageMode] = useState("upload");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const update = (field) => (e) => {
    setFormdata({ ...formdata, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  const onFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setErrors({ ...errors, image: validate(formdata, "upload", selected).image });
  };

  const clearFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setErrors({ ...errors, image: undefined });
  };

  const inputClass = (field, base = "form-control") => `${base} ${errors[field] ? "is-invalid" : ""}`;

  const submitForm = async (e) => {
    e.preventDefault();
    setServerError(null);

    const found = validate(formdata, imageMode, file);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }

    const body = new FormData();
    for (const [key, value] of Object.entries(formdata)) {
      if (key === "image") continue;
      body.append(key, typeof value === "string" ? value.trim() : String(value));
    }
    if (imageMode === "upload" && file) body.append("image", file);
    if (imageMode === "link" && formdata.image.trim()) body.append("image", formdata.image.trim());

    setLoading(true);
    setProgress(0);
    try {
      const res = await api.post("/trip", body, {
        onUploadProgress: (evt) => evt.total && setProgress(Math.round((evt.loaded / evt.total) * 100)),
      });
      navigate(`/experiencedetails/${res.data.trip._id}`, { state: { created: true } });
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) setErrors(details);
      setServerError(getErrorMessage(err, "Could not save your trip."));
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="container py-4 tm-form-page">
      <h1 className="h2 mb-1">Add a travel experience</h1>
      <p className="text-body-secondary mb-4">Fields marked <span className="text-danger">*</span> are required.</p>

      {serverError && (
        <div className="alert alert-danger" role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={submitForm} noValidate>
        <fieldset disabled={loading}>
          <div className="card tm-card mb-4">
            <div className="card-body">
              <h2 className="h5 mb-3">Trip details</h2>
              <Field id="tripName" label="Trip Name" required error={errors.tripName}>
                <input type="text" className={inputClass("tripName")} id="tripName" placeholder="e.g. Incredible India"
                  maxLength={LIMITS.tripName} value={formdata.tripName} onChange={update("tripName")} />
              </Field>

              <div className="row">
                <div className="col-md-6">
                  <Field id="startDateOfJourney" label="Start Date" required error={errors.startDateOfJourney}>
                    <input type="date" className={inputClass("startDateOfJourney")} id="startDateOfJourney"
                      value={formdata.startDateOfJourney} onChange={update("startDateOfJourney")} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field id="endDateOfJourney" label="End Date" required error={errors.endDateOfJourney}>
                    <input type="date" className={inputClass("endDateOfJourney")} id="endDateOfJourney"
                      min={formdata.startDateOfJourney || undefined}
                      value={formdata.endDateOfJourney} onChange={update("endDateOfJourney")} />
                  </Field>
                </div>
              </div>

              <div className="row">
                <div className="col-md-6">
                  <Field id="tripType" label="Trip Type" error={errors.tripType}>
                    <select className={inputClass("tripType", "form-select")} id="tripType" value={formdata.tripType} onChange={update("tripType")}>
                      <option value="">Select one</option>
                      <option value="backpacking">Backpacking</option>
                      <option value="leisure">Leisure</option>
                      <option value="business">Business</option>
                    </select>
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field id="totalCost" label="Total Cost" error={errors.totalCost}>
                    <input type="number" min="0" step="any" className={inputClass("totalCost")} id="totalCost"
                      placeholder="e.g. 50000" value={formdata.totalCost} onChange={update("totalCost")} />
                  </Field>
                </div>
              </div>

              <Field id="nameOfHotels" label="Name of Hotels" error={errors.nameOfHotels}>
                <input type="text" className={inputClass("nameOfHotels")} id="nameOfHotels" placeholder="Hotel Namaste, Backpackers Club"
                  maxLength={LIMITS.nameOfHotels} value={formdata.nameOfHotels} onChange={update("nameOfHotels")} />
              </Field>

              <Field id="placesVisited" label="Places Visited" error={errors.placesVisited}>
                <input type="text" className={inputClass("placesVisited")} id="placesVisited" placeholder="Delhi, Paris, London, etc."
                  maxLength={LIMITS.placesVisited} value={formdata.placesVisited} onChange={update("placesVisited")} />
              </Field>

              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="featured"
                  checked={formdata.featured} onChange={(e) => setFormdata({ ...formdata, featured: e.target.checked })} />
                <label className="form-check-label" htmlFor="featured">Feature this trip on the home page</label>
              </div>
            </div>
          </div>

          <div className="card tm-card mb-4">
            <div className="card-body">
              <h2 className="h5 mb-3">Cover image</h2>
              <div className="btn-group mb-3" role="group" aria-label="Image source">
                <button type="button" className={`btn btn-sm ${imageMode === "upload" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => { setImageMode("upload"); setErrors({ ...errors, image: undefined }); }}>
                  Upload a photo
                </button>
                <button type="button" className={`btn btn-sm ${imageMode === "link" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => { setImageMode("link"); setErrors({ ...errors, image: undefined }); }}>
                  Use an image link
                </button>
              </div>

              {imageMode === "upload" ? (
                <Field id="image" label="Photo" error={errors.image} hint={`JPEG, PNG, GIF or WEBP, up to ${MAX_IMAGE_MB} MB.`}>
                  <input ref={fileInput} type="file" className={inputClass("image")} id="image"
                    accept={ALLOWED_IMAGE_TYPES.join(",")} onChange={onFileChange} />
                  {preview && !errors.image && (
                    <div className="tm-preview mt-3">
                      <img src={preview} alt="Selected cover preview" />
                      <button type="button" className="btn btn-sm btn-light tm-preview__remove" onClick={clearFile} aria-label="Remove image">
                        ✕
                      </button>
                    </div>
                  )}
                </Field>
              ) : (
                <Field id="image" label="Image Link" error={errors.image}>
                  <input type="url" className={inputClass("image")} id="image" placeholder="https://example.com/photo.jpg"
                    maxLength={2048} value={formdata.image} onChange={update("image")} />
                </Field>
              )}
            </div>
          </div>

          <div className="card tm-card mb-4">
            <div className="card-body">
              <h2 className="h5 mb-3">Your story</h2>
              <Field id="shortDescription" label="Short Description" required error={errors.shortDescription}
                hint={`${formdata.shortDescription.length}/${LIMITS.shortDescription}`}>
                <textarea className={inputClass("shortDescription")} id="shortDescription" rows="2" placeholder="A one-line summary of the trip"
                  maxLength={LIMITS.shortDescription} value={formdata.shortDescription} onChange={update("shortDescription")} />
              </Field>
              <Field id="experience" label="Experience" error={errors.experience}
                hint={`${formdata.experience.length}/${LIMITS.experience}`}>
                <textarea className={inputClass("experience")} id="experience" rows="6"
                  placeholder="Write complete details about your experience on the trip."
                  maxLength={LIMITS.experience} value={formdata.experience} onChange={update("experience")} />
              </Field>
            </div>
          </div>

          {loading && imageMode === "upload" && file && (
            <div className="progress mb-3" role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
              <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${progress}%` }}>{progress}%</div>
            </div>
          )}

          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/")}>Cancel</button>
            <button type="submit" className="btn btn-primary px-4">
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                  Saving...
                </>
              ) : (
                "Save Trip"
              )}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
