import type { GardenData, Wish } from "../lib/garden.ts";
import { validateWish } from "../lib/validation.ts";
export type Submission = { requestId: string; name: string; message: string };
export type Acknowledgment = { requestId: string; comment: Wish; total: number };
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function isWish(value: unknown): value is Wish {
  return record(value) && Number.isSafeInteger(value.id) && Number(value.id) > 0 && typeof value.name === "string" && typeof value.message === "string" && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt));
}
function error(value: unknown): string { return record(value) && typeof value.error === "string" ? value.error : "방명록 응답을 확인하지 못했어요. 같은 내용으로 다시 시도해 주세요."; }
export function parseGarden(value: unknown): GardenData {
  if (!record(value) || !Number.isSafeInteger(value.total) || Number(value.total) < 0 || !Number.isSafeInteger(value.page) || Number(value.page) < 0 || !Number.isSafeInteger(value.scene) || Number(value.scene) < 0 || !Array.isArray(value.comments) || !value.comments.every(isWish) || value.comments.length > 6 || !Array.isArray(value.guests) || !value.guests.every(isWish) || value.guests.length > 36) throw new Error(error(value));
  return value as unknown as GardenData;
}
export function confirmAcknowledgment(value: unknown, pending: Submission): Acknowledgment {
  if (!record(value) || value.requestId !== pending.requestId || !isWish(value.comment) || value.comment.name !== pending.name || value.comment.message !== pending.message || !Number.isSafeInteger(value.total) || Number(value.total) < 1) throw new Error(error(value));
  return value as unknown as Acknowledgment;
}
export function prepareSubmission(name: string, message: string, previous?: Submission): Submission {
  const requestId = previous && previous.name === name.trim() && previous.message === message.trim() ? previous.requestId : crypto.randomUUID();
  const validated = validateWish({ requestId, name, message });
  if (validated.error) throw new Error(validated.error);
  return validated.data!;
}
export async function readGuestbook(endpoint: string, page: number, scene: number, signal?: AbortSignal): Promise<GardenData> {
  const url = new URL(endpoint); url.searchParams.set("page", String(page)); url.searchParams.set("scene", String(scene));
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) throw new Error("방명록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return parseGarden(await response.json());
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export async function postGuestbook(endpoint: string, pending: Submission): Promise<Acknowledgment> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: new URLSearchParams(pending).toString(), redirect: "follow", signal: controller.signal });
    if (!response.ok) throw new Error("저장 여부를 확인하지 못했어요. 같은 내용으로 다시 시도해 주세요.");
    return confirmAcknowledgment(await response.json(), pending);
  } finally { clearTimeout(timer); }
}
export function calendarFile(title: string, start: string, end: string, venue: string): string {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r/g, "");
  const date = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wedding Invitation//KO", "BEGIN:VEVENT", `UID:wedding-${date(start)}@invitation.local`, `DTSTAMP:${date(start)}`, `DTSTART:${date(start)}`, `DTEND:${date(end)}`, `SUMMARY:${escape(title)}`, `LOCATION:${escape(venue)}`, "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}
