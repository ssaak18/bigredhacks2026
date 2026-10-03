/** Pixel helpers for `{ width, height, data }` images (RGBA bytes, row-major). */

export function fitSize(width, height, longestSide) {
  const scale = Math.min(1, longestSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Area-averaged luminance (0-255) resampled to a `width` x `height` grid. */
export function toGrayGrid(image, width, height) {
  const gray = new Float32Array(width * height);
  const stepX = image.width / width;
  const stepY = image.height / height;
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * stepY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * stepY));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * stepX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * stepX));
      let sum = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = (sy * image.width + sx) * 4;
          sum += 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
        }
      }
      gray[y * width + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return gray;
}

/** Copies the pixel rectangle `[x0, x1) x [y0, y1)` into a new image. */
export function cropImage(image, x0, y0, x1, y1) {
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const width = Math.max(1, Math.min(image.width, Math.ceil(x1)) - left);
  const height = Math.max(1, Math.min(image.height, Math.ceil(y1)) - top);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const from = ((top + y) * image.width + left) * 4;
    data.set(image.data.subarray(from, from + width * 4), y * width * 4);
  }
  return { width, height, data, left, top };
}
