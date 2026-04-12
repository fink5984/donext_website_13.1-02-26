'use client';

import { useState, useEffect } from 'react';
import FileUpload from '@/app/components/FileUpload';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

export default function OpenedScreenSettingsForm({ settings, onUpdate, onSave, saving, campaignId }) {
  const [formData, setFormData] = useState(settings || {});
  const [campaignLogo, setCampaignLogo] = useState(null);
  
  // Fetch campaign data to get logo
  useEffect(() => {
    fetchWithAuth(`/api/campaigns/${campaignId}`)
      .then(res => res.json())
      .then(data => {
        if (data.logo) setCampaignLogo(data.logo);
      })
      .catch(console.error);
  }, [campaignId]);
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
        {/* Logo Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות לוגו</h3>
          
          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.bsShowLogo || false}
              onChange={(e) => handleInputChange('bsShowLogo', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג לוגו</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גובה לוגו
            </label>
            <input
              type="number"
              value={formData.bsLogoHeight || ''}
              onChange={(e) => handleInputChange('bsLogoHeight', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גובה לוגו"
            />
            <div className="mt-2">
              <FileUpload
                campaignId={campaignId}
                accept="image/*"
                label="העלה לוגו"
                endpoint="/api/storage"
                prefix={`screen-settings/${campaignId}`}
                fieldName="campaignLogo"
                previousUrl={formData.campaignLogo || campaignLogo}
                onUploadComplete={(url) => {
                  // Store logo URL temporarily
                  setCampaignLogo(url);
                  handleInputChange('campaignLogo', url);
                }}
              />
              {(formData.campaignLogo || campaignLogo) && (
                <img src={formData.campaignLogo || campaignLogo} alt="logo" className="mt-2 max-h-24 rounded bg-white p-2" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              ריווח עליון לוגו
            </label>
            <input
              type="number"
              value={formData.bsLogoTopMargin || ''}
              onChange={(e) => handleInputChange('bsLogoTopMargin', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ריווח עליון"
            />
          </div>
        </div>

        {/* Name Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות שם</h3>
          
          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן שם
            </label>
            <input
              type="number"
              value={formData.bsNameFontSize || ''}
              onChange={(e) => handleInputChange('bsNameFontSize', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              צבע שם
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalizeColor(formData.bsNameColor, '#ffffff')}
                onChange={(e) => handleInputChange('bsNameColor', e.target.value)}
                className="h-10 w-14 border border-gray-300 rounded-md"
              />
              <span className="inline-block w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: normalizeColor(formData.bsNameColor, '#ffffff') }} />
              <span className="text-xs text-gray-600">{normalizeColor(formData.bsNameColor, '#ffffff')}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              ריווח עליון שם
            </label>
            <input
              type="number"
              value={formData.bsNameTopMargin || ''}
              onChange={(e) => handleInputChange('bsNameTopMargin', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ריווח עליון"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Amount Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות סכום</h3>
          
          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.bsShowAmount || false}
              onChange={(e) => handleInputChange('bsShowAmount', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג סכום</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן סכום
            </label>
            <input
              type="number"
              value={formData.bsAmountFontSize || ''}
              onChange={(e) => handleInputChange('bsAmountFontSize', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              צבע סכום
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalizeColor(formData.bsAmountColor, '#ffffff')}
                onChange={(e) => handleInputChange('bsAmountColor', e.target.value)}
                className="h-10 w-14 border border-gray-300 rounded-md"
              />
              <span className="inline-block w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: normalizeColor(formData.bsAmountColor, '#ffffff') }} />
              <span className="text-xs text-gray-600">{normalizeColor(formData.bsAmountColor, '#ffffff')}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              ריווח עליון סכום
            </label>
            <input
              type="number"
              value={formData.bsAmountTopMargin || ''}
              onChange={(e) => handleInputChange('bsAmountTopMargin', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ריווח עליון"
            />
          </div>
        </div>

        {/* Rank Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-right">הגדרות דירוג</h3>
          
          <label className="flex items-center justify-end space-x-2 space-x-reverse">
            <input
              type="checkbox"
              checked={formData.bsShowRank || false}
              onChange={(e) => handleInputChange('bsShowRank', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">הצג דירוג</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              גודל גופן דירוג
            </label>
            <input
              type="number"
              value={formData.bsRankFontSize || ''}
              onChange={(e) => handleInputChange('bsRankFontSize', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="גודל גופן"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              צבע דירוג
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalizeColor(formData.bsRankColor, '#ffffff')}
                onChange={(e) => handleInputChange('bsRankColor', e.target.value)}
                className="h-10 w-14 border border-gray-300 rounded-md"
              />
              <span className="inline-block w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: normalizeColor(formData.bsRankColor, '#ffffff') }} />
              <span className="text-xs text-gray-600">{normalizeColor(formData.bsRankColor, '#ffffff')}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-right mb-2">
              ריווח עליון דירוג
            </label>
            <input
              type="number"
              value={formData.bsRankTopMargin || ''}
              onChange={(e) => handleInputChange('bsRankTopMargin', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ריווח עליון"
            />
          </div>
        </div>
      </div>

      {/* Other Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-right">הגדרות נוספות</h3>
        
        <label className="flex items-center justify-end space-x-2 space-x-reverse">
          <input
            type="checkbox"
            checked={formData.showNamesInDonationScreen || false}
            onChange={(e) => handleInputChange('showNamesInDonationScreen', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium">הצג שמות במסך תרומה</span>
        </label>
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
