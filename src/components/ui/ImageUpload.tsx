import React, { useState, useRef, useCallback } from 'react';
import { supabaseImageService, ImageUploadProgress, ImageUploadResult } from '../../services/supabaseImageService';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Camera, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface ImageUploadProps {
  onImageUploaded: (result: ImageUploadResult) => void;
  onImageRemoved?: () => void;
  currentImageUrl?: string;
  folder?: 'deals' | 'contacts' | 'avatars';
  maxSize?: number; // in MB
  className?: string;
  showPreview?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageUploaded,
  onImageRemoved,
  currentImageUrl,
  folder = 'deals',
  maxSize = 5,
  className = '',
  showPreview = true,
  disabled = false,
  placeholder = 'Click to upload image or drag and drop'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ImageUploadProgress | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    setSuccess(null);

    // Validate file
    const validation = supabaseImageService.validateImage(file);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    try {
      // Create preview
      if (showPreview) {
        const preview = await supabaseImageService.createImagePreview(file);
        setPreviewUrl(preview);
      }

      setIsUploading(true);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0, status: 'uploading' });

      // Upload image
      const result = await supabaseImageService.uploadImage(
        file,
        folder,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      if (result.success) {
        setSuccess('Image uploaded successfully!');
        onImageUploaded(result);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Upload failed');
        setPreviewUrl(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    setError(null);
    setSuccess(null);
    if (onImageRemoved) {
      onImageRemoved();
    }
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const displayImageUrl = previewUrl || currentImageUrl;

  return (
    <div className={`w-full ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
          ${success ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
        />

        {/* Upload Content */}
        <div className="p-6">
          {isUploading ? (
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {uploadProgress?.status === 'uploading' ? 'Uploading...' : 
                 uploadProgress?.status === 'processing' ? 'AI enhancing image...' : 'Uploading...'}
              </p>
              {uploadProgress && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {uploadProgress ? `${uploadProgress.percentage}% ${uploadProgress.status === 'processing' ? '- GPT-5 optimizing...' : ''}` : ''}
              </p>
            </div>
          ) : displayImageUrl ? (
            <div className="text-center">
              <div className="relative inline-block mb-3">
                <img
                  src={displayImageUrl}
                  alt="Uploaded image"
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {success || 'Image ready'}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openFileDialog();
                }}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center justify-center mx-auto"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Change Image
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-3">
                {error ? (
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                ) : success ? (
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400 mx-auto" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {error || success || placeholder}
              </p>
              {!error && !success && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Supports JPEG, PNG, WebP up to {maxSize}MB
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          </div>
        </div>
      )}

      {/* Upload Instructions */}
      {!displayImageUrl && !isUploading && !error && !success && (
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Drag and drop an image file or click to browse
          </p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;