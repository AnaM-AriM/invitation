import * as THREE from "three";
import { publicPath } from "../lib/public-path";

export type GardenLight = "garden" | "sunset" | "night";
export type GardenView = { setLight: (light: GardenLight) => void; dispose: () => void };

const palettes = {
  garden: { sky: "#a2c9b5", middle: "#f8edbd", grass: "#84a98c", leaf: "#567f70", bloom: "#fff0c8", paper: "#fffdf6" },
  sunset: { sky: "#c37d8a", middle: "#ffc788", grass: "#c39984", leaf: "#916965", bloom: "#ffe7ba", paper: "#ffe7c8" },
  night: { sky: "#253750", middle: "#70839d", grass: "#586f73", leaf: "#344e59", bloom: "#fff1b9", paper: "#d7e4f1" },
};

function printedSky(image: HTMLImageElement, light: GardenLight) {
  const sheet = document.createElement("canvas");
  sheet.width = sheet.height = 640;
  const ctx = sheet.getContext("2d")!;
  const colors = palettes[light];
  const gradient = ctx.createLinearGradient(0, 0, 120, 640);
  gradient.addColorStop(0, colors.sky);
  gradient.addColorStop(.58, colors.middle);
  gradient.addColorStop(1, colors.grass);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 640);
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = light === "night" ? .42 : .52;
  ctx.drawImage(image, 0, 0, image.width, image.height * .77, 0, 0, 640, 640);
  const texture = new THREE.CanvasTexture(sheet);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function createGardenView(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<GardenView | undefined> {
  const paths = ["bg-garden", "bg-sunset", "bg-night", "decor/arch", "couple", "decor/daisies"];
  const images = await Promise.all(paths.map(async name => {
    const image = new Image();
    image.src = publicPath(`/assets/v10/${name}.webp`);
    await image.decode();
    return image;
  }));
  if (signal.aborted) return;

  const context = canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "low-power" });
  if (!context) return;
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 30);
  camera.position.z = 9;
  const resources = new Set<{ dispose(): void }>();
  function own<T extends { dispose(): void }>(item: T): T { resources.add(item); return item; }
  function material(parameters: THREE.MeshBasicMaterialParameters) {
    return own(new THREE.MeshBasicMaterial(parameters));
  }
  function mesh(geometry: THREE.BufferGeometry, paint: THREE.MeshBasicMaterial, x: number, y: number, z: number) {
    const item = new THREE.Mesh(geometry, paint);
    item.position.set(x, y, z);
    scene.add(item);
    return item;
  }

  const skies = {
    garden: own(printedSky(images[0], "garden")),
    sunset: own(printedSky(images[1], "sunset")),
    night: own(printedSky(images[2], "night")),
  };
  const plane = own(new THREE.PlaneGeometry(1, 1));
  const sky = material({ map: skies.garden });
  mesh(plane, sky, 0, 0, -1.7).scale.set(7.55, 7.55, 1);
  const sunPaint = material({ color: "#fff0c7" });
  const circle = own(new THREE.CircleGeometry(1, 54));
  const sun = mesh(circle, sunPaint, 1.03, 1.6, -1.45);
  const halo = mesh(own(new THREE.RingGeometry(.48, .49, 64)), sunPaint, 1.03, 1.6, -1.46);
  const moonShape = new THREE.Shape();
  moonShape.moveTo(.13, .33);
  moonShape.absarc(0, 0, .355, 1.20, 5.25, false);
  moonShape.quadraticCurveTo(-.13, -.015, .13, .33);
  const moon = mesh(own(new THREE.ShapeGeometry(moonShape)), sunPaint, 1.12, 1.56, -1.4);

  const artTextures = images.slice(3).map(image => {
    const texture = own(new THREE.Texture(image));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  });
  const art = artTextures.map(map => material({ map, transparent: true, depthWrite: false }));
  const arch = mesh(plane, art[0], 0, -.08, -.06);
  arch.scale.set(4.25, 4.45, 1);
  const couple = mesh(plane, art[1], 0, -.49, .55);
  couple.scale.set(3.48, 3.48, 1);
  const shade = material({ color: "#4a524a", transparent: true, opacity: .15, depthWrite: false });
  mesh(circle, shade, .04, -2.03, .14).scale.set(1.05, .105, 1);
  const inkShadow = material({ map: artTextures[1], color: "#413c37", opacity: .18, transparent: true, depthWrite: false });
  mesh(plane, inkShadow, .085, -.55, .32).scale.copy(couple.scale);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(-.22, .37, 0, .85);
  leafShape.quadraticCurveTo(.26, .38, 0, 0);
  const leaf = own(new THREE.ShapeGeometry(leafShape));
  const leafPaint = material({ color: palettes.garden.leaf, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const blade = mesh(leaf, leafPaint, side * (1.18 + i * .15), -2.47 + i * .035, 1 + i * .01);
      blade.rotation.z = side * (.5 - i * .12);
      blade.scale.setScalar(.56 + .32 * Math.sin(i * 1.35) + i * .07);
    }
    const flowers = mesh(plane, art[2], side * 1.84, -2.12 + side * .07, 1.17);
    flowers.scale.set(side * 1.19, 1.11, 1);
    flowers.rotation.z = side * -.18;
  }
  art[2].side = THREE.DoubleSide;
  const motePaint = material({ color: palettes.garden.bloom, side: THREE.DoubleSide });
  const star = new THREE.Shape();
  star.moveTo(0, 1); star.lineTo(.17, .18); star.lineTo(.7, 0); star.lineTo(.17, -.18);
  star.lineTo(0, -1); star.lineTo(-.17, -.18); star.lineTo(-.7, 0); star.lineTo(-.17, .18); star.closePath();
  const sparkle = own(new THREE.ShapeGeometry(star));
  const motes = Array.from({ length: 28 }, (_, i) => {
    const x = (((i * 37) % 83) / 83 - .5) * 5.15;
    const y = (((i * 53) % 97) / 97 - .5) * 4.9;
    const item = mesh(sparkle, motePaint, x, y, i % 4 === 0 ? .96 : -.85);
    return { item, x, y };
  });

  let light: GardenLight = "garden";
  let targetX = 0, targetY = 0, elapsed = 0, frame = 0, previous = 0;
  let onscreen = false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function draw() {
    const moving = !reduced.matches;
    camera.position.x = moving ? THREE.MathUtils.lerp(camera.position.x, targetX + .16 * Math.sin(elapsed * .36), .12) : 0;
    camera.position.y = moving ? THREE.MathUtils.lerp(camera.position.y, targetY + .065 * Math.sin(elapsed * .49), .12) : 0;
    camera.lookAt(0, 0, 0);
    motes.forEach(({ item, x, y }, i) => {
      const phase = elapsed * .38 + i * 2.4;
      item.visible = i < (light === "night" ? 28 : 13);
      item.position.x = x + .10 * Math.sin(phase);
      item.position.y = y + .14 * Math.cos(phase);
      item.rotation.z = light === "night" ? 0 : Math.sin(phase) * .7;
      item.scale.setScalar((light === "night" ? .048 : .032) * (1 + .34 * Math.sin(phase)));
    });
    renderer.render(scene, camera);
  }
  function tick(time: number) {
    if (time - previous >= 32) {
      elapsed += Math.min((time - previous) / 1000, .08);
      previous = time;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function updateLoop() {
    cancelAnimationFrame(frame);
    if (document.hidden || !onscreen) return;
    draw();
    previous = performance.now();
    if (!reduced.matches) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!document.hidden && onscreen) draw();
  }
  function setLight(next: GardenLight) {
    light = next;
    const palette = palettes[next];
    sky.map = skies[next];
    for (const paint of art) paint.color.set(palette.paper);
    leafPaint.color.set(palette.leaf);
    motePaint.color.set(palette.bloom);
    sun.visible = halo.visible = next !== "night";
    moon.visible = next === "night";
    sun.scale.setScalar(next === "sunset" ? .48 : .35);
    if (onscreen && !document.hidden) draw();
  }
  function point(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - .5) * 1.65;
    targetY = (.5 - (event.clientY - rect.top) / rect.height) * 1.1;
  }
  function center() { targetX = targetY = 0; }
  const bounds = new ResizeObserver(resize);
  const visibility = new IntersectionObserver(([entry]) => { onscreen = entry.isIntersecting; updateLoop(); });
  bounds.observe(canvas);
  visibility.observe(canvas);
  document.addEventListener("visibilitychange", updateLoop);
  reduced.addEventListener("change", updateLoop);
  canvas.addEventListener("pointermove", point, { passive: true });
  canvas.addEventListener("pointerdown", point, { passive: true });
  canvas.addEventListener("pointerleave", center);
  canvas.addEventListener("pointercancel", center);
  canvas.addEventListener("pointerup", center);
  const rect = canvas.getBoundingClientRect();
  onscreen = rect.bottom > 0 && rect.top < innerHeight;
  resize();
  setLight(light);
  updateLoop();
  return { setLight, dispose() {
    cancelAnimationFrame(frame);
    bounds.disconnect();
    visibility.disconnect();
    document.removeEventListener("visibilitychange", updateLoop);
    reduced.removeEventListener("change", updateLoop);
    canvas.removeEventListener("pointermove", point);
    canvas.removeEventListener("pointerdown", point);
    canvas.removeEventListener("pointerleave", center);
    canvas.removeEventListener("pointercancel", center);
    canvas.removeEventListener("pointerup", center);
    resources.forEach(resource => resource.dispose());
    renderer.dispose();
  } };
}
