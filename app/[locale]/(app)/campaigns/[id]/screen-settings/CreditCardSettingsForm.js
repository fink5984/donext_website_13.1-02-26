'use client';

import { useState } from 'react';

export default function CreditCardSettingsForm({ settings, onUpdate, onSave, saving }) {
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
        {/* Donation Button Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות כפתור תרומה</h3>
          
          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.displayDonationButton || false}
              onChange={(e) => handleInputChange('displayDonationButton', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג כפתור תרומה</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              מיקום כפתור תרומה
            </label>
            <select
              value={formData.donationButtonPosition || ''}
              onChange={(e) => handleInputChange('donationButtonPosition', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">בחר מיקום</option>
              <option value="top">עליון</option>
              <option value="bottom">תחתון</option>
              <option value="center">מרכז</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              תמונת רקע כפתור תרומה
            </label>
            <input
              type="text"
              value={formData.donationButtonBackgroundImage || ''}
              onChange={(e) => handleInputChange('donationButtonBackgroundImage', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="URL תמונת רקע"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              URL כפתור תרומה
            </label>
            <input
              type="url"
              value={formData.donationButtonUrl || ''}
              onChange={(e) => handleInputChange('donationButtonUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/donate"
            />
          </div>
        </div>

        {/* Mosad Webhook Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות Webhook מוסד</h3>
          
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              Webhook מוסד 1
            </label>
            <input
              type="number"
              value={formData.mosadWebhook1 || ''}
              onChange={(e) => handleInputChange('mosadWebhook1', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Webhook 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              Webhook מוסד 2
            </label>
            <input
              type="number"
              value={formData.mosadWebhook2 || ''}
              onChange={(e) => handleInputChange('mosadWebhook2', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Webhook 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              Webhook מוסד 3
            </label>
            <input
              type="number"
              value={formData.mosadWebhook3 || ''}
              onChange={(e) => handleInputChange('mosadWebhook3', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Webhook 3"
            />
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





