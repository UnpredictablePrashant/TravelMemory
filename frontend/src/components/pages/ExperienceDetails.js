import React from "react";

export default function ExperienceDetails() {
  return (
    <div style={{ margin: "2%" }}>
      <div class="row">
        <div class="col-2"></div>
        <div class="col-8" style={{ textAlign: "center" }}>
          <h1>Trip Name</h1>
        </div>
        <div class="col-2"></div>
      </div>

      <div class="row">
        <div class="col-2"></div>
        <div class="col-8" style={{ textAlign: "center" }}>
          <img
            src="https://images.pexels.com/photos/1603650/pexels-photo-1603650.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"
            alt="Image Tag"
          ></img>
        </div>
        <div class="col-2"></div>
      </div>
      <br></br>

      <div class="container">
        <div class="row">
          <div class="col-3"></div>
          <div class="col-6 border bg-light">
            <div class="row">
              <div class="col-12">Name of Hotel: Hotel XYZ</div>
            </div>
            <div class="row">
              <div class="col-6">Start Date: 1/1/2001</div>
              <div class="col-6">End Date: 6/6/2001</div>
            </div>
            <div class="row">
              <div class="col-12">Places Visited: Delhi, Paris, etc.</div>
            </div>
            <div class="row">
              <div class="col-12">Total Cost: 99999</div>
            </div>
            <div class="row">
              <div class="col-12">Trip Type: Backpacking</div>
            </div>
          </div>
          <div class="col-3"></div>
        </div>
      </div>
      <br></br>
      <div class="row">
        <div class="col-1"></div>
        <div class="col-10" style={{ textAlign: "justify"}}>
          The Taj Mahal (/ˌtɑːdʒ məˈhɑːl, ˌtɑːʒ-/; lit. 'Crown of the
          Palace')[4][5][6] is an ivory-white marble mausoleum on the right bank
          of the river Yamuna in Agra, Uttar Pradesh, India. It was commissioned
          in 1631 by the fifth Mughal emperor, Shah Jahan (r. 1628–1658) to
          house the tomb of his favourite wife, Mumtaz Mahal; it also houses the
          tomb of Shah Jahan himself. The tomb is the centrepiece of a
          17-hectare (42-acre) complex, which includes a mosque and a guest
          house, and is set in formal gardens bounded on three sides by a
          crenellated wall.
          <br></br>
          Construction of the mausoleum was essentially completed in 1643, but
          work continued on other phases of the project for another 10 years.
          The Taj Mahal complex is believed to have been completed in its
          entirety in 1653 at a cost estimated at the time to be around ₹32
          million, which in 2020 would be approximately ₹70 billion (about US $1
          billion). The construction project employed some 20,000 artisans under
          the guidance of a board of architects led by Ustad Ahmad Lahori, the
          emperor’s court architect. Various types of symbolism have been
          employed in the Taj to reflect natural beauty and divinity.
        </div>
        <div class="col-1"></div>
      </div>
    </div>
  );
}
