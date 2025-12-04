/**
 * Supabase Image Service - Handles image upload and management
 * Integrates with Supabase Storage for secure image handling
 */

import { createClient } from '@supabase/supabase-js';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  publicUrl?: string;
  error?: string;
  fileName?: string;
}

export interface ImageUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
}

export interface ImageValidationResult {
  isValid: boolean;
  errors: string[];
}

class SupabaseImageService {
  private supabase;
  private readonly BUCKET_NAME = 'deal-images';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

  // Rate limiting
  private uploadCount = 0;
  private lastResetTime = Date.now();
  private readonly MAX_UPLOADS_PER_MINUTE = 10;
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase configuration missing. Image upload will be simulated.');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
  }

  /**
   * Validate image file before upload with comprehensive security checks
   */
  validateImage(file: File): ImageValidationResult {
    const errors: string[] = [];

    // Input validation
    if (!file || !(file instanceof File)) {
      errors.push('Invalid file provided');
      return { isValid: false, errors };
    }

    // Check file name for malicious patterns
    const fileName = file.name.toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.js', '.vbs', '.wsf'];
    if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
      errors.push('File type not allowed for security reasons');
    }

    // Check file type against allowed types
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`);
    }

    // Verify file extension matches MIME type
    const expectedExtension = this.getExtensionFromMimeType(file.type);
    const actualExtension = this.getFileExtension(file.name);
    if (expectedExtension && actualExtension !== expectedExtension) {
      errors.push('File extension does not match file type');
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Check minimum file size (prevent empty files)
    if (file.size === 0) {
      errors.push('File cannot be empty');
    }

    // Check if file is actually an image
    if (!file.type.startsWith('image/')) {
      errors.push('File must be an image');
    }

    // Additional security: check for suspicious file names
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      errors.push('Invalid file name');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get expected file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string | null {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    return mimeToExt[mimeType] || null;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Check rate limiting for uploads
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.lastResetTime > this.RATE_LIMIT_WINDOW) {
      this.uploadCount = 0;
      this.lastResetTime = now;
    }

    // Check if under limit
    if (this.uploadCount >= this.MAX_UPLOADS_PER_MINUTE) {
      return false;
    }

    this.uploadCount++;
    return true;
  }

  /**
   * Upload image to Supabase storage with retry logic and enhanced error handling
   */
  async uploadImage(
    file: File,
    folder: 'deals' | 'contacts' | 'avatars' = 'deals',
    onProgress?: (progress: ImageUploadProgress) => void,
    maxRetries: number = 3
  ): Promise<ImageUploadResult> {
    try {
      // Input validation
      if (!file || !(file instanceof File)) {
        return {
          success: false,
          error: 'Invalid file provided'
        };
      }

      // Check rate limiting
      if (!this.checkRateLimit()) {
        return {
          success: false,
          error: `Upload rate limit exceeded. Maximum ${this.MAX_UPLOADS_PER_MINUTE} uploads per minute allowed.`
        };
      }

      // Validate file first
      const validation = this.validateImage(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      onProgress?.({
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: 'uploading'
      });

      // If Supabase is not configured, simulate upload
      if (!this.supabase) {
        return await this.simulateUpload(file, onProgress);
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      let lastError: string = '';

      // Retry logic for upload
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          onProgress?.({
            loaded: 0,
            total: file.size,
            percentage: Math.round((attempt - 1) / maxRetries * 20), // Show retry progress
            status: 'uploading'
          });

          // Upload to Supabase Storage
          const { data, error } = await this.supabase.storage
            .from(this.BUCKET_NAME)
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) {
            lastError = this.categorizeError(error);
            if (attempt === maxRetries) {
              return {
                success: false,
                error: `Upload failed after ${maxRetries} attempts: ${lastError}`
              };
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }

          onProgress?.({
            loaded: file.size,
            total: file.size,
            percentage: 100,
            status: 'processing'
          });

          // Get public URL
          const { data: urlData } = this.supabase.storage
            .from(this.BUCKET_NAME)
            .getPublicUrl(fileName);

          onProgress?.({
            loaded: file.size,
            total: file.size,
            percentage: 100,
            status: 'complete'
          });

          return {
            success: true,
            url: data.path,
            publicUrl: urlData.publicUrl,
            fileName: fileName
          };

        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown upload error';
          if (attempt === maxRetries) {
            return {
              success: false,
              error: `Upload failed after ${maxRetries} attempts: ${lastError}`
            };
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }

      return {
        success: false,
        error: lastError || 'Upload failed after all retry attempts'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected upload error';
      return {
        success: false,
        error: `Upload initialization failed: ${errorMessage}`
      };
    }
  }

  /**
   * Delete image from Supabase storage with retry logic
   */
  async deleteImage(fileName: string, maxRetries: number = 3): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        // Simulate deletion for development
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
      }

      if (!fileName || fileName.trim() === '') {
        return {
          success: false,
          error: 'Invalid filename provided'
        };
      }

      let lastError: string = '';

      // Retry logic for deletion
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { error } = await this.supabase.storage
            .from(this.BUCKET_NAME)
            .remove([fileName]);

          if (error) {
            lastError = this.categorizeError(error);
            if (attempt === maxRetries) {
              return {
                success: false,
                error: `Delete failed after ${maxRetries} attempts: ${lastError}`
              };
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }

          return { success: true };
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown delete error';
          if (attempt === maxRetries) {
            return {
              success: false,
              error: `Delete failed after ${maxRetries} attempts: ${lastError}`
            };
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }

      return {
        success: false,
        error: lastError || 'Delete failed after all retry attempts'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected delete error';
      return {
        success: false,
        error: `Delete initialization failed: ${errorMessage}`
      };
    }
  }

  /**
   * Get signed URL for private image access
   */
  async getSignedUrl(fileName: string, expiresIn: number = 3600): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      if (!this.supabase) {
        // Return a placeholder URL for development
        return {
          success: true,
          url: `https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2`
        };
      }

      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(fileName, expiresIn);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        url: data.signedUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get signed URL'
      };
    }
  }

  /**
   * Simulate upload for development when Supabase is not configured
   */
  private async simulateUpload(
    file: File,
    onProgress?: (progress: ImageUploadProgress) => void
  ): Promise<ImageUploadResult> {
    try {
      onProgress?.({
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: 'uploading'
      });

      // Simulate upload progress
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        onProgress?.({
          loaded: (file.size * i) / 100,
          total: file.size,
          percentage: i,
          status: i < 100 ? 'uploading' : 'processing'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      onProgress?.({
        loaded: file.size,
        total: file.size,
        percentage: 100,
        status: 'complete'
      });

      // Generate a placeholder URL for development
      const seed = Date.now().toString();
      const placeholderUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444&textColor=ffffff`;

      return {
        success: true,
        url: `simulated-uploads/${file.name}`,
        publicUrl: placeholderUrl,
        fileName: `simulated-${Date.now()}-${file.name}`
      };
    } catch (error) {
      return {
        success: false,
        error: 'Simulation failed'
      };
    }
  }

  /**
   * Categorize Supabase storage errors for better user feedback
   */
  private categorizeError(error: any): string {
    if (!error) return 'Unknown error';

    const message = error.message || error.toString();

    // Network and connectivity errors
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network connection error. Please check your internet connection and try again.';
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('401')) {
      return 'Authentication failed. Please check your permissions.';
    }

    // Storage quota errors
    if (message.includes('quota') || message.includes('storage') || message.includes('limit')) {
      return 'Storage limit exceeded. Please contact support or try a smaller file.';
    }

    // File type errors
    if (message.includes('type') || message.includes('format') || message.includes('mime')) {
      return 'Unsupported file type. Please use JPEG, PNG, WebP, or GIF files.';
    }

    // File size errors
    if (message.includes('size') || message.includes('large') || message.includes('413')) {
      return `File too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB.`;
    }

    // Bucket/permission errors
    if (message.includes('bucket') || message.includes('permission') || message.includes('403')) {
      return 'Storage access denied. Please contact support.';
    }

    // Duplicate file errors
    if (message.includes('duplicate') || message.includes('exists')) {
      return 'File already exists. Please rename your file and try again.';
    }

    // Return original message for unhandled errors
    return message;
  }

  /**
   * Simulate upload with AI image generation for development
   */
  private async simulateUploadWithAI(
    file: File,
    onProgress?: (progress: ImageUploadProgress) => void
  ): Promise<ImageUploadResult> {
    // Simulate AI processing for better image
    onProgress?.({
      loaded: 0,
      total: file.size,
      percentage: 10,
      status: 'uploading'
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    onProgress?.({
      loaded: file.size * 0.5,
      total: file.size,
      percentage: 50,
      status: 'processing'
    });

    // Simulate upload progress
    for (let i = 50; i <= 90; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgress?.({
        loaded: (file.size * i) / 100,
        total: file.size,
        percentage: i,
        status: 'processing'
      });
    }

    // Simulate final processing
    await new Promise(resolve => setTimeout(resolve, 500));

    onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      status: 'complete'
    });

    // Generate AI-enhanced avatar URL
    const seed = Date.now().toString();
    const aiEnhancedUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444&textColor=ffffff`;

    return {
      success: true,
      url: `simulated-uploads/${file.name}`,
      publicUrl: aiEnhancedUrl,
      fileName: `simulated-${Date.now()}-${file.name}`
    };
  }

  /**
   * Create image preview from file with memory management
   */
  createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      // Additional validation for preview
      if (!file || !(file instanceof File)) {
        reject(new Error('Invalid file provided'));
        return;
      }

      if (file.size > this.MAX_FILE_SIZE) {
        reject(new Error('File too large for preview'));
        return;
      }

      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'));
        return;
      }

      const reader = new FileReader();

      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error('Preview creation timeout'));
      }, 30000); // 30 second timeout

      reader.onload = (e) => {
        clearTimeout(timeout);
        if (e.target?.result && typeof e.target.result === 'string') {
          // Validate the result is a proper data URL
          if (e.target.result.startsWith('data:image/')) {
            resolve(e.target.result);
          } else {
            reject(new Error('Invalid image data'));
          }
        } else {
          reject(new Error('Failed to create preview'));
        }
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to read file for preview'));
      };

      reader.onabort = () => {
        clearTimeout(timeout);
        reject(new Error('Preview creation was aborted'));
      };

      try {
        reader.readAsDataURL(file);
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error('Failed to start file reading'));
      }
    });
  }

  /**
   * Setup Supabase storage bucket (for initial setup)
   */
  async setupStorageBucket(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase not configured' };
      }

      // Create bucket if it doesn't exist
      const { error: bucketError } = await this.supabase.storage.createBucket(this.BUCKET_NAME, {
        public: true,
        allowedMimeTypes: this.ALLOWED_TYPES,
        fileSizeLimit: this.MAX_FILE_SIZE
      });

      // If bucket already exists, that's okay
      if (bucketError && !bucketError.message.includes('already exists')) {
        return { success: false, error: bucketError.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Setup failed'
      };
    }
  }
}

export const supabaseImageService = new SupabaseImageService();