import sharp from "sharp";

export interface ProcessedImage {
  main: Buffer;
  contentType: "image/jpeg";
  extension: "jpg";
}

export interface ProcessedImageWithThumb extends ProcessedImage {
  thumb: Buffer;
}

const MAIN_MAX = 1600;
const THUMB_SIZE = 300;

/**
 * Comprime una imagen a JPEG (mozjpeg) limitando su lado mayor. Llamar ANTES de
 * subir a storage (COSTS.md S1): evita guardar/servir el archivo original de
 * varios MB. Respeta la orientación EXIF y aplana transparencias sobre blanco.
 */
export async function compressImage(input: Buffer, maxSize = MAIN_MAX): Promise<ProcessedImage> {
  const main = await sharp(input)
    .rotate()
    .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return { main, contentType: "image/jpeg", extension: "jpg" };
}

/**
 * Como compressImage, pero además genera un thumbnail cuadrado (COSTS.md S2).
 * Úsalo donde haya que listar muchas imágenes (galería de cortes): la lista sirve
 * el thumb liviano y la imagen full solo al abrir el detalle.
 */
export async function compressImageWithThumb(
  input: Buffer,
  maxSize = MAIN_MAX,
  thumbSize = THUMB_SIZE,
): Promise<ProcessedImageWithThumb> {
  const [{ main }, thumb] = await Promise.all([
    compressImage(input, maxSize),
    sharp(input)
      .rotate()
      .resize(thumbSize, thumbSize, { fit: "cover" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer(),
  ]);
  return { main, thumb, contentType: "image/jpeg", extension: "jpg" };
}
