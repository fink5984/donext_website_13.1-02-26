'use client';

import { useState } from 'react';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export default function FileUpload({ campaignId, onUploadComplete, accept = 'image/*,video/*', label = 'העלה קובץ', endpoint = '/api/upload', prefix, filename, cacheControl, fieldName, previousUrl, previousKey, confirmReplace = true }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const doUpload = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (campaignId !== undefined && campaignId !== null) {
        formData.append('campaignId', campaignId);
      }
      if (prefix) {
        formData.append('prefix', prefix);
      }
      let effectiveFilename = filename || fieldName || undefined;
      if (!filename && fieldName) {
        const original = file.name || '';
        const dot = original.lastIndexOf('.');
        const ext = dot > -1 ? original.slice(dot + 1).toLowerCase() : '';
        if (ext) {
          effectiveFilename = `${fieldName}.${ext}`;
        }
      }
      if (effectiveFilename) {
        formData.append('filename', effectiveFilename);
        formData.append('noTimestamp', 'true');
      }
      if (cacheControl) {
        formData.append('cacheControl', cacheControl);
      }
      if (previousUrl) {
        formData.append('previousUrl', previousUrl);
      }
      if (previousKey) {
        formData.append('previousKey', previousKey);
      }

      const res = await fetchWithAuth(endpoint, { method: 'POST', body: formData });
      
      if (!res?.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || 'Upload failed');
      }
      
      const json = await res.json();
      const url = json?.url || json?.data?.url;
      
      if (!url) {
        console.error('Invalid upload response:', json);
        throw new Error('Invalid upload response - no URL returned');
      }
      
      // קריאה ל-callback רק אם הכל עבר בהצלחה
      if (onUploadComplete && typeof onUploadComplete === 'function') {
        onUploadComplete(url);
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err?.message || 'Upload failed';
      setError(errorMessage);
      // לא זורקים את השגיאה הלאה - מטפלים בה כאן
    } finally {
      setUploading(false);
      setPendingFile(null);
      setConfirmOpen(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (confirmReplace && (previousUrl || previousKey)) {
      setPendingFile(file);
      setConfirmOpen(true);
      return;
    }
    await doUpload(file);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-right mb-2">{label}</label>
      <input
        type="file"
        accept={accept}
        onChange={handleUpload}
        disabled={uploading}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      {uploading && <p className="text-sm text-blue-600 mt-1">מעלה...</p>}
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent hasOverlay={false} className="max-w-sm">
          <AlertDialogTitle className="text-right">אישור החלפת קובץ</AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            העלאת קובץ חדש תמחק לצמיתות את הקובץ הקודם. להמשיך?
          </AlertDialogDescription>
          <div className="mt-4 flex gap-2 justify-start">
            <AlertDialogCancel className="btn btn-outline" onClick={() => setPendingFile(null)}>
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              className="btn btn-primary"
              onClick={async () => {
                if (pendingFile) {
                  await doUpload(pendingFile);
                }
              }}
            >
              החלפה ומחיקה
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
