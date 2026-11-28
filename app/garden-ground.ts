import { couple, GUESTS_PER_SCENE, guestSlots } from "../lib/garden.ts";

export const gardenFloorY = -.014;
export const worldX = (left: number) => (left - 50) * .16;
export const worldZ = (bottom: number) => 7 - bottom * .14;
export const pathX = (z: number) => 1.15 * Math.sin((z + 5.6) * .37);
export const noise = (n: number) => { const v = Math.sin(n * 127.1 + 21.7) * 43758.5453; return v - Math.floor(v); };
const tau = Math.PI * 2;
type Point = { x: number; z: number };
export type GroundObstacle = { ax: number; az: number; bx: number; bz: number; radius: number; height: number; guests: number };

function capsule(ax: number, az: number, bx: number, bz: number, radius: number, height: number, guests = 0): GroundObstacle {
  return { ax, az, bx, bz, radius, height, guests };
}
export function closestGroundPoint(x: number, z: number, obstacle: GroundObstacle): Point {
  const dx = obstacle.bx - obstacle.ax, dz = obstacle.bz - obstacle.az;
  const along = Math.max(0, Math.min(1, ((x - obstacle.ax) * dx + (z - obstacle.az) * dz) / (dx * dx + dz * dz || 1)));
  return { x: obstacle.ax + along * dx, z: obstacle.az + along * dz };
}
export function groundClearance(x: number, z: number, obstacle: GroundObstacle) {
  const closest = closestGroundPoint(x, z, obstacle);
  return Math.hypot(x - closest.x, z - closest.z) - obstacle.radius;
}

export const archSpan = 1.60;
export const archRails = [.82, 1.20] as const;
export const archPrintZ = 1.24;
export const pavilion = { x: -7.1, z: -4.5, radius: 1.49 };
export const benchZ = -3.36;
export const benchXs = [-3.45, 3.45];
export const festoonRows = [-3.9, 2.8];
export const treeTrunks = Array.from({ length: 23 }, (_, i) => {
  const angle = i * tau / 23 + .11;
  return { x: Math.cos(angle) * (10 + noise(i + 2) * 2), z: Math.sin(angle) * (9.4 + noise(i + 32) * 2), angle };
});

// Include the printed feet of the arch and the seat and arms of each bench.
// The air between the arch's uprights is open.
const fixtures = [capsule(pavilion.x, pavilion.z, pavilion.x, pavilion.z, pavilion.radius + .08, 3.30)];
for (const side of [-1, 1]) {
  fixtures.push(capsule(side * archSpan, archRails[0], side * archSpan, archPrintZ, .25, 2.72));
  for (const z of festoonRows) fixtures.push(capsule(side * 8.4, z, side * 8.4, z, .055, 4.1));
}
for (const x of benchXs) {
  fixtures.push(capsule(x - .82, benchZ + .15, x + .82, benchZ + .15, .31, .99));
}
for (const { x, z } of treeTrunks) fixtures.push(capsule(x, z, x + .13, z, .15, 3.8));

// The widest illustrated stance plus sway takes a little over half a world unit.
export const guestFootRadius = .62;
const coupleHome = { x: worldX(couple.left), z: worldZ(couple.bottom) };
const homes = guestSlots(GUESTS_PER_SCENE, 0).map(slot => {
  const home = { x: worldX(slot.left), z: worldZ(slot.bottom) };
  for (const obstacle of fixtures) {
    const nearest = closestGroundPoint(home.x, home.z, obstacle);
    const dx = home.x - nearest.x, dz = home.z - nearest.z, distance = Math.hypot(dx, dz);
    const margin = obstacle.radius + guestFootRadius + .06;
    if (distance < margin) {
      home.x = nearest.x + margin * (distance ? dx / distance : 1);
      home.z = nearest.z + margin * (distance ? dz / distance : 0);
    }
  }
  return home;
});
export function guestGroundHome(ordinal: number) { return ordinal < 0 ? coupleHome : homes[ordinal % homes.length]; }

