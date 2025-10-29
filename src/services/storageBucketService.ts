import { createClient } from '@supabase/supabase-js';

export interface StorageBucketConfig {
  name: string;
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
}

class StorageBucketService {
  private supabase;
  private isConfigured: boolean = false;

  private buckets: StorageBucketConfig[] = [
    {
      name: 'deal-images',
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    },
    {
      name: 'contact-avatars',
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    },
    {
      name: 'deal-attachments',
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
      ]
    },
    {
      name: 'contact-documents',
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ]
    }
  ];

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase configuration missing. Storage buckets will not be available.');
      this.supabase = null;
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.isConfigured = true;
  }

  async initializeBuckets(): Promise<{ success: boolean; errors: string[] }> {
    if (!this.isConfigured || !this.supabase) {
      return {
        success: false,
        errors: ['Supabase not configured']
      };
    }

    const errors: string[] = [];

    for (const bucketConfig of this.buckets) {
      try {
        const { data: existingBuckets } = await this.supabase.storage.listBuckets();
        const bucketExists = existingBuckets?.some(b => b.name === bucketConfig.name);

        if (!bucketExists) {
          const { error } = await this.supabase.storage.createBucket(bucketConfig.name, {
            public: bucketConfig.public,
            fileSizeLimit: bucketConfig.fileSizeLimit,
            allowedMimeTypes: bucketConfig.allowedMimeTypes
          });

          if (error) {
            errors.push(`Failed to create bucket ${bucketConfig.name}: ${error.message}`);
          } else {
            console.log(`Created storage bucket: ${bucketConfig.name}`);
          }
        } else {
          console.log(`Storage bucket already exists: ${bucketConfig.name}`);
        }
      } catch (error) {
        errors.push(`Error initializing bucket ${bucketConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  async uploadFile(
    bucketName: string,
    filePath: string,
    file: File
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.isConfigured || !this.supabase) {
      return {
        success: false,
        error: 'Supabase not configured'
      };
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

      return {
        success: true,
        url: urlData.publicUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async deleteFile(bucketName: string, filePath: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured || !this.supabase) {
      return {
        success: false,
        error: 'Supabase not configured'
      };
    }

    try {
      const { error } = await this.supabase.storage
        .from(bucketName)
        .remove([filePath]);

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

  async getStorageUsage(bucketName?: string): Promise<{ totalSize: number; fileCount: number }> {
    if (!this.isConfigured || !this.supabase) {
      return { totalSize: 0, fileCount: 0 };
    }

    try {
      if (bucketName) {
        const { data, error } = await this.supabase.storage
          .from(bucketName)
          .list();

        if (error) throw error;

        const totalSize = data?.reduce((acc, file) => acc + (file.metadata?.size || 0), 0) || 0;
        return { totalSize, fileCount: data?.length || 0 };
      }

      let totalSize = 0;
      let fileCount = 0;

      for (const bucket of this.buckets) {
        const { data, error } = await this.supabase.storage
          .from(bucket.name)
          .list();

        if (!error && data) {
          totalSize += data.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
          fileCount += data.length;
        }
      }

      return { totalSize, fileCount };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { totalSize: 0, fileCount: 0 };
    }
  }

  getBucketConfig(bucketName: string): StorageBucketConfig | null {
    return this.buckets.find(b => b.name === bucketName) || null;
  }

  getAllBuckets(): StorageBucketConfig[] {
    return this.buckets;
  }

  isStorageConfigured(): boolean {
    return this.isConfigured;
  }
}

let storageBucketService: StorageBucketService | null = null;

export const getStorageBucketService = (): StorageBucketService => {
  if (!storageBucketService) {
    storageBucketService = new StorageBucketService();
  }
  return storageBucketService;
};

export { StorageBucketService };
