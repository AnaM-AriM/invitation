import * as THREE from "three";
import { publicPath } from "../lib/public-path";
import { archPrintZ, festoonRows, gardenFlowerCards, pavilion } from "./garden-ground";
import { whitenPetals } from "./garden-flower-print";

const cell = 256;
const tau = Math.PI * 2;

// Four botanical studies on a single transparent sheet. Their stems and petals
// stay legible in the very near foreground of the dog's walk.
function botanicalSheet() {
  const sheet = document.createElement("canvas");
  sheet.width = cell * 4;
  sheet.height = cell * 4;
  const ctx = sheet.getContext("2d")!;
  ctx.lineCap = "round";

  function stem(x: number, y: number, dx: number, dy: number, color: string, width: number) {
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * .28, y + dy * .55, x + dx, y + dy);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function leaf(x: number, y: number, dx: number, dy: number, width: number, color: string, petal = false) {
    const length = Math.hypot(dx, dy), nx = -dy / length * width, ny = dx / length * width;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * .52 + nx, y + dy * .52 + ny, x + dx, y + dy);
    ctx.quadraticCurveTo(x + dx * .55 - nx, y + dy * .55 - ny, x, y); ctx.fill();
    if (petal) { ctx.strokeStyle = "#aca99e"; ctx.lineWidth = 1.1; ctx.stroke(); }
  }

  for (let panel = 0; panel < 4; panel++) {
    ctx.save();
    ctx.translate(panel * cell, 0);
    ctx.beginPath(); ctx.rect(2, 2, cell - 4, cell - 4); ctx.clip();
    if (panel === 3) {
      // Two trailing eucalyptus sprays joined at the top of the festoon.
      for (const side of [-1, 1]) {
        const length = side === 1 ? 166 : 224;
        for (let i = 0; i < 7; i++) {
          const t = i / 7, x = 126 + side * (28 * t + 42 * t * t), y = 7 + length * t;
          const next = (i + 1) / 7;
          stem(x, y, side * (28 * (next - t) + 42 * (next * next - t * t)), length / 7 + 1, "#62795b", 3);
          const spread = 13 + (1 - t) * 33;
          leaf(x, y + 8, side * spread, 20 + 8 * t, 13 - i, i % 2 ? "#8aa17c" : "#617f6c");
          leaf(x, y + 14, -side * spread * .82, 24, 12 - i, i % 2 ? "#a9b995" : "#80997a");
        }
      }
    } else {
      for (let i = 0; i < 15; i++) {
        const x = 63 + (i * 31) % 129, dx = (i % 2 ? 1 : -1) * (18 + i % 5 * 9);
        leaf(x, 254, dx, -(39 + i * 29 % 94), 6 + i % 5, ["#78917a", "#4f776b", "#9caf82"][i % 3]);
      }
      for (let i = 0; i < (panel === 2 ? 8 : 7); i++) {
        const x = 31 + i * 27, baseX = 85 + i * 12, y = 54 + (i * 39 + 29) % 83;
        const dx = x - baseX, dy = y - 250;
        stem(baseX, 250, dx, dy, "#638370", 3);
        for (const t of [.28, .52, .66]) {
          const sign = (i + Math.round(t * 10)) % 2 ? 1 : -1;
          leaf(baseX + dx * (.56 * t + .44 * t * t), 250 + dy * t, sign * (22 + i % 3 * 5), -19, 5, "#83a082");
        }
        if (panel === 0) {
          const radius = 11 + i % 3 * 2;
          for (let p = 0; p < 9; p++) {
            const a = p * tau / 9 + i;
            ctx.fillStyle = p % 3 ? "#fffefa" : "#e9e7e0";
            ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * radius * .59, y + Math.sin(a) * radius * .48,
              radius * .68, radius * .27, a, 0, tau); ctx.fill();
            ctx.strokeStyle = "#b9b5a9"; ctx.lineWidth = .8; ctx.stroke();
          }
          ctx.fillStyle = "#beb49a"; ctx.beginPath(); ctx.ellipse(x, y, 4.7, 4, 0, 0, tau); ctx.fill();
        } else if (panel === 1) {
          for (let k = 0; k < 6; k++) {
            const spread = 8.5 - k;
            for (const side of [-1, 1]) {
              leaf(x + k * dx * .02, y - k * 6, side * spread, -10, 5 - k * .38,
                ["#d3d1cb", "#efede8", "#fffefa"][(k + i + (side + 1) / 2) % 3], true);
            }
          }
        } else {
          for (let k = 0; k < 5; k++) {
            const side = k % 2 ? -1 : 1;
            leaf(x + k * dx * .025, y - k * 5, side * (12 - k), -15, 3.8, k % 3 ? "#e2dfd6" : "#fffdf8", true);
          }
        }
      }
    }
    ctx.restore();
  }
  return sheet;
}

