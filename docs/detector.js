(function () {
  const TEMPLATE_SOURCES = {
    maki1: './assets/Maki1.jpeg',
    maki2: './assets/Maki2.jpeg',
    maki3: './assets/Maki3.jpeg',
    tempura: './assets/Tempura.jpeg',
    sashimi: './assets/Sashimi.jpeg',
    gyoza: './assets/Gyoza.jpeg',
    wasabi: './assets/Wasabi.jpeg',
    nigiri_egg: './assets/Niguiri huevo.jpeg',
    nigiri_salmon: './assets/Niguiri Salmon.jpeg',
    nigiri_squid: './assets/Niguiri.jpeg',
    chopsticks: './assets/Palillos.jpeg',
    pudding: './assets/Postre.jpeg'
  };

  const SIGNATURE_WIDTH = 24;
  const SIGNATURE_HEIGHT = 36;
  let templateCachePromise = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rgbDistance(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function toRgb(data, index) {
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2]
    };
  }

  function averageColors(colors) {
    if (!colors.length) {
      return { r: 0, g: 0, b: 0 };
    }

    const sum = colors.reduce(
      (acc, color) => ({
        r: acc.r + color.r,
        g: acc.g + color.g,
        b: acc.b + color.b
      }),
      { r: 0, g: 0, b: 0 }
    );

    return {
      r: Math.round(sum.r / colors.length),
      g: Math.round(sum.g / colors.length),
      b: Math.round(sum.b / colors.length)
    };
  }

  function averageSample(ctx, x, y, width, height) {
    const safeX = clamp(Math.round(x), 0, ctx.canvas.width - 1);
    const safeY = clamp(Math.round(y), 0, ctx.canvas.height - 1);
    const safeWidth = clamp(Math.round(width), 1, ctx.canvas.width - safeX);
    const safeHeight = clamp(Math.round(height), 1, ctx.canvas.height - safeY);
    const image = ctx.getImageData(safeX, safeY, safeWidth, safeHeight);
    const colors = [];

    for (let index = 0; index < image.data.length; index += 4) {
      colors.push(toRgb(image.data, index));
    }

    return averageColors(colors);
  }

  function loadImage(src) {
    const img = new Image();
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function loadBitmapFallback(file) {
    const img = new Image();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function loadBitmap(file) {
    if ('createImageBitmap' in window) {
      try {
        return await createImageBitmap(file);
      } catch (error) {
        return loadBitmapFallback(file);
      }
    }

    return loadBitmapFallback(file);
  }

  function imageToCanvas(image, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    return canvas;
  }

  function createSignature(canvas) {
    const normalized = imageToCanvas(canvas, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    const ctx = normalized.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    const signature = [];

    for (let index = 0; index < image.data.length; index += 4) {
      signature.push(image.data[index] / 255);
      signature.push(image.data[index + 1] / 255);
      signature.push(image.data[index + 2] / 255);
    }

    return signature;
  }

  async function loadTemplates() {
    if (!templateCachePromise) {
      templateCachePromise = Promise.all(
        Object.entries(TEMPLATE_SOURCES).map(async ([id, src]) => {
          const image = await loadImage(src);
          const canvas = imageToCanvas(image, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
          return {
            id,
            signature: createSignature(canvas)
          };
        })
      );
    }

    return templateCachePromise;
  }

  async function createCanvasFromFile(file) {
    const bitmap = await loadBitmap(file);
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function estimateBackground(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const sample = Math.max(8, Math.floor(Math.min(width, height) * 0.05));
    return averageColors([
      averageSample(ctx, 0, 0, sample, sample),
      averageSample(ctx, width - sample, 0, sample, sample),
      averageSample(ctx, 0, height - sample, sample, sample),
      averageSample(ctx, width - sample, height - sample, sample, sample)
    ]);
  }

  function dilate(mask, width, height) {
    const out = new Uint8Array(mask.length);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        let value = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (mask[(y + dy) * width + (x + dx)]) {
              value = 1;
            }
          }
        }
        out[y * width + x] = value;
      }
    }
    return out;
  }

  function erode(mask, width, height) {
    const out = new Uint8Array(mask.length);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        let value = 1;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!mask[(y + dy) * width + (x + dx)]) {
              value = 0;
            }
          }
        }
        out[y * width + x] = value;
      }
    }
    return out;
  }

  function buildForegroundMask(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    const background = estimateBackground(ctx);
    const image = ctx.getImageData(0, 0, width, height);
    let mask = new Uint8Array(width * height);
    const backgroundBrightness = (background.r + background.g + background.b) / 3;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const color = toRgb(image.data, index);
        const brightness = (color.r + color.g + color.b) / 3;
        const distance = rgbDistance(color, background);
        if (distance > 18 || brightness > backgroundBrightness + 10) {
          mask[y * width + x] = 1;
        }
      }
    }

    mask = dilate(mask, width, height);
    mask = erode(mask, width, height);
    mask = dilate(mask, width, height);

    return { mask, width, height };
  }

  function findComponents(maskData) {
    const { mask, width, height } = maskData;
    const visited = new Uint8Array(mask.length);
    const boxes = [];

    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || visited[start]) {
        continue;
      }

      const queue = [start];
      visited[start] = 1;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let area = 0;

      while (queue.length) {
        const current = queue.pop();
        const x = current % width;
        const y = Math.floor(current / width);
        area += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) {
              continue;
            }
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
              continue;
            }
            const next = nextY * width + nextX;
            if (visited[next] || !mask[next]) {
              continue;
            }
            visited[next] = 1;
            queue.push(next);
          }
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const aspect = boxWidth / boxHeight;
      const fill = area / (boxWidth * boxHeight);
      const minArea = width * height * 0.0025;

      if (area >= minArea && aspect > 0.38 && aspect < 0.9 && fill > 0.2) {
        boxes.push({
          x: minX,
          y: minY,
          width: boxWidth,
          height: boxHeight,
          area
        });
      }
    }

    return boxes;
  }

  function intersects(a, b) {
    return !(
      a.x + a.width + 10 < b.x ||
      b.x + b.width + 10 < a.x ||
      a.y + a.height + 10 < b.y ||
      b.y + b.height + 10 < a.y
    );
  }

  function mergeBoxes(boxes) {
    const pending = [...boxes].sort((a, b) => a.x - b.x);
    const merged = [];

    while (pending.length) {
      const current = pending.shift();
      let changed = true;

      while (changed) {
        changed = false;
        for (let index = pending.length - 1; index >= 0; index -= 1) {
          if (!intersects(current, pending[index])) {
            continue;
          }
          const candidate = pending.splice(index, 1)[0];
          current.x = Math.min(current.x, candidate.x);
          current.y = Math.min(current.y, candidate.y);
          current.width = Math.max(current.x + current.width, candidate.x + candidate.width) - current.x;
          current.height = Math.max(current.y + current.height, candidate.y + candidate.height) - current.y;
          changed = true;
        }
      }

      merged.push(current);
    }

    return merged;
  }

  function normalizeBoxes(boxes) {
    return boxes
      .filter(box => box.width > 20 && box.height > 20)
      .map(box => ({
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height)
      }));
  }

  function cropCanvas(canvas, box) {
    const paddingX = Math.round(box.width * 0.03);
    const paddingY = Math.round(box.height * 0.03);
    const x = clamp(box.x - paddingX, 0, canvas.width - 1);
    const y = clamp(box.y - paddingY, 0, canvas.height - 1);
    const width = clamp(box.width + paddingX * 2, 1, canvas.width - x);
    const height = clamp(box.height + paddingY * 2, 1, canvas.height - y);
    const crop = document.createElement('canvas');
    crop.width = width;
    crop.height = height;
    crop.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height);
    return crop;
  }

  function drawDebugOverlay(canvas, boxes) {
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = canvas.width;
    debugCanvas.height = canvas.height;
    const ctx = debugCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    ctx.lineWidth = 4;
    ctx.font = '22px sans-serif';

    boxes.forEach((box, index) => {
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.95)';
      ctx.fillStyle = 'rgba(255, 50, 50, 0.2)';
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = '#111';
      ctx.fillText(String(index + 1), box.x + 8, Math.max(24, box.y + 24));
    });

    return debugCanvas.toDataURL('image/jpeg', 0.9);
  }

  function sortBoxesReadingOrder(boxes) {
    if (!boxes.length) {
      return [];
    }

    const averageHeight = boxes.reduce((sum, box) => sum + box.height, 0) / boxes.length;
    const rowThreshold = averageHeight * 0.45;
    const sortedByTop = [...boxes].sort((a, b) => {
      if (Math.abs(a.y - b.y) <= rowThreshold) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    const rows = [];
    for (const box of sortedByTop) {
      const row = rows.find(item => Math.abs(item.y - box.y) <= rowThreshold);
      if (row) {
        row.items.push(box);
        row.y = (row.y * (row.items.length - 1) + box.y) / row.items.length;
      } else {
        rows.push({ y: box.y, items: [box] });
      }
    }

    rows.sort((a, b) => a.y - b.y);
    rows.forEach(row => row.items.sort((a, b) => a.x - b.x));
    return rows.flatMap(row => row.items);
  }

  function spansFromProjection(values, threshold) {
    const spans = [];
    let start = -1;

    for (let index = 0; index < values.length; index += 1) {
      if (values[index] >= threshold) {
        if (start === -1) {
          start = index;
        }
      } else if (start !== -1) {
        spans.push({ start, end: index - 1 });
        start = -1;
      }
    }

    if (start !== -1) {
      spans.push({ start, end: values.length - 1 });
    }

    return spans.filter(span => span.end - span.start > 20);
  }

  function fallbackGridBoxes(maskData) {
    const { mask, width, height } = maskData;
    const rowSums = new Array(height).fill(0);
    const colSums = new Array(width).fill(0);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = mask[y * width + x];
        rowSums[y] += value;
        colSums[x] += value;
      }
    }

    const rowThreshold = width * 0.015;
    const rowSpans = spansFromProjection(rowSums, rowThreshold);
    const boxes = [];

    rowSpans.forEach(row => {
      const localCols = new Array(width).fill(0);
      for (let y = row.start; y <= row.end; y += 1) {
        for (let x = 0; x < width; x += 1) {
          localCols[x] += mask[y * width + x];
        }
      }

      const colThreshold = Math.max(2, (row.end - row.start) * 0.08);
      const colSpans = spansFromProjection(localCols, colThreshold);

      colSpans.forEach(col => {
        boxes.push({
          x: col.start,
          y: row.start,
          width: col.end - col.start + 1,
          height: row.end - row.start + 1
        });
      });
    });

    return normalizeBoxes(
      boxes.filter(box => box.width / box.height > 0.38 && box.width / box.height < 0.9)
    );
  }

  function shouldUseGridFallback(boxes, canvas) {
    if (!boxes.length) {
      return true;
    }

    if (boxes.length <= 2) {
      return true;
    }

    const canvasArea = canvas.width * canvas.height;
    const giantBox = boxes.some(box => box.width * box.height > canvasArea * 0.22);
    return giantBox;
  }

  function compareSignatures(a, b) {
    let total = 0;
    for (let index = 0; index < a.length; index += 1) {
      total += Math.abs(a[index] - b[index]);
    }
    return total / a.length;
  }

  async function classifyCard(cropCanvas) {
    const templates = await loadTemplates();
    const signature = createSignature(cropCanvas);
    let best = null;

    for (const template of templates) {
      const distance = compareSignatures(signature, template.signature);
      if (!best || distance < best.distance) {
        best = {
          id: template.id,
          distance
        };
      }
    }

    return best;
  }

  async function detect(file) {
    const canvas = await createCanvasFromFile(file);
    const mask = buildForegroundMask(canvas);
    const componentBoxes = normalizeBoxes(mergeBoxes(findComponents(mask)));
    const gridBoxes = fallbackGridBoxes(mask);

    let boxes = componentBoxes;
    if (shouldUseGridFallback(componentBoxes, canvas) && gridBoxes.length > componentBoxes.length) {
      boxes = gridBoxes;
    } else if (!boxes.length) {
      boxes = gridBoxes;
    }

    boxes = sortBoxesReadingOrder(boxes);
    const cards = [];
    const matches = [];

    for (const box of boxes) {
      const crop = cropCanvas(canvas, box);
      const best = await classifyCard(crop);
      if (best) {
        cards.push(best.id);
        matches.push({ ...best, box });
      }
    }

    return {
      cards,
      boxes,
      matches,
      debugImage: drawDebugOverlay(canvas, boxes)
    };
  }

  window.SushiGoDetector = {
    detect
  };
})();
