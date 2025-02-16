/**************************************
 * Database.gs - Data Access Layer
 **************************************/

// ==========================================
// PROJECT FUNCTIONS
// ==========================================
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) throw new Error(`${sheetName} sheet not found`);
  const data = sheet.getDataRange().getValues();
  if (!data || data.length === 0) throw new Error(`No data found in ${sheetName} sheet`);
  return { sheet, headers: data[0], rows: data.slice(1) };
}

function getSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return spreadsheet.getSheetByName(sheetName);
}

function getActiveProjects() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);

  // Column indexes
  const projectIdCol = headers.indexOf("ProjectID");
  const projectNameCol = headers.indexOf("ProjectName");
  const statusCol = headers.indexOf("Status");
  const folderIdCol = headers.indexOf("FolderID");
  const jobIdCol = headers.indexOf("JobID");
  const estimatesFolderCol = headers.indexOf("EstimatesFolderID");
  const materialsFolderCol = headers.indexOf("MaterialsFolderID");
  const subInvoicesFolderCol = headers.indexOf("SubInvoicesFolderID");

  if ([
    projectIdCol, projectNameCol, statusCol, folderIdCol,
    estimatesFolderCol, materialsFolderCol, subInvoicesFolderCol,
    jobIdCol
  ].includes(-1)) {
    throw new Error("Required columns not found in Projects sheet");
  }

  return rows
    .filter(row => MODULE_ACCESS_STATUSES.includes(row[statusCol]))
    .map(row => ({
      id: row[projectIdCol],
      projectId: row[projectIdCol],
      name: row[projectNameCol],
      status: row[statusCol],
      jobId: row[jobIdCol] || '',
      folderId: row[folderIdCol],
      estimatesFolderId: row[estimatesFolderCol],
      materialsFolderId: row[materialsFolderCol],
      subInvoicesFolderId: row[subInvoicesFolderCol]
    }));
}

function createProjectRecord(data) {
  const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
  if (!sheet) throw new Error('Could not open Projects sheet');

  const projectId = generateProjectID();
  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();
  const initialStatus = PROJECT_STATUSES.PENDING;  // Use constant from config

  // Create folder structure with more robust error handling
  Logger.log('Creating project folders...');
  try {
    const folderName = `${data.customerId}-${projectId}-${data.projectName}`;
    const parentFolder = DriveApp.getFolderById(CONFIG.FOLDERS.PARENT_ID);
    const projectFolder = parentFolder.createFolder(folderName);
    const folderId = projectFolder.getId();

    const estimatesFolder = projectFolder.createFolder('Estimates');
    const materialsFolder = projectFolder.createFolder('Materials');
    const subInvoicesFolder = projectFolder.createFolder('SubInvoices');

    const estimatesFolderId = estimatesFolder.getId();
    const materialsFolderId = materialsFolder.getId();
    const subInvoicesFolderId = subInvoicesFolder.getId();

    // Ensure the project is created with an explicit initial status
    const rowData = [
      projectId,             // ProjectID
      data.customerId,       // CustomerID
      data.projectName,      // ProjectName
      initialStatus,         // Status - explicitly set
      folderId,             // Main folder
      now,                   // CreatedOn
      userEmail,            // CreatedBy
      '',                   // JobID
      now,                  // LastModified
      userEmail,            // LastModifiedBy
      estimatesFolderId,    // EstimatesFolderID
      materialsFolderId,    // MaterialsFolderID
      subInvoicesFolderId   // SubInvoicesFolderID
    ];

    sheet.appendRow(rowData);

    // Add delay and verify project creation
    Utilities.sleep(2000);
    
    // Verify project was created
    const verifyData = sheet.getDataRange().getValues();
    const projectRow = verifyData.find(row => row[0] === projectId);
    
    if (!projectRow) {
      throw new Error('Project creation verification failed');
    }

    return {
      success: true,
      data: {
        projectId,
        customerId: data.customerId,
        projectName: data.projectName,
        status: initialStatus,
        folderId,
        createdOn: now.toISOString(),
        createdBy: userEmail,
        folders: {
          main: folderId,
          estimates: estimatesFolderId,
          materials: materialsFolderId,
          subInvoices: subInvoicesFolderId
        }
      }
    };
  } catch (error) {
    Logger.log(`Error in createProjectRecord: ${error.message}`);
    throw error;
  }
}

