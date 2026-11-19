/* Container-bound Apps Script. Enable the Advanced Google Sheets service first. */
var HEADERS = ['id', 'requestId', 'name', 'message', 'createdAt'];
var TAB = 'Guestbook';
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function fail_(message) { return json_({ error: message }); }
function spreadsheetId_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Run setupGuestbook before publishing.');
  return id;
}
function setupGuestbook() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Bind this script to the private guestbook spreadsheet.');
  var sheet = spreadsheet.getSheetByName(TAB);
  if (!sheet) sheet = spreadsheet.insertSheet(TAB);
  var id = spreadsheet.getId();
  var values = Sheets.Spreadsheets.Values.get(id, TAB + '!A1:E1').values || [];
  if (values.length && values[0].some(function(value) { return value !== ''; })) {
    if (JSON.stringify(values[0]) !== JSON.stringify(HEADERS)) throw new Error('Existing Guestbook headers differ. No data was changed.');
  } else {
    Sheets.Spreadsheets.Values.update({ values: [HEADERS] }, id, TAB + '!A1:E1', { valueInputOption: 'RAW' });
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
  return 'Guestbook ready. Keep the spreadsheet private; only the web app is public.';
}
function rows_() {
  var values = Sheets.Spreadsheets.Values.get(spreadsheetId_(), TAB + '!A:E').values || [];
  if (!values.length || JSON.stringify(values[0]) !== JSON.stringify(HEADERS)) throw new Error('Guestbook schema mismatch.');
  var ids = {}, requests = {};
  return values.slice(1).filter(function(row) { return row.some(function(value) { return value !== ''; }); }).map(function(row) {
    var id = Number(row[0]);
    if (!Number.isSafeInteger(id) || id < 1 || ids[id] || requests[row[1]] || typeof row[1] !== 'string' || !uuid_(row[1]) || typeof row[2] !== 'string' || typeof row[3] !== 'string' || typeof row[4] !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row[4]) || !isFinite(Date.parse(row[4]))) throw new Error('Guestbook contains an invalid row.');
    var normalized = validate_({ requestId: row[1], name: row[2], message: row[3] });
    if (normalized.error || normalized.name !== row[2] || normalized.message !== row[3]) throw new Error('Guestbook contains invalid text.');
    ids[id] = true; requests[row[1]] = true;
    return { id: id, requestId: row[1], name: row[2], message: row[3], createdAt: row[4] };
  }).sort(function(a, b) { return a.id - b.id; });
}
function uuid_(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function validate_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: '입력 내용을 확인해 주세요.' };
  var name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || name.length > 20 || /[\x00-\x1F\x7F]/.test(name)) return { error: '이름을 1~20자로 적어 주세요.' };
  var message = typeof value.message === 'string' ? value.message.trim() : '';
  if (!message || message.length > 300 || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(message)) return { error: '축하 메시지를 1~300자로 적어 주세요.' };
  if (typeof value.requestId !== 'string' || !uuid_(value.requestId)) return { error: '요청 정보가 올바르지 않습니다.' };
  return { requestId: value.requestId, name: name, message: message };
}
function public_(row) { return { id: row.id, name: row.name, message: row.message, createdAt: row.createdAt }; }
function index_(value, total, size) {
  var number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 0;
  return Math.min(Number.isFinite(number) ? Math.floor(number) : 0, Math.max(0, Math.ceil(total / size) - 1));
}
function doGet(event) {
  try {
    var rows = rows_(), params = event && event.parameter || {};
    var page = index_(params.page, rows.length, 6), scene = index_(params.scene, rows.length, 36);
    return json_({ total: rows.length, comments: rows.slice().reverse().slice(page * 6, page * 6 + 6).map(public_), guests: rows.slice(scene * 36, scene * 36 + 36).map(public_), page: page, scene: scene });
  } catch (error) { console.error(error); return fail_('방명록을 불러오지 못했어요. 관리자에게 문의해 주세요.'); }
}
function doPost(event) {
  var lock = null, acquired = false;
  try {
    if (!event || !event.postData || typeof event.postData.contents !== 'string' || event.postData.contents.length > 8192 || Number(event.contentLength || 0) > 8192) return fail_('요청이 너무 크거나 올바르지 않습니다.');
    var type = String(event.postData.type || '').split(';')[0].toLowerCase(), payload;
    if (type === 'text/plain') payload = JSON.parse(event.postData.contents);
    else if (type === 'application/x-www-form-urlencoded') {
      payload = {}; event.postData.contents.split('&').forEach(function(pair) {
        var at = pair.indexOf('='), key = decodeURIComponent((at < 0 ? pair : pair.slice(0, at)).replace(/\+/g, ' ')), value = decodeURIComponent((at < 0 ? '' : pair.slice(at + 1)).replace(/\+/g, ' '));
        if (Object.prototype.hasOwnProperty.call(payload, key) || ['name', 'message', 'requestId'].indexOf(key) < 0) throw new Error('Invalid form field.');
        payload[key] = value;
      });
    } else return fail_('지원하지 않는 요청 형식입니다.');
    var valid = validate_(payload); if (valid.error) return fail_(valid.error);
    lock = LockService.getScriptLock(); acquired = lock.tryLock(20000);
    if (!acquired) return fail_('요청이 많아요. 같은 내용으로 잠시 후 다시 시도해 주세요.');
    var rows = rows_(), existing = rows.filter(function(row) { return row.requestId === valid.requestId; })[0];
    if (existing) {
      if (existing.name !== valid.name || existing.message !== valid.message) return fail_('같은 요청 번호의 내용이 다릅니다.');
      return json_({ requestId: valid.requestId, comment: public_(existing), total: rows.length });
    }
    var row = { id: rows.length ? rows[rows.length - 1].id + 1 : 1, requestId: valid.requestId, name: valid.name, message: valid.message, createdAt: new Date().toISOString() };
    Sheets.Spreadsheets.Values.append({ values: [[row.id, row.requestId, row.name, row.message, row.createdAt]] }, spreadsheetId_(), TAB + '!A:E', { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
    return json_({ requestId: valid.requestId, comment: public_(row), total: rows.length + 1 });
  } catch (error) { console.error(error); return fail_('저장 여부를 확인하지 못했어요. 같은 내용으로 다시 시도해 주세요.'); }
  finally { if (lock && acquired) lock.releaseLock(); }
}
