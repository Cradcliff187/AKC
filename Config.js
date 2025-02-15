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
    CUSTOMER_CONTACTS: "CustomerContacts",       // New sheet
    CUSTOMER_DOCUMENTS: "CustomerDocuments",     // New sheet
    CUSTOMER_COMMUNICATIONS: "CustomerComms"     // New sheet
  },

  // === Templates / Estimate Document References ===
  TEMPLATES: {
    ESTIMATE: {
      FOLDER_ID: "1whTNqMixlToIAzT4ZSqwH4c8b-PUxFoM",
      TEMPLATE_DOC_ID: "1uf8ZrAGNIkzoWHfaIaEHYNQ6PqZ7roHfa2FxO0ZkEHg",
      FILE_NAME_PREFIX: "EST-"
    },
    CUSTOMER: {                                // New template section
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

  // === Customer Module Configuration ===        // New section
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
    }
  }
};

// === Status Constants ===
const PROJECT_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED'
};

const ESTIMATE_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED'
};

// === Customer Status Constants ===
const CUSTOMER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  ARCHIVED: 'ARCHIVED'
};

// === Document Status Constants ===   // New section
const DOCUMENT_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  EXPIRED: 'EXPIRED'
};

// === Communication Status Constants === // New section
const COMMUNICATION_STATUSES = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  REPLIED: 'REPLIED',
  FAILED: 'FAILED'
};

// Define valid status transitions
const STATUS_TRANSITIONS = {
  PROJECT: {
    [PROJECT_STATUSES.PENDING]: [PROJECT_STATUSES.APPROVED, PROJECT_STATUSES.CANCELLED],
    [PROJECT_STATUSES.APPROVED]: [PROJECT_STATUSES.IN_PROGRESS, PROJECT_STATUSES.CANCELLED],
    [PROJECT_STATUSES.IN_PROGRESS]: [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CANCELLED],
    [PROJECT_STATUSES.COMPLETED]: [PROJECT_STATUSES.CLOSED],
    [PROJECT_STATUSES.CANCELLED]: [],
    [PROJECT_STATUSES.CLOSED]: []
  },
  ESTIMATE: {
    [ESTIMATE_STATUSES.DRAFT]: [ESTIMATE_STATUSES.PENDING, ESTIMATE_STATUSES.CANCELLED],
    [ESTIMATE_STATUSES.PENDING]: [ESTIMATE_STATUSES.APPROVED, ESTIMATE_STATUSES.REJECTED, ESTIMATE_STATUSES.CANCELLED],
    [ESTIMATE_STATUSES.APPROVED]: [ESTIMATE_STATUSES.COMPLETED, ESTIMATE_STATUSES.CANCELLED],
    [ESTIMATE_STATUSES.REJECTED]: [ESTIMATE_STATUSES.DRAFT, ESTIMATE_STATUSES.CANCELLED],
    [ESTIMATE_STATUSES.COMPLETED]: [ESTIMATE_STATUSES.CLOSED],
    [ESTIMATE_STATUSES.CANCELLED]: [],
    [ESTIMATE_STATUSES.CLOSED]: []
  },
  CUSTOMER: {                        // New section
    [CUSTOMER_STATUSES.PENDING]: [CUSTOMER_STATUSES.ACTIVE, CUSTOMER_STATUSES.INACTIVE],
    [CUSTOMER_STATUSES.ACTIVE]: [CUSTOMER_STATUSES.INACTIVE, CUSTOMER_STATUSES.ARCHIVED],
    [CUSTOMER_STATUSES.INACTIVE]: [CUSTOMER_STATUSES.ACTIVE, CUSTOMER_STATUSES.ARCHIVED],
    [CUSTOMER_STATUSES.ARCHIVED]: [CUSTOMER_STATUSES.ACTIVE]
  }
};

// Statuses that allow module access
const MODULE_ACCESS_STATUSES = [PROJECT_STATUSES.APPROVED, PROJECT_STATUSES.IN_PROGRESS];

// === Module Permissions ===     // New section
const MODULE_PERMISSIONS = {
  CUSTOMER: {
    VIEW: 'customer:view',
    EDIT: 'customer:edit',
    DELETE: 'customer:delete',
    MANAGE_CONTACTS: 'customer:manage_contacts',
    MANAGE_DOCUMENTS: 'customer:manage_documents',
    MANAGE_COMMUNICATIONS: 'customer:manage_communications'
  }
};