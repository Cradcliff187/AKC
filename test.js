// Add to Code.gs

function initializeCustomerModuleSheets() {
  Logger.log('=== Starting Sheet Initialization ===');

  try {
    // Define sheet schemas
    const schemas = {
      CustomerContacts: [
        'ContactID',
        'CustomerID',
        'Role',
        'Name',
        'Email',
        'Phone',
        'Title',
        'IsPrimary',
        'Status',
        'CreatedOn',
        'CreatedBy',
        'LastModified',
        'LastModifiedBy'
      ],
      CustomerDocuments: [
        'DocumentID',
        'CustomerID',
        'Type',
        'Name',
        'URL',
        'Description',
        'Version',
        'Status',
        'CreatedOn',
        'CreatedBy',
        'LastModified',
        'LastModifiedBy'
      ],
      CustomerComms: [
        'CommunicationID',
        'CustomerID',
        'Type',
        'Subject',
        'Content',
        'SentTo',
        'Status',
        'CreatedOn',
        'CreatedBy',
        'LastModified',
        'LastModifiedBy'
      ]
    };

    // Get spreadsheet
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    Logger.log('Opened spreadsheet:', ss.getName());

    // Initialize each sheet
    Object.entries(schemas).forEach(([sheetName, headers]) => {
      Logger.log(`\nProcessing ${sheetName}...`);
      
      // Get or create sheet
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log(`Creating new sheet: ${sheetName}`);
        sheet = ss.insertSheet(sheetName);
      } else {
        Logger.log(`Found existing sheet: ${sheetName}`);
      }

      // Get current headers if they exist
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      Logger.log('Current headers:', currentHeaders);

      // Check if headers need to be updated
      if (currentHeaders.length === 0 || !arraysEqual(currentHeaders, headers)) {
        Logger.log('Updating headers...');
        
        // Clear existing content if any
        if (sheet.getLastRow() > 0) {
          sheet.clear();
        }

        // Set new headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        
        // Format header row
        sheet.getRange(1, 1, 1, headers.length)
          .setBackground('#f3f3f3')
          .setFontWeight('bold')
          .setWrap(true);

        // Freeze header row
        sheet.setFrozenRows(1);

        // Auto-resize columns
        sheet.autoResizeColumns(1, headers.length);
      }

      Logger.log(`${sheetName} initialization complete`);
    });

    Logger.log('\n=== Sheet Initialization Complete ===');
    return true;

  } catch (error) {
    Logger.log('Error during initialization:');
    Logger.log('Message:', error.message);
    Logger.log('Stack:', error.stack);
    throw error;
  }
}

// Helper function to compare arrays
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Function to validate sheet structure
function validateSheetStructure(sheetName, expectedHeaders) {
  try {
    Logger.log(`\nValidating structure for ${sheetName}...`);
    
    const sheet = getSheet(sheetName);
    if (!sheet) {
      Logger.log(`Sheet ${sheetName} not found`);
      return false;
    }

    const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('Expected headers:', expectedHeaders);
    Logger.log('Actual headers:', actualHeaders);

    const isValid = arraysEqual(actualHeaders, expectedHeaders);
    Logger.log(`Validation result: ${isValid}`);
    
    return isValid;

  } catch (error) {
    Logger.log(`Error validating ${sheetName}:`, error.message);
    return false;
  }
}

