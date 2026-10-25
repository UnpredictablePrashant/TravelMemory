const path = require('path')
require('dotenv').config()

const toList = (value) => (value || '').split(',').map((v) => v.trim()).filter(Boolean)

const config = {
    port: Number(process.env.PORT) || 3001,
    mongoUri: process.env.MONGO_URI,
    // Comma separated list of allowed frontend origins, e.g. "http://localhost:3000,https://travel.example.com"
    corsOrigins: toList(process.env.CORS_ORIGIN || 'http://localhost:3000'),
    uploadDir: path.resolve(__dirname, process.env.UPLOAD_DIR || 'uploads'),
    maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024,
    // Set to the number of proxies in front of the app (e.g. 1 behind nginx / a load balancer)
    trustProxy: Number(process.env.TRUST_PROXY) || 0,
    isProduction: process.env.NODE_ENV === 'production',
}

if (!config.mongoUri) {
    console.error('MONGO_URI is not set. Add it to backend/.env (see .env.example).')
    process.exit(1)
}

module.exports = config