// ==========================================
// TIME LOGGING FUNCTIONS
// ==========================================

function logTime(data) {
  const sheet = getSheet(CONFIG.SHEETS.TIME_LOGS);
  if (!sheet) throw new Error("Time Logs sheet not found");

  const timeLogId = "TL" + new Date().getTime();

  sheet.appendRow([
    timeLogId,
    data.projectId,
    data.date,
    data.startTime,
    data.endTime,
    data.hours,
    data.submittingUser,
    data.forUserEmail,
    new Date()
  ]);

  return { id: timeLogId, hours: data.hours };
}

// ==========================================
// MATERIALS RECEIPT FUNCTIONS
// ==========================================

function logMaterialsReceipt(data) {
  const sheet = getSheet(CONFIG.SHEETS.MATERIALS_RECEIPTS);
  if (!sheet) throw new Error("Materials Receipts sheet not found");

  const receiptId = "MATREC-" + new Date().getTime();

  sheet.appendRow([
    receiptId,
    data.projectId,
    data.vendorId,
    data.vendorName,
    data.amount,
    data.receiptDocURL || '',
    data.submittingUser,
    data.forUserEmail,
    new Date()
  ]);

  // Log activity
  logActivity({
    action: 'MATERIALS_RECEIPT_CREATED',
    moduleType: 'MATERIALS',
    referenceId: receiptId,
    userEmail: data.submittingUser,
    details: {
      projectId: data.projectId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      amount: data.amount,
      receiptDocURL: data.receiptDocURL || '',
      forUserEmail: data.forUserEmail || data.submittingUser
    }
  });

  return { id: receiptId };
}

// ==========================================
// SUBCONTRACTOR FUNCTIONS
// ==========================================

function getSubcontractors() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.SUBCONTRACTORS);
  
  const subIdCol = headers.indexOf("SubID");
  const subNameCol = headers.indexOf("SubName");
  
  if (subIdCol === -1 || subNameCol === -1) {
    throw new Error("Required columns not found in Subcontractors sheet");
  }

  return rows.map(row => ({
    subId: row[subIdCol],
    subName: row[subNameCol]
  }));
}

function logSubInvoice(data) {
  const sheet = getSheet(CONFIG.SHEETS.SUBINVOICES);
  if (!sheet) throw new Error("Subinvoices sheet not found");

  const invoiceId = "SUBINV-" + new Date().getTime();

  sheet.appendRow([
    invoiceId,
    data.projectId,
    data.projectName,
    data.subId,
    data.subName,
    data.invoiceAmount,
    data.invoiceDocURL || '',
    data.submittingUser,
    new Date()
  ]);

  return { id: invoiceId };
}

function createSubcontractor(data) {
  const sheet = getSheet(CONFIG.SHEETS.SUBCONTRACTORS);
  if (!sheet) throw new Error("Subcontractors sheet not found");

  const newSubId = getNextSubId(sheet);

  sheet.appendRow([
    newSubId,
    data.subName || '',
    data.address || '',
    data.city || '',
    data.state || '',
    data.zip || '',
    data.contactEmail || '',
    data.phone || ''
  ]);

  return {
    subId: newSubId,
    subName: data.subName || '',
    address: data.address || '',
    city: data.city || '',
    state: data.state || '',
    zip: data.zip || '',
    contactEmail: data.contactEmail || '',
    phone: data.phone || ''
  };
}

// ==========================================
// CUSTOMER FUNCTIONS
// ==========================================

