import { GUESTS_PER_SCENE } from "../lib/garden.ts";
import { closestGroundPoint, gardenObstacles, guestFootRadius, guestGroundHome } from "./garden-ground.ts";

export { worldX, worldZ } from "./garden-ground.ts";
type Point = { x: number; z: number };
const places = Array.from({ length: GUESTS_PER_SCENE }, (_, i) => guestGroundHome(i));
const couplePlace = guestGroundHome(-1);
// Clip the personal walking area along the line between two places. Every
// segment stays on its guest's side even when the next invitation fills a slot.
function strollRoute(ordinal: number) {
  const slot = ordinal % GUESTS_PER_SCENE, home = places[slot];
  const points = [home];
  for (let corner = 0; corner < 3; corner++) {
    const angle = ordinal * 2.4 + corner * Math.PI * 2 / 3;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    let reach = 1.45;
    function leaveSpace(neighbour: Point, boundary: number) {
      const x = neighbour.x - home.x, z = neighbour.z - home.z;
      const distance = Math.hypot(x, z), towards = x * dx + z * dz;
      if (towards > 0) reach = Math.min(reach, Math.max(0, boundary) * distance / towards);
    }
    places.forEach((other, i) => {
      if (i !== slot) leaveSpace(other, (Math.hypot(other.x - home.x, other.z - home.z) - .74) / 2);
    });
    leaveSpace(couplePlace, Math.hypot(couplePlace.x - home.x, couplePlace.z - home.z) - 1.06);
    // A tangent at the closest point keeps the whole route, including diagonal
    // corner-to-corner legs, on the clear side of each planted or built object.
    for (const obstacle of gardenObstacles) {
      const nearest = closestGroundPoint(home.x, home.z, obstacle);
      const clearance = Math.hypot(nearest.x - home.x, nearest.z - home.z) - obstacle.radius - guestFootRadius;
      if (clearance < 1.45) leaveSpace(nearest, clearance);
    }
    points.push({ x: home.x + dx * reach, z: home.z + dz * reach });
  }

  const legs = points.map((from, i) => {
    const to = points[(i + 1) % points.length], distance = Math.hypot(to.x - from.x, to.z - from.z);
    const walk = Math.max(1.6, distance / (.34 + (ordinal % 4) * .035));
    const pause = 2.1 + (ordinal * 3 + i * 7) % 5;
    return { from, to, walk, pause, steps: Math.max(2, Math.round(distance / .22)) };
  });
  const duration = legs.reduce((total, leg) => total + leg.walk + leg.pause, 0);
  return { home, legs, duration };
}

// Each guest keeps their own clock. Holding it while the dog visits allows
// them to continue the same step after the conversation.
export function createGuestStroll(ordinal: number) {
  const { home, legs, duration } = strollRoute(ordinal);
  const firstWait = ((ordinal * 13) % 19) * .21;
  return (seconds: number) => {
    let t = Math.max(0, seconds - firstWait) % duration;
    for (const { from, to, walk, pause, steps } of legs) {
      if (t < walk) {
        const p = t / walk, eased = p * p * (3 - 2 * p);
        const stride = Math.sin(eased * Math.PI * steps) * Math.min(1, p * 8, (1 - p) * 8);
        return { x: from.x + (to.x - from.x) * eased, z: from.z + (to.z - from.z) * eased, stride };
      }
      if (t < walk + pause) return { ...to, stride: 0 };
      t -= walk + pause;
    }
    return { ...home, stride: 0 };
  };
}
