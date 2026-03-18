(function () {
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

  function classifyByColor(color) {
    if (color.r > 170 && color.g < 110 && color.b < 110) {
      return 'maki';
    }

    if (color.r > 205 && color.g > 185 && color.b < 120) {
      return 'yellow';
    }

    if (color.r > 185 && color.g > 180 && color.b > 215) {
      return 'tempura';
    }

    if (color.b > 170 && color.g > 160 && color.r < 190) {
      return 'blue';
    }

    if (color.g > 175 && color.r > 145 && color.b < 110) {
      return 'lime';
    }

    if (color.r > 210 && color.g > 165 && color.b > 170) {
      return 'pudding';
    }

    return 'unknown';
  }

  function countDarkTopIcons(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const image = ctx.getImageData(0, 0, width, Math.max(1, Math.floor(height * 0.2)));
    const columns = new Array(width).fill(0);

    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const color = toRgb(image.data, index);
        const dark = color.r < 70 && color.g < 70 && color.b < 70;
        if (dark) {
          columns[x] += 1;
        }
      }
    }

    let groups = 0;
    let active = false;
    for (const value of columns) {
      if (value > image.height * 0.09) {
        if (!active) {
          groups += 1;
          active = true;
        }
      } else {
        active = false;
      }
    }

    return clamp(groups, 1, 3);
  }

  function classifyYellowCard(ctx) {
    const topCenter = averageSample(
      ctx,
      ctx.canvas.width * 0.28,
      ctx.canvas.height * 0.28,
      ctx.canvas.width * 0.44,
      ctx.canvas.height * 0.18
    );
    const middle = averageSample(
      ctx,
      ctx.canvas.width * 0.25,
      ctx.canvas.height * 0.42,
      ctx.canvas.width * 0.5,
      ctx.canvas.height * 0.24
    );

    if (middle.g > middle.r && middle.g > middle.b) {
      return 'wasabi';
    }

    if (topCenter.r > 230 && topCenter.g > 210 && topCenter.b > 190) {
      return 'nigiri_squid';
    }

    if (topCenter.r > 220 && topCenter.g > 170 && topCenter.g < 220) {
      return 'nigiri_salmon';
    }

    return 'nigiri_egg';
  }

  function classifyBlueCard(ctx) {
    const center = averageSample(
      ctx,
      ctx.canvas.width * 0.3,
      ctx.canvas.height * 0.32,
      ctx.canvas.width * 0.4,
      ctx.canvas.height * 0.4
    );

    if (center.r > 155 && center.g > 120 && center.b < 110) {
      return 'chopsticks';
    }

    return 'gyoza';
  }

  function classifyLimeCard(ctx) {
    const center = averageSample(
      ctx,
      ctx.canvas.width * 0.28,
      ctx.canvas.height * 0.45,
      ctx.canvas.width * 0.44,
      ctx.canvas.height * 0.22
    );

    if (center.r > 170 && center.b > 120) {
      return 'sashimi';
    }

    return 'wasabi';
  }

  function classifyCard(cropCanvas) {
    const ctx = cropCanvas.getContext('2d');
    const bgColor = averageSample(
      ctx,
      cropCanvas.width * 0.08,
      cropCanvas.height * 0.08,
      cropCanvas.width * 0.2,
      cropCanvas.height * 0.2
    );

    const family = classifyByColor(bgColor);

    if (family === 'maki') {
      return `maki${countDarkTopIcons(ctx)}`;
    }

    if (family === 'yellow') {
      return classifyYellowCard(ctx);
    }

    if (family === 'tempura') {
      return 'tempura';
    }

    if (family === 'blue') {
      return classifyBlueCard(ctx);
    }

    if (family === 'lime') {
      return classifyLimeCard(ctx);
    }

    if (family === 'pudding') {
      return 'pudding';
    }

    return null;
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

  async function createCanvasFromFile(file) {
    const bitmap = await loadBitmap(file);
    const ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
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
    const sample = Math.max(6, Math.floor(Math.min(width, height) * 0.04));
    return averageColors([
      averageSample(ctx, 0, 0, sample, sample),
      averageSample(ctx, width - sample, 0, sample, sample),
      averageSample(ctx, 0, height - sample, sample, sample),
      averageSample(ctx, width - sample, height - sample, sample, sample)
    ]);
  }

  function buildForegroundMask(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    const background = estimateBackground(ctx);
    const image = ctx.getImageData(0, 0, width, height);
    const mask = new Uint8Array(width * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const color = toRgb(image.data, index);
        const distance = rgbDistance(color, background);
        if (distance > 42) {
          mask[y * width + x] = 1;
        }
      }
    }

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

        const neighbors = [current - 1, current + 1, current - width, current + width];
        for (const next of neighbors) {
          if (next < 0 || next >= mask.length || visited[next] || !mask[next]) {
            continue;
          }

          const nextX = next % width;
          const nextY = Math.floor(next / width);
          if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) {
            continue;
          }

          visited[next] = 1;
          queue.push(next);
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const aspect = boxWidth / boxHeight;
      const minArea = width * height * 0.015;

      if (area >= minArea && aspect > 0.42 && aspect < 0.9) {
        boxes.push({
          x: minX,
          y: minY,
          width: boxWidth,
          height: boxHeight,
          area
        });
      }
    }

    return boxes.sort((a, b) => a.x - b.x);
  }

  function cropCanvas(canvas, box) {
    const paddingX = Math.round(box.width * 0.04);
    const paddingY = Math.round(box.height * 0.04);
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

  function sortBoxesReadingOrder(boxes) {
    if (!boxes.length) {
      return [];
    }

    const averageHeight =
      boxes.reduce((sum, box) => sum + box.height, 0) / boxes.length;
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

  async function detect(file) {
    const canvas = await createCanvasFromFile(file);
    const mask = buildForegroundMask(canvas);
    const boxes = sortBoxesReadingOrder(findComponents(mask));
    const cards = [];

    for (const box of boxes) {
      const crop = cropCanvas(canvas, box);
      const cardId = classifyCard(crop);
      if (cardId) {
        cards.push(cardId);
      }
    }

    return {
      cards,
      boxes
    };
  }

  window.SushiGoDetector = {
    detect
  };
})();
