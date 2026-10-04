import { useState, useRef } from 'react';
import { X, Upload, Camera, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';

export default function AvatarUploadModal({ isOpen, onClose, onUploaded, currentAvatar = null }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    // Validate size (5MB max)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError('Image size exceeds 5MB. Please choose a smaller photo.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await api.post('/auth/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const newAvatarUrl = res.data?.avatar_url;
      if (newAvatarUrl && onUploaded) {
        onUploaded(newAvatarUrl);
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to upload photo. Please try again.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setSelectedFile(null);
    setPreviewUrl(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 border border-[#EFE4D8] shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-[#F4E9DF]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FAF0E7] flex items-center justify-center text-[#BA6838]">
              <Camera size={18} />
            </div>
            <h3 className="font-bold text-base text-[#261B14]">
              Update Profile Photo
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#857368] hover:bg-[#F6ECE2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Avatar Preview Section */}
        <div className="flex flex-col items-center justify-center py-2 space-y-3">
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-3 border-[#BA6838]/30 shadow-md bg-[#F6DFC9] flex items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            ) : currentAvatar ? (
              <img
                src={currentAvatar}
                alt="Current Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <Camera size={36} className="text-[#BA6838]/60" />
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-[#BA6838] hover:text-[#9A4C1F] bg-[#FAF0E7] hover:bg-[#F3E2D3] px-3.5 py-1.5 rounded-full transition-colors"
          >
            {previewUrl ? 'Choose Different Photo' : 'Select Photo from Device'}
          </button>
          <span className="text-[10.5px] text-[#A8988D]">
            JPG, PNG, or WebP up to 5MB
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="flex-1 py-2.5 px-4 text-xs font-semibold text-[#7A6960] bg-[#F6ECE2] hover:bg-[#EFE4D8] rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-[#BA6838] hover:bg-[#A8582A] rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Save Photo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