// In Database.gs
function getCustomerData() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.CUSTOMERS);
  
  const customerIdCol = headers.indexOf("CustomerID");
  const nameCol = headers.indexOf("CustomerName");
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("ContactEmail");
  const phoneCol = headers.indexOf("Phone");
  const statusCol = headers.indexOf("Status");

  // Filter out invalid rows
  const validCustomers = rows.filter(row => {
    const customerId = row[customerIdCol];
    const customerName = row[nameCol];
    
    // Skip rows with invalid or undefined IDs
    if (!customerId || 
        customerId.toString().includes('undefined') || 
        customerId.toString().trim() === '') {
      return false;
    }
    
    // Skip rows with missing names
    if (!customerName || customerName.toString().trim() === '') {
      return false;
    }
    
    return true;
  }).map(row => ({
    customerId: row[customerIdCol],
    name: row[nameCol] || '',
    address: row[addressCol] || '',
    city: row[cityCol] || '',
    state: row[stateCol] || '',
    zip: row[zipCol] || '',
    email: row[emailCol] || '',
    phone: row[phoneCol] || '',
    status: row[statusCol] || 'Active'
  }));

  // Log summary for debugging
  Logger.log(`Processed ${validCustomers.length} valid customers`);
  
  return validCustomers;
}

function createCustomerRecord(data) {
  const sheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
  if (!sheet) throw new Error('Could not open Customers sheet');

  const customerId = generateCustomerID();
  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();
  const initialStatus = CUSTOMER_STATUSES.ACTIVE;

  sheet.appendRow([
    customerId,
    data.name || '',
    data.address || '',
    data.city || '',
    data.state || '',
    data.zip || '',
    data.email || '',
    data.phone || '',
    now,
    userEmail,
    initialStatus
  ]);

  // Add activity logging
  logSystemActivity(
    'CUSTOMER_CREATED',
    'CUSTOMER',
    customerId,
    {
      name: data.name,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      phone: data.phone
    }
  );

  return {
    success: true,
    data: {
      customerId,
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      email: data.email,
      phone: data.phone,
      createdOn: now,
      createdBy: userEmail,
      status: initialStatus
    }
  };
}

// ==========================================
// VENDOR FUNCTIONS
// ==========================================

function getVendors() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.VENDORS);
  
  const vendorIdCol = headers.indexOf("VendorID");
  const vendorNameCol = headers.indexOf("VendorName");
  
  if (vendorIdCol === -1 || vendorNameCol === -1) {
    throw new Error("Required columns not found in Vendors sheet");
  }

  return rows.map(row => ({
    vendorId: row[vendorIdCol],
    vendorName: row[vendorNameCol]
  }));
}

function createVendor(data) {
  const sheet = getSheet(CONFIG.SHEETS.VENDORS);
  if (!sheet) throw new Error("Vendors sheet not found");

  const vendorId = generateVendorID();
  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();

  // Append all fields including CreatedOn, CreatedBy, and Status
  sheet.appendRow([
    vendorId,              // VendorID
    data.vendorName || '', // VendorName
    now,                   // CreatedOn
    userEmail,            // CreatedBy
    'Active'              // Status
  ]);

  return {
    success: true,
    data: {
      vendorId,
      vendorName: data.vendorName || '',
      createdOn: now,
      createdBy: userEmail,
      status: 'Active'
    }
  };
}

function generateVendorID() {
  const sheet = getSheet(CONFIG.SHEETS.VENDORS);
  if (sheet.getLastRow() < 2) return "VEND-001";

  // Get all existing vendor IDs
  const data = sheet.getDataRange().getValues();
  const existingIds = data.slice(1).map(row => row[0]); // Skip header row
  
  // Filter for only VEND-XXX format IDs
  const vendIds = existingIds.filter(id => /^VEND-\d{3}$/.test(id));
  
  if (vendIds.length === 0) {
    // No properly formatted IDs exist yet, start with 001
    return "VEND-001";
  }
  
  // Find the highest number used
  const maxNum = Math.max(...vendIds.map(id => {
    const match = id.match(/^VEND-(\d{3})$/);
    return match ? parseInt(match[1], 10) : 0;
  }));
  
  // Generate next number
  return `VEND-${(maxNum + 1).toString().padStart(3, '0')}`;
}

// ==========================================
// ACTIVITY LOGGING FUNCTIONS
// ==========================================

function logActivity(data) {
  const sheet = getSheet(CONFIG.SHEETS.ACTIVITY_LOG);
  if (!sheet) throw new Error("Activity Log sheet not found");

  const logId = `LOG-${new Date().getTime()}`;
  const timestamp = new Date();

  sheet.appendRow([
    logId,
    timestamp,
    data.action,
    data.userEmail,
    data.moduleType,
    data.referenceId,
    JSON.stringify(data.details),
    data.status || '',
    data.previousStatus || ''
  ]);

  return { logId, timestamp };
}

