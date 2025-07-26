const multer = require('multer');
const { UPLOAD_CONSTANTS } = require('../constants');

// Memory storage for processing before uploading to Cloudinary
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  if (UPLOAD_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and JPG files are allowed.'), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: UPLOAD_CONSTANTS.MAX_IMAGE_SIZE
  },
  fileFilter: fileFilter
});

// Single file upload
const uploadSingle = (fieldName) => {
  return upload.single(fieldName);
};

// Multiple file upload
const uploadMultiple = (fieldName, maxCount = 6) => {
  return upload.array(fieldName, maxCount);
};

// Validate image upload
const validateImageUpload = (req, res, next) => {
  if (req.file) {
    // Validate file size
    if (req.file.size > UPLOAD_CONSTANTS.MAX_IMAGE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `File size too large. Maximum size is ${UPLOAD_CONSTANTS.MAX_IMAGE_SIZE / (1024 * 1024)}MB`
      });
    }

    // Validate file type
    if (!UPLOAD_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG and JPG files are allowed.'
      });
    }
  }

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      // Validate file size
      if (file.size > UPLOAD_CONSTANTS.MAX_IMAGE_SIZE) {
        return res.status(400).json({
          success: false,
          message: `File size too large. Maximum size is ${UPLOAD_CONSTANTS.MAX_IMAGE_SIZE / (1024 * 1024)}MB`
        });
      }

      // Validate file type
      if (!UPLOAD_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only JPEG, PNG and JPG files are allowed.'
        });
      }
    }
  }

  next();
};

// Chat media file filter
const chatFileFilter = (req, file, cb) => {
  if (UPLOAD_CONSTANTS.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type.'), false);
  }
};

// Chat file upload configuration
const chatUpload = multer({
  storage: storage,
  limits: {
    fileSize: UPLOAD_CONSTANTS.MAX_FILE_SIZE
  },
  fileFilter: chatFileFilter
});

// Chat single file upload
const uploadChatFile = (fieldName) => {
  return chatUpload.single(fieldName);
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  validateImageUpload,
  uploadChatFile
};
