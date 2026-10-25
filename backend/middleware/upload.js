const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')
const multer = require('multer')
const config = require('../config')
const { HttpError } = require('./errors')

// Only raster formats; SVG is rejected because it can carry scripts.
const IMAGE_TYPES = {
    'image/jpeg': { ext: '.jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    'image/png': { ext: '.png', matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    'image/gif': { ext: '.gif', matches: (b) => b.subarray(0, 4).toString('ascii') === 'GIF8' },
    'image/webp': { ext: '.webp', matches: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
}

// Files are kept in memory until their content is verified, so nothing untrusted touches the disk.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 1, fields: 20, fieldSize: 20 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!IMAGE_TYPES[file.mimetype]) {
            return cb(new HttpError(400, 'Only JPEG, PNG, GIF or WEBP images are allowed'))
        }
        cb(null, true)
    },
})

// Checks the real file signature (the client supplied mimetype can be spoofed) and writes it
// under a random name. Returns the public path, e.g. /uploads/3f9c...e1.jpg
async function saveImage(file) {
    const type = Object.values(IMAGE_TYPES).find((t) => t.matches(file.buffer))
    if (!type) {
        throw new HttpError(400, 'Uploaded file is not a valid image')
    }
    const filename = crypto.randomBytes(16).toString('hex') + type.ext
    await fs.mkdir(config.uploadDir, { recursive: true })
    await fs.writeFile(path.join(config.uploadDir, filename), file.buffer, { flag: 'wx' })
    return `/uploads/${filename}`
}

async function removeImage(publicPath) {
    if (!publicPath || !publicPath.startsWith('/uploads/')) return
    const filename = path.basename(publicPath)
    await fs.unlink(path.join(config.uploadDir, filename)).catch(() => {})
}

module.exports = { upload, saveImage, removeImage }
