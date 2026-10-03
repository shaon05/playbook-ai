import sharp from "sharp";

export function verifyImageProcessingCapabilities() {
  const formats = sharp.format;
  return { jpeg: Boolean(formats.jpeg?.input.file), png: Boolean(formats.png?.input.file), heic: Boolean(formats.heif?.input.file) };
}
