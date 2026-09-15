const sharp = require('sharp');
const path = require('path');

const PLAYERS_DIR = path.join(__dirname, '..', '..', 'uploads', 'players');

// Every player photo lands here re-encoded to WebP, regardless of the
// source format (png/jpg/svg/webp/gif) or how it arrived (a direct upload
// vs. an Excel-import photo link) — one on-disk format for the whole app.
async function savePlayerPhotoAsWebp(buffer) {
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  try {
    await sharp(buffer).webp({ quality: 82 }).toFile(path.join(PLAYERS_DIR, filename));
  } catch {
    throw new Error('the file is not a valid image');
  }
  return `/uploads/players/${filename}`;
}

async function fetchImageBuffer(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('could not reach the image link');
  }
  if (!response.ok) {
    throw new Error(`could not download the image link (HTTP ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { savePlayerPhotoAsWebp, fetchImageBuffer };
