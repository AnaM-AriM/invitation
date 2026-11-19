import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const headers = ["id", "requestId", "name", "message", "createdAt"];
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function harness(initial: unknown[][] = [headers]) {
  let rows = initial.map(row => [...row]), locked = false, releaseCount = 0, canLock = true;
  const writes: { method: string; options: Record<string, unknown>; values: unknown[][] }[] = [];
  const properties: Record<string, string> = { SPREADSHEET_ID: "private-fixture" };
  const context = vm.createContext({ console: { error() {} }, ContentService: { MimeType: { JSON: "json" }, createTextOutput: (text: string) => ({ setMimeType: () => text }) }, PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties[key], setProperty: (key: string, value: string) => { properties[key] = value; } }) }, SpreadsheetApp: { getActiveSpreadsheet: () => ({ getId: () => "private-fixture", getSheetByName: () => ({}), insertSheet: () => ({}) }) }, LockService: { getScriptLock: () => ({ tryLock: () => { if (!canLock || locked) return false; locked = true; return true; }, releaseLock: () => { locked = false; releaseCount++; } }) }, Sheets: { Spreadsheets: { Values: {
    get: (_id: string, range: string) => ({ values: range.endsWith("A1:E1") ? rows.slice(0, 1) : rows }),
    update: (data: { values: unknown[][] }, _id: string, _range: string, options: Record<string, unknown>) => { writes.push({ method: "update", options, values: data.values }); rows = data.values.map(row => [...row]); },
    append: (data: { values: unknown[][] }, _id: string, _range: string, options: Record<string, unknown>) => { assert.equal(locked, true, "append must occur under script lock"); writes.push({ method: "append", options, values: data.values }); rows.push(...data.values.map(row => [...row])); },
  } } } });
  vm.runInContext(source, context);
  return { run: (expression: string) => vm.runInContext(expression, context), call: (name: string, arg?: unknown) => { context.argument = arg; return JSON.parse(vm.runInContext(`${name}(argument)`, context)); }, rows: () => rows, writes, released: () => releaseCount, block: () => { canLock = false; } };
}
function post(name: string, message: string, n = 1) { const contents = new URLSearchParams({ name, message, requestId: uuid(n) }).toString(); return { postData: { type: "application/x-www-form-urlencoded;charset=UTF-8", contents }, contentLength: contents.length }; }
test("RAW setup only creates missing schema and never overwrites mismatched headers", () => {
  const fresh = harness([]); fresh.run("setupGuestbook()"); assert.equal(fresh.writes[0].options.valueInputOption, "RAW"); assert.equal(JSON.stringify(fresh.rows()), JSON.stringify([headers]));
  const existing = harness([["wrong"]]); assert.throws(() => existing.run("setupGuestbook()")); assert.equal(existing.writes.length, 0);
});
test("full row delta is literal, ISO, public and idempotent under lock", () => {
  const h = harness(); const first = h.call("doPost", post("00123", "=1+2"));
  assert.equal(h.rows().length, 2); assert.deepEqual(h.rows()[1].slice(0, 4), [1, uuid(1), "00123", "=1+2"]);
  assert.equal(h.writes[0].options.valueInputOption, "RAW"); assert.match(String(h.rows()[1][4]), /^\d{4}-\d\d-\d\dT.*Z$/); assert.equal(new Date(String(h.rows()[1][4])).toISOString(), h.rows()[1][4]);
  assert.deepEqual(Object.keys(first.comment).sort(), ["createdAt", "id", "message", "name"]); assert.equal(first.requestId, uuid(1));
  const second = h.call("doPost", post("00123", "=1+2")); assert.deepEqual(second, first); assert.equal(h.rows().length, 2); assert.equal(h.writes.length, 1); assert.equal(h.released(), 2);
  assert.ok(h.call("doPost", post("00123", "changed")).error); assert.equal(h.rows().length, 2); assert.equal(h.released(), 3);
});
test("name/message boundaries, controls, UUID, body and type failures write nothing", () => {
  for (const [name, message] of [["a", "b"], ["a".repeat(20), "b".repeat(300)]]) { const h = harness(); assert.ok(h.call("doPost", post(name, message)).comment); }
  for (const [name, message] of [["", "b"], ["a".repeat(21), "b"], ["a", ""], ["a", "b".repeat(301)], ["a\x01b", "b"], ["a", "b\x00c"]]) { const h = harness(); assert.ok(h.call("doPost", post(name, message)).error); assert.equal(h.writes.length, 0); }
  const h = harness();
  for (const event of [{ postData: { type: "text/plain", contents: JSON.stringify({ name: "a", message: "b", requestId: "no" }) } }, { postData: { type: "text/plain", contents: "x".repeat(8193) } }, { postData: { type: "application/json", contents: "{}" } }, { postData: { type: "text/plain", contents: "{" } }]) assert.ok(h.call("doPost", event).error);
  assert.equal(h.writes.length, 0);
});
test("latest six comments, chronological 36 guests, clamping and public fields", () => {
  const rows: unknown[][] = [headers, ...Array.from({ length: 75 }, (_, i) => [i + 1, uuid(i + 1), `하객${i + 1}`, `축하${i + 1}`, "2027-01-01T00:00:00.000Z"])];
  const h = harness(rows); const first = h.call("doGet", { parameter: { page: "0", scene: "1" } });
  assert.equal(first.total, 75); assert.deepEqual(first.comments.map((r: { id: number }) => r.id), [75, 74, 73, 72, 71, 70]); assert.equal(first.guests[0].id, 37); assert.equal(first.guests[35].id, 72);
  assert.deepEqual(Object.keys(first.guests[0]).sort(), ["createdAt", "id", "message", "name"]);
  const clamp = h.call("doGet", { parameter: { page: "999", scene: "999" } }); assert.equal(clamp.page, 12); assert.equal(clamp.scene, 2); assert.equal(clamp.guests.length, 3);
  const negative = h.call("doGet", { parameter: { page: "-1", scene: "-1" } }); assert.equal(negative.page, 0); assert.equal(negative.scene, 0);
});
test("lock contention, schema corruption and sparse IDs cannot write or drop invariants", () => {
  const blocked = harness(); blocked.block(); assert.ok(blocked.call("doPost", post("a", "b")).error); assert.equal(blocked.writes.length, 0); assert.equal(blocked.released(), 0);
  const corrupt = harness([["wrong"]]); assert.ok(corrupt.call("doGet", {}).error); assert.ok(corrupt.call("doPost", post("a", "b")).error); assert.equal(corrupt.released(), 1); assert.equal(corrupt.writes.length, 0);
  const sparse = harness([headers, [12, uuid(2), "a", "b", "2027-01-01T00:00:00.000Z"]]); assert.equal(sparse.call("doPost", post("c", "d", 3)).comment.id, 13);
  const badDate = harness([headers, [1, uuid(1), "a", "b", "not a date"]]); assert.ok(badDate.call("doGet", {}).error);
});
