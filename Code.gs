const scriptProperties = PropertiesService.getScriptProperties();
const SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');
const SHEET_NAME = scriptProperties.getProperty('SHEET_NAME') || 'Sheet1';
const TOKEN = scriptProperties.getProperty('TOKEN');

function doPost(e) {
  // Security check for the token
  if (!TOKEN || e.headers['x-token'] !== TOKEN) {
    return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
  }

  // Idempotency check to prevent duplicate submissions
  const idempotencyKey = e.headers['x-idempotency-key'];
  if (idempotencyKey) {
    const cache = CacheService.getScriptCache();
    if (cache.get(idempotencyKey)) {
      return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Request already processed"})).setMimeType(ContentService.MimeType.JSON);
    }
    // Store the key for 6 hours to prevent reprocessing
    cache.put(idempotencyKey, 'processed', 21600); 
  }

  try {
    // Lock to prevent concurrent modifications to the spreadsheet
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // Wait up to 30 seconds

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    
    // If the sheet is empty, add a header row
    if (sheet.getLastRow() === 0) {
      const headers = ["Timestamp", "Company", "Department", "Name", "Email", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Category"];
      sheet.appendRow(headers);
    }

    const data = JSON.parse(e.postData.contents);

    // Prepare the row data
    const row = [
      new Date(data.__ts || Date.now()),
      data.company,
      data.department,
      data.name,
      data.email,
      data.Q1, data.Q2, data.Q3, data.Q4, data.Q5,
      data.Q6, data.Q7, data.Q8, data.Q9, data.Q10,
      data.category
    ];

    sheet.appendRow(row);
    
    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Return an error message if something goes wrong
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  const response = ContentService.createTextOutput();
  response.addHeader("Access-Control-Allow-Origin", "*");
  response.addHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.addHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, X-Idempotency-Key");
  return response;
}
