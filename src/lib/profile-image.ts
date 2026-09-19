const MAX_AVATAR_EDGE = 640;
const TARGET_AVATAR_BYTES = 120 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível preparar esta imagem."));
    }, "image/webp", quality);
  });
}

export async function compressProfileImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem válida.");

  const bitmap = await createImageBitmap(file);
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const outputSize = Math.min(sourceSize, MAX_AVATAR_EDGE);
  const sourceX = Math.max(0, (bitmap.width - sourceSize) / 2);
  const sourceY = Math.max(0, (bitmap.height - sourceSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    bitmap.close();
    throw new Error("Não foi possível preparar esta imagem.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
  bitmap.close();

  let compressed = await canvasToBlob(canvas, 0.82);
  for (const quality of [0.74, 0.66, 0.58, 0.5]) {
    if (compressed.size <= TARGET_AVATAR_BYTES) break;
    compressed = await canvasToBlob(canvas, quality);
  }

  return compressed;
}