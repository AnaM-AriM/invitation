import test from "node:test";
import assert from "node:assert/strict";
import { publicPath } from "../lib/public-path.ts";
import { calendarFile, prepareSubmission, confirmAcknowledgment, parseGarden, postGuestbook } from "../site/guestbook.ts";
const id = "00000000-0000-4000-8000-000000000001";
const pending = { requestId: id, name: "이름", message: "축하해요" };
const comment = { id: 1, name: pending.name, message: pending.message, createdAt: "2027-01-01T00:00:00.000Z" };
test("public asset paths cover default, nested, external and SVG source paths", () => {
  assert.equal(publicPath("/assets/a.webp"), "/assets/a.webp");
  assert.equal(publicPath("/assets/a.webp", "/invitation/"), "/invitation/assets/a.webp");
  assert.equal(publicPath("https://a.test/a", "/invitation/"), "https://a.test/a");
  assert.equal(publicPath("//a.test/a", "/invitation/"), "//a.test/a");
  assert.equal(publicPath("photos/a.webp", "/invitation/"), "photos/a.webp");
});
test("retry retains normalized payload UUID and editing allocates a new attempt", () => {
  assert.deepEqual(prepareSubmission(" 이름 ", " 축하해요 ", pending), pending);
  assert.notEqual(prepareSubmission("다른 이름", "축하해요", pending).requestId, id);
  assert.throws(() => prepareSubmission("", "축하해요"));
});
test("only matching confirmed acknowledgments succeed", () => {
  const acknowledgment = { requestId: id, comment, total: 1 };
  assert.deepEqual(confirmAcknowledgment(acknowledgment, pending), acknowledgment);
  for (const invalid of [{}, { ...acknowledgment, requestId: "different" }, { ...acknowledgment, comment: { ...comment, name: "different" } }, { ...acknowledgment, comment: { ...comment, message: "different" } }, { ...acknowledgment, total: 0 }, { error: "실패" }]) assert.throws(() => confirmAcknowledgment(invalid, pending));
});
test("client rejects network failures and malformed success without accepting opaque responses", async () => {
  const original = globalThis.fetch;
  try {
    let body = "";
    globalThis.fetch = async (_input, init) => { body = String(init?.body); throw new Error("lost response"); };
    await assert.rejects(postGuestbook("https://example.com/exec", pending), /lost response/);
    assert.equal(new URLSearchParams(body).get("requestId"), id);
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }));
    await assert.rejects(postGuestbook("https://example.com/exec", pending));
    globalThis.fetch = async () => new Response(JSON.stringify({ requestId: id, comment, total: 1 }));
    assert.equal((await postGuestbook("https://example.com/exec", pending)).comment.id, 1);
  } finally { globalThis.fetch = original; }
});
test("read validation and calendar preserve contract", () => {
  assert.equal(parseGarden({ total: 1, page: 0, scene: 0, comments: [comment], guests: [comment] }).total, 1);
  assert.throws(() => parseGarden({ total: -1 }));
  const calendar = calendarFile("우리, 결혼;해요", "2027-05-22T14:00:00+09:00", "2027-05-22T15:00:00+09:00", "서울");
  assert.match(calendar, /DTSTART:20270522T050000Z/);
  assert.match(calendar, /SUMMARY:우리\\, 결혼\\;해요/);
});
