/**************************************
 * Code.gs - Main Application Logic
 **************************************/

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function extractFolderIdFromUrl(folderUrl) {
  const urlPatterns = [
    /\/folders\/([a-zA-Z0-9-_]+)/, 
    /\/drive\/folders\/([a-zA-Z0-9-_]+)/, 
    /id=([a-zA-Z0-9-_]+)/
  ];
  for (let pattern of urlPatterns) {
    const match = folderUrl.match(pattern);
    if (match && match[1]) return match[1];
  }
  throw new Error("Could not extract folder ID from the provided URL");
}

// ==========================================
// WEBAPP INITIALIZATION
// ==========================================

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('AKC LLC Management')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================
// PROJECT MANAGEMENT
// ==========================================

function getProjects() {
  const context = 'getProjects';
  try {
    const projects = getActiveProjects();
    return createStandardResponse(true, projects); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function setWorkspacePermissions(folders) {
  const DOMAIN = 'austinkunzconstruction.com';
  
  // Helper function to set permissions on a single folder
  const setFolderPermission = (folderId) => {
    try {
      Logger.log('Setting permissions for folder: ' + folderId);
      
      // First verify we can access the folder
      const folder = DriveApp.getFolderById(folderId);
      Logger.log('Found folder: ' + folder.getName());
      
      // Create the permission using proven working configuration
      const permissionResource = {
        'type': 'domain',
        'role': 'writer',
        'domain': DOMAIN
      };
      
      const createResponse = Drive.Permissions.create(
        permissionResource,
        folderId,
        {
          'supportsAllDrives': true,
          'fields': 'id'
        }
      );
      
      Logger.log(`Permission created for ${folder.getName()} with ID: ${createResponse.id}`);
      return true;
    } catch (error) {
      Logger.log(`Error setting permissions for folder ${folderId}: ${error.message}`);
      return false;
    }
  };

  // Get all folder IDs to process
  const folderIds = new Set();
  
  // Add main folder
  if (folders.main) {
    folderIds.add(folders.main);
  } else if (folders.folderId) {
    folderIds.add(folders.folderId);
  }
  
  // Add subfolders
  if (folders.estimates) folderIds.add(folders.estimates);
  if (folders.materials) folderIds.add(folders.materials);
  if (folders.subInvoices) folderIds.add(folders.subInvoices);
  
  Logger.log('Processing permissions for folders: ' + Array.from(folderIds).join(', '));
  
  // Set permissions for each folder
  let allSuccessful = true;
  for (const folderId of folderIds) {
    if (!setFolderPermission(folderId)) {
      allSuccessful = false;
    }
  }
  
  return allSuccessful;
}

function createProject(data) {
  const context = 'createProject';
  try {
    // 1) Validate required fields
    const requiredFields = ['customerId', 'projectName'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    // 2) Get customer data to ensure we have all necessary info
    const customers = getCustomerData();
    const customer = customers.find(c => c.customerId === data.customerId);
    if (!customer) {
      return createStandardResponse(false, null, 'Customer not found'); // USE Utils.js
    }

    // 3) Create project record with enriched data
    const result = createProjectRecord({
      ...data,
      customerName: customer.name, // Add customer name for folder creation
      customerInfo: customer // Pass full customer info if needed
    });

    // 4) Set workspace permissions on all created folders
    const permissionsResult = setWorkspacePermissions(result.data.folders);
    if (!permissionsResult) {
      Logger.log(`Warning: Permissions setting may have failed for some folders in project ${result.data.projectId}`);
    }

    // 5) Log activity with enriched data
    logSystemActivity( // USE Utils.js
      'PROJECT_CREATED',
      'PROJECT',
      result.data.projectId,
      {
        customerId: data.customerId,
        customerName: customer.name,
        projectName: data.projectName,
        folderId: result.data.folderId,
        folders: result.data.folders,
        status: result.data.status
      }
    );

    // 6) Return the newly created project
    return createStandardResponse(true, result.data); // USE Utils.js

  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return handleError(error, context); // USE Utils.js
  }
}

// ==========================================
// TIME LOGGING
// ==========================================

function submitTimeLog(data) {
  const context = 'submitTimeLog';
  try {
    // Validate required fields
    const requiredFields = ['date', 'startTime', 'endTime', 'projectId'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    const submittingUser = Session.getActiveUser().getEmail();

    // Calculate hours
    const startTime = new Date(`${data.date} ${data.startTime}`);
    const endTime = new Date(`${data.date} ${data.endTime}`);
    const hours = (endTime - startTime) / (1000 * 60 * 60);
    
    if (hours <= 0) {
      return createStandardResponse(false, null, "End time must be after start time"); // USE Utils.js
    }

    // Insert into DB
    const result = logTime({
      projectId: data.projectId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      hours: hours,
      submittingUser,
      forUserEmail: data.forUserEmail || ''
    });

    // Log activity
    logSystemActivity( // USE Utils.js
      'TIME_LOG_CREATED',
      'TIME',
      result.id,
      {
        projectId: data.projectId,
        date: data.date,
        hours: hours,
        forUserEmail: data.forUserEmail || submittingUser,
        timeLogId: result.id
      }
    );

    return createStandardResponse(true, result); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

// ==========================================
// MATERIALS RECEIPT MANAGEMENT
// ==========================================

function submitMaterialsReceipt(data) {
  const context = 'submitMaterialsReceipt';
  try {
    // Validate required fields
    const requiredFields = ['projectId', 'vendorId', 'vendorName', 'amount'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    // Validate amount is a positive number
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return createStandardResponse(false, null, "Amount must be a positive number"); // USE Utils.js
    }

    const submittingUser = Session.getActiveUser().getEmail();

    // Insert into DB
    const result = logMaterialsReceipt({
      projectId: data.projectId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      amount: amount,
      receiptDocURL: data.receiptDocURL || '',
      submittingUser,
      forUserEmail: data.forUserEmail || ''
    });

    // Optionally, if you want the 2-step approach like estimates:
    // (Already appended row, so now let's update if docURL is present)
    if (result && result.id && data.receiptDocURL) {
      updateMaterialsReceiptDocUrl(result.id, data.receiptDocURL, "");
    }

    // Log activity using standardized function
    logSystemActivity( // USE Utils.js
      'MATERIALS_RECEIPT_CREATED',
      'MATERIALS',
      result.id,
      {
        projectId: data.projectId,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        amount: amount,
        receiptDocURL: data.receiptDocURL || '',
        forUserEmail: data.forUserEmail || submittingUser
      }
    );

    return createStandardResponse(true, { // USE Utils.js
      id: result.id,
      amount: formatCurrency(amount), // USE Utils.js
      timestamp: formatDate(new Date(), 'iso')
    });

  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

// ==========================================
// VENDOR MANAGEMENT
// ==========================================

function getVendorsForClient() {
  const context = 'getVendorsForClient';
  try {
    const vendors = getVendors();
    return createStandardResponse(true, vendors); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function createVendorForClient(data) {
  const context = 'createVendorForClient';
  try {
    Logger.log('=== Starting createVendorForClient ===');
    Logger.log('Input data: ' + JSON.stringify(data));

    // Validate input
    if (!data || !data.vendorName) {
      Logger.log('Error: Missing vendorName in input');
      return createStandardResponse(false, null, 'Vendor name is required'); // USE Utils.js
    }

    // Validate required fields
    const requiredFields = ['vendorName'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      Logger.log('Validation failed: ' + validation.error);
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    // Create vendor
    Logger.log('Creating vendor with name: ' + data.vendorName);
    const result = createVendor(data);
    Logger.log('Create vendor result: ' + JSON.stringify(result));

    if (!result || !result.success) {
      Logger.log('Error: Vendor creation failed');
      return createStandardResponse(false, null, 'Failed to create vendor'); // USE Utils.js
    }

    // Log activity
    logSystemActivity( // USE Utils.js
      'VENDOR_CREATED',
      'VENDOR',
      result.data.vendorId,
      {
        vendorName: data.vendorName
      }
    );

    Logger.log('Vendor created successfully: ' + JSON.stringify(result.data));
    return createStandardResponse(true, result.data); // USE Utils.js

  } catch (error) {
    Logger.log('Error in createVendorForClient: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    return handleError(error, context); // USE Utils.js
  }
}

// ==========================================
// SUBCONTRACTOR MANAGEMENT
// ==========================================

function getSubcontractorsForClient() {
  try {
    const subcontractors = getSubcontractors();
    return createStandardResponse(true, subcontractors); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function submitSubInvoice(data) {
  const context = 'submitSubInvoice';
  try {
    const requiredFields = ['projectId', 'projectName', 'subId', 'subName', 'invoiceAmount'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    const submittingUser = Session.getActiveUser().getEmail();

    // Validate amount
    const amount = parseFloat(data.invoiceAmount);
    if (isNaN(amount) || amount <= 0) {
      return createStandardResponse(false, null, "Invoice amount must be a positive number"); // USE Utils.js
    }

    const result = logSubInvoice({
      projectId: data.projectId,
      projectName: data.projectName,
      subId: data.subId,
      subName: data.subName,
      invoiceAmount: amount,
      invoiceDocURL: data.invoiceDocURL || '',
      submittingUser
    });

    // Optionally update the doc URL after logging
    if (result && result.id && data.invoiceDocURL) {
      updateSubInvoiceDocUrl(result.id, data.invoiceDocURL, "");
    }

    logSystemActivity( // USE Utils.js
      'SUBINVOICE_CREATED',
      'SUBINVOICE',
      result.id,
      {
        projectId: data.projectId,
        projectName: data.projectName,
        subId: data.subId,
        subName: data.subName,
        invoiceAmount: formatCurrency(amount), // USE Utils.js
        invoiceDocURL: data.invoiceDocURL || ''
      }
    );

    return createStandardResponse(true, { // USE Utils.js
      id: result.id,
      amount: formatCurrency(amount) // USE Utils.js
    });
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

function getCustomersForClient() {
  try {
    Logger.log('=== Starting getCustomersForClient ===');

    // Get sheet data
    const sheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
    if (!sheet) {
      Logger.log('ERROR: Could not access Customers sheet');
      return createStandardResponse(false, null, 'Could not access customer data'); // USE Utils.js
    }

    // Get all data including headers
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1); // Skip header row

    Logger.log(`Found ${rows.length} customer rows`);

    // Get column indices
    const customerIdCol = headers.indexOf('CustomerID');
    const nameCol = headers.indexOf('CustomerName');
    const addressCol = headers.indexOf('Address');
    const cityCol = headers.indexOf('City');
    const stateCol = headers.indexOf('State');
    const zipCol = headers.indexOf('Zip');
    const emailCol = headers.indexOf('ContactEmail');
    const phoneCol = headers.indexOf('Phone');
    const statusCol = headers.length - 1; // Status is last column

    // Validate column indices
    if (customerIdCol === -1 || nameCol === -1) {
      Logger.log('ERROR: Required columns not found');
      Logger.log('Headers:', headers);
      return createStandardResponse(false, null, 'Customer data sheet is missing required columns'); // USE Utils.js
    }

    // Transform data
    const customers = rows
      .filter(row => {
        // Filter out invalid/empty rows
        const customerId = row[customerIdCol];
        return customerId && 
               !customerId.toString().includes('undefined') && 
               customerId.toString().trim() !== '';
      })
      .map(row => {
        // Map to customer objects
        const customer = {
          customerId: row[customerIdCol],
          name: row[nameCol] || '',
          address: row[addressCol] || '',
          city: row[cityCol] || '',
          state: row[stateCol] || '',
          zip: row[zipCol] || '',
          email: row[emailCol] || '',
          phone: row[phoneCol] || '',
          status: row[statusCol] || 'Active'
        };
        Logger.log(`Processed customer: ${customer.customerId} - ${customer.name}`);
        return customer;
      });

    Logger.log(`Returning ${customers.length} valid customers`);
    return createStandardResponse(true, customers); // USE Utils.js

  } catch (error) {
    Logger.log('ERROR in getCustomersForClient:', error.message);
    Logger.log('Stack:', error.stack);
    return createStandardResponse(false, null, `Error getting customers: ${error.message}`); // USE Utils.js
  }
}

function createCustomer(data) {
  const context = 'createCustomer';
  try {
    const result = createCustomerRecord(data);
    // Use standardized response format
    return createStandardResponse(true, result.data); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function getCustomerDetailsForClient(customerId) {
  const context = 'getCustomerDetailsForClient';
  try {
    const customers = getCustomerData();
    const customer = customers.find(c => c.customerId === customerId);
    
    if (!customer) {
      return createStandardResponse(false, null, 'Customer not found'); // USE Utils.js
    }
    
    const enrichedCustomer = enrichCustomerData(customer);
    return createStandardResponse(true, enrichedCustomer); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function updateCustomerStatus(data) {
  const context = 'updateCustomerStatus';
  try {
    const sheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    
    const customerIdCol = headers.indexOf("CustomerID");
    let statusCol = headers.indexOf("Status");
    
    // If Status column not found by name, use last column
    if (statusCol === -1) {
      statusCol = headers.length - 1;
    }
    
    Logger.log(`CustomerID column: ${customerIdCol}`);
    Logger.log(`Status column: ${statusCol}`);
    
    const rowIndex = values.findIndex(row => row[customerIdCol] === data.customerId);
    if (rowIndex === -1) {
      throw new Error('Customer not found');
    }
    
    // Update status with proper range validation
    if (rowIndex >= 0 && statusCol >= 0) {
      sheet.getRange(rowIndex + 1, statusCol + 1).setValue(data.newStatus);
      return createStandardResponse(true, { // USE Utils.js
        customerId: data.customerId,
        status: data.newStatus
      });
    } else {
      throw new Error('Invalid row or column index');
    }
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return handleError(error, context); // USE Utils.js
  }
}

// ==========================================
// FILE UPLOAD HANDLERS
// ==========================================

function uploadReceiptFile(base64Data, folderId, fileType = 'MATREC') {
  const context = 'uploadReceiptFile';
  try {
    // Extensive logging
    Logger.log('=== Upload Receipt File Start ===');
    Logger.log('Received base64Data length: ' + base64Data.length);
    Logger.log('Folder ID: ' + folderId);
    Logger.log('Folder ID Type: ' + typeof folderId);
    Logger.log('File Type: ' + fileType);

    // Validate required inputs
    if (!base64Data || !folderId) {
      Logger.log('Missing base64 data or folder ID');
      return createStandardResponse(false, null, "Missing base64 data or folder ID"); // USE Utils.js
    }

    // Validate folder ID
    if (typeof folderId !== 'string' || folderId.trim() === '') {
      Logger.log('Invalid folder ID format');
      return createStandardResponse(false, null, "Invalid folder ID format"); // USE Utils.js
    }

    // More robust MIME type extraction
    const mimeTypeMatch = base64Data.match(/^data:(.*?);base64,/);
    if (!mimeTypeMatch) {
      Logger.log('Invalid base64 data format');
      return createStandardResponse(false, null, "Invalid base64 data format"); // USE Utils.js
    }

    const mimeType = mimeTypeMatch[1];
    const fileExtension = mimeType.split('/')[1];

    Logger.log('Detected MIME Type: ' + mimeType);
    Logger.log('File Extension: ' + fileExtension);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(mimeType)) {
      Logger.log('Disallowed file type: ' + mimeType);
      return createStandardResponse(false, null, `File type ${mimeType} is not allowed`); // USE Utils.js
    }

    // Generate unique file ID
    const timestamp = new Date().getTime();
    const fileId = `${fileType}-${timestamp}`;

    // Additional error handling for base64 decoding
    let decodedData;
    try {
      decodedData = Utilities.base64Decode(base64Data.split(",")[1]);
      Logger.log('Successfully decoded base64 data');
    } catch (decodeError) {
      Logger.log('Base64 decoding error: ' + decodeError.message);
      return createStandardResponse(false, null, "Failed to decode base64 data"); // USE Utils.js
    }

    // Create blob
    const fileBlob = Utilities.newBlob(
      decodedData,
      mimeType,
      `${fileId}.${fileExtension}`
    );

    // Validate file size (10MB max)
    const sizeValidation = validateFileSize(fileBlob.getBytes().length); // USE Utils.js
    if (!sizeValidation.valid) {
      Logger.log('File size validation failed');
      return createStandardResponse(false, null, sizeValidation.error); // USE Utils.js
    }

    // Verify folder exists with comprehensive debugging
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
      Logger.log('Folder verified: ' + folder.getName());
      Logger.log('Folder ID: ' + folder.getId());
    } catch (folderError) {
      Logger.log('Folder verification failed: ' + folderError.message);
      
      // Additional debugging: log all existing project folders
      try {
        const projects = getActiveProjects();
        Logger.log('Project Folders Lookup:');
        projects.forEach(proj => {
          Logger.log(`Project: ${proj.name}`);
          Logger.log(`Main Folder ID: ${proj.folderId}`);
          Logger.log(`Estimates Folder ID: ${proj.estimatesFolderId}`);
          Logger.log(`Materials Folder ID: ${proj.materialsFolderId}`);
          Logger.log(`SubInvoices Folder ID: ${proj.subInvoicesFolderId}`);
          Logger.log('---');
        });
      } catch (projectsError) {
        Logger.log('Error retrieving project folders: ' + projectsError.message);
      }

      return createStandardResponse(false, null, "Invalid folder ID: " + folderId); // USE Utils.js
    }

    // Upload to Drive with enhanced error handling
    let uploadedFile;
    try {
      const fileMetadata = {
        name: fileBlob.getName(),
        parents: [folderId],
        mimeType: fileBlob.getContentType()
      };

      uploadedFile = Drive.Files.create(fileMetadata, fileBlob, {
        supportsAllDrives: true
      });
      Logger.log('File uploaded successfully');
      Logger.log('File ID: ' + uploadedFile.id);
      Logger.log('File Name: ' + uploadedFile.name);
      Logger.log('File Type: ' + uploadedFile.mimeType);
      Logger.log('File Size: ' + uploadedFile.size);
    } catch (uploadError) {
      Logger.log('Drive upload error: ' + uploadError.message);
      Logger.log('Full error object: ' + JSON.stringify(uploadError));
      return createStandardResponse(false, null, "Failed to upload file to Drive: " + uploadError.message); // USE Utils.js
    }

    // Log activity
    logSystemActivity( // USE Utils.js
      'FILE_UPLOADED',
      'FILE_STORAGE',
      uploadedFile.id,
      {
        fileName: uploadedFile.name,
        fileType: fileType,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size,
        originalFolderId: folderId
      }
    );

    // Return successful response
    return createStandardResponse(true, { // USE Utils.js
      url: `https://drive.google.com/file/d/${uploadedFile.id}/view`,
      name: uploadedFile.name,
      mimeType: uploadedFile.mimeType,
      id: fileId,
      folderId: folderId
    });

  } catch (error) {
    Logger.log('=== Unexpected Error in uploadReceiptFile ===');
    Logger.log('Error Message: ' + error.message);
    Logger.log('Error Stack: ' + error.stack);
    console.error('Unexpected error:', error);
    return handleError(error, context); // USE Utils.js
  }
}

// ==========================================
// ESTIMATE DOCUMENT GENERATION
// ==========================================

function generateEstimateDocument(data) {
  try {
    Logger.log("=== Starting generateEstimateDocument ===");
    Logger.log("Input data: " + JSON.stringify(data));

    let finalEstimateId = data.estimateId || generateEstimateID(data.projectId);
    data.estimateId = finalEstimateId;

    // **IMPORTANT**: Use the folder ID passed in (e.g. the Estimates subfolder ID)
    const templateDoc = DriveApp.getFileById(CONFIG.TEMPLATES.ESTIMATE.TEMPLATE_DOC_ID);
    const folderId = data.projectFolderId || CONFIG.FOLDERS.PARENT_ID;  // <--- updated
    const projectFolder = DriveApp.getFolderById(folderId);

    const baseName = `Estimate-${finalEstimateId}`;
    const newDocFile = templateDoc.makeCopy(baseName, projectFolder);
    const doc = DocumentApp.openById(newDocFile.getId());
    const body = doc.getBody();

    // Replace standard placeholders
    const replacements = {
      '{{EstimateNumber}}': finalEstimateId,
      '{{Date}}': new Date().toLocaleDateString(),
      '{{CustomerName}}': data.customerName || '',
      '{{CustomerAddress}}': data.customerAddress || '',
      '{{CustomerCityStateZip}}': `${data.customerCity || ''}, ${data.customerState || ''} ${data.customerZip || ''}`,
      '{{ScopeOfWork}}': data.scopeOfWork || ''
    };
    for (let [placeholder, value] of Object.entries(replacements)) {
      body.replaceText(placeholder, value);
    }

    // Fill service items table (if any)
    const tables = body.getTables();
    for (let table of tables) {
      const headerText = table.getCell(0, 0).getText().trim();
      if (headerText === 'ITEM/SERVICE') {
        Logger.log("Found service items table");

        const safeParse = (str) => parseFloat(String(str).replace(/[^0-9.]/g, '')) || 0;

        for (let i = 0; i < data.tableItems.length && i < (table.getNumRows() - 1); i++) {
          const rowIndex = i + 1;
          const item = data.tableItems[i];

          const numericRate = safeParse(item.rate);
          const numericAmount = safeParse(item.amount);

          table.getCell(rowIndex, 0).clear().setText(item.itemService || '');
          table.getCell(rowIndex, 1).clear().setText(item.description || '');
          table.getCell(rowIndex, 2).clear().setText(item.qtyHours || '');
          table.getCell(rowIndex, 3).clear().setText(formatCurrency(numericRate)); // USE Utils.js
          table.getCell(rowIndex, 4).clear().setText(formatCurrency(numericAmount)); // USE Utils.js

          Logger.log(`Wrote row ${rowIndex}: ${JSON.stringify(item)}`);
        }

        // Clear leftover rows
        for (let i = data.tableItems.length + 1; i < table.getNumRows(); i++) {
          for (let j = 0; j < 5; j++) {
            table.getCell(i, j).clear();
          }
        }
        break;
      }
    }

    // Save & create PDF
    doc.saveAndClose();
    Utilities.sleep(1500); // ensure changes propagate

    const docFile = DriveApp.getFileById(newDocFile.getId());
    const pdfBlob = docFile.getAs('application/pdf');
    pdfBlob.setName(`${baseName}.pdf`);
    const savedPdf = projectFolder.createFile(pdfBlob);

    return {
      success: true,
      data: {
        docUrl: savedPdf.getUrl(),
        docId: savedPdf.getId(),
        estimateId: finalEstimateId
      }
    };

  } catch (error) {
    Logger.log("Error in generateEstimateDocument: " + error.message);
    return { success: false, error: error.message };
  }
}

// ==========================================
// CREATE & SAVE ESTIMATE
// ==========================================

function createAndSaveEstimate(data) {
  const context = 'createAndSaveEstimate';
  try {
    Logger.log('=== Starting createAndSaveEstimate ===');
    Logger.log('Input data:', JSON.stringify(data));

    // 1. Validate required fields
    const requiredFields = ['customerName', 'projectName', 'scopeOfWork', 'tableItems', 'totalAmount'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    // 2. Create project record if this is a new estimate
    let projectId = data.projectId;
    if (!projectId) {
      const projectResult = createProjectRecord({
        customerId: data.customerId,
        projectName: data.projectName,
        status: 'PENDING'
      });
      
      if (!projectResult.success) {
        throw new Error('Failed to create project: ' + projectResult.error);
      }
      projectId = projectResult.data.projectId;
    }

    // 3. Generate estimate ID
    const estimateId = generateEstimateID(projectId);

    // 4. Create initial record in ESTIMATES sheet
    const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
    if (!sheet) throw new Error('Could not access Estimates sheet');

    const now = new Date();
    const userEmail = Session.getActiveUser().getEmail();

    const rowData = [
      estimateId,                    // EstimateID
      projectId,                     // ProjectID
      now,                          // DateCreated
      data.customerId,              // CustomerID
      data.totalAmount,             // EstimatedAmount
      data.contingencyAmount || 0,   // ContingencyAmount
      JSON.stringify(data.tableItems), // ScopeItemsJSON
      userEmail,                    // CreatedBy
      '',                           // DocUrl (placeholder)
      '',                           // DocId (placeholder)
      data.status || 'DRAFT',       // Status
      '',                           // SentDate
      'true',                       // IsActive
      data.previousVersionId || '', // PreviousVersionId
      '1',                          // VersionNumber
      '',                           // ApprovedDate
      '',                           // ApprovedBy
      data.totalAmount,             // UpdatedAmount
      '',                           // ActiveEstimateId
      data.totalAmount              // CurrentApprovedAmount
    ];

    sheet.appendRow(rowData);

    // 5. Generate document if requested
    let docInfo = null;
    if (data.generateDoc) {
      docInfo = generateEstimateDocument({
        estimateId,
        projectId,
        customerName: data.customerName,
        customerAddress: data.customerAddress,
        customerCity: data.customerCity,
        customerState: data.customerState,
        customerZip: data.customerZip,
        scopeOfWork: data.scopeOfWork,
        tableItems: data.tableItems,
        projectFolderId: data.projectFolderId
      });

      if (docInfo.success && docInfo.data.docUrl) {
        // Update doc URL and ID
        updateEstimateDocUrl(estimateId, docInfo.data.docUrl, docInfo.data.docId);
      }
    }

    // 6. Log activity
    logSystemActivity( // USE Utils.js
      'ESTIMATE_CREATED',
      'ESTIMATE',
      estimateId,
      {
        projectId,
        customerId: data.customerId,
        status: data.status || 'DRAFT',
        amount: data.totalAmount,
        generateDoc: data.generateDoc
      }
    );

    // 7. Return success with estimate info
    return createStandardResponse(true, { // USE Utils.js
      estimateId,
      projectId,
      status: data.status || 'DRAFT',
      docUrl: docInfo?.data?.docUrl || null,
      docId: docInfo?.data?.docId || null
    });

  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return handleError(error, context); // USE Utils.js
  }
}


function sendEstimateEmail(data) {
  const context = 'sendEstimateEmail';
  try {
    Logger.log('=== Starting sendEstimateEmail ===');
    Logger.log('Data received:', JSON.stringify(data));

    // Validate required fields
    const requiredFields = ['estimateId', 'recipientEmail', 'docId'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    // Get the document and create PDF
    const file = DriveApp.getFileById(data.docId);
    const pdf = file.getAs(MimeType.PDF);
    
    // Get the estimate details for the email content
    const { headers, rows } = getSheetData(CONFIG.SHEETS.ESTIMATES);
    const estimateRow = rows.find(row => row[headers.indexOf('EstimateID')] === data.estimateId);
    
    if (!estimateRow) {
      throw new Error('Estimate not found');
    }

    // Build email content
    const subject = data.subject || `Estimate ${data.estimateId} from AKC LLC`;
    const emailBody = `Dear ${data.customerName},

Please find attached your estimate (${data.estimateId}) for ${data.projectName}.

Total Amount: ${formatCurrency(data.amount)} // USE Utils.js

${data.notes ? '\nAdditional Notes:\n' + data.notes + '\n' : ''}

If you have any questions, please don't hesitate to contact us.

Best regards,
AKC LLC`;

    // Send email with PDF attachment
    GmailApp.sendEmail(
      data.recipientEmail,
      subject,
      emailBody,
      {
        attachments: [pdf],
        name: 'AKC LLC',
        replyTo: Session.getActiveUser().getEmail()
      }
    );

    // Log activity
    logSystemActivity( // USE Utils.js
      'ESTIMATE_EMAILED',
      'ESTIMATE',
      data.estimateId,
      {
        recipientEmail: data.recipientEmail,
        sentBy: Session.getActiveUser().getEmail(),
        timestamp: new Date()
      }
    );

    return createStandardResponse(true, { // USE Utils.js
      sent: true,
      timestamp: new Date(),
      recipient: data.recipientEmail
    });

  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return handleError(error, context); // USE Utils.js
  }
}

// ==========================================
// DATA SCHEMA AND STATUS CHANGE FUNCTIONS
// ==========================================

function updateEstimateStatusForClient(data) {
  const context = 'updateEstimateStatusForClient';
  try {
    // Validate required fields
    const requiredFields = ['estimateId', 'newStatus'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    const userEmail = Session.getActiveUser().getEmail();
    
    // Call database function
    const result = updateEstimateStatus(
      data.estimateId,
      data.newStatus,
      userEmail
    );

    return createStandardResponse(true, result.data); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function updateEstimateStatusWithSync(data) {
  const context = 'updateEstimateStatusWithSync';
  try {
    // Validate required fields: estimateId and newStatus.
    const requiredFields = ['estimateId', 'newStatus'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }
    
    const userEmail = Session.getActiveUser().getEmail();
    // Update the estimate status using the existing function.
    const result = updateEstimateStatus(data.estimateId, data.newStatus, userEmail);
    
    // If the estimate is approved, update the linked project.
    if (data.newStatus === 'APPROVED') {
      // Retrieve the Estimates sheet data to get the associated ProjectID.
      const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
      const allData = sheet.getDataRange().getValues();
      const headers = allData[0];
      const estimateIdCol = headers.indexOf('EstimateID');
      const projectIdCol = headers.indexOf('ProjectID');
      
      // Find the row that matches the estimateId.
      const rowIndex = allData.findIndex(row => row[estimateIdCol] === data.estimateId);
      if (rowIndex === -1) {
        throw new Error(`Estimate ${data.estimateId} not found in sheet after update.`);
      }
      const projectId = allData[rowIndex][projectIdCol];
      if (!projectId) {
        throw new Error(`Associated project not found for estimate ${data.estimateId}.`);
      }
      
      // Update the associated project's status to APPROVED.
      const projectUpdateResult = updateProjectStatus(projectId, 'APPROVED', userEmail);
      // (Optional: You could check projectUpdateResult for success if needed.)
      
      // Log the project status update (if not already logged inside updateProjectStatus).
      logActivity({ // USE Utils.js
        action: 'PROJECT_STATUS_UPDATED',
        moduleType: 'PROJECT',
        referenceId: projectId,
        userEmail: userEmail,
        details: {
          newStatus: 'APPROVED',
          relatedEstimate: data.estimateId
        }
      });
    }
    
    return createStandardResponse(true, result); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function updateProjectStatusForClient(data) {
  const context = 'updateProjectStatusForClient';
  try {
    // Validate required fields
    const requiredFields = ['projectId', 'newStatus'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    const userEmail = Session.getActiveUser().getEmail();
    
    // Call database function
    const result = updateProjectStatus(
      data.projectId,
      data.newStatus,
      userEmail
    );

    return createStandardResponse(true, result.data); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function updateEstimateAmountForClient(data) {
  const context = 'updateEstimateAmountForClient';
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const result = updateEstimateWithAmount({
      ...data,
      userEmail
    });

    return createStandardResponse(true, result.data);
  } catch (error) {
    return handleError(error, context);
  }
}

function loadPreviousEstimateVersion(data) {
  const context = 'loadPreviousEstimateVersion';
  try {
    // Validate required fields
    const requiredFields = ['projectId', 'previousEstimateId'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error); // USE Utils.js
    }

    // Get previous estimate data
    const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
    const estimates = sheet.getDataRange().getValues();
    const headers = estimates[0];
    
    const estimateRow = estimates.find(row => 
      row[headers.indexOf('EstimateID')] === data.previousEstimateId
    );

    if (!estimateRow) {
      return createStandardResponse(false, null, 'Previous estimate not found'); // USE Utils.js
    }

    // Create template for new version
    const templateData = {
      projectId: data.projectId,
      estimatedAmount: estimateRow[headers.indexOf('EstimatedAmount')],
      contingencyAmount: estimateRow[headers.indexOf('ContingencyAmount')],
      scopeItemsJSON: estimateRow[headers.indexOf('ScopeItemsJSON')],
      previousVersionId: data.previousEstimateId
    };

    return createStandardResponse(true, templateData); // USE Utils.js
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}

function getModuleVisibility(projectId) {
  const context = 'getModuleVisibility';
  try {
    const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const projectIdCol = headers.indexOf('ProjectID');
    const statusCol = headers.indexOf('Status');
    
    const projectRow = data.find(row => row[projectIdCol] === projectId);
    if (!projectRow) {
      return createStandardResponse(false, null, 'Project not found'); // USE Utils.js
    }

    const status = projectRow[statusCol];
    
    // Only show modules if project is APPROVED or IN_PROGRESS
    const modulesEnabled = ['APPROVED', 'IN_PROGRESS'].includes(status);
    
    return createStandardResponse(true, { // USE Utils.js
      timeLogging: modulesEnabled,
      materialsReceipts: modulesEnabled,
      subInvoices: modulesEnabled
    });
  } catch (error) {
    return handleError(error, context); // USE Utils.js
  }
}