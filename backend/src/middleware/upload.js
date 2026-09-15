const multer = require('multer');
const path = require('path');
const fs = require('fs');

const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

function fileFilter(req, file, cb) {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (png, jpg, svg, webp) are allowed'));
  }
}

// Wraps multer so size/type errors come back as a clean JSON message
// (naming the actual limit) instead of falling through to the generic
// 500 handler in server.js.
function wrapSingle(upload, maxFileSizeBytes) {
  const maxSizeMB = maxFileSizeBytes / (1024 * 1024);
  return (fieldName) => (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: `File is too large. Maximum size is ${maxSizeMB}MB.` });
      }
      return res.status(400).json({ message: err.message });
    });
  };
}

function createUploader(subfolder, maxFileSizeBytes) {
  const uploadDir = path.join(__dirname, '..', '..', 'uploads', subfolder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    }
  });

  const upload = multer({ storage, limits: { fileSize: maxFileSizeBytes }, fileFilter });
  return { single: wrapSingle(upload, maxFileSizeBytes) };
}

// Player photos are always re-encoded to WebP by the controller (whatever
// format they arrive in), so there's no reason for multer to ever write the
// pre-conversion file to disk — memory storage just hands back the raw
// bytes for the controller to convert.
function createMemoryUploader(maxFileSizeBytes) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFileSizeBytes }, fileFilter });
  return { single: wrapSingle(upload, maxFileSizeBytes) };
}

module.exports = {
  logos: createUploader('logos', 3 * 1024 * 1024),
  playerPhotos: createMemoryUploader(3 * 1024 * 1024)
};
