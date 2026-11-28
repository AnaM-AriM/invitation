import { gardenObstacles } from "./garden-ground.ts";

type Point = { x: number; z: number };
type Obstacle = (typeof gardenObstacles)[number];
export const gardenEyeHeight = .72;
const bodyRadius = .19;
const step = .42, cells = 49;
const at = (i: number): Point => ({ x: (i % cells - 24) * step, z: (Math.floor(i / cells) - 24) * step });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

function pointDistance2(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2;
}

// Closest distance between a ground path and the planted or built segment.
function crosses(a: Point, b: Point, o: Obstacle, margin: number) {
  const r = o.radius + margin;
  if (Math.max(a.x,b.x) < Math.min(o.ax,o.bx)-r || Math.min(a.x,b.x) > Math.max(o.ax,o.bx)+r ||
      Math.max(a.z,b.z) < Math.min(o.az,o.bz)-r || Math.min(a.z,b.z) > Math.max(o.az,o.bz)+r) return false;
  const dx = b.x - a.x, dz = b.z - a.z, ex = o.bx - o.ax, ez = o.bz - o.az;
  const det = dx * ez - dz * ex;
  if (det) {
    const t = ((o.ax - a.x) * ez - (o.az - a.z) * ex) / det;
    const u = ((o.ax - a.x) * dz - (o.az - a.z) * dx) / det;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return Math.min(pointDistance2(a.x,a.z,o.ax,o.az,o.bx,o.bz), pointDistance2(b.x,b.z,o.ax,o.az,o.bx,o.bz),
    pointDistance2(o.ax,o.az,a.x,a.z,b.x,b.z), pointDistance2(o.bx,o.bz,a.x,a.z,b.x,b.z)) < r * r;
}

const walkable = (a: Point, b: Point) => !gardenObstacles.some(o => crosses(a, b, o, bodyRadius));

export function gardenViewBlocked(guest: Point, camera: Point, height: number, halfWidth: number, total: number) {
  return gardenObstacles.some(o => {
    if ((o.guests ?? 0) > total || o.height < Math.min(height, gardenEyeHeight)) return false;
    // Only the part of the sightline below the top of this obstacle can be hidden.
    const t = Math.max(0, Math.min(1, (o.height - height) / (gardenEyeHeight - height)));
    const cut = { x: guest.x + (camera.x - guest.x) * t, z: guest.z + (camera.z - guest.z) * t };
    return height < gardenEyeHeight ? crosses(guest, cut, o, halfWidth) : crosses(cut, camera, o, halfWidth);
  });
}

// Connect a stop on open ground directly when possible. Otherwise use connected
// patches of lawn, then remove intermediate waypoints only across clear ground.
const neighbours = new Map<number, number[]>();
function exits(id: number) {
  const cached = neighbours.get(id);
  if (cached) return cached;
  const choices: number[] = [], a = at(id);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const x = id % cells + dx, z = Math.floor(id / cells) + dz;
    if ((!dx && !dz) || x < 0 || x >= cells || z < 0 || z >= cells) continue;
    const next = z * cells + x;
    if (walkable(a, at(next))) choices.push(next);
  }
  neighbours.set(id, choices);
  return choices;
}

function connections(p: Point) {
  const x = Math.round(p.x / step) + 24, z = Math.round(p.z / step) + 24;
  const ids: number[] = [];
  for (let j = Math.max(0,z-2); j <= Math.min(cells-1,z+2); j++) {
    for (let i = Math.max(0,x-2); i <= Math.min(cells-1,x+2); i++) {
      const id = j * cells + i;
      if (walkable(p, at(id))) ids.push(id);
    }
  }
  return ids;
}

export function gardenCameraPath(start: Point, end: Point): Point[] | undefined {
  if (walkable(start, end)) return [start, end];
  if (!walkable(end, end)) return;
  const goals = new Set(connections(end));
  if (!goals.size) return;
  const open = new Map<number, number>(), costs = new Map<number, number>(), parents = new Map<number, number>();
  for (const id of connections(start)) {
    const cost = distance(start, at(id));
    open.set(id, cost + distance(at(id), end));
    costs.set(id, cost);
  }
  while (open.size) {
    let current = -1, best = Infinity;
    for (const [id, score] of open) if (score < best) { current = id; best = score; }
    open.delete(current);
    if (goals.has(current)) {
      const reverse = [end, at(current)];
      while (parents.has(current)) { current = parents.get(current)!; reverse.push(at(current)); }
      reverse.push(start);
      const raw = reverse.reverse(), route = [start];
      for (let i = 0; i < raw.length - 1;) {
        let j = raw.length - 1;
        while (j > i + 1 && !walkable(raw[i], raw[j])) j--;
        route.push(raw[j]); i = j;
      }
      return route;
    }
    for (const id of exits(current)) {
      const cost = costs.get(current)! + distance(at(current), at(id));
      if (cost >= (costs.get(id) ?? Infinity)) continue;
      costs.set(id, cost); parents.set(id, current);
      open.set(id, cost + distance(at(id), end));
    }
  }
}
