const sharp = require('sharp');
const { UPLOAD_CONSTANTS } = require('../constants');

class ImageUtils {
  static validateImageFormat(file) {
    return UPLOAD_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.mimetype);
  }

  static validateImageSize(file) {
    return file.size <= UPLOAD_CONSTANTS.MAX_IMAGE_SIZE;
  }

  static async compressImage(buffer, options = {}) {
    try {
      const defaultOptions = {
        quality: 80,
        width: 800,
        height: 600,
        format: 'jpeg'
      };

      const config = { ...defaultOptions, ...options };

      let processor = sharp(buffer);

      // Resize if dimensions are specified
      if (config.width || config.height) {
        processor = processor.resize(config.width, config.height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Set format and quality
      if (config.format === 'jpeg') {
        processor = processor.jpeg({ quality: config.quality });
      } else if (config.format === 'png') {
        processor = processor.png({ quality: config.quality });
      } else if (config.format === 'webp') {
        processor = processor.webp({ quality: config.quality });
      }

      return await processor.toBuffer();
    } catch (error) {
      throw new Error(`Image compression failed: ${error.message}`);
    }
  }

  static async generateThumbnail(buffer, size = 150) {
    try {
      return await sharp(buffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  static async generateImageVariants(buffer) {
    try {
      const variants = {};

      // Thumbnail (150x150)
      variants.thumbnail = await sharp(buffer)
        .resize(150, 150, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Small (300x300)
      variants.small = await sharp(buffer)
        .resize(300, 300, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Medium (600x600)
      variants.medium = await sharp(buffer)
        .resize(600, 600, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Large (1200x1200)
      variants.large = await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 95 })
        .toBuffer();

      return variants;
    } catch (error) {
      throw new Error(`Image variant generation failed: ${error.message}`);
    }
  }

  static async getImageMetadata(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      };
    } catch (error) {
      throw new Error(`Failed to get image metadata: ${error.message}`);
    }
  }

  static async rotateImage(buffer, degrees) {
    try {
      return await sharp(buffer)
        .rotate(degrees)
        .toBuffer();
    } catch (error) {
      throw new Error(`Image rotation failed: ${error.message}`);
    }
  }

  static async cropImage(buffer, { left, top, width, height }) {
    try {
      return await sharp(buffer)
        .extract({ left, top, width, height })
        .toBuffer();
    } catch (error) {
      throw new Error(`Image cropping failed: ${error.message}`);
    }
  }

  static async addWatermark(buffer, watermarkBuffer, options = {}) {
    try {
      const defaultOptions = {
        gravity: 'southeast',
        blend: 'over'
      };

      const config = { ...defaultOptions, ...options };

      return await sharp(buffer)
        .composite([{
          input: watermarkBuffer,
          gravity: config.gravity,
          blend: config.blend
        }])
        .toBuffer();
    } catch (error) {
      throw new Error(`Watermark application failed: ${error.message}`);
    }
  }

  static async convertFormat(buffer, format, options = {}) {
    try {
      let processor = sharp(buffer);

      switch (format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          processor = processor.jpeg(options);
          break;
        case 'png':
          processor = processor.png(options);
          break;
        case 'webp':
          processor = processor.webp(options);
          break;
        case 'avif':
          processor = processor.avif(options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      return await processor.toBuffer();
    } catch (error) {
      throw new Error(`Format conversion failed: ${error.message}`);
    }
  }

  static calculateAspectRatio(width, height) {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return {
      width: width / divisor,
      height: height / divisor,
      ratio: width / height
    };
  }

  static isSquareImage(width, height) {
    return width === height;
  }

  static isLandscapeImage(width, height) {
    return width > height;
  }

  static isPortraitImage(width, height) {
    return height > width;
  }

  static calculateFileSize(buffer) {
    return buffer.length;
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static async optimizeForWeb(buffer, options = {}) {
    try {
      const defaultOptions = {
        quality: 80,
        progressive: true,
        maxWidth: 1920,
        maxHeight: 1080
      };

      const config = { ...defaultOptions, ...options };
      const metadata = await this.getImageMetadata(buffer);

      let processor = sharp(buffer);

      // Resize if image is too large
      if (metadata.width > config.maxWidth || metadata.height > config.maxHeight) {
        processor = processor.resize(config.maxWidth, config.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Optimize based on format
      if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
        processor = processor.jpeg({
          quality: config.quality,
          progressive: config.progressive
        });
      } else if (metadata.format === 'png') {
        processor = processor.png({
          quality: config.quality,
          progressive: config.progressive
        });
      } else {
        // Convert to JPEG for other formats
        processor = processor.jpeg({
          quality: config.quality,
          progressive: config.progressive
        });
      }

      return await processor.toBuffer();
    } catch (error) {
      throw new Error(`Web optimization failed: ${error.message}`);
    }
  }
}

module.exports = ImageUtils;
