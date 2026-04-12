'use client';

import { useState } from 'react';
import FileUpload from '@/app/components/FileUpload';

export default function VideoSettingsForm({ settings, onUpdate, onSave, saving, campaignId }) {
  const [formData, setFormData] = useState(settings || {});

  const handleInputChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Video Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות וידאו</h3>
          
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              העלאת וידאו
            </label>
            <FileUpload
              campaignId={campaignId}
              accept="video/*"
              label="בחר וידאו להעלאה"
              endpoint="/api/storage"
              prefix={`screen-settings/${campaignId}`}
              fieldName="videoUrl"
              previousUrl={formData.videoUrl}
              onUploadComplete={(url) => handleInputChange('videoUrl', url)}
            />
            {formData.videoUrl && (
              <p className="text-xs text-gray-600 mt-1 break-all text-right">{formData.videoUrl}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              טקסט וידאו
            </label>
            <input
              type="text"
              value={formData.videoText || ''}
              onChange={(e) => handleInputChange('videoText', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="טקסט וידאו"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן טקסט וידאו
            </label>
            <input
              type="number"
              value={formData.videoTextFontSize || ''}
              onChange={(e) => handleInputChange('videoTextFontSize', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              תאריך וידאו
            </label>
            <input
              type="datetime-local"
              value={formData.videoDate ? new Date(formData.videoDate).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleInputChange('videoDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              חזרות וידאו
            </label>
            <input
              type="number"
              value={formData.videoRepeat || ''}
              onChange={(e) => handleInputChange('videoRepeat', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="מספר חזרות"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              URL וידאו
            </label>
            <input
              type="url"
              value={formData.videoUrl || ''}
              onChange={(e) => handleInputChange('videoUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/video.mp4"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">תצוגה מקדימה</h3>
          <div className="bg-gray-100 p-4 rounded-lg min-h-[200px]">
            <p className="text-sm text-gray-600 text-right">
              כאן תוצג תצוגה מקדימה של הגדרות הוידאו
            </p>
            {formData.videoUrl && (
              <div className="mt-4">
                <video
                  controls
                  className="w-full rounded"
                  style={{ fontSize: formData.videoTextFontSize ? `${formData.videoTextFontSize}px` : 'inherit' }}
                >
                  <source src={formData.videoUrl} type="video/mp4" />
                  הדפדפן שלך לא תומך בוידאו.
                </video>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {saving ? 'שומר...' : 'שמור הגדרות'}
        </button>
      </div>
    </form>
  );
}
