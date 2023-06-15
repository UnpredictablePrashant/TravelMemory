import React from "react";

export default function AddExperience() {
  return (
    <div style={{ margin: "2%" }}>
      <div class="mb-3">
        <label for="tripName" class="form-label">
          Trip Name
        </label>
        <input
          type="text"
          class="form-control"
          id="tripName"
          placeholder="Add your Trip Name"
        ></input>
      </div>
      <div class="mb-3">
        <label for="tripDate" class="form-label">
          Trip Date
        </label>
        <div class="row">
          <div class="col-6">
            <input type="date" class="form-control" id="startDate"></input>
          </div>
          <div class="col-6">
            <input type="date" class="form-control" id="endDate"></input>
          </div>
        </div>
      </div>
      <div class="mb-3">
        <label for="nameOfHotels" class="form-label">
          Trip Name
        </label>
        <input
          type="text"
          class="form-control"
          id="nameOfHotels"
          placeholder="Add your Hotel Name"
        ></input>
      </div>
      <div class="mb-3">
        <div class="row">
          <div class="col-6">
            <label for="nameOfHotels" class="form-label">
              Trip Type
            </label>
            <select class="form-select" id="tripType" aria-label="tripType">
              <option selected value="backpacking">
                Backpacking
              </option>
              <option value="leisure">Leisure</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div class="col-6">
            <label for="totalCost" class="form-label">
              Total Cost
            </label>
            <input
              type="number"
              class="form-control"
              id="totalCost"
              placeholder="99999"
            ></input>
          </div>
        </div>
      </div>
      <div class="mb-3">
        <label for="placesVisited" class="form-label">
          Places Visited
        </label>
        <input
          type="text"
          class="form-control"
          id="placesVisited"
          placeholder="Delhi, Paris, London, etc."
        ></input>
      </div>
      <div class="mb-3">
        <label for="featured" class="form-label">
          Featured Trip?
        </label>
        <div class="form-check">
          <input
            type="radio"
            class="form-check-input"
            id="true"
            value={true}
          ></input>
          <label>True</label>
        </div>
        <div class="form-check">
          <input
            type="radio"
            class="form-check-input"
            id="false"
            value={false}
          ></input>
          <label>False</label>
        </div>
      </div>
      <div class="mb-3">
        <label for="image" class="form-label">
          Image Link
        </label>
        <input
          type="text"
          class="form-control"
          id="image"
          placeholder="http://xyz.com/image.png"
        ></input>
      </div>
      <div class="mb-3">
        <label for="shortDescription" class="form-label">
          Short Description
        </label>
        <textarea
          class="form-control"
          id="shortDescription"
          rows="2"
          placeholder="Write Short Description"
        ></textarea>
      </div>
      <div class="mb-3">
        <label for="experience" class="form-label">
          Experience
        </label>
        <textarea
          class="form-control"
          id="experience"
          rows="5"
          placeholder="Write Complete Details about your experience in the trip."
        ></textarea>
      </div>
      <div class="mb-3" style={{ textAlign: "center"}}>
        <button type="submit" class="btn btn-primary">Submit</button>
      </div>
    </div>
  );
}
