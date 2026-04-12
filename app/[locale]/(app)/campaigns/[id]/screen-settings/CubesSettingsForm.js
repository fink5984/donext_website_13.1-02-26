'use client';

import { useState } from 'react';

export default function CubesSettingsForm({ settings, onUpdate, onSave, saving }) {
  const [formData, setFormData] = useState(settings || {});
  const normalizeColor = (value, fallback = '#111827') => {
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
        {/* Cube Dimensions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">מידות קוביות</h3>
          
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              רוחב קוביה
            </label>
            <input
              type="number"
              value={formData.cubeWidth || ''}
              onChange={(e) => handleInputChange('cubeWidth', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="רוחב"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גובה קוביה
            </label>
            <input
              type="number"
              value={formData.cubeHeight || ''}
              onChange={(e) => handleInputChange('cubeHeight', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גובה"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              ריווח קוביה
            </label>
            <input
              type="number"
              value={formData.cubePadding || ''}
              onChange={(e) => handleInputChange('cubePadding', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ריווח"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              רדיוס פינות
            </label>
            <input
              type="number"
              value={formData.borderRadius || ''}
              onChange={(e) => handleInputChange('borderRadius', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="רדיוס"
            />
          </div>
        </div>

        {/* Font Sizes */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">גדלי גופן</h3>
          
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן שם - חזית
            </label>
            <input
              type="number"
              value={formData.fontSizeNameFront || ''}
              onChange={(e) => handleInputChange('fontSizeNameFront', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן שם - גב
            </label>
            <input
              type="number"
              value={formData.fontSizeNameBack || ''}
              onChange={(e) => handleInputChange('fontSizeNameBack', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן סכום - גב
            </label>
            <input
              type="number"
              value={formData.fontSizeAmountBack || ''}
              onChange={(e) => handleInputChange('fontSizeAmountBack', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן דירוג
            </label>
            <input
              type="number"
              value={formData.fontSizeRank || ''}
              onChange={(e) => handleInputChange('fontSizeRank', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן שטיבל
            </label>
            <input
              type="number"
              value={formData.fontSizeShtiebel || ''}
              onChange={(e) => handleInputChange('fontSizeShtiebel', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן שדה חופשי
            </label>
            <input
              type="number"
              value={formData.fontSizeFreeField1 || ''}
              onChange={(e) => handleInputChange('fontSizeFreeField1', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>
        </div>
      </div>

      {/* Display Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-right">אפשרויות תצוגה</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.displayRank || false}
              onChange={(e) => handleInputChange('displayRank', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג דירוג</span>
          </label>

          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.displayShtiebel || false}
              onChange={(e) => handleInputChange('displayShtiebel', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג שטיבל</span>
          </label>

          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.displayFreeField1 || false}
              onChange={(e) => handleInputChange('displayFreeField1', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג שדה חופשי</span>
          </label>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-right">צבעים</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              צבע טקסט חזית
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalizeColor(formData.frontBoxTextColor, '#111827')}
                onChange={(e) => handleInputChange('frontBoxTextColor', e.target.value)}
                className="h-10 w-14 border border-gray-300 rounded-md"
              />
              <span className="inline-block w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: normalizeColor(formData.frontBoxTextColor, '#111827') }} />
              <span className="text-xs text-gray-600">{normalizeColor(formData.frontBoxTextColor, '#111827')}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              צבע טקסט גב
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalizeColor(formData.backBoxTextColor, '#111827')}
                onChange={(e) => handleInputChange('backBoxTextColor', e.target.value)}
                className="h-10 w-14 border border-gray-300 rounded-md"
              />
              <span className="inline-block w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: normalizeColor(formData.backBoxTextColor, '#111827') }} />
              <span className="text-xs text-gray-600">{normalizeColor(formData.backBoxTextColor, '#111827')}</span>
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