// Combined test function
function testCustomerModuleSetup() {
  Logger.log('=== Testing Customer Module Setup ===');

  try {
    // First initialize sheets
    Logger.log('\nInitializing sheets...');
    initializeCustomerModuleSheets();

    // Then validate each sheet
    Logger.log('\nValidating sheets...');
    
    // Get schema definitions
    const customerContactsHeaders = [
      'ContactID', 'CustomerID', 'Role', 'Name', 'Email', 'Phone', 'Title',
      'IsPrimary', 'Status', 'CreatedOn', 'CreatedBy', 'LastModified', 'LastModifiedBy'
    ];

    const customerDocsHeaders = [
      'DocumentID', 'CustomerID', 'Type', 'Name', 'URL', 'Description', 'Version',
      'Status', 'CreatedOn', 'CreatedBy', 'LastModified', 'LastModifiedBy'
    ];

    const customerCommsHeaders = [
      'CommunicationID', 'CustomerID', 'Type', 'Subject', 'Content', 'SentTo',
      'Status', 'CreatedOn', 'CreatedBy', 'LastModified', 'LastModifiedBy'
    ];

    // Validate each sheet
    const validations = {
      CustomerContacts: validateSheetStructure(CONFIG.SHEETS.CUSTOMER_CONTACTS, customerContactsHeaders),
      CustomerDocuments: validateSheetStructure(CONFIG.SHEETS.CUSTOMER_DOCUMENTS, customerDocsHeaders),
      CustomerComms: validateSheetStructure(CONFIG.SHEETS.CUSTOMER_COMMUNICATIONS, customerCommsHeaders)
    };

    Logger.log('\nValidation Results:', validations);

    // If all validations pass, try creating a test record
    if (Object.values(validations).every(v => v)) {
      Logger.log('\nAll validations passed. Testing record creation...');
      
      // Get a valid customer ID
      const customersSheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
      const customerData = customersSheet.getDataRange().getValues();
      const customerIdCol = customerData[0].indexOf('CustomerID');
      const validCustomerId = customerData[1][customerIdCol];

      Logger.log('Using customer ID:', validCustomerId);

      // Try creating a test contact
      const testResult = createCustomerContact({
        customerId: validCustomerId,
        role: CONFIG.CUSTOMER_MODULE.CONTACT_ROLES.PRIMARY,
        name: 'Test Contact',
        email: 'test@example.com',
        phone: '555-0123',
        title: 'Project Manager',
        isPrimary: true
      });

      Logger.log('\nTest record creation result:', testResult);
    }

  } catch (error) {
    Logger.log('Setup test error:');
    Logger.log('Message:', error.message);
    Logger.log('Stack:', error.stack);
  }
}


function extractSheetHeaders() {
  // Open the spreadsheet using the ID in the config
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = spreadsheet.getSheets();
  const output = [];

  // Loop over every sheet in the spreadsheet
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();

    // Get the last column with content in the sheet to determine header range
    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) {
      // If there is no content, skip this sheet
      continue;
    }

    // Assume that the first row is the header row
    const headerRange = sheet.getRange(1, 1, 1, lastColumn);
    const headerValues = headerRange.getValues()[0];

    // Create an array to hold header details (name + formatting)
    const headers = [];

    // Loop over each column in the header row
    for (let col = 1; col <= lastColumn; col++) {
      const cell = sheet.getRange(1, col);
      const headerName = cell.getValue();
      
      // Extract formatting information
      const formatting = {
        background: cell.getBackground(),
        fontColor: cell.getFontColor(),
        fontFamily: cell.getFontFamily(),
        fontSize: cell.getFontSize(),
        fontWeight: cell.getFontWeight(),
        horizontalAlignment: cell.getHorizontalAlignment(),
        verticalAlignment: cell.getVerticalAlignment()
      };
      
      headers.push({
        name: headerName,
        format: formatting
      });
    }

    // Push the sheet's header information to the output array
    output.push({
      sheetName: sheetName,
      headers: headers
    });
  }

  // Log the output as a JSON string for easy inspection
  Logger.log(JSON.stringify(output, null, 2));
  return output;
}

// Optionally, you can add a function to run this extraction
function runExtraction() {
  extractSheetHeaders();
}


function applyHeadersToSchemas() {
  const schemas = {
    CustomerContacts: [
      'ContactID',
      'CustomerID',
      'Role',
      'Name',
      'Email',
      'Phone',
      'Title',
      'IsPrimary',
      'Status',
      'CreatedOn',
      'CreatedBy',
      'LastModified',
      'LastModifiedBy'
    ],
    CustomerDocuments: [
      'DocumentID',
      'CustomerID',
      'Type',
      'Name',
      'URL',
      'Description',
      'Version',
      'Status',
      'CreatedOn',
      'CreatedBy',
      'LastModified',
      'LastModifiedBy'
    ],
    CustomerComms: [
      'CommunicationID',
      'CustomerID',
      'Type',
      'Subject',
      'Content',
      'SentTo',
      'Status',
      'CreatedOn',
      'CreatedBy',
      'LastModified',
      'LastModifiedBy'
    ]
  };

  // Open the spreadsheet using the ID from your configuration
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // Loop over each schema
  Object.keys(schemas).forEach(sheetName => {
    // Get the sheet by name
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log("Sheet not found: " + sheetName);
      return;
    }
    
    // Get the headers from the schema
    const headers = schemas[sheetName];
    
    // Write the headers to the first row of the sheet.
    // This writes the headers starting at cell A1
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    Logger.log("Headers applied to sheet: " + sheetName);
  });
}

// Optionally, you can add a function to run this operation
function runApplyHeaders() {
  applyHeadersToSchemas();
}


