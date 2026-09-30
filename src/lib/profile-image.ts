const MAX_AVATAR_EDGE = 640;
const TARGET_AVATAR_BYTES = 120 * 1024;

type LoadedImage = { source: CanvasImageSource; width: number; height: number; dispose: () => void };

async function loadImage(blob: Blob): Promise<LoadedImage> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
  } catch {
    // Some iPhone browsers display HEIC photos but cannot decode them with createImageBitmap.
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Não foi possível abrir esta imagem.");
    }
  }
}

function isIphonePhoto(file: File) {
  return /\.(heic|heif|heics|heifs)$/i.test(file.name) || /^image\/hei[cf](?:-sequence)?$/i.test(file.type);
}

async function loadPhoto(file: File): Promise<LoadedImage> {
  try {
    return await loadImage(file);
  } catch (error) {
    if (!isIphonePhoto(file)) throw error;
    try {
      // Import only when needed: the decoder is large and must never run during SSR.
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const imageBlob = Array.isArray(converted) ? converted[0] : converted;
      if (!imageBlob) throw new Error("Foto vazia.");
      return await loadImage(imageBlob);
    } catch {
      throw new Error("Não foi possível abrir esta foto do iPhone. Tente salvar como JPEG e enviar novamente.");
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível preparar esta imagem."));
    }, "image/webp", quality);
  });
}

export async function compressProfileImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && !isIphonePhoto(file)) throw new Error("Escolha uma imagem válida.");

  const image = await loadPhoto(file);
  const sourceSize = Math.min(image.width, image.height);
  const outputSize = Math.min(sourceSize, MAX_AVATAR_EDGE);
  const sourceX = Math.max(0, (image.width - sourceSize) / 2);
  const sourceY = Math.max(0, (image.height - sourceSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    image.dispose();
    throw new Error("Não foi possível preparar esta imagem.");
  }

  try {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
  } finally {
    image.dispose();
  }

  let compressed = await canvasToBlob(canvas, 0.82);
  for (const quality of [0.74, 0.66, 0.58, 0.5]) {
    if (compressed.size <= TARGET_AVATAR_BYTES) break;
    compressed = await canvasToBlob(canvas, quality);
  }

  return compressed;
}