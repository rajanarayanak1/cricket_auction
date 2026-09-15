export const MAX_PHOTO_SIZE_MB = 3;
export const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

/** Returns an error message if the file exceeds the profile picture size limit, otherwise null. */
export function validatePhotoFile(file) {
  if (file && file.size > MAX_PHOTO_SIZE_BYTES) {
    return `That image is too large — please choose a file under ${MAX_PHOTO_SIZE_MB}MB.`;
  }
  return null;
}
