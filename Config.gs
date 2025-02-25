// Config.gs

const CONFIG = {
  // === Main Spreadsheet ID ===
  SPREADSHEET_ID: "1eSwZwz5uPGPVyHkXAt8TFQuS4fLAOqeX5b-PvhK2Ghg",

  // === Sheet Names ===
  SHEETS: {
    PROJECTS: "Projects",
    TIME_LOGS: "TimeLogs",
    MATERIALS_RECEIPTS: "MaterialsReceipts",
    SUBCONTRACTORS: "Subcontractors",
    SUBINVOICES: "Subinvoices",
    ESTIMATES: "Estimates",
    CUSTOMERS: "Customers",
    ACTIVITY_LOG: "ActivityLog",
    VENDORS: "Vendors",
    CUSTOMER_CONTACTS: "CustomerContacts",
    CUSTOMER_DOCUMENTS: "CustomerDocuments",
    CUSTOMER_COMMUNICATIONS: "CustomerComms"
  },

  // === Templates / Estimate Document References ===
  TEMPLATES: {
    ESTIMATE: {
      FOLDER_ID: "1whTNqMixlToIAzT4ZSqwH4c8b-PUxFoM",
      TEMPLATE_DOC_ID: "1uf8ZrAGNIkzoWHfaIaEHYNQ6PqZ7roHfa2FxO0ZkEHg",
      FILE_NAME_PREFIX: "EST-",
      COMMUNICATION: {
        ESTIMATE_FOLLOWUP: "EST_FOLLOWUP",
        PAYMENT_REMINDER: "PAYMENT_REMINDER",
        STATUS_UPDATE: "STATUS_UPDATE"
      }
    },
    CUSTOMER: {
      COMMUNICATION: {
        ESTIMATE_FOLLOWUP: "EST_FOLLOWUP",
        PAYMENT_REMINDER: "PAYMENT_REMINDER",
        STATUS_UPDATE: "STATUS_UPDATE"
      }
    }
  },

  // === Folder Structure ===
  FOLDERS: {
    PARENT_ID: "0AFEjkvrWgRIaUk9PVA"
  },

  // === Dynamic Customer Year ===
  CURRENT_CUSTOMER_YEAR: new Date().getFullYear().toString(),

  // === Customer Module Configuration ===
  CUSTOMER_MODULE: {
    DOCUMENT_TYPES: {
      ESTIMATE: 'ESTIMATE',
      CONTRACT: 'CONTRACT',
      INVOICE: 'INVOICE',
      COMMUNICATION: 'COMMUNICATION',
      OTHER: 'OTHER'
    },
    CONTACT_ROLES: {
      PRIMARY: 'PRIMARY',
      BILLING: 'BILLING',
      TECHNICAL: 'TECHNICAL',
      MANAGEMENT: 'MANAGEMENT',
      OTHER: 'OTHER'
    },
    VIEWS: {
      DASHBOARD: 'dashboard',
      DETAILS: 'details',
      ESTIMATES: 'estimates',
      PROJECTS: 'projects',
      DOCUMENTS: 'documents',
      CONTACTS: 'contacts',
      FINANCIALS: 'financials',
      COMMUNICATIONS: 'communications'
    },
    DOCUMENT_CONFIG: {
      maxFileSize: 10485760, // 10MB
      allowedTypes: {
        DEFAULT: ['application/pdf', 'image/jpeg', 'image/png'],
        ESTIMATE: ['application/pdf'],
        CONTRACT: ['application/pdf'],
        INVOICE: ['application/pdf'],
        COMMUNICATION: ['application/pdf', 'text/plain']
      }
    }
  },
  
  // === Status Configuration ===
  STATUS_CONFIG: {
    ESTIMATE: {
      DRAFT: { color: 'gray', icon: 'edit', label: 'Draft', actions: ['submit', 'cancel'] },
      PENDING: { color: 'yellow', icon: 'clock', label: 'Pending Review', actions: ['approve', 'reject', 'cancel'] },
      APPROVED: { color: 'green', icon: 'check', label: 'Approved', actions: ['complete', 'cancel'] },
      REJECTED: { color: 'red', icon: 'x', label: 'Rejected', actions: ['revise', 'cancel'] },
      COMPLETED: { color: 'blue', icon: 'flag', label: 'Completed', actions: ['close'] },
      CANCELLED: { color: 'gray', icon: 'ban', label: 'Cancelled', actions: [] },
      CLOSED: { color: 'gray', icon: 'archive', label: 'Closed', actions: [] }
    },
    PROJECT: {
      DRAFT: { color: 'gray', icon: 'edit', label: 'Draft' },
      PENDING: { color: 'yellow', icon: 'clock', label: 'Pending' },
      APPROVED: { color: 'green', icon: 'check', label: 'Approved' },
      IN_PROGRESS: { color: 'blue', icon: 'play', label: 'In Progress' },
      COMPLETED: { color: 'purple', icon: 'flag', label: 'Completed' },
      CANCELLED: { color: 'red', icon: 'x', label: 'Cancelled' },
      CLOSED: { color: 'gray', icon: 'archive', label: 'Closed' }
    }
  },
  
  // === Permissions Configuration ===
  PERMISSIONS: {
    CUSTOMER: {
      view: ['CREATOR', 'MANAGER', 'ADMIN'],
      edit: ['MANAGER', 'ADMIN'],
      delete: ['ADMIN'],
      dashboard: { view: ['CREATOR', 'MANAGER', 'ADMIN'] },
      contacts: { view: ['CREATOR', 'MANAGER', 'ADMIN'] },
      projects: { view: ['CREATOR', 'MANAGER', 'ADMIN'] },
      estimates: { view: ['CREATOR', 'MANAGER', 'ADMIN'] },
      documents: { view: ['CREATOR', 'MANAGER', 'ADMIN'] },
      communications: { view: ['CREATOR', 'MANAGER', 'ADMIN'] },
      financials: { view: ['CREATOR', 'MANAGER', 'ADMIN'] }
    },
    PROJECT: {
      timeTracking: {
        submit: ['CREATOR', 'MANAGER', 'ADMIN'],
        view: ['CREATOR', 'MANAGER', 'ADMIN']
      },
      subInvoices: {
        submit: ['CREATOR', 'MANAGER', 'ADMIN']
      }
    },
    ESTIMATES: {
      view: ['CREATOR', 'MANAGER', 'ADMIN'],
      create: ['CREATOR', 'MANAGER', 'ADMIN'],
      update: ['MANAGER', 'ADMIN']
    }
  },
  
  // Remainder of the file remains the same as in your original document
  // ... (rest of the code stays identical)
};

// Function to export client-side configuration
function getClientConfig() {
  return {
    STATUS_CONFIG: CONFIG.STATUS_CONFIG,
    workflow: CONFIG.workflow,
    PERMISSIONS: CONFIG.PERMISSIONS,
    CUSTOMER_MODULE: CONFIG.CUSTOMER_MODULE,
    MATERIALS_RECEIPTS: CONFIG.MATERIALS_RECEIPTS
  };
}