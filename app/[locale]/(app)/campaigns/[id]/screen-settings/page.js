'use client';

import { useState, useEffect } from 'react';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { useParams } from 'next/navigation';
import ScreenSettingsForm from './ScreenSettingsForm';
import VideoSettingsForm from './VideoSettingsForm';
import TimerSettingsForm from './TimerSettingsForm';
import CubesSettingsForm from './CubesSettingsForm';
import OpenedScreenSettingsForm from './OpenedScreenSettingsForm';
import CreditCardSettingsForm from './CreditCardSettingsForm';
import CommunitySettingsForm from './CommunitySettingsForm';
import ShopSettingsForm from './ShopSettingsForm';

export default function CampaignScreenSettingsPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState('screen');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tabs = [
    { id: 'screen', label: 'הגדרות מסך', component: ScreenSettingsForm },
    { id: 'video', label: 'הגדרות וידאו', component: VideoSettingsForm },
    { id: 'timer', label: 'הגדרות טיימר', component: TimerSettingsForm },
    { id: 'cubes', label: 'הגדרות קוביות', component: CubesSettingsForm },
    { id: 'opened', label: 'הגדרות מסך פתוח', component: OpenedScreenSettingsForm },
    { id: 'credit', label: 'הגדרות כרטיס אשראי', component: CreditCardSettingsForm },
    { id: 'community', label: 'הגדרות קהילה', component: CommunitySettingsForm },
    { id: 'shop', label: 'הגדרות חנות', component: ShopSettingsForm },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetchWithAuth(`/api/campaigns/${params.id}/screen-settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else if (response.status === 404) {
        // Create default settings if none exist
        setSettings(getDefaultSettings());
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultSettings = () => ({
    displayTopPart: true,
    displayBottomPart: true,
    preloadingNames: true,
    byPresence: false,
    displayRank: true,
    displayShtiebel: false,
    displayFreeField1: false,
    showAmount: true,
    bsShowLogo: true,
    bsShowAmount: true,
    bsShowRank: true,
    showNamesInDonationScreen: true,
    displayDonationButton: true,
    hasShop: false,
    ifHok: false,
    ifFundRaiser: false,
    showSum: true,
    showDonorFundRaiser: false,
    skipDonationApproved: false,
    supervisorApproval: false,
    lowDonationDisplay: 'HIDE',
  });

  const handleSave = async (updatedSettings) => {
    setSaving(true);
    try {
      // Save campaign logo only on Save click (not during upload)
      const { campaignLogo, ...restSettings } = updatedSettings || {};

      if (campaignLogo) {
        await fetchWithAuth(`/api/campaigns/${params.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo: campaignLogo })
        });
      }

      const response = await fetchWithAuth(`/api/campaigns/${params.id}/screen-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restSettings),
      });

      if (response.ok) {
        const savedSettings = await response.json();
        setSettings(savedSettings);
        alert('הגדרות נשמרו בהצלחה');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">טוען...</div>;
  }

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-right">הגדרות מסך התרמה</h1>
      
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {ActiveComponent && (
          <ActiveComponent
            settings={settings}
            onUpdate={updateSettings}
            onSave={handleSave}
            saving={saving}
            campaignId={params.id}
          />
        )}
      </div>
    </div>
  );
}