// ==========================================
// ID GENERATION FUNCTIONS
// ==========================================

function generateCustomerID() {
  const sheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
  const data = sheet.getDataRange().getValues();
  const currentYear = CONFIG.CURRENT_CUSTOMER_YEAR;

  Logger.log(`Generating Customer ID for year: ${currentYear}`);

  if (data.length <= 1) {
    Logger.log("No existing customers found, starting fresh.");
    return `${currentYear}-001`;  // First customer of the year
  }

  // Extract only valid customer IDs that match the format YYYY-XXX
  const customerIds = data
    .slice(1)  // Ignore header row
    .map(row => row[0])  // Get only the customer ID column
    .filter(id => id && /^\d{4}-\d{3}$/.test(id));  // Match format YYYY-XXX

  Logger.log(`Found existing customer IDs: ${customerIds}`);

  // Get the highest existing sequence number for the current year
  const lastIdForYear = customerIds
    .filter(id => id.startsWith(currentYear)) // Only look at current year's IDs
    .sort()
    .pop();  // Get the last (highest) one

  if (!lastIdForYear) {
    Logger.log(`No customers found for ${currentYear}, starting at 001.`);
    return `${currentYear}-001`;
  }

  Logger.log(`Last customer ID for ${currentYear}: ${lastIdForYear}`);

  // Extract sequence number and increment
  const [year, sequence] = lastIdForYear.split('-');
  const nextSequence = (parseInt(sequence, 10) + 1).toString().padStart(3, '0');

  const newCustomerId = `${currentYear}-${nextSequence}`;
  Logger.log(`Generated new Customer ID: ${newCustomerId}`);

  return newCustomerId;
}


function generateProjectID() {
  const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
  const data = sheet.getDataRange().getValues();
  const yearMonth = Utilities.formatDate(new Date(), 'GMT', 'yyyyMM');

  if (data.length <= 1) return `PROJ-${yearMonth}-001`;

  const currentMonthProjects = data.slice(1)
    .filter(row => row[0].startsWith(`PROJ-${yearMonth}`));

  if (currentMonthProjects.length === 0) return `PROJ-${yearMonth}-001`;

  const lastProject = currentMonthProjects[currentMonthProjects.length - 1][0];
  const sequence = parseInt(lastProject.split('-')[2], 10) + 1;
  return `PROJ-${yearMonth}-${sequence.toString().padStart(3, '0')}`;
}

function getNextSubId(sheet) {
  if (sheet.getLastRow() < 2) return "Sub-001";

  const lastSubId = sheet.getRange(sheet.getLastRow(), 1).getValue().toString();
  const match = lastSubId.match(/^Sub-(\d+)$/);
  if (!match) throw new Error("Invalid SubID format in last row: " + lastSubId);

  const nextNum = parseInt(match[1], 10) + 1;
  return "Sub-" + nextNum.toString().padStart(3, '0');
}

function generateEstimateID(projectID) {
  const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
  const data = sheet.getDataRange().getValues();

  // Start from row 1 (exclude header).
  // Column 0 might be EstimateID, Column 1 is ProjectID, etc.
  const projectEstimates = data.slice(1)
    .filter(row => row[1] === projectID)
    .map(row => row[0]); // the EstimateID

  if (projectEstimates.length === 0) {
    return `EST-${projectID}-1`;
  }

  const lastSequence = Math.max(...projectEstimates.map(id => {
    const parts = id.split('-');
    return parseInt(parts[parts.length - 1], 10);
  }));

  return `EST-${projectID}-${lastSequence + 1}`;
}

// ==========================================
// STATUS MANAGEMENT FUNCTIONS
// ==========================================

