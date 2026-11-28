import * as THREE from "three";
import { partyActions, GUESTS_PER_SCENE, guestPresentation, spriteForOrdinal } from "../lib/garden";
import { DOG_HOME, dogDestination, type DogPoint, type DogVisitor } from "../lib/dog-tour";
import { publicPath } from "../lib/public-path";
import { guestDanceFrame, guestDrawing, guestGesture, prepareGuestGreeting } from "./guest-greeting";
import { createGardenLandscape } from "./garden-landscape";
import { whiteBouquet, whiteGuestFlowers } from "./garden-flower-print";
import { createGuestStroll, worldX, worldZ } from "./guest-stroll";
import { gardenFloorY, guestGroundHome } from "./garden-ground";
import { gardenCameraPath, gardenEyeHeight as eyeHeight, gardenViewBlocked } from "./garden-camera-path";

export type GardenWalkState = {
  visitors: DogVisitor[];
  total: number;
  dog: DogPoint;
  target: number | null;
  moving: boolean;
  reduced: boolean;
  reading: boolean;
  ambient: boolean;
};

export function createGardenWalk(
  canvas: HTMLCanvasElement,
  onReady: () => void,
  onFail: () => void,
  onPick: (ordinal: number) => void,
) {
  const context = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "low-power" });
  if (!context) return;
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(53, 1, .075, 100);
  const landscape = createGardenLandscape(scene, requestDraw, !!context.getContextAttributes()?.antialias);
  const actors = new Map<number, THREE.Sprite>();
  const hitMasks = new WeakMap<THREE.Sprite, Uint8ClampedArray>();
  const maskSize = 64;
  type GuestArt = {
    sprite: number;
    still: HTMLImageElement | HTMLCanvasElement;
    stroll: ReturnType<typeof createGuestStroll>;
    pose?: Awaited<ReturnType<typeof prepareGuestGreeting>>;
    requested: boolean;
    seconds: number;
    stride: number;
    lastPaint: number;
    armStep: number;
    footStep: number;
    danceFrame: number;
  };
  const guests = new Map<THREE.Sprite, GuestArt>();
  const projected = new THREE.Vector3();
  let lastTime: number | undefined;
  let readingTime = 0;
  let danceSeconds = 0;
  let ambientTimer = 0;

  function paintGuest(actor: THREE.Sprite, art: GuestArt, arms: number, stride: number, danceFrame = -1) {
    const texture = actor.material.map;
    if (!texture) return;
    const armStep = Math.round(arms * 14), footStep = Math.round(stride * 10);
    if (armStep === art.armStep && footStep === art.footStep && danceFrame === art.danceFrame) return;
    const posed = armStep !== 0 || footStep !== 0 || danceFrame >= 0;
    if (posed && !art.pose) {
      if (!art.requested) {
        art.requested = true;
        void prepareGuestGreeting(art.sprite, art.still).then(pose => {
          if (guests.get(actor) !== art || disposed || failed) return;
          art.pose = pose;
          art.lastPaint = -Infinity;
          requestDraw();
        }).catch(() => { /* Keep the painted still when the optional pose layers are unavailable. */ });
      }
      return;
    }
    texture.image = posed ? art.pose!(armStep / 14, footStep / 10, danceFrame) : art.still;
    texture.needsUpdate = true;
    art.armStep = armStep;
    art.footStep = footStep;
    art.danceFrame = danceFrame;
  }

  function moveGuests(target: THREE.Sprite | undefined, elapsed: number) {
    for (const [actor, art] of guests) {
      if (actor === target) {
        art.stride *= Math.max(0, 1 - elapsed * 8);
        continue;
      }
      art.seconds += elapsed;
      const step = art.stroll(art.seconds);
      actor.position.x = step.x;
      actor.position.z = step.z;
      art.stride = step.stride;
    }
  }

  const softEdge = document.createElement("canvas");
  softEdge.width = softEdge.height = 32;
  const ink = softEdge.getContext("2d")!;
  const shade = ink.createRadialGradient(16, 16, 0, 16, 16, 16);
  shade.addColorStop(0, "rgba(64,60,48,.38)");
  shade.addColorStop(1, "rgba(64,60,48,0)");
  ink.fillStyle = shade;
  ink.fillRect(0, 0, 32, 32);
  const shadowMap = new THREE.CanvasTexture(softEdge);
  shadowMap.colorSpace = THREE.SRGBColorSpace;
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  shadowGeometry.rotateX(-Math.PI / 2);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
  const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, (GUESTS_PER_SCENE + 1) * 3);
  shadows.count = 0;
  shadows.renderOrder = -1;
  shadows.frustumCulled = false;
  scene.add(shadows);
  const foot = new THREE.Object3D();
  type Sole = { x: number; y: number; width: number };
  const contact = new THREE.Vector3();
  function updateShadows() {
    const right = camera.matrixWorld.elements;
    shadows.count = 0;
    foot.rotation.y = camera.rotation.y;
    function stamp(x: number, z: number, width: number, depth: number) {
      foot.position.set(x, gardenFloorY + .003, z);
      foot.scale.set(width, 1, depth);
      foot.updateMatrix();
      shadows.setMatrixAt(shadows.count++, foot.matrix);
    }
    for (const [ordinal, actor] of actors) {
      if (!actor.visible) continue;
      const soles = actor.userData.soles as Sole[];
      const offset = actor.userData.footOffset as number;
      stamp(actor.position.x + offset * right[0], actor.position.z + offset * right[2],
        ordinal < 0 ? 1.45 : .78, ordinal < 0 ? .55 : .32);
      for (const sole of soles) {
        // The far shoe can be slightly higher on the page. Project its ink
        // along the viewing ray so the contact falls underneath that shoe.
        contact.set(actor.position.x + sole.x * right[0] + sole.y * right[4],
          actor.position.y + sole.y * right[5], actor.position.z + sole.x * right[2] + sole.y * right[6]);
        const along = (camera.position.y - gardenFloorY) / (camera.position.y - contact.y);
        stamp(camera.position.x + (contact.x - camera.position.x) * along,
          camera.position.z + (contact.z - camera.position.z) * along, sole.width, .14);
      }
    }
    shadows.instanceMatrix.needsUpdate = true;
  }

  camera.position.set(worldX(DOG_HOME.left), eyeHeight, worldZ(DOG_HOME.bottom) + 2.05);
  camera.rotation.set(.024, 0, 0, "YXZ");
  const raycaster = new THREE.Raycaster();
  const portraitDistance = 2.85;
  let state: GardenWalkState | undefined;
  let frame = 0, drawn = false;
  let approach: {
    dogStart: THREE.Vector2; dogEnd: THREE.Vector2;
    route: { x: number; z: number; length: number }[]; distance: number; endPitch: number;
    startYaw: number; turn: number; startPitch: number;
  } | undefined;
  let inView = false, disposed = false, failed = false;

  function fail() {
    if (disposed || failed) return;
    failed = true;
    cancelAnimationFrame(frame);
    clearTimeout(ambientTimer);
    frame = 0;
    onFail();
  }

  function requestDraw() {
    if (!disposed && !failed && inView && !document.hidden && !frame) frame = requestAnimationFrame(draw);
  }

  function addActor(ordinal: number, path: string, flip: boolean) {
    // Opaque petals and furniture write depth. A nearer flower can hide a shoe
    // while the guest continues to cover the scenery behind them.
    const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    const home = guestGroundHome(ordinal);
    sprite.position.set(home.x, gardenFloorY + .002, home.z);
    sprite.userData.ordinal = ordinal;
    sprite.userData.inkRadius = ordinal < 0 ? 1 : .60;
    actors.set(ordinal, sprite);
    scene.add(sprite);

    const image = new Image();
    image.src = publicPath(path);
    void image.decode().then(() => {
      if (disposed || failed || actors.get(ordinal) !== sprite) return;
      const spriteIndex = ordinal < 0 ? -1 : spriteForOrdinal(ordinal);
      const still = ordinal === -1 ? whiteBouquet(image) : whiteGuestFlowers(spriteIndex, image);
      const texture = new THREE.Texture(still);
      if (ordinal >= 0) {
        guests.set(sprite, { sprite: spriteIndex, still, stroll: createGuestStroll(ordinal),
          seconds: 0, stride: 0, requested: false, lastPaint: -Infinity, armStep: 0, footStep: 0, danceFrame: -1 });
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      if (flip) {
        texture.repeat.x = -1;
        texture.offset.x = 1;
      }
      texture.needsUpdate = true;
      sprite.material.map = texture;
      sprite.material.needsUpdate = true;
      const height = ordinal === -1 ? 2.05 : 1.89;
      sprite.scale.set(height * image.naturalWidth / image.naturalHeight, height, 1);
      // Raycast UVs cover the entire transparent source sheet. Only painted pixels select a guest.
      const thumb = document.createElement("canvas");
      const width = image.naturalWidth, sourceHeight = image.naturalHeight;
      thumb.width = width;
      thumb.height = Math.ceil(sourceHeight * .14);
      const ctx = thumb.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(image, 0, thumb.height - sourceHeight);
      const soles = ctx.getImageData(0, 0, width, thumb.height).data;
      const lowest = new Int16Array(width).fill(-1);
      let bottom = 0;
      for (let x = 0; x < width; x++) {
        for (let y = thumb.height - 1; y >= 0; y--) {
          if (soles[(y * width + x) * 4 + 3] <= 100) continue;
          lowest[x] = y; bottom = Math.max(bottom, y); break;
        }
      }
      sprite.center.set(.5, (thumb.height - 1 - bottom) / sourceHeight);
      const bands: { left: number; right: number; y: number }[] = [];
      for (let x = 0; x < width; x++) {
        if (lowest[x] < bottom - sourceHeight * .025) continue;
        const prev = bands[bands.length - 1];
        if (!prev || x - prev.right > 4) bands.push({ left: x, right: x, y: lowest[x] });
        else { prev.right = x; prev.y = Math.max(prev.y, lowest[x]); }
      }
      const contacts = bands.sort((a,b) => (b.right-b.left) - (a.right-a.left)).slice(0,2).map(b => ({
        x: ((b.left + b.right + 1) / (2 * width) - .5) * sprite.scale.x * (flip ? -1 : 1),
        y: (bottom - b.y) * height / sourceHeight,
        width: (b.right - b.left + 1) * sprite.scale.x / width + .1,
      }));
      sprite.userData.soles = contacts;
      sprite.userData.footOffset = contacts.reduce((sum, c) => sum + c.x, 0) / (contacts.length || 1);
      thumb.width = thumb.height = maskSize;
      ctx.drawImage(image, 0, 0, maskSize, maskSize);
      const pixels = ctx.getImageData(0, 0, maskSize, maskSize).data;
      hitMasks.set(sprite, pixels);
      let reach = 0;
      for (let i = 0; i < maskSize * maskSize; i++) {
        if (pixels[i * 4 + 3] > 64) reach = Math.max(reach, Math.abs((i % maskSize + .5) / maskSize - .5));
      }
      sprite.userData.inkRadius = reach * sprite.scale.x + .07;
      sprite.visible = true;
      updateShadows();
      requestDraw();
    }).catch(() => {
      if (actors.get(ordinal) === sprite) fail();
    });
  }

  function removeActor(ordinal: number, sprite: THREE.Sprite) {
    guests.delete(sprite);
    actors.delete(ordinal);
    scene.remove(sprite);
    sprite.material.map?.dispose();
    sprite.material.dispose();
  }

  function syncGuests(visitors: DogVisitor[]) {
    const live = new Set(visitors.map(visitor => visitor.ordinal));
    for (const [ordinal, sprite] of actors) {
      if (ordinal >= 0 && !live.has(ordinal)) removeActor(ordinal, sprite);
    }
    for (const visitor of visitors) {
      if (actors.has(visitor.ordinal)) continue;
      const id = spriteForOrdinal(visitor.ordinal);
      const pose = guestPresentation(id, visitor.left, visitor.direction);
      addActor(visitor.ordinal, guestDrawing(id), pose.flip);
    }
    updateShadows();
  }

  function beginApproach(guest: DogVisitor, start: DogPoint) {
    const ground = actors.get(guest.ordinal)?.position ?? guestGroundHome(guest.ordinal);
    const { x: gx, z: gz } = ground, startAt = { x: camera.position.x, z: camera.position.z };
    const cx = startAt.x - gx, cz = startAt.z - gz;
    const arrivalYaw = Math.hypot(cx, cz) > .25 ? Math.atan2(cx, cz) : camera.rotation.y;
    const stops = [];
    for (let i = 0; i < 24; i++) {
      const offset = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12;
      const yaw = arrivalYaw + offset, sx = Math.sin(yaw), sz = Math.cos(yaw);
      const stop = { x: gx + sx * portraitDistance, z: gz + sz * portraitDistance };
      let score = Math.abs(offset);
      if (gardenViewBlocked(ground, stop, 1.5, .27, state!.total)) score += 24;
      if (gardenViewBlocked(ground, stop, .8, .26, state!.total)) score += 12;
      if (gardenViewBlocked(ground, stop, .08, .22, state!.total)) score += 7;
      for (const [ordinal, actor] of actors) {
        if (ordinal === guest.ordinal) continue;
        const x = actor.position.x - gx, z = actor.position.z - gz;
        const depth = x * sx + z * sz;
        if (depth <= .06 || depth > portraitDistance + .45) continue;
        const width = ordinal < 0 ? .93 : .68;
        const clearance = Math.abs(x * sz - z * sx);
        if (clearance < width) score += 2.6 * (1 - clearance / width);
      }
      stops.push({ stop, yaw, score });
    }
    let path = [startAt], bestYaw = arrivalYaw;
    for (const { stop, yaw } of stops.sort((a,b) => a.score - b.score)) {
      const openPath = gardenCameraPath(startAt, stop);
      if (openPath) { path = openPath; bestYaw = yaw; break; }
    }
    let distance = 0;
    const route = path.map((p, i) => {
      if (i) distance += Math.hypot(p.x - path[i-1].x, p.z - path[i-1].z);
      return { ...p, length: distance };
    });
    const end = path[path.length - 1];
    const endPitch = Math.atan2(.98 - eyeHeight, Math.hypot(end.x - gx, end.z - gz));
    const destination = dogDestination(guest);
    const delta = bestYaw - camera.rotation.y;
    return {
      dogStart: new THREE.Vector2(worldX(start.left), worldZ(start.bottom)),
      dogEnd: new THREE.Vector2(worldX(destination.left), worldZ(destination.bottom)),
      route, distance, endPitch,
      startYaw: camera.rotation.y, turn: Math.atan2(Math.sin(delta), Math.cos(delta)), startPitch: camera.rotation.x,
    };
  }

  function update(next: GardenWalkState) {
    if (disposed || failed) return;
    const before = state;
    const changedPlace = !before || before.dog.left !== next.dog.left || before.dog.bottom !== next.dog.bottom;
    state = next;
    if (before?.total !== next.total) landscape.setGuestCount(next.total);
    if (before?.visitors !== next.visitors) syncGuests(next.visitors);
    if (before?.target !== next.target || !next.reading) readingTime = 0;
    if (before?.ambient !== next.ambient) lastTime = undefined;
    if (next.target === null) approach = undefined;
    else if (before?.target !== next.target || !approach) {
      const visitor = next.visitors.find(item => item.ordinal === next.target);
      approach = visitor ? beginApproach(visitor, before?.dog ?? DOG_HOME) : undefined;
    }
    if (before?.visitors !== next.visitors || changedPlace || before?.target !== next.target ||
        before?.reading !== next.reading || before?.ambient !== next.ambient || before?.reduced !== next.reduced || before?.moving !== next.moving || before?.total !== next.total) requestDraw();
  }

  function draw(time: number) {
    frame = 0;
    clearTimeout(ambientTimer);
    if (!state || !inView || disposed || failed || document.hidden || !canvas.clientHeight || !canvas.clientWidth) return;
    const target = state.target === null ? undefined : actors.get(state.target);
    const elapsed = lastTime === undefined ? 0 : Math.min(.12, (time - lastTime) / 1000);
    lastTime = time;
    const ambient = state.ambient && !state.reduced;
    if (ambient && guests.size) {
      danceSeconds += elapsed;
      moveGuests(target, elapsed);
    }
    if (state.reading && !state.reduced) readingTime += elapsed;
    if (approach && target) {
      const { dogStart, dogEnd, route, distance, endPitch, startYaw, turn, startPitch } = approach;
      const dx = dogEnd.x - dogStart.x, dz = dogEnd.y - dogStart.y;
      const x = worldX(state.dog.left) - dogStart.x, z = worldZ(state.dog.bottom) - dogStart.y;
      const lengthSquared = dx * dx + dz * dz;
      const progress = lengthSquared < .0001 ? 1 : THREE.MathUtils.clamp((x * dx + z * dz) / lengthSquared, 0, 1);
      // Use the guide's eased progress along a ground route that clears planting and furniture.
      const travelled = progress * distance;
      const next = route.findIndex(p => p.length >= travelled);
      const to = route[next < 0 ? route.length - 1 : next], from = route[Math.max(0, next - 1)];
      const t = to.length > from.length ? (travelled - from.length) / (to.length - from.length) : 0;
      camera.position.set(THREE.MathUtils.lerp(from.x, to.x, t), eyeHeight, THREE.MathUtils.lerp(from.z, to.z, t));
      camera.rotation.set(THREE.MathUtils.lerp(startPitch, endPitch, progress),
        startYaw + turn * progress, 0, "YXZ");
    }

    camera.updateMatrixWorld();
    updateShadows();
    const view = camera.matrixWorldInverse.elements;
    const sideways = (x: number, z: number) => view[0] * x + view[8] * z;
    const depth = (x: number, z: number) => -(view[2] * x + view[10] * z);
    const focusX = target ? target.position.x - camera.position.x : 0;
    const focusZ = target ? target.position.z - camera.position.z : 0;
    const focusDepth = depth(focusX, focusZ);
    for (const actor of actors.values()) {
      if (actor === target) {
        actor.material.opacity = 1;
        continue;
      }
      const x = actor.position.x - camera.position.x, z = actor.position.z - camera.position.z;
      const front = depth(x, z);
      let opacity = THREE.MathUtils.smoothstep(front, 1.35, 2.0);
      if (target && front > 0 && front < focusDepth) {
        const ratio = front / focusDepth;
        const separation = Math.abs(sideways(x, z) - sideways(focusX, focusZ) * ratio);
        const halfWidth = actor.userData.inkRadius + target.userData.inkRadius * ratio;
        opacity *= THREE.MathUtils.smoothstep(separation - halfWidth, 0, .28);
      }
      actor.material.opacity = opacity;
    }

    for (const [actor, art] of guests) {
      if (state.reduced) {
        paintGuest(actor, art, 0, 0);
        continue;
      }
      const greeting = actor === target && state.reading;
      if ((!ambient && !greeting) || actor.material.opacity < .05) continue;
      // Paint only figures that can contribute to the frame. Distant guests
      // need fewer painted poses; their ground position still updates smoothly.
      projected.copy(actor.position);
      projected.y += actor.scale.y / 2;
      projected.project(camera);
      if (projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > 1.6 || Math.abs(projected.y) > 1.7) continue;
      const dancing = partyActions[art.sprite] === "dance";
      const near = actor.position.distanceToSquared(camera.position) < 40;
      const interval = near ? (dancing ? 65 : 110) : (dancing ? 125 : 220);
      if (time - art.lastPaint < interval) continue;
      art.lastPaint = time;
      if (dancing) {
        if (ambient) paintGuest(actor, art, 0, 0, guestDanceFrame(art.sprite, danceSeconds, actor.userData.ordinal));
        continue;
      }
      const rest = greeting ? Math.max(0, readingTime - 3.8) : 0;
      const arm = greeting && !rest
        ? Math.sin(Math.PI * Math.min(1, readingTime / 2.8)) ** 2
        : guestGesture(art.sprite, art.seconds + rest + actor.userData.ordinal * .73) * (greeting ? Math.min(1, rest) : 1);
      paintGuest(actor, art, arm, art.stride);
    }
    try {
      renderer.render(scene, camera);
    } catch {
      fail();
      return;
    }
    if (!drawn && actors.get(-1)?.visible && [...actors.values()].every(actor => actor.visible)) {
      drawn = true;
      onReady();
    }
    if ((ambient && guests.size) || (state.reading && !state.reduced && readingTime < 3.1)) {
      ambientTimer = window.setTimeout(requestDraw, 32);
    }
  }

  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    // Resolve thin ink at screen density on phones while bounding the buffer on larger views.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(1_500_000 / (width * height)));
    renderer.setDrawingBufferSize(width, height, pixelRatio);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestDraw();
  }

  function visibilityChanged() {
    lastTime = undefined;
    clearTimeout(ambientTimer);
    cancelAnimationFrame(frame);
    frame = 0;
    requestDraw();
  }

  function sceneryInFront(distance: number) {
    raycaster.far = distance;
    try {
      return raycaster.intersectObject(landscape.root, true).some(hit => {
        const obj = hit.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        const map = obj.material.map;
        if (!obj.material.alphaTest || !map || !hit.uv || !(map.image instanceof HTMLCanvasElement)) return true;
        // The printed arch and flowers share a mesh. Empty paper around each
        // motif lets a tap through just as it lets the guest's ink show through.
        const uv = map.transformUv(hit.uv), sheet = map.image;
        const x = THREE.MathUtils.clamp(Math.floor(uv.x * sheet.width), 0, sheet.width - 1);
        const y = THREE.MathUtils.clamp(Math.floor(uv.y * sheet.height), 0, sheet.height - 1);
        return sheet.getContext("2d")!.getImageData(x, y, 1, 1).data[3] >= 128;
      });
    } finally { raycaster.far = Infinity; }
  }

  function pick(event: MouseEvent) {
    if (!drawn || failed || disposed) return;
    const bounds = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects([...actors.values()], false)) {
      const sprite = hit.object as THREE.Sprite;
      const mask = hitMasks.get(sprite), uv = hit.uv;
      if (!mask || !uv || sprite.material.opacity < .5 || !sprite.material.map) continue;
      sprite.material.map.transformUv(uv);
      const x = Math.min(maskSize - 1, Math.floor(uv.x * maskSize));
      const y = Math.min(maskSize - 1, Math.floor(uv.y * maskSize));
      const image = sprite.material.map.image;
      let alpha = mask[(y * maskSize + x) * 4 + 3];
      if (image instanceof HTMLCanvasElement) {
        const px = THREE.MathUtils.clamp(Math.floor(uv.x * image.width), 0, image.width - 1);
        const py = THREE.MathUtils.clamp(Math.floor(uv.y * image.height), 0, image.height - 1);
        alpha = image.getContext("2d")!.getImageData(px, py, 1, 1).data[3];
      }
      if (alpha < 40) continue;
      if (sceneryInFront(hit.distance)) return;
      if (sprite.userData.ordinal >= 0) onPick(sprite.userData.ordinal);
      return;
    }
  }

  function contextLost(event: Event) {
    event.preventDefault();
    fail();
  }
  const boundsObserver = new ResizeObserver(resize);
  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibilityChanged(); });
  observer.observe(canvas);
  boundsObserver.observe(canvas);
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("click", pick);
  document.addEventListener("visibilitychange", visibilityChanged);
  addActor(-1, "/assets/v10/couple.webp", false);
  resize();

  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(ambientTimer);
      boundsObserver.disconnect();
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("click", pick);
      document.removeEventListener("visibilitychange", visibilityChanged);
      for (const [ordinal, actor] of actors) removeActor(ordinal, actor);
      shadows.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      shadowMap.dispose();
      landscape.dispose();
      renderer.dispose();
    },
  };
}
