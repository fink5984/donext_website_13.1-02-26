'use client';

import { useState } from 'react';
import FileUpload from '@/app/components/FileUpload';

export default function ScreenSettingsForm({ settings, onUpdate, onSave, saving, campaignId }) {
  const [formData, setFormData] = useState(settings || {});

  const normalizeColor = (value, fallback = '#ffffff') => {
    const v = typeof value === 'string' ? value : '';
    const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
    return isHex ? v : fallback;
  };

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
        {/* Basic Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות בסיסיות</h3>
          
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              סכום מסך גדול
            </label>
            <input
              type="number"
              value={formData.amountBigScreen || ''}
              onChange={(e) => handleInputChange('amountBigScreen', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="סכום מסך גדול"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              טקסט מעל הסכום הכולל
            </label>
            <input
              type="text"
              value={formData.textOverTotal || ''}
              onChange={(e) => handleInputChange('textOverTotal', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="טקסט מעל הסכום הכולל"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              טקסט מתחת לסכום הכולל
            </label>
            <input
              type="text"
              value={formData.textUnderTotal || ''}
              onChange={(e) => handleInputChange('textUnderTotal', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="טקסט מתחת לסכום הכולל"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              צבע כותרות תחתונות חלק עליון
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalizeColor(formData.topPartBottomTitlesColor, '#ffffff')}
                onChange={(e) => handleInputChange('topPartBottomTitlesColor', e.target.value)}
                className="h-10 w-14 border border-gray-300 rounded-md"
              />
              <span
                className="inline-block w-6 h-6 rounded border border-gray-300"
                style={{ backgroundColor: normalizeColor(formData.topPartBottomTitlesColor, '#ffffff') }}
                title={normalizeColor(formData.topPartBottomTitlesColor, '#ffffff')}
              />
              <span className="text-xs text-gray-600">{normalizeColor(formData.topPartBottomTitlesColor, '#ffffff')}</span>
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">אפשרויות תצוגה</h3>
          
          <div className="space-y-3">
            <label className="flex items-center justify-end space-x-2 space-x-reverse">
              <input
                type="checkbox"
                checked={formData.displayTopPart || false}
                onChange={(e) => handleInputChange('displayTopPart', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">הצג חלק עליון</span>
            </label>

            <label className="flex items-center justify-end space-x-2 space-x-reverse">
              <input
                type="checkbox"
                checked={formData.displayBottomPart || false}
                onChange={(e) => handleInputChange('displayBottomPart', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">הצג חלק תחתון</span>
            </label>

            <label className="flex items-center justify-end space-x-2 space-x-reverse">
              <input
                type="checkbox"
                checked={formData.preloadingNames || false}
                onChange={(e) => handleInputChange('preloadingNames', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">טעינה מוקדמת שמות</span>
            </label>

            <label className="flex items-center justify-end space-x-2 space-x-reverse">
              <input
                type="checkbox"
                checked={formData.byPresence || false}
                onChange={(e) => handleInputChange('byPresence', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">לפי נוכחות</span>
            </label>

            <label className="flex items-center justify-end space-x-2 space-x-reverse">
              <input
                type="checkbox"
                checked={formData.showAmount || false}
                onChange={(e) => handleInputChange('showAmount', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">הצג סכום</span>
            </label>
          </div>
        </div>
      </div>

      {/* Background Images */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-right">תמונות רקע</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              רקע מסך
            </label>
            <input
              type="text"
              value={formData.bgScreen || ''}
              onChange={(e) => handleInputChange('bgScreen', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="URL תמונת רקע מסך"
            />
            <div className="mt-2">
              <FileUpload
                campaignId={campaignId}
                accept="image/*"
                label="העלה תמונת רקע למסך"
                endpoint="/api/storage"
                prefix={`screen-settings/${campaignId}`}
                fieldName="bgScreen"
                previousUrl={formData.bgScreen}
                onUploadComplete={(url) => handleInputChange('bgScreen', url)}
              />
              {formData.bgScreen && (
                <img src={formData.bgScreen} alt="bg screen" className="mt-2 max-h-40 rounded" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              רקע תרומות גדולות
            </label>
            <input
              type="text"
              value={formData.bgBigDonations || ''}
              onChange={(e) => handleInputChange('bgBigDonations', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="URL תמונת רקע תרומות גדולות"
            />
            <div className="mt-2">
              <FileUpload
                campaignId={campaignId}
                accept="image/*"
                label="העלה רקע לתרומות גדולות"
                endpoint="/api/storage"
                prefix={`screen-settings/${campaignId}`}
                fieldName="bgBigDonations"
                previousUrl={formData.bgBigDonations}
                onUploadComplete={(url) => handleInputChange('bgBigDonations', url)}
              />
              {formData.bgBigDonations && (
                <img src={formData.bgBigDonations} alt="bg big" className="mt-2 max-h-40 rounded" />
              )}
            </div>
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