function updateEstimateStatus(estimateId, newStatus, userEmail) {
  const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const estimateIdCol = headers.indexOf('EstimateID');
  const statusCol = headers.indexOf('Status');
  const projectIdCol = headers.indexOf('ProjectID');
  
  const rowIndex = data.findIndex(row => row[estimateIdCol] === estimateId);
  if (rowIndex === -1) {
    throw new Error(`Estimate ${estimateId} not found`);
  }
  
  const oldStatus = data[rowIndex][statusCol];
  validateStatusTransition(oldStatus, newStatus, 'ESTIMATE');
  
  // Update status
  sheet.getRange(rowIndex + 1, statusCol + 1).setValue(newStatus);
  
  // Log activity
  logActivity({
    action: 'ESTIMATE_STATUS_CHANGED',
    moduleType: 'ESTIMATE',
    referenceId: estimateId,
    userEmail: userEmail,
    details: {
      oldStatus: oldStatus,
      newStatus: newStatus
    }
  });
  
  return {
    estimateId: estimateId,
    oldStatus: oldStatus,
    newStatus: newStatus
  };
}

function updateProjectStatus(projectId, newStatus, userEmail) {
  const context = 'updateProjectStatus';
  try {
    const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const projectIdCol = headers.indexOf('ProjectID');
    const statusCol = headers.indexOf('Status');
    
    const rowIndex = data.findIndex(row => row[projectIdCol] === projectId);
    if (rowIndex === -1) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const oldStatus = data[rowIndex][statusCol];
    
    // Validate status transition
    try {
      validateStatusTransition(oldStatus, newStatus, 'PROJECT');
    } catch (error) {
      Logger.log(`Status transition validation failed: ${error.message}`);
      Logger.log(`Old status: ${oldStatus}, New status: ${newStatus}`);
      throw error;
    }
    
    // Update status in spreadsheet
    sheet.getRange(rowIndex + 1, statusCol + 1).setValue(newStatus);
    
    // Log activity
    logActivity({
      action: 'PROJECT_STATUS_CHANGED',
      moduleType: 'PROJECT',
      referenceId: projectId,
      userEmail: userEmail,
      details: {
        oldStatus: oldStatus,
        newStatus: newStatus
      }
    });
    
    return {
      success: true,
      data: {
        projectId: projectId,
        oldStatus: oldStatus,
        newStatus: newStatus
      }
    };
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

// ==========================================
// ESTIMATE FUNCTIONS
// ==========================================

// In Database.gs
function logEstimate(data) {
  Logger.log('=== logEstimate called ===');
  Logger.log('Data received: ' + JSON.stringify(data));

  const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
  if (!sheet) {
    Logger.log('Estimates sheet not found');
    throw new Error("Estimates sheet not found");
  }

  let finalEstimateId = data.estimateId;
  if (!finalEstimateId) {
    if (!data.projectId) {
      Logger.log('Cannot generate EstimateID without a ProjectID');
      throw new Error("Cannot generate EstimateID without a ProjectID");
    }
    finalEstimateId = generateEstimateID(data.projectId);
    Logger.log('Generated new estimate ID: ' + finalEstimateId);
  }

  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();
  
  // Use provided status or default to DRAFT
  const status = data.status || 'DRAFT';
  
  // Prepare row data with explicit status
  const rowData = [
    finalEstimateId,               // EstimateID
    data.projectId || '',          // ProjectID
    now,                           // DateCreated
    data.customerId || '',         // CustomerID
    data.estimatedAmount || 0,     // EstimatedAmount
    data.contingencyAmount || 0,   // ContingencyAmount
    JSON.stringify(data.tableItems || []), // ScopeItemsJSON
    userEmail,                     // CreatedBy
    '',                            // DocUrl placeholder
    '',                            // DocId placeholder
    status,                        // Status - use passed in status
    '',                            // SentDate
    'true',                        // IsActive
    '',                            // PreviousVersionId
    '1',                           // VersionNumber
    '',                            // ApprovedDate
    '',                            // ApprovedBy
    data.estimatedAmount || 0,     // UpdatedAmount
    '',                            // ActiveEstimateId
    data.estimatedAmount || 0      // CurrentApprovedAmount
  ];

  sheet.appendRow(rowData);

  return {
    estimateId: finalEstimateId,
    createdOn: now,
    status: status
  };
}

// ==========================================
// NEW: UPDATE DOC URL HELPERS FOR MATERIALS & SUBINVOICES
// ==========================================

function updateMaterialsReceiptDocUrl(receiptId, docUrl, docId) {
  const sheet = getSheet(CONFIG.SHEETS.MATERIALS_RECEIPTS);
  if (!sheet) throw new Error("Materials Receipts sheet not found");
  
  const data = sheet.getDataRange().getValues();
  // Column 0 is the receiptId
  // Column 5 is existing doc URL (1-based => column 6)
  // We'll store docId in column 10 (arbitrary example) if we want
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowReceiptId = row[0];
    if (rowReceiptId === receiptId) {
      sheet.getRange(i + 1, 6).setValue(docUrl);  // doc url at col 6
      // Put docId in col 10 if you added a new column for it
      sheet.getRange(i + 1, 10).setValue(docId);
      break;
    }
  }
}

function updateSubInvoiceDocUrl(invoiceId, docUrl, docId) {
  const sheet = getSheet(CONFIG.SHEETS.SUBINVOICES);
  if (!sheet) throw new Error("Subinvoices sheet not found");

  const data = sheet.getDataRange().getValues();
  // Column 0 is invoiceId
  // Column 6 is existing doc URL (1-based => column 7)
  // We'll store docId in column 10 if we want
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowInvoiceId = row[0];
    if (rowInvoiceId === invoiceId) {
      sheet.getRange(i + 1, 7).setValue(docUrl); // doc url at col 7
      sheet.getRange(i + 1, 10).setValue(docId); // if you have a new column
      break;
    }
  }
}

