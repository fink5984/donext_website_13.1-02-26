'use client';

import { useState } from 'react';

export default function ShopSettingsForm({ settings, onUpdate, onSave, saving }) {
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
        {/* Shop Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות חנות</h3>
          
          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.hasShop || false}
              onChange={(e) => handleInputChange('hasShop', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הפעל חנות</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              URL חנות
            </label>
            <input
              type="url"
              value={formData.shopUrl || ''}
              onChange={(e) => handleInputChange('shopUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/shop"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              כותרת חנות
            </label>
            <input
              type="text"
              value={formData.shopTitle || ''}
              onChange={(e) => handleInputChange('shopTitle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="כותרת חנות"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              תיאור חנות
            </label>
            <textarea
              value={formData.shopDescription || ''}
              onChange={(e) => handleInputChange('shopDescription', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="תיאור החנות"
              rows={3}
            />
          </div>
        </div>

        {/* Nedarim Mosad Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות נדרים מוסד</h3>
          
          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.nedarimMosad || false}
              onChange={(e) => handleInputChange('nedarimMosad', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הפעל נדרים מוסד</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              URL נדרים מוסד
            </label>
            <input
              type="url"
              value={formData.nedarimMosadUrl || ''}
              onChange={(e) => handleInputChange('nedarimMosadUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/nedarim"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              כותרת נדרים מוסד
            </label>
            <input
              type="text"
              value={formData.nedarimMosadTitle || ''}
              onChange={(e) => handleInputChange('nedarimMosadTitle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="כותרת נדרים מוסד"
            />
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-right">הגדרות נוספות</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.ifHok || false}
              onChange={(e) => handleInputChange('ifHok', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">אם חוק</span>
          </label>

          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.ifFundRaiser || false}
              onChange={(e) => handleInputChange('ifFundRaiser', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">אם מגייס</span>
          </label>

          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.showSum || false}
              onChange={(e) => handleInputChange('showSum', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג סכום</span>
          </label>

          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.showDonorFundRaiser || false}
              onChange={(e) => handleInputChange('showDonorFundRaiser', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג תורם מגייס</span>
          </label>

          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.skipDonationApproved || false}
              onChange={(e) => handleInputChange('skipDonationApproved', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">דלג על אישור תרומה</span>
          </label>

          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.supervisorApproval || false}
              onChange={(e) => handleInputChange('supervisorApproval', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">אישור מנהל</span>
          </label>
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





