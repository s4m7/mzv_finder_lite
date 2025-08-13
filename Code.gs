function doPost(e) {
  const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const SHEET_NAME = PropertiesService.getScriptProperties().getProperty('SHEET_NAME');
  const TOKEN = PropertiesService.getScriptProperties().getProperty('TOKEN');
  try {
    console.log(`Request received: ${JSON.stringify(e)}`);
    const data = JSON.parse(e.postData.contents || '{}');
    console.log(`Parsed data: ${JSON.stringify(data)}`);

    // Security check (moved from headers to body)
    if (!TOKEN || data.token !== TOKEN) {
      console.log('Unauthorized request');
      return ContentService.createTextOutput(
        JSON.stringify({ status: "unauthorized" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Idempotency (moved from headers to body)
    const idempotencyKey = data.idempotencyKey;
    if (idempotencyKey) {
      const cache = CacheService.getScriptCache();
      if (cache.get(idempotencyKey)) {
        return ContentService.createTextOutput(
          JSON.stringify({ status: "success", message: "Request already processed" })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      cache.put(idempotencyKey, 'processed', 21600); // 6h
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp","Company","Department","Name","Email","Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9","Q10","Category"]);
    }

    const rowData = [
      new Date(data.__ts || Date.now()),
      data.company, data.department, data.name, data.email,
      data.Q1, data.Q2, data.Q3, data.Q4, data.Q5,
      data.Q6, data.Q7, data.Q8, data.Q9, data.Q10,
      data.category
    ];
    console.log(`Appending row: ${JSON.stringify(rowData)}`);
    sheet.appendRow(rowData);

    lock.releaseLock();
    console.log('Successfully appended data and released lock.');
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.log(`Error occurred: ${err.toString()}`);
    console.log(`Error stack: ${err.stack}`);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}