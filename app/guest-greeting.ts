import { partyActions } from "../lib/garden";
import { guestInk } from "./guest-ink";
import { guestSteps } from "./guest-steps";
import rigs from "../lib/guest-parts.json";
import type { PaintedParts } from "./painted-arm";

// Use the same standing pose in the overview and the close-up, including the
// hand-to-chin drawing whose resting photograph has both hands in pockets.
export function guestDrawing(sprite: number) {
  return rigs[sprite].source;
}

// Twenty-four poses cover a two-step: transfer weight, dip, lift the free foot,
// then repeat on the other side. Both the overview and the dog use this beat.
export const danceFrames = 24;
export const dancePeriod = (sprite: number) => 2.15 + (sprite % 3) * .12;
export const danceOffset = (ordinal: number) => (ordinal * .269) % 1;
export function guestDanceFrame(sprite: number, seconds: number, ordinal: number) {
  return Math.floor(((seconds / dancePeriod(sprite) + danceOffset(ordinal)) % 1) * danceFrames);
}

// Each action follows its own phrasing. Between gestures the drawing rests.
export function guestGesture(sprite: number, seconds: number) {
  const phase = seconds / rigs[sprite].duration + sprite * .381966;
  const beat = phase - Math.floor(phase);
  const accent = (start: number, span: number, count = 1) => {
    const t = (beat - start) / span;
    if (t <= 0 || t >= 1) return 0;
    return Math.sin(Math.PI * t) ** 2 * Math.cos(2 * Math.PI * count * (t - .5));
  };
  switch (partyActions[sprite]) {
    case "clap": return accent(.04, .72, 3);
    case "music": return accent(.02, .93, 4);
    case "dance": return Math.sin(2 * Math.PI * beat);
    case "wave": return accent(.08, .79, 2);
    case "laugh": return accent(.12, .62, 2);
    case "photo": return accent(.19, .48, 0);
    case "petals": return accent(.09, .62, 1);
    case "toast": return accent(.05, .85, 0);
    case "chat": return accent(.04, .63) + .45 * accent(.70, .26, 0);
    default: return .65 * accent(.1, .85, 0);
  }
}

export async function prepareGuestGreeting(sprite: number, original: HTMLImageElement | HTMLCanvasElement, output?: HTMLCanvasElement) {
  const rig: PaintedParts = rigs[sprite];
  const [width, height] = rig.stage;
  const sheet = output ?? document.createElement("canvas");
  if (sheet.width !== width) sheet.width = width;
  if (sheet.height !== height) sheet.height = height;
  const ctx = sheet.getContext("2d")!;
  const ink = guestInk(rig, original);
  const drawBody = guestSteps(sprite, ink.canvas);
  return function pose(amount: number, stride = 0, danceFrame = -1) {
    const dancing = danceFrame >= 0;
    const phase = danceFrame * (2 * Math.PI / danceFrames);
    const sway = Math.sin(phase), dip = Math.cos(phase) ** 2;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (dancing) {
      const floor = height * .965;
      ctx.translate(width / 2 + sway * 9, floor);
      // The torso leans over the supporting shoe and the knees absorb each beat.
      ctx.transform(1, 0, -.078 * sway, 1 - .046 * dip, 0, 0);
      ctx.translate(-width / 2, -floor);
    }
    ink.move(dancing ? 0 : amount, dancing ? 7 * Math.sin(phase + .32) + 2 * Math.cos(2 * phase) : 0);
    drawBody(ctx, dancing ? Math.sin(phase - .30) * 1.70 : stride);
    ctx.restore();
    return sheet;
  };
}
