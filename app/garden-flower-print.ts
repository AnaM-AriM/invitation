// The stationery uses cool blue and lilac ink for petals and warm green for leaves.
// Blend that ink into ivory while retaining the original linework and paper grain.
export function whitenPetals(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const blend = Math.min(1, Math.max(0, (8 * b - 4 * r - 4 * g - 44) / 255));
    if (blend === 0 || pixels[i + 3] === 0) continue;
    const paper = 155 + .18 * r + .16 * g + .06 * b;
    pixels[i] += (paper - r) * blend;
    pixels[i + 1] += (paper - 1 - g) * blend;
    pixels[i + 2] += (paper - 5 - b) * blend;
  }
}

// The same blend expressed as an SVG color matrix for the illustrated overview.
export const whitePetalMatrix = `
  .18 .16 .06 0 ${155 / 255}
  .18 .16 .06 0 ${154 / 255}
  .18 .16 .06 0 ${150 / 255}
   -4  -4   8 0 ${-44 / 255}
`;

export function whiteBouquet(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ink = canvas.getContext("2d")!;
  ink.drawImage(image, 0, 0);
  // The hand-held bouquet is confined to the bride's side of the couple print.
  const left = Math.floor(canvas.width * .28), top = Math.floor(canvas.height * .49);
  const bouquet = ink.getImageData(left, top, Math.ceil(canvas.width * .2), Math.ceil(canvas.height * .16));
  whitenPetals(bouquet.data);
  ink.putImageData(bouquet, left, top);
  return canvas;
}

// Petal silhouettes on the 320 × 400 master drawings. The basket cutouts follow
// the upper edge of the ribbon so the painted blue bows keep their cloth color.
export const guestFlowerShapes: Partial<Record<number, string>> = {
  5: "M187 132Q187 125 193 126Q198 123 202 127Q206 126 206 132Q210 133 209 138Q209 142 204 142Q205 149 199 149Q195 150 193 146Q188 149 186 144Q184 141 188 138Q184 136 187 132Z",
  6: "M173 24H216V68H173Z",
  9: "M155 110H179V133H155Z",
  16: "M96 35H122V65H96Z",
  17: "M106 249L108 241L114 237L120 240L124 237L129 236L134 240L138 238L141 244L140 248L134 248L130 252L109 252Z M210 134H278V209H210Z",
  20: "M119 112L126 112L134 117L135 122L132 128L123 128L119 123Z",
  22: "M114 224L115 215L119 211L124 212L129 209L133 209L138 212L143 210L147 214L150 219L143 219L138 222L136 225Z M221 141H275V224H221Z",
  28: "M95 55L99 49L103 48L105 42L110 40L113 35L119 34L122 36L127 34L132 36L135 42L134 46L136 50L130 55L125 57L119 60L114 61L108 64L102 65L98 61Z",
  32: "M132 159H162V188H132Z",
  35: "M184 111H203V131H184Z",
  36: "M127 120H156V150H127Z",
  42: "M84 43H117V83H84Z",
};

// Lift pale petal washes into paper white; the first entries preserve dark ink.
export const flowerPaperTones = [0, .12, .25, .4, .64, .84, .944, .981, 1];

export function whiteGuestFlowers(sprite: number, image: HTMLImageElement) {
  const shape = guestFlowerShapes[sprite];
  if (!shape) return image;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fill(new Path2D(shape));
  const mask = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  const print = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = print.data;
  for (let i = 0; i < pixels.length; i += 4) {
    if (!mask[i + 3] || !pixels[i + 3]) continue;
    const value = (.25 * pixels[i] + .5 * pixels[i + 1] + .25 * pixels[i + 2]) * 8 / 255;
    const index = Math.min(7, Math.floor(value));
    const paper = 255 * (flowerPaperTones[index] + (flowerPaperTones[index+1] - flowerPaperTones[index]) * (value - index));
    // Cool flower paint is distinct from the warm skin and cream cloth inside
    // an accessory's outline. Neutral black seams keep their original ink.
    const pigment = Math.min(1, Math.max(0, (32 * (pixels[i + 2] - pixels[i]) - 12) / 255));
    const weight = pigment * mask[i + 3] / 255;
    for (let c = 0; c < 3; c++) pixels[i + c] += (paper - pixels[i + c]) * weight;
  }
  ctx.putImageData(print, 0, 0);
  return canvas;
}
