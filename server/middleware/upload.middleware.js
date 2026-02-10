// middleware/upload.middleware.js
import multer from 'multer';

// Configure multer for memory storage (file will be in req.file.buffer)
const storage = multer.memoryStorage();

// File filter to accept Excel and CSV files
const fileFilter = (req, file, cb) => {
  // Accept Excel files and CSV files
  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.mimetype === 'text/csv' ||
    file.originalname.endsWith('.xlsx') ||
    file.originalname.endsWith('.xls') ||
    file.originalname.endsWith('.csv')
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware for single file upload
export const uploadExcel = upload.single('file');

// Middleware for multiple files (if needed in future)
export const uploadMultipleExcel = upload.array('files', 10);
