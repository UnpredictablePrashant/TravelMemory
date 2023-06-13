const db = require("../conn");
const mongoose = require("../conn").mongoose;

const tripSchema = mongoose.Schema({
  tripName: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 50
  },
  startDateOfJourney: {
    type: String,
    required: true
  },
  endDateOfJourney: {
    type: String,
    required: true
  },
  nameOfHotels: {
    type: String
  },
  placesVisited: {
    type: String
  },
  totalCost: {
    type: Number
  },
  tripType: {
    type: String,
    enum: ['backpacking', 'leisure', 'business']
  },
  experience: {
    type: String
  },
  image: {
    type: String
  },
  shortDescription: {
    type: String,
    required: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now()
  },
});


const Trip = mongoose.model('tripdetails', tripSchema)
module.exports = { Trip }