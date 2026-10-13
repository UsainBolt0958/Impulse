import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { uploadImage } from '@/lib/portalServer';

export default function ImageUploadField({ 
  label = 'Upload Image', 
  onUpload, 
  currentImageUrl, 
  onDelete,
  maxSizeKB = 5000 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(currentImageUrl);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Validate size
    if (file.size > maxSizeKB * 1024) {
      setError(`File too large. Max ${maxSizeKB}KB`);
      return;
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('Only image files allowed');
      return;
    }

    setIsLoading(true);
    try {
      const result = await uploadImage(file);
      if (result?.url) {
        setPreview(result.url);
        onUpload?.(result.url);
      } else {
        setError('Upload failed');
      }
    } catch (err) {
      setError('Upload error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setPreview(null);
    onDelete?.();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      
      {preview ? (
        <div className="relative inline-block">
          <img 
            src={preview} 
            alt="preview" 
            className="h-32 w-auto border rounded-lg object-cover"
          />
          <button
            onClick={handleDelete}
            type="button"
            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded"
            disabled={isLoading}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition"
        >
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700">Click to upload</p>
          <p className="text-xs text-gray-500">PNG, JPG up to {maxSizeKB}KB</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={isLoading}
        className="hidden"
      />
    </div>
  );
}
