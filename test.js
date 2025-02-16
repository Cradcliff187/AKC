function testEstimateEmailSending() {
  Logger.log("=== Testing Estimate Email Sending ===");
  
  try {
    // Test 1: Get Sheet Data
    Logger.log("\nStep 1: Getting Sheet Data");
    const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const estimateIdCol = headers.indexOf('EstimateID');
    const docIdCol = headers.indexOf('DocId');
    const docUrlCol = headers.indexOf('DocUrl');
    
    Logger.log("Headers found:", headers);
    
    // Get most recent estimate with a docId
    const recentEstimate = data.slice(1).reverse().find(row => row[docIdCol]);
    
    if (!recentEstimate) {
      Logger.log("❌ No estimates found with DocId");
      return;
    }
    
    // Test 2: Document Info
    Logger.log("\nStep 2: Document Info");
    Logger.log("Estimate details:", {
      estimateId: recentEstimate[estimateIdCol],
      docId: recentEstimate[docIdCol],
      docUrl: recentEstimate[docUrlCol]
    });
    
    // Test 3: Document Access
    Logger.log("\nStep 3: Document Access");
    const file = DriveApp.getFileById(recentEstimate[docIdCol]);
    Logger.log("File found:", file.getName());
    Logger.log("File type:", file.getMimeType());
    
    // Test 4: PDF Conversion
    Logger.log("\nStep 4: PDF Conversion");
    const pdf = file.getAs(MimeType.PDF);
    Logger.log("PDF created successfully");
    Logger.log("PDF size:", pdf.getBytes().length);
    
    // Test 5: Email Send
    Logger.log("\nStep 5: Email Send");
    const testEmailData = {
      estimateId: recentEstimate[estimateIdCol],
      docId: recentEstimate[docIdCol],
      recipientEmail: Session.getActiveUser().getEmail(),
      subject: "Test Estimate Email",
      notes: "This is a test email",
      customerName: "Test Customer",
      projectName: "Test Project",
      amount: 1000
    };
    
    Logger.log("Attempting to send email with data:", testEmailData);
    const emailResult = sendEstimateEmail(testEmailData);
    Logger.log("Email send result:", emailResult);
    
  } catch (error) {
    Logger.log("❌ Test failed with error:", error.message);
    Logger.log("Error stack:", error.stack);
    Logger.log("Error occurred at step:", getCurrentStep());
  }
}

// Helper to track current step
let currentStep = '';
function getCurrentStep() {
  return currentStep;
}