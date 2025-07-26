const cloudinary = require('cloudinary').v2;
const { CLOUDINARY_CONSTANTS, UPLOAD_CONSTANTS } = require('../constants');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryService {
  static async uploadImage(fileBuffer, folder = CLOUDINARY_CONSTANTS.FOLDERS.PROFILES, filename = null) {
    try {
      const uploadOptions = {
        folder: folder,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto'
      };

      if (filename) {
        uploadOptions.public_id = filename;
      }

      // Convert buffer to base64 data URI
      const dataUri = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
      
      const result = await cloudinary.uploader.upload(dataUri, uploadOptions);

      return {
        url: result.secure_url,
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  static async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      throw new Error(`Image deletion failed: ${error.message}`);
    }
  }

  static generateThumbnail(publicId, transformation = CLOUDINARY_CONSTANTS.TRANSFORMATIONS.PROFILE_THUMBNAIL) {
    return cloudinary.url(publicId, {
      transformation: transformation
    });
  }

  static optimizeImage(publicId, options = {}) {
    const defaultOptions = {
      quality: 'auto',
      fetch_format: 'auto'
    };

    const transformOptions = { ...defaultOptions, ...options };

    return cloudinary.url(publicId, {
      transformation: transformOptions
    });
  }

  static generateImageVariants(publicId) {
    const variants = {};
    
    // Generate different sizes
    Object.keys(CLOUDINARY_CONSTANTS.TRANSFORMATIONS).forEach(key => {
      variants[key.toLowerCase()] = cloudinary.url(publicId, {
        transformation: CLOUDINARY_CONSTANTS.TRANSFORMATIONS[key]
      });
    });

    return variants;
  }

  static async uploadChatMedia(file) {
    return this.uploadImage(file, CLOUDINARY_CONSTANTS.FOLDERS.CHAT);
  }

  static validateImageFile(file) {
    // Check file type
    if (!UPLOAD_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG, and JPG files are allowed.');
    }

    // Check file size
    if (file.size > UPLOAD_CONSTANTS.MAX_IMAGE_SIZE) {
      throw new Error(`File too large. Maximum size is ${UPLOAD_CONSTANTS.MAX_IMAGE_SIZE / (1024 * 1024)}MB.`);
    }

    return true;
  }

  static async uploadMultipleImages(files, folder = CLOUDINARY_CONSTANTS.FOLDERS.PROFILES) {
    const uploadPromises = files.map(file => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  static async deleteMultipleImages(publicIds) {
    const deletePromises = publicIds.map(publicId => this.deleteImage(publicId));
    return Promise.all(deletePromises);
  }
}

module.exports = CloudinaryService;
