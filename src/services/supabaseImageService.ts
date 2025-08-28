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
   * Validate image file before upload
   */
  validateImage(file: File): ImageValidationResult {
    const errors: string[] = [];

    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`);
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Check if file is actually an image
    if (!file.type.startsWith('image/')) {
      errors.push('File must be an image');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Upload image to Supabase storage
   */
  async uploadImage(
    file: File,
    folder: 'deals' | 'contacts' | 'avatars' = 'deals',
    onProgress?: (progress: ImageUploadProgress) => void
  ): Promise<ImageUploadResult> {
    try {
      // Validate file first
      const validation = this.validateImage(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
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

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        return {
          success: false,
          error: error.message
        };
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Delete image from Supabase storage
   */
  async deleteImage(fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        // Simulate deletion
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
      }

      const { error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .remove([fileName]);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
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
   * Create image preview from file
   */
  createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to create preview'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
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