// Grow the borders around all occupied places, including guests who will arrive later.
// Reserve a little room past the shoes so a crowded reception still has room to stroll.
const reserved = homes.map(p => ({ ...p, radius: guestFootRadius + .32 }));
reserved.push({ ...coupleHome, radius: 1.06 });
const stems: Point[] = [];
function canPlant(x: number, z: number, radius: number) {
  return reserved.every(p => Math.hypot(p.x - x, p.z - z) >= radius + p.radius) &&
    fixtures.every(obstacle => groundClearance(x, z, obstacle) >= radius) &&
    stems.every(p => Math.hypot(x - p.x, z - p.z) >= .22);
}
function bedPosition(x: number, z: number, radius: number, side: number): Point {
  // First follow the drift along the path, then move out into the side border.
  // Past the last guest and tree there is always open ground.
  for (let step = 0; ; step++) {
    for (let offset = 0; offset <= step; offset++) {
      const px = x + side * (step - offset) * .30;
      for (const sign of offset ? [-1, 1] : [1]) {
        const pz = z + sign * offset * .30;
        if (side * (px - pathX(pz)) < 1.12 + radius) continue;
        if (canPlant(px, pz, radius)) {
          const bed = { x: px, z: pz };
          stems.push(bed);
          return bed;
        }
      }
    }
  }
}

export const gardenObstacles = [...fixtures];
type FlowerCard = { kind: "sprig" | "planters" | "daisies"; panel: number; x: number; y: number; z: number; width: number; height: number; turn: number };
export const gardenFlowerCards: FlowerCard[] = [];
function flowerCard(kind: FlowerCard["kind"], panel: number, side: number, x: number, y: number, z: number, width: number, height: number, turn: number) {
  const depth = kind === "planters" ? .14 : .055;
  const bed = bedPosition(x, z, width / 2 + depth, side);
  gardenFlowerCards.push({ kind, panel, ...bed, y, width, height, turn });
  if (kind === "planters") reserved.push({ ...bed, radius: width / 2 + depth });
  const dx = Math.cos(turn) * width / 2, dz = Math.sin(turn) * width / 2;
  gardenObstacles.push(capsule(bed.x - dx, bed.z - dz, bed.x + dx, bed.z + dz, depth, y + height));
}
for (const side of [-1, 1]) flowerCard("planters", 0, side, side * 2.0, 0, 1.43, .8, .82, side * .31);
for (const side of [-1, 1]) {
  for (let i = 0; i < 31; i++) {
    if ((i + side + 1) % 10 > 6) continue;
    const z = -8.3 + i * .50 + side * .12, angle = i * 2.399 + side;
    const x = pathX(z) + side * (1.48 + .20 * Math.sin(angle));
    const panel = Math.floor((i + side + 1) / 4) % 3;
    flowerCard("sprig", panel, side, x, 0, z, .55 + .12 * Math.sin(angle), .29 + .13 * (1 + Math.cos(angle)), angle * .43);
    flowerCard("sprig", (panel + 1) % 3, side, x + .22 * side, 0, z + .14, .46, .31, angle + 1.2);
  }
  for (let i = 0; i < 26; i++) {
    const z = -6.1 + i * .53, x = side * (6.5 + .22 * Math.sin(i * 2.3));
    flowerCard("sprig", i % 7 < 4 ? 1 : 0, side, x, 0, z, .64, .4 + (i % 4) * .05, i * 1.87);
  }
  flowerCard("daisies", 0, side, side * 1.86, .025, 3.85 + side * .34, .54, .50, side * -.43);
  flowerCard("daisies", 0, side, side * 2.12, .03, .68, .48, .45, side * .54);
}
export const gardenFlowerClusters = Array.from({ length: 90 }, (_, i) => {
  const fixed = i < 46, index = fixed ? i : i - 46, side = index % 2 ? 1 : -1;
  const z = fixed ? -6.9 + noise(i + 25) * 15 : 2 - ((index * 4.33) % 9.8);
  const x = fixed ? side * (6.65 + noise(i + 317) * 1.3) : pathX(z) + side * (1.33 + noise(i + 32) * .42);
  const bed = bedPosition(x, z, .41, side), guests = fixed ? 0 : index + 1;
  gardenObstacles.push(capsule(bed.x, bed.z, bed.x, bed.z, .41, .61, guests));
  return { ...bed, guests };
});
