# AKC LLC Management App

The AKC LLC Management App is a Google Apps Script web application designed to help manage projects, customers, estimates, time logging, materials receipts, subcontractors, and more for a construction business. The app utilizes Google Sheets as the database to store and retrieve data.

## Features

- **Project Management**: Create and manage projects, track project status, and associate projects with customers. Set workspace permissions for project folders in Google Drive.
- **Time Logging**: Log time spent on projects by employees. Submit time entries specifying project, date, start/end times, and calculate hours.
- **Materials Receipt Tracking**: Submit and track receipts for materials purchased for projects. Associate receipts with projects and vendors. Upload receipt images/PDFs to Google Drive.
- **Subcontractor Management**: Manage subcontractors and track subcontractor invoices. Associate invoices with projects and subcontractors. Upload invoice files to Drive.
- **Customer Management**: Manage customer information and view customer details. Track projects and estimates associated with each customer.
- **Estimate Generation**: Create detailed estimates for projects. Specify scope of work, materials, rates and generate professional estimate documents (with optional e-signature). E-mail estimates directly to customers.
- **Vendor Management**: Manage vendor information for materials purchases.
- **Analytics & Reporting**: Dashboard with key metrics and visualizations. Segment data by customer, project status, etc. Export data to CSV.

## Architecture

The app is built on Google Apps Script and utilizes the following G Suite services:

- **Google Sheets**: Primary data store
- **Google Drive**: File storage for receipt images, invoices, estimate docs
- **Gmail**: Sending estimates to customers

The backend is written in Apps Script (JavaScript) and is responsible for all the business logic, data access, and third-party service interactions.
The frontend is built using HTML/CSS (Bootstrap) and React. It communicates with the backend via google.script.run asynchronous calls.

## Key Modules / Files

- **Code.gs**: Main application logic and webapp routing
- **Database.gs**: Data access layer for reading/writing data to Google Sheets
- **Utils.gs**: Utility and helper functions
- **Config.gs**: Configuration variables
- **Index.html**: Main app UI entry point and component renderer
- **CustomerManagement.html**: Customer management module UI
- **ProjectManager.html**: Project management module UI
- **EstimateCreator.html**: Estimate creation module UI
- **TimeLogger.html**: Time logging module UI
- ... (other component files)

## Configuration & Setup

1. Create a new Google Sheets spreadsheet and configure the required sheets as defined in Config.gs. Share the sheet with edit access to the Google account that will run the Apps Script.
2. Create a new Apps Script project, copy over the Google Apps Script and .html files.
3. Update the config variables in Config.gs with your spreadsheet ID, template doc IDs, email subjects, folder IDs, etc.
4. Deploy the Apps Script project as a web app, granting access to users within your G Suite domain.
5. Open the deployed web app URL to start using the application.

## License

MIT