// ==========================================
// FUNCTIONS FOR CUSTOMER MANGEMENT MODULE
// ==========================================

function getCustomers() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.CUSTOMERS);
  
  const customerIdCol = headers.indexOf("CustomerID");
  const nameCol = headers.indexOf("CustomerName");
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("ContactEmail");
  const phoneCol = headers.indexOf("Phone");
  const statusCol = headers.length - 1; // Status is last column
  
  return rows.map(row => ({
    customerId: row[customerIdCol],
    name: row[nameCol],
    address: row[addressCol],
    city: row[cityCol],
    state: row[stateCol],
    zip: row[zipCol],
    email: row[emailCol],
    phone: row[phoneCol],
    status: row[statusCol] || CUSTOMER_STATUSES.ACTIVE // Default to ACTIVE if not set
  }));
}

function getCustomerProjects(customerId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);
  
  const projectIdCol = headers.indexOf("ProjectID");
  const customerIdCol = headers.indexOf("CustomerID");
  const nameCol = headers.indexOf("ProjectName");
  const statusCol = headers.indexOf("Status");
  const createdOnCol = headers.indexOf("CreatedOn");
  const jobIdCol = headers.indexOf("JobID");
  
  return rows
    .filter(row => row[customerIdCol] === customerId)
    .map(row => ({
      projectId: row[projectIdCol],
      name: row[nameCol],
      status: row[statusCol],
      createdOn: row[createdOnCol],
      jobId: row[jobIdCol] || ''
    }));
}

function getCustomerEstimates(customerId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.ESTIMATES);
  
  const estimateIdCol = headers.indexOf("EstimateID");
  const projectIdCol = headers.indexOf("ProjectID");
  const customerIdCol = headers.indexOf("CustomerID");
  const dateCol = headers.indexOf("DateCreated");
  const amountCol = headers.indexOf("EstimatedAmount");
  const statusCol = headers.indexOf("Status");
  const versionCol = headers.indexOf("VersionNumber");
  const isActiveCol = headers.indexOf("IsActive");
  const approvedAmountCol = headers.indexOf("CurrentApprovedAmount");
  
  return rows
    .filter(row => row[customerIdCol] === customerId)
    .map(row => ({
      estimateId: row[estimateIdCol],
      projectId: row[projectIdCol],
      dateCreated: row[dateCol],
      amount: parseFloat(row[amountCol]) || 0,
      status: row[statusCol],
      versionNumber: row[versionCol],
      isActive: row[isActiveCol] === 'true',
      approvedAmount: parseFloat(row[approvedAmountCol]) || 0
    }));
}

