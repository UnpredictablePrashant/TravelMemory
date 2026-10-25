const express = require('express')
const rateLimit = require('express-rate-limit')
const routes = express.Router()

const tripDetails = require('../controllers/trip.controller')
const { upload } = require('../middleware/upload')

// Express 4 does not forward rejected promises to the error handler on its own
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Stricter limit for writes (uploads are the expensive part)
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many trips submitted. Please try again later.' },
})

// Accepts multipart/form-data (with an optional "image" file) or plain JSON
routes.post('/', writeLimiter, upload.single('image'), asyncHandler(tripDetails.tripAdditionController))
routes.get('/', asyncHandler(tripDetails.getTripDetailsController))
routes.get('/:id', asyncHandler(tripDetails.getTripDetailsByIdController))

module.exports = routes
