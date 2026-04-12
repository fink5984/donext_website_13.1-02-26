'use client';

import { useState } from 'react';

export default function TimerSettingsForm({ settings, onUpdate, onSave, saving }) {
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
        {/* Timer Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות טיימר</h3>
          
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              טקסט טיימר עליון
            </label>
            <input
              type="text"
              value={formData.topTimerText || ''}
              onChange={(e) => handleInputChange('topTimerText', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="טקסט טיימר עליון"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              טקסט טיימר תחתון
            </label>
            <input
              type="text"
              value={formData.bottomTimerText || ''}
              onChange={(e) => handleInputChange('bottomTimerText', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="טקסט טיימר תחתון"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">תצוגה מקדימה</h3>
          <div className="bg-gray-100 p-4 rounded-lg min-h-[200px]">
            <div className="text-center space-y-2">
              {formData.topTimerText && (
                <p className="text-sm text-gray-600">{formData.topTimerText}</p>
              )}
              <div className="text-2xl font-bold text-red-600">
                00:00:00
              </div>
              {formData.bottomTimerText && (
                <p className="text-sm text-gray-600">{formData.bottomTimerText}</p>
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