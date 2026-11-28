"use client";
import { useEffect, useId, useRef, type CSSProperties } from "react";
import type { GuestAction } from "../lib/garden";
import { publicPath } from "../lib/public-path";
import { flowerPaperTones, guestFlowerShapes, whiteGuestFlowers } from "./garden-flower-print";
import { guestDanceFrame, guestDrawing, guestGesture, prepareGuestGreeting } from "./guest-greeting";

type Props = { sprite: number; flip: boolean; action: GuestAction; ordinal: number; preview?: boolean; paused?: boolean; effects?: boolean };

// The overview shows up to 36 guests. Only visible, active drawings share
// this clock, and held frames keep their existing pixels.
const paintings = new Set<(elapsed: number) => void>();
let timer = 0, lastTick = 0;
function schedulePaints() {
  if (!paintings.size || timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    const now = performance.now();
    const elapsed = Math.min((now - lastTick) / 1000, .15);
    lastTick = now;
    for (const paint of paintings) paint(elapsed);
    schedulePaints();
  }, 1000 / 12);
}

// Preparing every rig in one image-decode callback can stall the opening of a
// crowded overview. Keep the original illustration visible as each rig initializes.
const preparations = new Set<() => void>();
let prepareFrame = 0;
function schedulePreparation() {
  if (!preparations.size || prepareFrame) return;
  prepareFrame = requestAnimationFrame(() => {
    prepareFrame = 0;
    const next = preparations.values().next().value;
    if (next) { preparations.delete(next); next(); }
    schedulePreparation();
  });
}

export default function GuestSprite({ sprite, flip, action, ordinal, preview = false, paused = false, effects = true }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "_");
  const flowerShape = guestFlowerShapes[sprite];
  const original = useRef<HTMLImageElement>(null), surface = useRef<HTMLCanvasElement>(null);
  const controls = useRef({ paused, effects });
  const refresh = useRef<() => void>(undefined);

  useEffect(() => {
    controls.current = { paused, effects };
    refresh.current?.();
  }, [paused, effects]);

  useEffect(() => {
    const canvas = surface.current, image = original.current;
    if (preview || !canvas || !image) return;
    const ink = canvas.getContext("2d");
    if (!ink) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let mounted = true, visible = false, decoding = false, preparing = false;
    let still: HTMLImageElement | HTMLCanvasElement | undefined;
    let pose: Awaited<ReturnType<typeof prepareGuestGreeting>> | undefined;
    let seconds = 0, lastPose: number | undefined;

    function paint(elapsed: number) {
      if (!pose) return;
      seconds += elapsed;
      const dance = action === "dance";
      const frame = dance ? guestDanceFrame(sprite, seconds, ordinal) : Math.round(guestGesture(sprite, seconds + ordinal * .73) * 14);
      if (frame === lastPose) return;
      pose(dance ? 0 : frame / 14, 0, dance ? frame : -1);
      lastPose = frame;
    }

    function rest() {
      if (!still || !canvas || !ink) return;
      ink.clearRect(0, 0, canvas.width, canvas.height);
      ink.drawImage(still, 0, 0);
      lastPose = undefined;
    }

    async function decodeStill() {
      if (!image || !canvas) return;
      decoding = true;
      try {
        await image.decode();
        if (!mounted) return;
        still = whiteGuestFlowers(sprite, image);
        rest();
        canvas.dataset.ready = "true";
        canvas.parentElement!.dataset.motionReady = "true";
        update();
      } catch { /* Keep the original image if the drawing cannot be prepared. */ }
    }

    async function preparePose() {
      if (!still || !canvas) return;
      preparing = true;
      try {
        const next = await prepareGuestGreeting(sprite, still, canvas);
        if (!mounted) return;
        pose = next;
        update();
      } catch {
        if (mounted) rest();
      }
    }

    function update() {
      const active = visible && !document.hidden;
      const motion = controls.current.effects && !media.matches;
      const playing = active && motion && !controls.current.paused;
      if (playing && pose) {
        if (!paintings.size) lastTick = performance.now();
        paintings.add(paint);
        paint(0);
        schedulePaints();
      } else {
        paintings.delete(paint);
        if (!paintings.size) { clearTimeout(timer); timer = 0; }
        if (!motion && lastPose !== undefined) rest();
      }
      if (active && !decoding) void decodeStill();
      if (playing && still && !pose && !preparing) {
        preparations.add(preparePose);
        schedulePreparation();
      } else {
        preparations.delete(preparePose);
      }
    }

    refresh.current = update;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(canvas);
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      mounted = false;
      refresh.current = undefined;
      preparations.delete(preparePose);
      paintings.delete(paint);
      canvas.dataset.ready = "false";
      if (canvas.parentElement) canvas.parentElement.dataset.motionReady = "false";
      if (!paintings.size) { clearTimeout(timer); timer = 0; }
      observer.disconnect();
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [sprite, action, ordinal, preview]);

  return <span className="guest-rig-facing" style={{ transform: flip ? "scaleX(-1)" : undefined }} aria-hidden="true">
   <span className="guest-rig" data-action={action} data-flowers={flowerShape ? true : undefined} data-preview={preview} data-motion="drawing" data-motion-ready="false" style={{ "--guest-flowers": flowerShape ? `url(#${id}-flowers)` : undefined } as CSSProperties}>
   {flowerShape && <svg aria-hidden="true" width="0" height="0" style={{position:"absolute"}}><defs>
    <filter id={`${id}-flowers`} x="0%" y="0%" width="100%" height="100%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
     <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -32 0 32 0 -.047" result="coolInk"/>
     <feColorMatrix in="SourceGraphic" type="matrix" values=".25 .5 .25 0 0 .25 .5 .25 0 0 .25 .5 .25 0 0 0 0 0 1 0"/>
     <feComponentTransfer result="paper"><feFuncR type="table" tableValues={flowerPaperTones.join(" ")}/><feFuncG type="table" tableValues={flowerPaperTones.join(" ")}/><feFuncB type="table" tableValues={flowerPaperTones.join(" ")}/></feComponentTransfer>
     <feImage href={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400"><path d="${flowerShape}"/></svg>`)}`} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="petals"/>
     <feComposite in="paper" in2="coolInk" operator="in"/><feComposite in2="petals" operator="in"/><feComposite in2="SourceGraphic" operator="atop"/>
    </filter>
   </defs></svg>}
   <img ref={original} className="guest-original" src={publicPath(guestDrawing(sprite))} alt="" width={320} height={400} draggable={false} loading={preview ? "lazy" : "eager"}/>
   {!preview && <canvas ref={surface} className={action === "dance" ? "guest-motion-canvas guest-dance-canvas" : "guest-motion-canvas"} width={320} height={400} data-ready="false"/>}
   </span>
  </span>;
}
