const mongoose = require('mongoose')
const tripModel = require('../models/trip.model')
const { HttpError } = require('../middleware/errors')
const { saveImage, removeImage } = require('../middleware/upload')

const STRING_FIELDS = ['tripName', 'startDateOfJourney', 'endDateOfJourney', 'nameOfHotels', 'placesVisited', 'tripType', 'experience', 'shortDescription']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const isValidDate = (value) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))

const isHttpUrl = (value) => {
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

// Builds the trip from an allow-list of fields so clients cannot set anything else
// (e.g. _id, createdAt) and coerces multipart string values into proper types.
function buildTrip(body) {
    const errors = {}
    const trip = {}

    for (const field of STRING_FIELDS) {
        const value = body[field]
        if (value === undefined || value === null) continue
        if (typeof value !== 'string') {
            errors[field] = `${field} must be text`
            continue
        }
        trip[field] = value.trim()
    }
    if (trip.tripType === '' || trip.tripType === 'select') delete trip.tripType

    for (const field of ['startDateOfJourney', 'endDateOfJourney']) {
        if (trip[field] && !isValidDate(trip[field])) errors[field] = 'Date must be in YYYY-MM-DD format'
    }
    if (!errors.startDateOfJourney && !errors.endDateOfJourney && trip.startDateOfJourney && trip.endDateOfJourney
        && trip.endDateOfJourney < trip.startDateOfJourney) {
        errors.endDateOfJourney = 'End date cannot be before the start date'
    }

    if (body.totalCost !== undefined && body.totalCost !== '') {
        const cost = Number(body.totalCost)
        if (!Number.isFinite(cost)) errors.totalCost = 'Total cost must be a number'
        else trip.totalCost = cost
    }

    const featured = body.featured
    if (featured === true || featured === 'true') trip.featured = true
    else if (featured === undefined || featured === false || featured === 'false') trip.featured = false
    else errors.featured = 'Featured must be true or false'

    if (typeof body.image === 'string' && body.image.trim() !== '') {
        if (!isHttpUrl(body.image.trim())) errors.image = 'Image link must be a valid http(s) URL'
        else trip.image = body.image.trim()
    }

    return { trip, errors }
}

async function tripAdditionController(req, res) {
    const { trip, errors } = buildTrip(req.body || {})
    const tripDetail = new tripModel.Trip(trip)

    const schemaErrors = tripDetail.validateSync()
    if (schemaErrors) {
        for (const [field, e] of Object.entries(schemaErrors.errors)) errors[field] = errors[field] || e.message
    }
    if (Object.keys(errors).length) {
        throw new HttpError(400, 'Validation failed', errors)
    }

    // Uploaded file wins over an image link
    if (req.file) {
        tripDetail.image = await saveImage(req.file)
    }

    try {
        await tripDetail.save()
    } catch (err) {
        if (req.file) await removeImage(tripDetail.image)
        throw err
    }
    res.status(201).json({ message: 'Trip added successfully', trip: tripDetail })
}

async function getTripDetailsController(req, res) {
    const filter = {}
    if (req.query.featured === 'true') filter.featured = true
    if (req.query.featured === 'false') filter.featured = false

    // The list view does not need the (potentially long) experience text
    const trips = await tripModel.Trip.find(filter)
        .select('-experience -__v')
        .sort({ featured: -1, createdAt: -1 })
        .limit(200)
        .lean()
    res.json(trips)
}

async function getTripDetailsByIdController(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
        throw new HttpError(400, 'Invalid trip id')
    }
    const trip = await tripModel.Trip.findById(req.params.id).select('-__v').lean()
    if (!trip) {
        throw new HttpError(404, 'Trip not found')
    }
    res.json(trip)
}

module.exports = { tripAdditionController, getTripDetailsController, getTripDetailsByIdController }
