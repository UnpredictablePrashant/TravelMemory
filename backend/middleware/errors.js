const multer = require('multer')
const mongoose = require('mongoose')

class HttpError extends Error {
    constructor(status, message, details) {
        super(message)
        this.status = status
        this.details = details
    }
}

function notFoundHandler(req, res) {
    res.status(404).json({ error: 'Route not found' })
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message, details: err.details })
    }
    if (err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large' : `Upload error: ${err.message}`
        return res.status(status).json({ error: message })
    }
    if (err instanceof mongoose.Error.ValidationError) {
        const details = Object.fromEntries(Object.entries(err.errors).map(([field, e]) => [field, e.message]))
        return res.status(400).json({ error: 'Validation failed', details })
    }
    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({ error: `Invalid value for ${err.path}` })
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Malformed JSON body' })
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body is too large' })
    }
    if (err.message && err.message.startsWith('CORS')) {
        return res.status(403).json({ error: err.message })
    }

    // Unknown error: log it, but never leak internals to the client
    console.error(err)
    res.status(500).json({ error: 'Something went wrong. Please try again later.' })
}

module.exports = { HttpError, notFoundHandler, errorHandler }
