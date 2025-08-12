// Uses Script Properties: SPREADSHEET_ID, SHEET_NAME
const PROPS = PropertiesService.getScriptProperties();
const SHEET_ID   = PROPS.getProperty('SPREADSHEET_ID');
const SHEET_NAME = PROPS.getProperty('SHEET_NAME') || 'Sheet1';
const IDEM_SHEET = 'idem';
const TOKEN      = PROPS.getProperty('TOKEN') || 'CHANGE_ME'; // optional shared secret

function json(o, code=200) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON)  // note: Apps Script web apps don't let you set CORS headers here
    .setResponseCode(code);
}

function doPost(e) {
  try {
    const headers = (e && e.headers) || {};
    if ((headers['x-token'] || headers['X-Token']) !== TOKEN) return json({ok:false,error:'unauthorized'},401);

    const body = e?.postData?.contents ? JSON.parse(e.postData.contents) : {};
    const { company, name, email, survey } = body;
    const key = headers['x-idempotency-key'] || Utilities.getUuid();
    if (![company, name, email, survey].every(Boolean)) return json({ok:false,error:'bad_request'},400);

    const lock = LockService.getScriptLock(); lock.tryLock(5000);

    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const main = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    const idem = ss.getSheetByName(IDEM_SHEET) || ss.insertSheet(IDEM_SHEET);

    // Idempotency check (column A)
    const last = Math.max(idem.getLastRow(), 1);
    const keys = last > 1 ? new Set(idem.getRange(1,1,last,1).getValues().flat()) : new Set();
    if (keys.has(key)) { lock.releaseLock(); return json({ok:true,duplicate:true}); }

    idem.appendRow([key, new Date()]);
    main.appendRow([new Date(), company, name, email, survey, key]);

    lock.releaseLock();
    return json({ok:true});
  } catch (err) {
    try { LockService.getScriptLock().releaseLock(); } catch (_) {}
    return json({ok:false,error:String(err)},500);
  }
}

// Optional: simple health check
function doGet() { return json({ok:true,ping:'pong'}); }