function enrichCustomerData(customer) {
  // Get projects
  const projects = getCustomerProjects(customer.customerId);
  
  // Get estimates
  const estimates = getCustomerEstimates(customer.customerId);
  
  // Calculate metrics
  const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS');
  const approvedEstimates = estimates.filter(e => e.status === 'APPROVED');
  const totalApprovedAmount = approvedEstimates.reduce((sum, e) => sum + e.approvedAmount, 0);
  
  return {
    ...customer,
    projects,
    estimates,
    metrics: {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      completedProjects: projects.filter(p => p.status === 'COMPLETED').length,
      totalEstimates: estimates.length,
      approvedEstimates: approvedEstimates.length,
      totalApprovedAmount,
      estimateConversionRate: estimates.length ? (approvedEstimates.length / estimates.length) * 100 : 0,
      averageProjectValue: projects.length ? totalApprovedAmount / projects.length : 0,
      lastActivity: projects.length ? new Date(Math.max(...projects.map(p => new Date(p.createdOn)))) : null
    }
  };
}



// === Add these functions to Database.gs ===

// Customer Contacts Functions
function getCustomerContacts(customerId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.CUSTOMER_CONTACTS);
  
  const customerIdCol = headers.indexOf("CustomerID");
  const contactIdCol = headers.indexOf("ContactID");
  const roleCol = headers.indexOf("Role");
  const nameCol = headers.indexOf("Name");
  const emailCol = headers.indexOf("Email");
  const phoneCol = headers.indexOf("Phone");
  const titleCol = headers.indexOf("Title");
  const primaryCol = headers.indexOf("IsPrimary");
  const statusCol = headers.indexOf("Status");
  
  return rows
    .filter(row => row[customerIdCol] === customerId)
    .map(row => ({
      contactId: row[contactIdCol],
      role: row[roleCol],
      name: row[nameCol],
      email: row[emailCol],
      phone: row[phoneCol],
      title: row[titleCol],
      isPrimary: row[primaryCol] === 'true',
      status: row[statusCol]
    }));
}

function createCustomerContact(data) {
  const sheet = getSheet(CONFIG.SHEETS.CUSTOMER_CONTACTS);
  if (!sheet) throw new Error("Customer Contacts sheet not found");

  const contactId = generateContactID();
  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();

  sheet.appendRow([
    contactId,              // ContactID
    data.customerId,        // CustomerID
    data.role,             // Role
    data.name,             // Name
    data.email,            // Email
    data.phone || '',      // Phone
    data.title || '',      // Title
    data.isPrimary || false, // IsPrimary
    'ACTIVE',              // Status
    now,                   // CreatedOn
    userEmail,             // CreatedBy
    now,                   // LastModified
    userEmail              // LastModifiedBy
  ]);

  return {
    success: true,
    data: {
      contactId,
      customerId: data.customerId,
      role: data.role,
      name: data.name,
      email: data.email,
      phone: data.phone,
      title: data.title,
      isPrimary: data.isPrimary,
      status: 'ACTIVE',
      createdOn: now,
      createdBy: userEmail
    }
  };
}

// Customer Documents Functions
function getCustomerDocuments(customerId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.CUSTOMER_DOCUMENTS);
  
  const customerIdCol = headers.indexOf("CustomerID");
  const documentIdCol = headers.indexOf("DocumentID");
  const typeCol = headers.indexOf("Type");
  const nameCol = headers.indexOf("Name");
  const urlCol = headers.indexOf("URL");
  const statusCol = headers.indexOf("Status");
  const versionCol = headers.indexOf("Version");
  
  return rows
    .filter(row => row[customerIdCol] === customerId)
    .map(row => ({
      documentId: row[documentIdCol],
      type: row[typeCol],
      name: row[nameCol],
      url: row[urlCol],
      status: row[statusCol],
      version: row[versionCol]
    }));
}

function createCustomerDocument(data) {
  const sheet = getSheet(CONFIG.SHEETS.CUSTOMER_DOCUMENTS);
  if (!sheet) throw new Error("Customer Documents sheet not found");

  const documentId = generateDocumentID();
  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();

  sheet.appendRow([
    documentId,           // DocumentID
    data.customerId,      // CustomerID
    data.type,           // Type
    data.name,           // Name
    data.url,            // URL
    data.description || '', // Description
    '1.0',               // Version
    'ACTIVE',            // Status
    now,                 // CreatedOn
    userEmail,           // CreatedBy
    now,                 // LastModified
    userEmail            // LastModifiedBy
  ]);

  return {
    success: true,
    data: {
      documentId,
      customerId: data.customerId,
      type: data.type,
      name: data.name,
      url: data.url,
      version: '1.0',
      status: 'ACTIVE',
      createdOn: now,
      createdBy: userEmail
    }
  };
}

