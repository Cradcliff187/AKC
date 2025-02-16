// =========================================
// 📌 DATA ANALYSIS + LOGGING FOR DATA LAKE
// =========================================

// === GLOBAL CONFIGURATION (From Config.gs) ===
var STATUS_CHANGE_SHEET = "Status Change Map"; // Logs workflow changes
var SCHEMA_SHEET = "Schema Report"; // Stores extracted schema details
var TIMESTAMP_FORMAT = "yyyy-MM-dd HH:mm:ss"; // Date format for timestamps

// === MAIN FUNCTION: RUN EVERYTHING ===
function runDataAnalysis() {
  extractDataSchema(); // Extracts the schema
  trackStatusChanges(); // Tracks status changes
  Logger.log("✅ Data Analysis Complete! Ready for Data Lake Migration.");
}

// =========================================
// 📌 STEP 1: EXTRACT DATA SCHEMA (AND LOG TO EXECUTION LOGS)
// =========================================
function extractDataSchema() {
  var spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var schemaSheet = createOrGetSheet(SCHEMA_SHEET);
  schemaSheet.clear();

  // Set header row
  var schemaHeaders = ["Sheet Name", "Column Name", "Example Data", "Font Weight", "Data Type"];
  schemaSheet.appendRow(schemaHeaders);

  var schemaResults = [];

  Object.values(CONFIG.SHEETS).forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return; // Skip missing sheets

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return; // Skip empty sheets

    var headers = data[0]; // First row = headers
    for (var i = 0; i < headers.length; i++) {
      var example = data.length > 1 ? data[1][i] : "N/A";
      var fontWeight = sheet.getRange(2, i + 1).getFontWeight();
      var dataType = detectDataType(example);
      schemaSheet.appendRow([sheetName, headers[i], example, fontWeight, dataType]);

      // Add to log results
      schemaResults.push(`${sheetName} | ${headers[i]} | ${example} | ${fontWeight} | ${dataType}`);
    }
  });

  Logger.log("✅ Schema extraction completed! Below is the schema data:");
  schemaResults.forEach(row => Logger.log(row));
}

// Detects basic data types (String, Number, Date, Boolean)
function detectDataType(value) {
  if (!isNaN(value)) return "Number";
  if (Object.prototype.toString.call(value) === "[object Date]") return "Date";
  if (value.toString().toLowerCase() === "true" || value.toString().toLowerCase() === "false") return "Boolean";
  return "String"; // Default to string
}

// =========================================
// 📌 STEP 2: TRACK STATUS CHANGES (AND LOG TO EXECUTION LOGS)
// =========================================
function trackStatusChanges() {
  var spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var logSheet = createOrGetSheet(STATUS_CHANGE_SHEET);

  // Ensure header row exists
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(["Sheet Name", "Record ID", "Old Status", "New Status", "Timestamp", "User"]);
  }

  var statusResults = [];

  Object.values(CONFIG.SHEETS).forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return; // Skip missing sheets

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return; // Skip empty sheets

    var headers = data[0];
    var statusCol = findColumnIndex(headers, "Status");
    var idCol = findColumnIndex(headers, "ProjectID", "EstimateID", "CustomerID", "InvoiceID");
    var userCol = findColumnIndex(headers, "LastModifiedBy", "UserEmail");
    var timestampCol = findColumnIndex(headers, "LastModified", "Timestamp");

    if (statusCol === -1 || idCol === -1) return; // Skip sheets without status tracking

    for (var i = 1; i < data.length; i++) {
      var recordId = data[i][idCol];
      var newStatus = data[i][statusCol];
      var timestamp = timestampCol !== -1 ? data[i][timestampCol] : formatDate(new Date());
      var user = userCol !== -1 ? data[i][userCol] : "Unknown";

      if (!recordId || !newStatus) continue; // Skip rows without necessary data

      var oldStatus = getOldStatus(logSheet, recordId);
      
      if (oldStatus !== newStatus) {
        logSheet.appendRow([sheetName, recordId, oldStatus, newStatus, timestamp, user]);
        statusResults.push(`${sheetName} | ${recordId} | ${oldStatus} -> ${newStatus} | ${timestamp} | ${user}`);
      }
    }
  });

  Logger.log("✅ Status Change Map Updated! Below are the status changes:");
  statusResults.forEach(row => Logger.log(row));
}

// =========================================
// 📌 UTILITIES & HELPERS
// =========================================
function findColumnIndex(headers, ...possibleNames) {
  for (var i = 0; i < headers.length; i++) {
    if (possibleNames.includes(headers[i])) return i;
  }
  return -1;
}

function getOldStatus(logSheet, recordId) {
  var data = logSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === recordId) return data[i][3]; // Old status stored in column 4
  }
  return "N/A";
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), TIMESTAMP_FORMAT);
}

function createOrGetSheet(sheetName) {
  var spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function testEmailFunction() {
  Logger.log('=== Testing Email Function ===');
  
  try {
    // Use hardcoded template ID from Config.js
    const TEMPLATE_DOC_ID = "1uf8ZrAGNIkzoWHfaIaEHYNQ6PqZ7roHfa2FxO0ZkEHg";
    Logger.log('Template ID:', TEMPLATE_DOC_ID);
    
    // Verify Drive access
    Logger.log('1. Checking Drive access...');
    const templateFile = DriveApp.getFileById(TEMPLATE_DOC_ID);
    Logger.log('Template file name:', templateFile.getName());
    
    // Test data
    Logger.log('2. Setting up test data...');
    const testData = {
      estimateId: 'TEST-001',
      recipientEmail: Session.getActiveUser().getEmail(), // Use current user's email
      docId: TEMPLATE_DOC_ID,
      customerName: 'Test Customer',
      projectName: 'Test Project',
      amount: 1000,
      notes: 'This is a test email'
    };
    Logger.log('Test data:', JSON.stringify(testData, null, 2));
    
    // Try to create PDF
    Logger.log('3. Testing PDF creation...');
    const file = DriveApp.getFileById(testData.docId);
    const pdf = file.getAs(MimeType.PDF);
    Logger.log('PDF created successfully');
    
    // Try sending email
    Logger.log('4. Testing email send...');
    const userEmail = Session.getActiveUser().getEmail();
    Logger.log('Sending to email:', userEmail);
    
    GmailApp.sendEmail(
      userEmail,
      'Test Estimate Email',
      'This is a test email',
      {
        attachments: [pdf],
        name: 'AKC LLC Test'
      }
    );
    Logger.log('Email sent successfully');
    
    return { success: true, message: 'Test completed successfully' };
    
  } catch (error) {
    Logger.log('ERROR DETAILS:');
    Logger.log('Error message:', error.message);
    Logger.log('Error stack:', error.stack);
    return { 
      success: false, 
      error: error.message,
      location: error.stack
    };
  }
}

function testGmailAccess() {
  Logger.log('=== Testing Gmail Access ===');
  
  try {
    const userEmail = Session.getActiveUser().getEmail();
    Logger.log('User email:', userEmail);
    
    // Try sending a simple test email
    GmailApp.sendEmail(
      userEmail,
      'Test Email Access',
      'This is a test email to verify Gmail access.'
    );
    
    Logger.log('Email sent successfully!');
    return { success: true };
    
  } catch (error) {
    Logger.log('ERROR DETAILS:');
    Logger.log('Error message:', error.message);
    Logger.log('Error stack:', error.stack);
    return { success: false, error: error.message };
  }
}