// Normalized page coordinates in the shared print sheet; two cells preserve the ink on the arch.
const stationery = {
  arch: [0, 1, 2, 2], lanterns: [2, 1, 1, 1], planters: [3, 1, 1, 1],
  bunting: [2, 2, 2, 1], daisies: [0, 3, 1, 1],
} as const;
type Tile = readonly [number, number, number, number];

export function createGardenBorders(redraw: () => void, multisampled: boolean) {
  const positions: number[] = [], uv: number[] = [], faces: number[] = [];
  function card(tile: Tile, x: number, y: number, z: number, width: number, height: number, turn = 0) {
    const i = positions.length / 3, dx = Math.cos(turn) * width / 2, dz = Math.sin(turn) * width / 2;
    positions.push(x-dx,y,z-dz, x+dx,y,z+dz, x+dx,y+height,z+dz, x-dx,y+height,z-dz);
    const [column, row, w, h] = tile;
    const left = (column + .008) / 4, right = (column + w - .008) / 4;
    const top = 1 - (row + .008) / 4, bottom = 1 - (row + h - .008) / 4;
    uv.push(left,bottom, right,bottom, right,top, left,top);
    faces.push(i,i+1,i+2, i,i+2,i+3);
  }
  function sprig(panel: number, x: number, y: number, z: number, width: number, height: number, turn: number) {
    card([panel, 0, 1, 1], x, y, z, width, height, turn);
  }
  for (const { kind, panel, x, y, z, width, height, turn } of gardenFlowerCards) {
    if (kind === "sprig") sprig(panel, x, y, z, width, height, turn);
    else card(stationery[kind], x, y, z, width, height, turn);
  }
  for (const z of festoonRows) {
    for (let i = 1; i < 20; i += 2) {
      const x = -8.4 + i * .84, y = 3.21 + .89 * (x / 8.4) ** 2;
      const h = .37 + .14 * (1 + Math.sin(i + z));
      if (Math.abs(x) < 1.6) continue;
      if (i % 4 === 1) {
        const tie = x + (z < 0 ? .51 : 0);
        const wireHeight = 3.21 + .89 * (tie / 8.4) ** 2;
        card(stationery.lanterns, tie, wireHeight - .60, z, .57, .64, .14 * Math.cos(i));
      } else {
        sprig(3, x + .11, y - h, z, .61, h, -.26 + .42 * Math.cos(i));
      }
    }
  }
  // The original inked arch dresses the front of the open metal frame.
  card(stationery.arch, 0, -.04, archPrintZ, 4.08, 3.95);
  // The bunting ties to the two front bays of the timber summerhouse.
  for (let bay = 0; bay < 2; bay++) {
    const a = (bay + .5) * tau / 8, b = a + tau / 8;
    const x1 = pavilion.x + Math.cos(a)*pavilion.radius, z1 = pavilion.z + Math.sin(a)*pavilion.radius;
    const x2 = pavilion.x + Math.cos(b)*pavilion.radius, z2 = pavilion.z + Math.sin(b)*pavilion.radius;
    card(stationery.bunting, (x1+x2)/2, 1.67, (z1+z2)/2, Math.hypot(x2-x1,z2-z1), .47, Math.atan2(z2-z1,x2-x1));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(faces);
  const sheet = botanicalSheet();
  const map = new THREE.CanvasTexture(sheet);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  let disposed = false;
  // The garden renders immediately, and each recovered original is painted independently.
  for (const [name, [col, row, width, height]] of Object.entries(stationery)) {
    const original = new Image();
    original.src = publicPath(`/assets/v10/decor/${name}.webp`);
    void original.decode().then(() => {
      if (disposed) return;
      const ctx = sheet.getContext("2d")!;
      const x = col * cell, y = row * cell, w = width * cell, h = height * cell;
      ctx.drawImage(original, x + 2, y + 2, w - 4, h - 4);
      // Print the black outlines in the soft charcoal used on the character paper.
      const patch = ctx.getImageData(x,y,w,h);
      if (name === "arch" || name === "planters" || name === "daisies") whitenPetals(patch.data);
      for (let i = 0; i < patch.data.length; i += 4) {
        const shade = Math.max(0, 1 - Math.max(patch.data[i], patch.data[i+1], patch.data[i+2]) / 128);
        patch.data[i] += 45 * shade; patch.data[i+1] += 54 * shade; patch.data[i+2] += 47 * shade;
      }
      ctx.putImageData(patch,x,y);
      map.needsUpdate = true;
      redraw();
    }).catch(() => { /* The solid arbor and planted beds are already drawn. */ });
  }
  const material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, alphaTest: .14, alphaToCoverage: multisampled });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, dispose() { disposed = true; geometry.dispose(); material.dispose(); map.dispose(); } };
}
