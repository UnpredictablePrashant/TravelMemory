const mongoose = require('mongoose')
const config = require('./config')

// Strip query selectors like { $gt: '' } from user supplied filters (NoSQL injection guard)
mongoose.set('sanitizeFilter', true)
mongoose.set('strictQuery', true)

const db = mongoose.connection
db.on('error', (err) => console.error('DB ERROR:', err.message))
db.on('disconnected', () => console.warn('DB disconnected'))

const connect = () => mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 })

module.exports = { db, mongoose, connect }