function extractAllSheetSchemas() {
  Logger.log('=== Extracting Schema for All Sheets ===\n');
  
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const allSheets = ss.getSheets();
  
  const schemas = allSheets.map(sheet => {
    const sheetName = sheet.getName();
    const lastColumn = sheet.getLastColumn();
    
    // Skip the sheet if it doesn't have any columns
    if (lastColumn < 1) {
      Logger.log(`Sheet "${sheetName}" is empty. Skipping...`);
      return null;
    }
    
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const formats = sheet.getRange(1, 1, 1, lastColumn).getTextStyles();
    
    // Get example data row if exists
    let exampleData = [];
    if (sheet.getLastRow() > 1) {
      exampleData = sheet.getRange(2, 1, 1, lastColumn).getValues()[0];
    }
    
    return {
      sheetName,
      columnCount: headers.length,
      headers: headers.map((header, index) => ({
        name: header,
        format: {
          fontWeight: formats[0][index].isBold() ? 'bold' : 'normal',
          horizontalAlignment: sheet.getRange(1, index + 1).getHorizontalAlignment(),
        },
        exampleValue: exampleData[index] || null
      }))
    };
  }).filter(schema => schema !== null);  // Filter out any null results
  
  // Log each schema in a readable format
  schemas.forEach(schema => {
    Logger.log(`\n=== ${schema.sheetName} ===`);
    Logger.log(`Column Count: ${schema.columnCount}`);
    Logger.log('Headers:');
    schema.headers.forEach(header => {
      Logger.log(`- ${header.name}`);
      Logger.log(`  Format: ${JSON.stringify(header.format)}`);
      if (header.exampleValue) {
        Logger.log(`  Example: ${header.exampleValue}`);
      }
    });
    Logger.log('---');
  });
  
  return schemas;
}

/**
 * Comprehensive test script for estimate functionality
 */

