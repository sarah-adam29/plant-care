/**
 * image.ts — shrink phone photos in the browser before uploading.
 *
 * 📘 LEARN: A phone photo is 3–5 MB. Claude only needs ~1280px to identify a
 * plant, so resizing first makes uploads fast and cuts API cost ~5–10×.
 */
export async function resizeImage(file: File, maxSide = 1280, quality = 0.82) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg" as const, previewUrl: dataUrl };
}