// Customer Communications Functions
function getCustomerCommunications(customerId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.CUSTOMER_COMMUNICATIONS);
  
  const customerIdCol = headers.indexOf("CustomerID");
  const commIdCol = headers.indexOf("CommunicationID");
  const typeCol = headers.indexOf("Type");
  const subjectCol = headers.indexOf("Subject");
  const contentCol = headers.indexOf("Content");
  const statusCol = headers.indexOf("Status");
  const sentToCol = headers.indexOf("SentTo");
  
  return rows
    .filter(row => row[customerIdCol] === customerId)
    .map(row => ({
      communicationId: row[commIdCol],
      type: row[typeCol],
      subject: row[subjectCol],
      content: row[contentCol],
      status: row[statusCol],
      sentTo: row[sentToCol]
    }));
}

function createCustomerCommunication(data) {
  const sheet = getSheet(CONFIG.SHEETS.CUSTOMER_COMMUNICATIONS);
  if (!sheet) throw new Error("Customer Communications sheet not found");

  const communicationId = generateCommunicationID();
  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();

  sheet.appendRow([
    communicationId,      // CommunicationID
    data.customerId,      // CustomerID
    data.type,           // Type
    data.subject,        // Subject
    data.content,        // Content
    data.sentTo,         // SentTo
    'DRAFT',             // Status
    now,                 // CreatedOn
    userEmail,           // CreatedBy
    now,                 // LastModified
    userEmail            // LastModifiedBy
  ]);

  return {
    success: true,
    data: {
      communicationId,
      customerId: data.customerId,
      type: data.type,
      subject: data.subject,
      content: data.content,
      sentTo: data.sentTo,
      status: 'DRAFT',
      createdOn: now,
      createdBy: userEmail
    }
  };
}

// ID Generation Functions
function generateContactID() {
  return `CONT-${new Date().getTime()}`;
}

function generateDocumentID() {
  return `DOC-${new Date().getTime()}`;
}

function generateCommunicationID() {
  return `COMM-${new Date().getTime()}`;
}

// Add these to the existing enrichCustomerData function
function enrichCustomerData(customer) {
  // Get existing data
  const projects = getCustomerProjects(customer.customerId);
  const estimates = getCustomerEstimates(customer.customerId);
  
  // Get new data
  const contacts = getCustomerContacts(customer.customerId);
  const documents = getCustomerDocuments(customer.customerId);
  const communications = getCustomerCommunications(customer.customerId);
  
  // Calculate existing metrics
  const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS');
  const approvedEstimates = estimates.filter(e => e.status === 'APPROVED');
  const totalApprovedAmount = approvedEstimates.reduce((sum, e) => sum + e.approvedAmount, 0);
  
  // Calculate new metrics
  const activeContacts = contacts.filter(c => c.status === 'ACTIVE');
  const activeDocuments = documents.filter(d => d.status === 'ACTIVE');
  const recentCommunications = communications
    .filter(c => new Date(c.createdOn) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  return {
    ...customer,
    contacts,
    documents,
    communications,
    projects,
    estimates,
    metrics: {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      completedProjects: projects.filter(p => p.status === 'COMPLETED').length,
      totalEstimates: estimates.length,
      approvedEstimates: approvedEstimates.length,
      totalApprovedAmount,
      estimateConversionRate: estimates.length ? (approvedEstimates.length / estimates.length) * 100 : 0,
      averageProjectValue: projects.length ? totalApprovedAmount / projects.length : 0,
      lastActivity: projects.length ? new Date(Math.max(...projects.map(p => new Date(p.createdOn)))) : null,
      // New metrics
      totalContacts: contacts.length,
      activeContacts: activeContacts.length,
      totalDocuments: documents.length,
      activeDocuments: activeDocuments.length,
      recentCommunications: recentCommunications.length
    }
  };
}