import React, { useState, useRef } from 'react';
import { Upload, X, Camera, Trash2 } from 'lucide-react';
import Button from './Button';

const ImageUpload = ({ 
  currentImage, 
  onImageUpload, 
  onImageRemove, 
  loading = false,
  className = "" 
}) => {
  const [previewUrl, setPreviewUrl] = useState(currentImage || '');
  const [isHovered, setIsHovered] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload file
    onImageUpload(file, setUploadProgress);
  };

  const handleRemove = () => {
    setPreviewUrl('');
    onImageRemove();
  };

  const handleCancel = () => {
    setPreviewUrl(currentImage || '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div
        className="relative w-32 h-32 group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl || "/placeholder.svg"}
              alt="Profile"
              className="w-full h-full rounded-full object-cover border-4 border-gray-200 shadow-lg"
            />
            {(isHovered || loading) && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                {loading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-1"></div>
                    <span className="text-white text-xs">{uploadProgress}%</span>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-white hover:text-blue-300 p-1"
                      onClick={triggerFileInput}
                      title="Change photo"
                    >
                      <Camera size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-white hover:text-red-300 p-1"
                      onClick={handleRemove}
                      title="Remove photo"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div 
            className="w-full h-full rounded-full bg-gray-100 border-4 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={triggerFileInput}
          >
            <div className="text-center">
              <Upload size={24} className="text-gray-400 mx-auto mb-1" />
              <span className="text-xs text-gray-500">Upload Photo</span>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={loading}
      />

      <div className="flex space-x-2">
        {!previewUrl && (
          <Button
            type="button"
            variant="outline"
            onClick={triggerFileInput}
            disabled={loading}
            className="flex items-center space-x-1"
          >
            <Upload size={16} />
            <span>Upload Photo</span>
          </Button>
        )}
        
        {previewUrl && previewUrl !== currentImage && (
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            size="sm"
          >
            Cancel
          </Button>
        )}
      </div>

      {loading && (
        <div className="w-full max-w-xs">
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
