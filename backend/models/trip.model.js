const { mongoose } = require('../conn')

const TRIP_TYPES = ['backpacking', 'leisure', 'business']

const tripSchema = new mongoose.Schema({
  tripName: {
    type: String,
    required: [true, 'Trip name is required'],
    trim: true,
    minlength: 1,
    maxlength: [50, 'Trip name must be at most 50 characters']
  },
  startDateOfJourney: {
    type: String,
    required: [true, 'Start date is required'],
    trim: true
  },
  endDateOfJourney: {
    type: String,
    required: [true, 'End date is required'],
    trim: true
  },
  nameOfHotels: {
    type: String,
    trim: true,
    maxlength: [300, 'Hotel names must be at most 300 characters']
  },
  placesVisited: {
    type: String,
    trim: true,
    maxlength: [300, 'Places visited must be at most 300 characters']
  },
  totalCost: {
    type: Number,
    min: [0, 'Total cost cannot be negative'],
    max: [1e12, 'Total cost is too large']
  },
  tripType: {
    type: String,
    enum: { values: TRIP_TYPES, message: 'Trip type must be one of: ' + TRIP_TYPES.join(', ') }
  },
  experience: {
    type: String,
    trim: true,
    maxlength: [10000, 'Experience must be at most 10000 characters']
  },
  // Either an external http(s) URL or a path under /uploads for files uploaded to this server
  image: {
    type: String,
    trim: true,
    maxlength: 2048
  },
  shortDescription: {
    type: String,
    required: [true, 'Short description is required'],
    trim: true,
    maxlength: [300, 'Short description must be at most 300 characters']
  },
  featured: {
    type: Boolean,
    default: false
  },
}, { timestamps: true });


const Trip = mongoose.model('tripdetails', tripSchema)
module.exports = { Trip, TRIP_TYPES }
