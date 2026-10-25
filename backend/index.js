const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const config = require('./config')
const conn = require('./conn')
const tripRoutes = require('./routes/trip.routes')
const { notFoundHandler, errorHandler } = require('./middleware/errors')

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', config.trustProxy)

// The API and uploaded images are consumed by the frontend on another origin
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
    origin: (origin, cb) => {
        // Requests without an Origin header (curl, server-to-server, same-origin) are allowed
        if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return cb(null, true)
        cb(new Error(`CORS: origin ${origin} is not allowed`))
    },
    methods: ['GET', 'POST'],
}))
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
}))
app.use(express.json({ limit: '100kb' }))

// Uploaded images: never executed or sniffed as anything other than an image
app.use('/uploads', express.static(config.uploadDir, {
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Content-Security-Policy', "default-src 'none'")
    },
}))

app.use('/trip', tripRoutes) // http://localhost:3001/trip --> POST/GET/GET by ID

app.get('/hello', (req,res)=>{
    res.send('Hello World!')
})

app.get('/health', (req, res) => {
    const dbUp = conn.db.readyState === 1
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'connected' : 'disconnected' })
})

app.use(notFoundHandler)
app.use(errorHandler)

async function start() {
    try {
        await conn.connect()
        console.log('Connected to MongoDB')
    } catch (err) {
        console.error('Could not connect to MongoDB:', err.message)
        process.exit(1)
    }

    const server = app.listen(config.port, () => {
        console.log(`Server started at http://localhost:${config.port}`)
    })

    const shutdown = (signal) => {
        console.log(`${signal} received, shutting down`)
        server.close(() => conn.mongoose.disconnect().then(() => process.exit(0)))
        setTimeout(() => process.exit(1), 10000).unref()
    }
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
}

if (require.main === module) {
    start()
}

module.exports = app
