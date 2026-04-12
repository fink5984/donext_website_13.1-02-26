'use client';

import { useState } from 'react';

export default function CommunitySettingsForm({ settings, onUpdate, onSave, saving }) {
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
        {/* Community Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות קהילה</h3>
          
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              כותרת לפני
            </label>
            <input
              type="text"
              value={formData.titleBefore || ''}
              onChange={(e) => handleInputChange('titleBefore', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="כותרת לפני"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">תצוגה מקדימה</h3>
          <div className="bg-gray-100 p-4 rounded-lg min-h-[200px]">
            <p className="text-sm text-gray-600 text-right">
              כאן תוצג תצוגה מקדימה של הגדרות הקהילה
            </p>
            {formData.titleBefore && (
              <div className="mt-4 text-center">
                <p className="text-lg font-semibold">{formData.titleBefore}</p>
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