function testEstimateWorkflow() {
  Logger.log('=== Starting Estimate Workflow Test ===');
  
  // Test data
  const testCustomer = {
    name: 'Test Customer Corp',
    address: '123 Test St',
    city: 'Testville',
    state: 'TS',
    zip: '12345',
    email: 'test@testcorp.com',
    phone: '(555) 555-5555'
  };
  
  const testProject = {
    name: 'Test Construction Project',
    siteLocation: '456 Build Ave',
    siteNotes: 'Test construction notes',
    scopeOfWork: 'Comprehensive test project scope'
  };
  
  const testEstimateItems = [
    {
      itemService: 'Labor',
      description: 'General construction labor',
      qtyHours: '40',
      rate: '75.00',
      amount: '3000.00'
    },
    {
      itemService: 'Materials',
      description: 'Construction materials',
      qtyHours: '1',
      rate: '2500.00',
      amount: '2500.00'
    }
  ];

  try {
    Logger.log('1. Creating test customer...');
    const customerResponse = createCustomer(testCustomer);
    if (!customerResponse.success) {
      throw new Error(`Failed to create customer: ${customerResponse.error}`);
    }
    const customerId = customerResponse.data.customerId;
    Logger.log(`Created customer with ID: ${customerId}`);

    Logger.log('2. Creating test project...');
    const projectResponse = createProject({
      customerId: customerId,
      projectName: testProject.name,
      siteLocation: testProject.siteLocation,
      siteNotes: testProject.siteNotes
    });
    if (!projectResponse.success) {
      throw new Error(`Failed to create project: ${projectResponse.error}`);
    }
    const projectId = projectResponse.data.projectId;
    Logger.log(`Created project with ID: ${projectId}`);

    Logger.log('3. Creating estimate...');
    const estimateData = {
      customerId: customerId,
      projectId: projectId,
      projectFolderId: projectResponse.data.folders.estimates,
      customerName: testCustomer.name,
      customerAddress: testCustomer.address,
      customerCity: testCustomer.city,
      customerState: testCustomer.state,
      customerZip: testCustomer.zip,
      customerEmail: testCustomer.email,
      customerPhone: testCustomer.phone,
      projectName: testProject.name,
      siteLocation: testProject.siteLocation,
      siteNotes: testProject.siteNotes,
      scopeOfWork: testProject.scopeOfWork,
      tableItems: testEstimateItems,
      totalAmount: testEstimateItems.reduce((sum, item) => 
        sum + parseFloat(item.amount), 0)
    };

    const estimateResponse = createAndSaveEstimate(estimateData);
    if (!estimateResponse.success) {
      throw new Error(`Failed to create estimate: ${estimateResponse.error}`);
    }
    const estimateId = estimateResponse.data.estimateId;
    Logger.log(`Created estimate with ID: ${estimateId}`);

    // Test status transitions
    Logger.log('4. Testing estimate status transitions...');
    const statusTransitions = [
      'DRAFT',
      'PENDING',
      'APPROVED',
      'COMPLETED',
      'CLOSED'
    ];

    for (const newStatus of statusTransitions) {
      Logger.log(`Updating estimate status to: ${newStatus}`);
      const statusResponse = updateEstimateStatus(
        estimateId,
        newStatus,
        Session.getActiveUser().getEmail()
      );
      
      if (!statusResponse.success) {
        throw new Error(`Failed to update status to ${newStatus}: ${statusResponse.error}`);
      }
      Logger.log(`Successfully updated status to: ${newStatus}`);
    }

    // Verify final state
    Logger.log('5. Verifying final state...');
    const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const estimateIdCol = headers.indexOf('EstimateID');
    const statusCol = headers.indexOf('Status');
    
    const estimateRow = data.find(row => row[estimateIdCol] === estimateId);
    if (!estimateRow) {
      throw new Error('Could not find estimate in sheet');
    }

    const finalStatus = estimateRow[statusCol];
    if (finalStatus !== 'CLOSED') {
      throw new Error(`Unexpected final status: ${finalStatus}`);
    }

    Logger.log('6. Checking document generation...');
    const docUrl = estimateResponse.data.docUrl;
    if (!docUrl) {
      throw new Error('No document URL generated');
    }
    Logger.log(`Document generated at: ${docUrl}`);

    Logger.log('=== Test Completed Successfully ===');
    return {
      success: true,
      data: {
        customerId,
        projectId,
        estimateId,
        docUrl
      }
    };

  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cleanup test data
 */
function cleanupTestData(testData) {
  Logger.log('=== Starting Test Cleanup ===');
  
  try {
    // Clean up estimate
    if (testData.estimateId) {
      const estimatesSheet = getSheet(CONFIG.SHEETS.ESTIMATES);
      const estimateData = estimatesSheet.getDataRange().getValues();
      const estimateIdCol = estimateData[0].indexOf('EstimateID');
      const estimateRow = estimateData.findIndex(row => 
        row[estimateIdCol] === testData.estimateId);
      
      if (estimateRow > 0) {
        estimatesSheet.deleteRow(estimateRow + 1);
        Logger.log(`Deleted estimate: ${testData.estimateId}`);
      }
    }

    // Clean up project
    if (testData.projectId) {
      const projectsSheet = getSheet(CONFIG.SHEETS.PROJECTS);
      const projectData = projectsSheet.getDataRange().getValues();
      const projectIdCol = projectData[0].indexOf('ProjectID');
      const projectRow = projectData.findIndex(row => 
        row[projectIdCol] === testData.projectId);
      
      if (projectRow > 0) {
        projectsSheet.deleteRow(projectRow + 1);
        Logger.log(`Deleted project: ${testData.projectId}`);
      }
    }

    // Clean up customer
    if (testData.customerId) {
      const customersSheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
      const customerData = customersSheet.getDataRange().getValues();
      const customerIdCol = customerData[0].indexOf('CustomerID');
      const customerRow = customerData.findIndex(row => 
        row[customerIdCol] === testData.customerId);
      
      if (customerRow > 0) {
        customersSheet.deleteRow(customerRow + 1);
        Logger.log(`Deleted customer: ${testData.customerId}`);
      }
    }

    // Clean up generated documents
    if (testData.docUrl) {
      const fileId = testData.docUrl.match(/[-\w]{25,}/);
      if (fileId) {
        try {
          DriveApp.getFileById(fileId[0]).setTrashed(true);
          Logger.log(`Deleted document: ${fileId[0]}`);
        } catch (e) {
          Logger.log(`Warning: Could not delete document: ${e.message}`);
        }
      }
    }

    Logger.log('=== Cleanup Completed Successfully ===');
    return { success: true };
  } catch (error) {
    Logger.log(`ERROR during cleanup: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run full test suite
 */
function runEstimateTests() {
  Logger.log('=== Starting Full Estimate Test Suite ===');
  
  const testResult = testEstimateWorkflow();
  Logger.log(`Test result: ${JSON.stringify(testResult, null, 2)}`);
  
  if (testResult.success) {
    const cleanupResult = cleanupTestData(testResult.data);
    Logger.log(`Cleanup result: ${JSON.stringify(cleanupResult, null, 2)}`);
  }
  
  Logger.log('=== Test Suite Completed ===');
  return testResult;
}