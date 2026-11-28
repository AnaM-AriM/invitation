import type { PaintedArm, PaintedParts } from "./painted-arm";

function polygon(points: number[][]) {
  const outline = new Path2D();
  points.forEach(([x, y], i) => i ? outline.lineTo(x, y) : outline.moveTo(x, y));
  outline.closePath();
  return outline;
}

const cell = 4;
const feather = 4; // Transition over the neighbouring ink at shoulders and cuffs.

function influence(arm: PaintedArm, rig: PaintedParts, w: number, h: number, left: number, top: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1 / cell, 0, 0, 1 / cell, .5 - left / cell, .5 - top / cell);
  const path = polygon(arm.polygon);
  for (const extra of arm.includePolygons ?? []) path.addPath(polygon(extra));
  ctx.lineJoin = "round";
  ctx.lineWidth = 28;
  ctx.stroke(path); ctx.fill(path);
  ctx.globalCompositeOperation = "destination-out";
  for (const excluded of arm.excludePolygons ?? []) ctx.fill(polygon(excluded));
  const over = arm.occludedBy && rig.arms[arm.occludedBy];
  if (over) {
    ctx.fill(polygon(over.polygon));
    for (const extra of over.includePolygons ?? []) ctx.fill(polygon(extra));
  }
  const pixels = ctx.getImageData(0, 0, w, h).data;
  // Separable tent kernel on a coarse control grid, independent of CSS/Canvas filter support.
  const horizontal = new Float32Array(w * h), field = new Float32Array(w * h);
  const norm = (feather + 1) ** 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let k = Math.max(-feather, -x); k <= Math.min(feather, w - x - 1); k++) {
      horizontal[y * w + x] += pixels[(y * w + x + k) * 4 + 3] * (feather + 1 - Math.abs(k)) / (255 * norm);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let k = Math.max(-feather, -y); k <= Math.min(feather, h - y - 1); k++) {
      field[y * w + x] += horizontal[(y + k) * w + x] * (feather + 1 - Math.abs(k)) / norm;
    }
  }
  return field;
}

// The artist's ownership masks control how far each part moves. Sample the
// intact print through that continuous field, including ink which crosses a joint.
export function guestInk(rig: PaintedParts, original: HTMLImageElement | HTMLCanvasElement) {
  const [width, height] = rig.stage;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(original, 0, 0);
  const arms = Object.values(rig.arms).filter(arm => !arm.hidden);
  const points = arms.flatMap(arm => arm.polygon.concat(...(arm.includePolygons ?? [])));
  if (!points.length) return { canvas, move() {} };
  const pad = 40, xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const left = Math.max(0, Math.floor((Math.min(...xs) - pad) / cell) * cell);
  const top = Math.max(0, Math.floor((Math.min(...ys) - pad) / cell) * cell);
  const w = Math.min(width, Math.ceil((Math.max(...xs) + pad) / cell) * cell) - left;
  const h = Math.min(height, Math.ceil((Math.max(...ys) + pad) / cell) * cell) - top;
  const cols = w / cell + 1, rows = h / cell + 1;
  const layers = arms.map(arm => ({ arm, weight: influence(arm, rig, cols, rows, left, top) }));
  const source = ctx.getImageData(left, top, w, h), output = ctx.createImageData(w, h);
  output.data.set(source.data);
  const rgba = source.data, words = new Uint32Array(rgba.buffer), out = new Uint32Array(output.data.buffer);
  const dx = new Float32Array(cols * rows), dy = new Float32Array(cols * rows);
  const patches: number[] = [];
  for (let gy = 0; gy < rows - 1; gy++) for (let gx = 0; gx < cols - 1; gx++) {
    const i = gy * cols + gx;
    if (layers.some(({weight}) => weight[i] || weight[i + 1] || weight[i + cols] || weight[i + cols + 1])) patches.push(i);
  }
  let previousAmount: number | undefined, previousDance: number | undefined;
  function move(amount: number, danceAngle: number) {
    if (amount === previousAmount && danceAngle === previousDance) return;
    previousAmount = amount; previousDance = danceAngle;
    if (!amount && !danceAngle) { ctx.putImageData(source, left, top); return; }
    dx.fill(0); dy.fill(0);
    for (const { arm, weight } of layers) {
      // Broad swings also tug adjacent ink on a continuous drawing. Keep the
      // hand travel within the feathered area around the cuff and its prop.
      const gesture = Math.max(-9, Math.min(9, arm.motion)) * amount;
      const degrees = danceAngle ? Math.sign(arm.motion) * danceAngle : gesture;
      const angle = -degrees * Math.PI / 180;
      const cos = Math.cos(angle) - 1, sin = Math.sin(angle);
      for (let i = 0; i < weight.length; i++) {
        if (!weight[i]) continue;
        const x = left + (i % cols) * cell - arm.pivot[0], y = top + Math.floor(i / cols) * cell - arm.pivot[1];
        dx[i] += weight[i] * (cos * x - sin * y);
        dy[i] += weight[i] * (sin * x + cos * y);
      }
    }
    for (const i of patches) {
      const x0 = (i % cols) * cell, y0 = Math.floor(i / cols) * cell;
      for (let row = 0; row < cell; row++) {
        const t = row / cell, i1 = i + cols;
        const sx = dx[i] * (1 - t) + dx[i1] * t, sy = dy[i] * (1 - t) + dy[i1] * t;
        const stepX = (dx[i + 1] * (1 - t) + dx[i1 + 1] * t - sx) / cell;
        const stepY = (dy[i + 1] * (1 - t) + dy[i1 + 1] * t - sy) / cell;
        const dest = (y0 + row) * w + x0;
        for (let col = 0; col < cell; col++) {
          const x = Math.max(0, Math.min(w - 1, x0 + col + sx + col * stepX));
          const y = Math.max(0, Math.min(h - 1, y0 + row + sy + col * stepY));
          const ix = Math.min(w - 2, x | 0), iy = Math.min(h - 2, y | 0), j = iy * w + ix, k = j + w;
          if (words[j] === words[j + 1] && words[j] === words[k] && words[j] === words[k + 1]) {
            out[dest + col] = words[j];
            continue;
          }
          const fx = x - ix, fy = y - iy;
          const a = (1 - fx) * (1 - fy) * rgba[4 * j + 3], b = fx * (1 - fy) * rgba[4 * (j + 1) + 3];
          const c = (1 - fx) * fy * rgba[4 * k + 3], d = fx * fy * rgba[4 * (k + 1) + 3];
          const alpha = a + b + c + d, target = (dest + col) * 4;
          output.data[target + 3] = alpha;
          if (!alpha) continue;
          for (let ch = 0; ch < 3; ch++) {
            output.data[target + ch] = (rgba[4 * j + ch] * a + rgba[4 * (j + 1) + ch] * b +
              rgba[4 * k + ch] * c + rgba[4 * (k + 1) + ch] * d) / alpha;
          }
        }
      }
    }
    ctx.putImageData(output, left, top);
  }
  return { canvas, move };
}
