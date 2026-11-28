import * as THREE from "three";
import { archRails, archSpan, benchXs, benchZ, festoonRows, gardenFloorY, gardenFlowerClusters, noise, pathX, pavilion, treeTrunks } from "./garden-ground";
import { createGardenBorders } from "./garden-borders";

const TAU = Math.PI * 2;
const blooms = ["#fffefa", "#f4f3ed", "#eae9e4", "#faf8f2"];
const greens = ["#527567", "#78957f", "#a4b395", "#729788"];
/** Painted gravel, clipped grass and soft contact shadows share one ground draw. */
function gardenGround() {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 1536;
  const ctx = tile.getContext("2d")!;
  const size = 44;
  ctx.scale(tile.width / size, tile.height / size);
  ctx.translate(size / 2, size / 2);
  ctx.fillStyle = "#efede7";
  ctx.fillRect(-22, -22, 44, 44);
  for (let i = 0; i < 470; i++) {
    ctx.fillStyle = i % 2 ? "#fffefa63" : "#d6d5ce48";
    ctx.beginPath();
    ctx.ellipse(noise(i + 4) * size - 22, noise(i + 520) * size - 22, .3 + noise(i + 74) * 1.2, .1 + noise(i + 98) * .55, .2, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = "round";
  const avenue = new Path2D();
  for (let z = -12; z <= 11; z += .15) {
    if (z === -12) avenue.moveTo(pathX(z), z);
    else avenue.lineTo(pathX(z), z);
  }
  const loop = new Path2D();
  loop.ellipse(0, .9, 6.85, 5.1, -.15, 0, TAU);
  for (const [path, width] of [[loop, 1.3], [avenue, 2.2]] as const) {
    ctx.strokeStyle = "#d2cfc6"; ctx.lineWidth = width + .16; ctx.stroke(path);
    ctx.strokeStyle = "#faf8f2"; ctx.lineWidth = width; ctx.stroke(path);
  }
  for (let i = 0; i < 2350; i++) {
    const x = noise(i + 200) * 34 - 17, z = noise(i + 3540) * 34 - 17;
    ctx.fillStyle = i % 3 ? "#fffefa59" : "#a7a39628";
    ctx.beginPath(); ctx.ellipse(x, z, .018 + noise(i) * .06, .024, .35, 0, TAU); ctx.fill();
  }
  // Sparse pencil strokes sit in the grass or gravel, following the drawn paths.
  for (let i = 0; i < 7200; i++) {
    const x = (noise(i + 5100) - .5) * 20, z = (noise(i + 13500) - .5) * 19;
    const loopX = .989 * x - .149 * (z - .9), loopZ = .149 * x + .989 * (z - .9);
    const onLoop = Math.abs(Math.hypot(loopX / 6.85, loopZ / 5.1) - 1) < .105;
    const gravel = onLoop || Math.abs(x - pathX(z)) < 1.08;
    ctx.fillStyle = gravel ? (i % 2 ? "#bab5a987" : "#ffffffb0") : (i % 2 ? "#b7b5ac78" : "#fffefa9e");
    ctx.beginPath();
    ctx.ellipse(x, z, gravel ? .023 : .056, .014, i * .83, 0, TAU);
    ctx.fill();
  }
  // Broken edges, hairline cracks and a mossy lip read from the dog's low viewpoint.
  for (let i = 0; i < 43; i++) {
    const z = i * .52 - 11, x = pathX(z) + Math.sin(i * 2.6) * .29;
    ctx.save(); ctx.translate(x, z); ctx.rotate(Math.sin(i) * .35);
    const rx = .37 + noise(i + 9) * .15, rz = .21 + noise(i + 7) * .06;
    const points = Array.from({length: 8}, (_, k) => {
      const a = k * TAU / 8, r = .82 + noise(k + i * 8) * .28;
      return [rx * r * Math.cos(a), rz * r * Math.sin(a)];
    });
    const stone = new Path2D();
    stone.moveTo((points[0][0] + points[7][0]) / 2, (points[0][1] + points[7][1]) / 2);
    points.forEach(([px, pz], k) => {
      const next = points[(k + 1) % 8];
      stone.quadraticCurveTo(px, pz, (px + next[0]) / 2, (pz + next[1]) / 2);
    });
    stone.closePath();
    ctx.translate(.018, .038); ctx.fillStyle = "#c4c1b7"; ctx.fill(stone); ctx.translate(-.018, -.038);
    ctx.fillStyle = ["#e5e2da", "#e1ded6", "#e9e6df", "#edeae2"][i % 4];
    ctx.fill(stone); ctx.strokeStyle = "#f9f7f2"; ctx.lineWidth = .018; ctx.stroke(stone);
    ctx.clip(stone);
    for (let fleck = 0; fleck < 24; fleck++) {
      ctx.fillStyle = fleck % 3 ? "#9c988d45" : "#ffffff94";
      ctx.fillRect((noise(i*29+fleck)-.5)*rx*2, (noise(i*37+fleck+600)-.5)*rz*2, .017+noise(fleck)*.028, .014);
    }
    if (i % 3 === 0) {
      ctx.beginPath(); ctx.moveTo(-rx, -.09); ctx.lineTo(-rx * .55, -.07); ctx.lineTo(-rx * .32, -.12);
      ctx.strokeStyle = "#bab6ab"; ctx.stroke();
    }
    ctx.restore();
  }
  for (let i = 0; i < 240; i++) {
    const z = noise(i + 86) * 22 - 11, x = pathX(z) + (noise(i + 550) - .5) * 2.6;
    ctx.fillStyle = i % 2 ? "#d8d6ce" : "#fffefa";
    ctx.beginPath(); ctx.ellipse(x, z, .045, .022, i, 0, TAU); ctx.fill();
  }
  for (const { x, z } of treeTrunks) {
    const shade = ctx.createRadialGradient(x, z, 0, x, z, 2.1);
    shade.addColorStop(0, "#9d989170"); shade.addColorStop(1, "#9d989100");
    ctx.fillStyle = shade; ctx.fillRect(x - 2.1, z - 2.1, 4.2, 4.2);
  }
  const texture = new THREE.CanvasTexture(tile);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Dry washes and short leaf marks wrap around each crown, like ink on tinted paper.
function canopyPaper() {
  const sheet = document.createElement("canvas");
  sheet.width = 512; sheet.height = 256;
  const ctx = sheet.getContext("2d")!;
  const wash = ctx.createLinearGradient(0, 28, 0, 231);
  wash.addColorStop(0, "#fffefd"); wash.addColorStop(.52, "#faf9f6"); wash.addColorStop(1, "#dddad5");
  ctx.fillStyle = wash; ctx.fillRect(0,0,512,256);
  ctx.lineCap = "round";
  for (let i = 0; i < 38; i++) {
    const x = 18 + noise(i + 830) * 476, y = 63 + noise(i + 550) * 143;
    for (let j = 0; j < 3; j++) {
      const xx = x + j * 5, yy = y + 3 * Math.sin(j + i);
      ctx.beginPath(); ctx.moveTo(xx,yy); ctx.quadraticCurveTo(xx+1,yy-4,xx+4.7,yy-5);
      ctx.lineWidth = i % 2 ? 1.6 : 2.2; ctx.strokeStyle = i % 3 ? "#8886807a" : "#ffffffc4"; ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(sheet); map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// The canvas gores meet along raised seams and end in a scalloped ivory valance.
function pavilionCanopy() {
  const positions: number[] = [], colors: number[] = [];
  type Vertex = [number, number, number];
  const color = new THREE.Color();
  function triangle(a: Vertex, b: Vertex, c: Vertex, tint: string) {
    positions.push(...a, ...b, ...c);
    color.set(tint);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  }
  const position = (a: number, r: number, y: number): Vertex => [Math.cos(a) * r, y, Math.sin(a) * r];
  for (let gore = 0; gore < 16; gore++) {
    const tint = gore % 2 ? "#e6e8e5" : "#faf8f2";
    const mid = gore * TAU / 16;
    for (let j = 0; j < 4; j++) {
      const a = mid + j * TAU / 64, b = a + TAU / 64;
      const seam = (n: number) => Math.sin(n * Math.PI / 4);
      const shoulderA = position(a, 1.18, .43 + .057 * seam(j));
      const shoulderB = position(b, 1.18, .43 + .057 * seam(j + 1));
      const hemA = position(a, 1.88, .04), hemB = position(b, 1.88, .04);
      triangle([0,1.12,0], shoulderB, shoulderA, tint);
      triangle(shoulderA, shoulderB, hemB, tint);
      triangle(shoulderA, hemB, hemA, tint);
      const lowA = position(a, 1.875, -.035 - .11 * seam(j));
      const lowB = position(b, 1.875, -.035 - .11 * seam(j + 1));
      triangle(hemA, hemB, lowB, "#eeebe3");
      triangle(hemA, lowB, lowA, "#eeebe3");
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

export function createGardenLandscape(scene: THREE.Scene, redraw: () => void = () => {}, multisampled = false) {
  const root = new THREE.Group();
  root.name = "Wedding garden";
  scene.add(root);
  const previousBackground = scene.background, previousFog = scene.fog;
  const sky = document.createElement("canvas");
  sky.width = 1; sky.height = 128;
  const ink = sky.getContext("2d")!;
  const wash = ink.createLinearGradient(0, 0, 0, 128);
  wash.addColorStop(0, "#fffefd"); wash.addColorStop(.55, "#faf8f2"); wash.addColorStop(1, "#efede7");
  ink.fillStyle = wash; ink.fillRect(0, 0, 1, 128);
  const skyTexture = new THREE.CanvasTexture(sky);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTexture;
  scene.fog = new THREE.FogExp2("#f8f7f3", .031);
  const sun = new THREE.DirectionalLight("#fffcf5", 1.20);
  sun.position.set(-7, 11, 5);
  root.add(sun, new THREE.HemisphereLight("#fffefd", "#dcd9d4", 1.95));

  const groundTexture = gardenGround();
  const groundGeometry = new THREE.PlaneGeometry(44, 44);
  const groundPaint = new THREE.MeshBasicMaterial({ map: groundTexture });
  const ground = new THREE.Mesh(groundGeometry, groundPaint);
  ground.rotation.x = -Math.PI / 2; ground.position.y = gardenFloorY;
  root.add(ground);
  const borders = createGardenBorders(redraw, multisampled);
  root.add(borders.mesh);

  const foliage = new THREE.SphereGeometry(1, 9, 6);
  const crownMap = canopyPaper(), crownPaint = new THREE.MeshLambertMaterial({ map: crownMap, emissive: "#575652" });
  const bud = new THREE.SphereGeometry(1, 6, 4);
  const pole = new THREE.CylinderGeometry(1, 1, 1, 7);
  const rib = new THREE.TorusGeometry(1, .029, 6, 45, Math.PI);
  const paint = new THREE.MeshLambertMaterial();
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const timber = new THREE.BoxGeometry(1, 1, 1);
  const shapes = [foliage, leaf, bud, pole, rib, timber];
  type Point = [number, number, number];
  type Planting = { matrix: THREE.Matrix4; color: string; guests: number };
  const shapesToPlant = new Map<THREE.BufferGeometry, Planting[]>(shapes.map(shape => [shape, []]));
  const model = new THREE.Object3D();
  function record(shape: THREE.BufferGeometry, color: string, guests = 0) {
    model.updateMatrix();
    shapesToPlant.get(shape)!.push({ matrix: model.matrix.clone(), color, guests });
  }
  function place(shape: THREE.BufferGeometry, color: string, at: Point, scale: Point, turn = 0, tilt = 0, guests = 0) {
    model.position.set(...at); model.scale.set(...scale); model.rotation.set(0, turn, tilt);
    record(shape, color, guests);
  }
  const vector = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function branch(a: Point, b: Point, radius: number, color: string, guests = 0) {
    vector.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    model.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    model.scale.set(radius, vector.length(), radius);
    model.quaternion.setFromUnitVectors(up, vector.normalize());
    record(pole, color, guests);
  }
  function blossom(x: number, y: number, z: number, radius: number, color: string, guests = 0) {
    // Five cupped petals face forward and up, toward the approaching visitor.
    for (let p = 0; p < 5; p++) {
      const a = p * TAU / 5 + .3;
      place(bud, color, [x + Math.cos(a) * radius * .56, y + Math.sin(a) * radius * .47, z - Math.sin(a) * radius * .25],
        [radius * .52, radius * .50, radius * .32], a * .3, a, guests);
    }
    place(bud, "#c7bea5", [x, y, z + radius * .14], [radius * .25, radius * .25, radius * .24], 0, 0, guests);
  }

  // The inked front print sits against this open frame. Its spring line
  // and foot spacing match the original invitation's illustrated arch.
  const span = archSpan, spring = 2.40, rise = 1.26;
  for (const z of archRails) {
    for (const side of [-1, 1]) {
      branch([side * span, .03, z], [side * span, spring, z], .036, "#65786e");
      place(timber, "#a5b29b", [side * span, .06, z], [.34, .10, .20]);
    }
    place(rib, "#889b86", [0, spring, z], [span, rise, .83]);
  }
  for (let i = 0; i <= 10; i++) {
    const angle = i * Math.PI / 10;
    const x = Math.cos(angle) * span, y = spring + Math.sin(angle) * rise;
    branch([x, y, archRails[0]], [x, y, archRails[1]], .022, "#a9b39b");
  }

  // Surrounding trees keep the low camera inside the garden even on its return walk.
  for (const [i, { x, z, angle: a }] of treeTrunks.entries()) {
    const h = 2.3 + noise(i + 11) * 1.5, crown = i % 4 === 0 ? ["#ebe7e5", "#f6f3ef", "#fffdfa"] : ["#e5e5e2", "#f1f0ec", "#faf9f6"];
    branch([x, 0, z], [x + .13, h, z], .14, "#c0bbb1");
    for (let j = 0; j < 5; j++) {
      const t = j * 2.4 + i, r = j ? 1.02 : 0;
      const tx = x + Math.sin(t) * r, tz = z + Math.cos(t) * r, ty = h + (j ? 0 : .94) + noise(i + j) * .4;
      if (j > 0) {
        const fork: Point = [x + (tx-x)*.42, h*.60, z + (tz-z)*.42];
        branch([x+.06,h*.31,z], fork, .082, "#b8b4ab");
        branch(fork, [tx,ty-.18,tz], .057, "#c9c5bc");
        branch(fork, [tx+.43*Math.cos(t),ty-.55,tz+.43*Math.sin(t)], .034, "#d6d2ca");
      }
      const tall = .94 + noise(i + j) * .39;
      place(foliage, crown[j % 3], [tx, ty, tz], [1.18, tall, 1.13], t, .12);
      // A few irregular lobes share the same wash, keeping the distant silhouette soft.
      for (let k = 0; k < 3; k++) {
        const angle = t + k * TAU / 3, level = -.29 + noise(i * 85 + j * 7 + k) * .62;
        const radius = .53 + noise(i * 55 + j * 12 + k) * .23;
        place(foliage, crown[(j+k)%3], [tx+Math.cos(angle)*.86,ty+level*tall,tz+Math.sin(angle)*.85],
          [radius,radius*.82,radius*.96], angle,.14);
      }
    }
    // A separate, muted ridge prevents visible gaps in the horizon between trees.
    place(bud, i % 2 ? "#e2e2de" : "#eae8e3", [x * 1.82, -.22, z * 1.82], [5.4, 2.6 + noise(i) * 1.7, 4.7], a);
  }

  for (let i = 0; i < 11; i++) {
    const a = i * TAU / 11, x = Math.cos(a) * 24, z = Math.sin(a) * 24, y = 6.2 + noise(i) * 3.8;
    for (let j = -1; j < 3; j++) {
      place(bud, "#fffdfa", [x + j * .88, y + .18 * Math.cos(j), z + j * .61], [1.45, .32 + noise(i + j) * .3, 1.02]);
    }
  }
  // A canvas-roofed summerhouse anchors the west end of the walk.
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) * TAU / 8, x = pavilion.x + Math.cos(a) * pavilion.radius, z = pavilion.z + Math.sin(a) * pavilion.radius;
    branch([x, 0, z], [x, 2.18, z], .053, "#e5e0d5");
  }
  // A timber gallery wraps the summerhouse, with an open doorway facing the lawn.
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) * TAU / 8, b = a + TAU / 8;
    const x = pavilion.x + Math.cos(a) * pavilion.radius, z = pavilion.z + Math.sin(a) * pavilion.radius;
    const ex = pavilion.x + Math.cos(b) * pavilion.radius, ez = pavilion.z + Math.sin(b) * pavilion.radius;
    branch([x, 2.13, z], [ex, 2.13, ez], .07, "#e9e4dc");
    branch([x, 1.78, z], [x * .68 + ex * .32, 2.12, z * .68 + ez * .32], .032, "#cfc9bf");
    if (Math.cos((a + b) / 2) > .55) continue;
    for (const y of [.23, .83]) branch([x, y, z], [ex, y, ez], .041, "#dbd6cd");
    for (let picket = 1; picket < 5; picket++) {
      const t = picket / 5, px = x * (1-t) + ex * t, pz = z * (1-t) + ez * t;
      branch([px,.23,pz], [px,.83,pz], .024, "#eae7df");
    }
  }
  const canopy = pavilionCanopy();
  canopy.position.set(pavilion.x, 2.12, pavilion.z);
  root.add(canopy);
  place(bud, "#b49564", [pavilion.x, 3.32, pavilion.z], [.09, .16, .09]);
  for (const x of benchXs) {
    const z = benchZ;
    for (const offset of [-.74, .74]) {
      const px = x + offset;
      branch([px, 0, z + .02], [px, .92, z - .11], .047, "#6f8178");
      branch([px, 0, z + .42], [px, .61, z + .34], .043, "#75887e");
      branch([px, .58, z + .36], [px, .71, z + .25], .038, "#7a8c7f");
      branch([px, .71, z + .25], [px, .71, z -.07], .036, "#7a8c7f");
      place(bud, "#baa980", [px, .96, z -.11], [.061,.081,.061]);
    }
    for (const y of [.67, .82]) place(timber, "#dad8c7", [x, y, z - .072], [1.49, .108, .078]);
    for (const dz of [.04, .19, .34]) place(timber, "#dfd5c0", [x, .45, z + dz], [1.68, .074, .12]);
    place(timber, "#8c9b89", [x,.38,z+.34],[1.57,.075,.067]);
  }

  // Two draped strings cross the reception above the heads of all the guests.
  for (const z of festoonRows) {
    for (const side of [-1, 1]) branch([8.4 * side, .02, z], [8.4 * side, 4.1, z], .055, "#9a896a");
    for (let i = 0; i < 20; i++) {
      const x = -8.4 + i * .84, next = x + .84;
      const y = (v: number) => 3.21 + .89 * (v / 8.4) ** 2;
      branch([x, y(x), z], [next, y(next), z], .014, "#8b846d");
      if (i % 4 === 3 && Math.abs(x) >= 1.6) {
        branch([x, y(x), z], [x, y(x) - .10, z], .024, "#938169");
        place(bud, "#f9ecd1", [x, y(x) - .16, z], [.065, .082, .065]);
      }
    }
  }

  // Each wish reveals another planting. Established beds frame the scene at zero guests.
  for (const [i, { x, z, guests: threshold }] of gardenFlowerClusters.entries()) {
    for (let j = 0; j < 4; j++) {
      const a = j * 1.7 + i;
      place(leaf, greens[(i + j) % 4], [x + Math.sin(a) * .12, .135, z + Math.cos(a) * .12],
        [.083, .17, .072], a, .56 * Math.cos(a), threshold);
    }
    for (let j = 0; j < 3; j++) {
      const dx = (noise(i * 3 + j + 8) - .5) * .39, dz = (noise(i * 3 + j + 629) - .5) * .34;
      const y = .22 + noise(i + j * 13) * .24;
      branch([x + dx * .45, .08, z + dz * .5], [x + dx, y, z + dz], .014, "#69866b", threshold);
      blossom(x + dx, y, z + dz, .086 + noise(i + j) * .048, blooms[(i + j) % 4], threshold);
    }
  }

  // An instance prefix per shape lets a new arrival bloom without rebuilding the garden.
  const batches = Array.from(shapesToPlant, ([shape, placements]) => {
    placements.sort((a, b) => a.guests - b.guests);
    const mesh = new THREE.InstancedMesh(shape, shape === foliage ? crownPaint : paint, placements.length);
    const color = new THREE.Color();
    placements.forEach((item, i) => { mesh.setMatrixAt(i, item.matrix); mesh.setColorAt(i, color.set(item.color)); });
    mesh.computeBoundingSphere();
    root.add(mesh);
    return { mesh, thresholds: placements.map(p => p.guests) };
  });
  function setGuestCount(total: number) {
    for (const { mesh, thresholds } of batches) {
      const firstHidden = thresholds.findIndex(count => count > total);
      mesh.count = firstHidden < 0 ? thresholds.length : firstHidden;
    }
  }
  setGuestCount(0);
  return { root, setGuestCount, dispose() {
    scene.remove(root);
    scene.background = previousBackground; scene.fog = previousFog;
    for (const { mesh } of batches) mesh.dispose();
    for (const shape of shapes) shape.dispose();
    paint.dispose(); groundGeometry.dispose(); groundPaint.dispose();
    crownMap.dispose(); crownPaint.dispose();
    canopy.geometry.dispose(); canopy.material.dispose();
    borders.dispose(); skyTexture.dispose(); groundTexture.dispose();
  } };
}
