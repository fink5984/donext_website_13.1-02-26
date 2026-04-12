"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import styles from './contacts.module.scss';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import Button from '@/app/components/Button';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

export default function AddToCampaignModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  selectedPersonIds, 
  clientId 
}) {
  const t = useTranslations('contactsPage');
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedCampaign = useMemo(
    () => campaigns.find(c => String(c.id) === selectedCampaignId),
    [campaigns, selectedCampaignId]
  );

  // Auto-determine role based on campaign type
  const autoRole = useMemo(() => {
    if (!selectedCampaign) return 'donor';
    return selectedCampaign.campaign_type === 'crowdfunding' ? 'fundraiser' : 'donor';
  }, [selectedCampaign]);

  const roleLabel = useMemo(() => {
    return autoRole === 'fundraiser' ? t('roleFundraiser') : t('roleDonor');
  }, [autoRole, t]);

  const filteredCampaigns = useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const term = searchTerm.trim().toLowerCase();
    return campaigns.filter(c => c.name?.toLowerCase().includes(term));
  }, [campaigns, searchTerm]);

  // Fetch campaigns
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!clientId) return;
      setLoadingCampaigns(true);
      try {
        const res = await fetchWithAuth(`/api/campaigns?clientId=${clientId}`);
        if (res?.ok) {
          const data = await res.json();
          setCampaigns(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    fetchCampaigns();
  }, [clientId]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedCampaignId('');
      setError('');
      setSearchTerm('');
      setDropdownOpen(false);
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleSelectCampaign = (id) => {
    setSelectedCampaignId(String(id));
    setDropdownOpen(false);
    setSearchTerm('');
  };

  const handleSubmit = async () => {
    if (!selectedCampaignId) { setError(t('selectCampaignError')); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/people/add-to-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-campaign-id': selectedCampaignId,
        },
        body: JSON.stringify({
          personIds: selectedPersonIds,
          campaignId: parseInt(selectedCampaignId),
          role: autoRole,
        })
      });
      if (res.ok) {
        const result = await res.json();
        onSuccess(result);
      } else {
        const errorData = await res.json();
        setError(errorData.error || t('addToCampaignError'));
      }
    } catch (err) {
      console.error('Error adding contacts to campaign:', err);
      setError(t('addToCampaignError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="p-[0] w-[780px] max-w-[none] border-none overflow-visible">
        <AlertDialogTitle className="sr-only">{t('addToCampaignTitle')}</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">{t('addToCampaignDescription', { count: selectedPersonIds.length })}</AlertDialogDescription>

        <div className={styles.atcPopup}>
          {/* Title */}
          <div className={styles.atcTitle}>
            <span className="headline-4">{t('addToCampaignTitle')}</span>
            <span className={styles.atcSubtitle}>
              {t('addToCampaignDescription', { count: selectedPersonIds.length })}
            </span>
          </div>

          {/* Campaign dropdown */}
          <div className={styles.atcContent}>
            <div className={styles.atcDropdownWrapper} ref={dropdownRef}>
              <button
                type="button"
                className={`${styles.atcDropdownTrigger} ${dropdownOpen ? styles.atcDropdownTriggerOpen : ''}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className={selectedCampaign ? styles.atcDropdownValue : styles.atcDropdownPlaceholder}>
                  {selectedCampaign ? selectedCampaign.name : t('selectCampaignPlaceholder')}
                </span>
                <span className={`${styles.atcDropdownArrow} ${dropdownOpen ? styles.atcDropdownArrowOpen : ''}`}>▾</span>
              </button>

              {dropdownOpen && (
                <div className={styles.atcDropdownPanel}>
                  <input
                    type="text"
                    placeholder={t('selectCampaignPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.atcDropdownSearch}
                    autoFocus
                  />
                  <div className={styles.atcCampaignList}>
                    {loadingCampaigns ? (
                      <div className={styles.atcEmpty}>{t('loading')}</div>
                    ) : filteredCampaigns.length === 0 ? (
                      <div className={styles.atcEmpty}>{t('noCampaignsAvailable')}</div>
                    ) : filteredCampaigns.map((campaign) => (
                      <button
                        key={campaign.id}
                        className={`${styles.atcCampaignItem} ${String(campaign.id) === selectedCampaignId ? styles.atcCampaignSelected : ''}`}
                        onClick={() => handleSelectCampaign(campaign.id)}
                      >
                        <span className={styles.atcCampaignName}>{campaign.name}</span>
                        <span className={styles.atcCampaignType}>
                          {campaign.campaign_type === 'crowdfunding' ? t('typeCrowdfunding') : t('typeCommunity')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Show selected info */}
            {selectedCampaign && (
              <div className={styles.atcSelectedInfo}>
                <span>{t('roleLabel')}: <strong>{roleLabel}</strong></span>
                <span>{t('contactCount')}: <strong>{selectedPersonIds.length}</strong></span>
              </div>
            )}
          </div>

          {error && <div className={styles.atcError}>{error}</div>}

          {/* Buttons */}
          <div className={styles.atcActions}>
            <Button
              text={t('addToCampaignButton')}
              onClick={handleSubmit}
              primary
              disabled={!selectedCampaignId || loading}
              loading={loading}
            />
            <Button
              text={t('cancel')}
              onClick={onClose}
              disabled={loading}
            />
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
