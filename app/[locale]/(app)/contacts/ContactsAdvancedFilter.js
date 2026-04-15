"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import styles from "./ContactsAdvancedFilter.module.scss";
import X from "@/app/icons/x.svg";
import SearchIcon from "@/app/icons/search.svg";
import SourceLandingIcon from '@/app/icons/sourceLandingPage.svg';
import SourceSystemIcon from '@/app/icons/sourceSystemFeed.svg';
import SourcePhoneIcon from '@/app/icons/sourcePhone.svg';
import SourceVowsIcon from '@/app/icons/sourceVows.svg';
import SourceCreditIcon from '@/app/icons/sourceCreditCard.svg';
import MultiRangeSlider from "../filter/multiRangeSlider/multiRangeSlider";
import fetchWithAuth from '@/app/utils/fetchWithAuth';

/* ============ Searchable Multi-Select Dropdown ============ */
function SearchableMultiSelect({ options, selected, onChange, placeholder, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);
  const hasValue = selected.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search) return options;
    return options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const toggle = (opt) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };

  const displayText = selected.length === 0
    ? placeholder
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} נבחרו`;

  return (
    <div className={styles.dropdownWrapper} ref={wrapperRef}>
      {label && (
        <label className={`${styles.floatingLabel} ${(hasValue || isOpen) ? styles.floatingLabelActive : ''}`}>
          {label}
        </label>
      )}
      <button
        type="button"
        className={`${styles.dropdownButton} ${hasValue ? styles.hasValue : ''} ${isOpen ? styles.isOpen : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className={selected.length === 0 ? styles.placeholderText : styles.selectedText}>
          {(label && !hasValue && !isOpen) ? '' : displayText}
        </span>
        <svg className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {isOpen && (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownSearch}>
            <SearchIcon className={styles.dropdownSearchIcon} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </div>
          <div className={styles.dropdownOptions}>
            {filtered.map((opt, i) => {
              const isSel = selected.includes(opt);
              return (
                <div
                  key={i}
                  className={`${styles.dropdownOption} ${isSel ? styles.selected : ''}`}
                  onClick={() => toggle(opt)}
                >
                  <input type="checkbox" checked={isSel} readOnly className={styles.optionCheckbox} />
                  <span>{opt}</span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className={styles.noResults}>אין תוצאות</div>
            )}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              className={styles.clearSelectionBtn}
              onClick={() => { onChange([]); }}
            >
              נקה בחירה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Campaign pill color palette (deterministic by campaign ID — same as ContactsPage)
const CAMPAIGN_PILL_COLORS = [
  { bg: '#DAEAFE', text: '#0C4AD5' },   // blue
  { bg: '#F3F5F7', text: '#454B4E' },   // gray
  { bg: '#ECE9FC', text: '#744ABF' },   // purple
  { bg: '#FDE4E3', text: '#B35056' },   // red
  { bg: 'rgba(50,255,255,0.2)', text: '#26A9A9' }, // teal
  { bg: '#FBE7F3', text: '#CC7093' },   // pink
];

function getCampaignPillColor(campaignId) {
  const idx = (typeof campaignId === 'number' ? campaignId : parseInt(campaignId) || 0) % CAMPAIGN_PILL_COLORS.length;
  return CAMPAIGN_PILL_COLORS[idx];
}

// Donation source keys
const DONATION_SOURCES = ['credit', 'vows', 'phone', 'system', 'landing'];

// Contact method keys
const CONTACT_METHODS = ['phone', 'mobile', 'email', 'whatsapp', 'sms'];

const ContactsAdvancedFilter = forwardRef(function ContactsAdvancedFilter(
  { isOpen, onClose, onApply, onReset, clientId, totalResults },
  ref
) {
  const t = useTranslations('contactsPage');

  // Active section tab
  const [activeSection, setActiveSection] = useState('campaigns');

  // Personal details — multi-select arrays
  const [selectedFirstNames, setSelectedFirstNames] = useState([]);
  const [selectedLastNames, setSelectedLastNames] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedStreets, setSelectedStreets] = useState([]);
  const [selectedHouseNumbers, setSelectedHouseNumbers] = useState([]);
  const [selectedTitlesBefore, setSelectedTitlesBefore] = useState([]);
  const [selectedTitlesAfter, setSelectedTitlesAfter] = useState([]);
  const [selectedFundraisers, setSelectedFundraisers] = useState([]);

  // Campaigns & Donations
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [standingOrder, setStandingOrder] = useState(null); // null=no filter, true, false
  const [expectedRange, setExpectedRange] = useState({ min: 0, max: 1000000 });
  const [actualRange, setActualRange] = useState({ min: 0, max: 1000000 });
  const [isFundraiser, setIsFundraiser] = useState(false);
  const [rating, setRating] = useState(0);
  const [selectedContactMethods, setSelectedContactMethods] = useState([]);

  // Additional details — multi-select arrays
  const [selectedFatherNames, setSelectedFatherNames] = useState([]);
  const [selectedMotherNames, setSelectedMotherNames] = useState([]);
  const [selectedGroomAt, setSelectedGroomAt] = useState([]);
  const [selectedWifeNames, setSelectedWifeNames] = useState([]);
  const [selectedSynagogues, setSelectedSynagogues] = useState([]);

  // Age
  const [ageFrom, setAgeFrom] = useState('');
  const [ageTo, setAgeTo] = useState('');

  // Filter options from API (distinct values for dropdowns)
  const [filterOptions, setFilterOptions] = useState({
    firstNames: [], lastNames: [], cities: [], streets: [], houseNumbers: [],
    titlesBefore: [], titlesAfter: [], fundraiserNames: [],
    fatherNames: [], motherNames: [], synagogues: [],
  });

  // Fetch campaigns
  useEffect(() => {
    if (!isOpen || !clientId) return;
    let cancelled = false;
    const fetchCampaigns = async () => {
      setLoadingCampaigns(true);
      try {
        const res = await fetchWithAuth(`/api/campaigns?clientId=${clientId}`);
        if (res?.ok) {
          const data = await res.json();
          if (!cancelled) {
            const campaignList = Array.isArray(data) ? data : (data.data || data.campaigns || []);
            setCampaigns(campaignList);
          }
        }
      } catch (e) {
        console.error('Error fetching campaigns for filter:', e);
      } finally {
        if (!cancelled) setLoadingCampaigns(false);
      }
    };
    fetchCampaigns();
    return () => { cancelled = true; };
  }, [isOpen, clientId]);

  // Fetch filter options (distinct field values for dropdowns)
  useEffect(() => {
    if (!isOpen || !clientId) return;
    let cancelled = false;
    const fetchFilterOptions = async () => {
      try {
        const res = await fetchWithAuth(`/api/people/filter-options?clientId=${clientId}`);
        if (res?.ok) {
          const data = await res.json();
          if (!cancelled) setFilterOptions(data);
        }
      } catch (e) {
        console.error('Error fetching filter options:', e);
      }
    };
    fetchFilterOptions();
    return () => { cancelled = true; };
  }, [isOpen, clientId]);

  // Toggle campaign selection
  const toggleCampaign = (campaignId) => {
    setSelectedCampaignIds(prev =>
      prev.includes(campaignId) ? prev.filter(id => id !== campaignId) : [...prev, campaignId]
    );
  };

  // Toggle donation source
  const toggleSource = (source) => {
    setSelectedSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  // Toggle contact method
  const toggleContactMethod = (method) => {
    setSelectedContactMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  // Handle range changes
  const handleExpectedChange = (values) => {
    setExpectedRange({
      min: Math.max(0, Math.min(values.min, expectedRange.max - 1)),
      max: Math.min(1000000, Math.max(values.max, expectedRange.min + 1)),
    });
  };

  const handleActualChange = (values) => {
    setActualRange({
      min: Math.max(0, Math.min(values.min, actualRange.max - 1)),
      max: Math.min(1000000, Math.max(values.max, actualRange.min + 1)),
    });
  };

  // Star rating click
  const handleRatingClick = (starValue) => {
    setRating(prev => prev === starValue ? 0 : starValue);
  };

  // Collect all filters
  const collectFilters = useCallback(() => {
    const filters = {};

    // Personal — multi-select arrays
    if (selectedFirstNames.length > 0) filters.firstNames = selectedFirstNames;
    if (selectedLastNames.length > 0) filters.lastNames = selectedLastNames;
    if (selectedCities.length > 0) filters.cities = selectedCities;
    if (selectedStreets.length > 0) filters.streets = selectedStreets;
    if (selectedHouseNumbers.length > 0) filters.houseNumbers = selectedHouseNumbers;
    if (selectedTitlesBefore.length > 0) filters.titlesBefore = selectedTitlesBefore;
    if (selectedTitlesAfter.length > 0) filters.titlesAfter = selectedTitlesAfter;
    if (selectedFundraisers.length > 0) filters.fundraiserNames = selectedFundraisers;

    // Campaigns & Donations
    if (selectedCampaignIds.length > 0) filters.campaignIds = selectedCampaignIds;
    if (selectedSources.length > 0) filters.sources = selectedSources;
    if (standingOrder !== null) filters.standingOrder = standingOrder;
    if (expectedRange.min > 0 || expectedRange.max < 1000000) {
      filters.expectedMin = expectedRange.min;
      filters.expectedMax = expectedRange.max;
    }
    if (actualRange.min > 0 || actualRange.max < 1000000) {
      filters.actualMin = actualRange.min;
      filters.actualMax = actualRange.max;
    }
    if (isFundraiser) filters.isFundraiser = true;
    if (rating > 0) filters.rating = rating;
    if (selectedContactMethods.length > 0) filters.contactMethod = selectedContactMethods;

    // Additional details — multi-select arrays
    if (selectedFatherNames.length > 0) filters.fatherNames = selectedFatherNames;
    if (selectedMotherNames.length > 0) filters.motherNames = selectedMotherNames;
    if (selectedGroomAt.length > 0) filters.groomAt = selectedGroomAt;
    if (selectedWifeNames.length > 0) filters.wifeNames = selectedWifeNames;
    if (selectedSynagogues.length > 0) filters.synagogues = selectedSynagogues;

    // Age
    if (ageFrom) filters.ageFrom = parseInt(ageFrom);
    if (ageTo) filters.ageTo = parseInt(ageTo);

    return filters;
  }, [selectedFirstNames, selectedLastNames, selectedCities, selectedStreets, selectedHouseNumbers, selectedTitlesBefore, selectedTitlesAfter, selectedFundraisers, selectedCampaignIds, selectedSources, standingOrder, expectedRange, actualRange, isFundraiser, rating, selectedContactMethods, selectedFatherNames, selectedMotherNames, selectedGroomAt, selectedWifeNames, selectedSynagogues, ageFrom, ageTo]);

  // Apply filters
  const handleApply = () => {
    const filters = collectFilters();
    if (onApply) onApply(filters);
    onClose();
  };

  // Live-apply filters on every state change (debounced)
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const prevFiltersRef = useRef('');

  useEffect(() => {
    if (!isOpenRef.current) return;
    const filtersJson = JSON.stringify(collectFilters());
    // Skip if filters haven't actually changed
    if (filtersJson === prevFiltersRef.current) return;
    prevFiltersRef.current = filtersJson;
    const timer = setTimeout(() => {
      const filters = collectFilters();
      if (onApply) onApply(filters);
    }, 400);
    return () => clearTimeout(timer);
  }, [collectFilters]); // only re-run when filters change, NOT on isOpen change

  // Reset all filters
  const handleReset = () => {
    setSelectedFirstNames([]);
    setSelectedLastNames([]);
    setSelectedCities([]);
    setSelectedStreets([]);
    setSelectedHouseNumbers([]);
    setSelectedTitlesBefore([]);
    setSelectedTitlesAfter([]);
    setSelectedFundraisers([]);
    setSelectedCampaignIds([]);
    setSelectedSources([]);
    setStandingOrder(null);
    setExpectedRange({ min: 0, max: 1000000 });
    setActualRange({ min: 0, max: 1000000 });
    setIsFundraiser(false);
    setRating(0);
    setSelectedContactMethods([]);
    setSelectedFatherNames([]);
    setSelectedMotherNames([]);
    setSelectedGroomAt([]);
    setSelectedWifeNames([]);
    setSelectedSynagogues([]);
    setAgeFrom('');
    setAgeTo('');
    if (onReset) onReset();
  };

  // Hydrate local state from store filters (for bidirectional sync with chip bar)
  const hydrateFromStore = useCallback((storeFilters) => {
    if (!storeFilters) return;

    // Personal
    setSelectedFirstNames(storeFilters.firstNames || []);
    setSelectedLastNames(storeFilters.lastNames || []);
    // city (chip bar, string) → selectedCities; cities (advanced, array) → selectedCities
    if (storeFilters.cities?.length) setSelectedCities(storeFilters.cities);
    else if (storeFilters.city) setSelectedCities([storeFilters.city]);
    else setSelectedCities([]);
    setSelectedStreets(storeFilters.streets || []);
    setSelectedHouseNumbers(storeFilters.houseNumbers || []);
    setSelectedTitlesBefore(storeFilters.titlesBefore || []);
    setSelectedTitlesAfter(storeFilters.titlesAfter || []);
    setSelectedFundraisers(storeFilters.fundraiserNames || []);

    // Campaigns & Donations
    setSelectedCampaignIds(storeFilters.campaignIds || []);
    setSelectedSources(storeFilters.sources || []);
    setStandingOrder(storeFilters.standingOrder !== undefined ? storeFilters.standingOrder : null);
    setExpectedRange({
      min: storeFilters.expectedMin || 0,
      max: storeFilters.expectedMax || 1000000,
    });
    setActualRange({
      min: storeFilters.actualMin || 0,
      max: storeFilters.actualMax || 1000000,
    });
    setIsFundraiser(!!storeFilters.isFundraiser);
    setRating(storeFilters.rating || 0);
    setSelectedContactMethods(storeFilters.contactMethod || []);

    // Additional
    setSelectedFatherNames(storeFilters.fatherNames || []);
    setSelectedMotherNames(storeFilters.motherNames || []);
    setSelectedGroomAt(storeFilters.groomAt || []);
    setSelectedWifeNames(storeFilters.wifeNames || []);
    setSelectedSynagogues(storeFilters.synagogues || []);
    setAgeFrom(storeFilters.ageFrom ? String(storeFilters.ageFrom) : '');
    setAgeTo(storeFilters.ageTo ? String(storeFilters.ageTo) : '');
  }, []);

  useImperativeHandle(ref, () => ({
    reset: handleReset,
    getFilters: collectFilters,
    hydrateFromStore,
  }));

  // Source icon map
  const sourceIconMap = {
    credit: <SourceCreditIcon />,
    vows: <SourceVowsIcon />,
    phone: <SourcePhoneIcon />,
    system: <SourceSystemIcon />,
    landing: <SourceLandingIcon />,
  };

  const sourceLabelMap = {
    credit: t('sourceCredit'),
    vows: t('sourceVows'),
    phone: t('sourcePhone'),
    system: t('sourceSystem'),
    landing: t('sourceLanding'),
  };

  const contactMethodLabelMap = {
    phone: t('af_methodPhone'),
    mobile: t('af_methodMobile'),
    email: t('af_methodEmail'),
    whatsapp: t('af_methodWhatsapp'),
    sms: t('af_methodSms'),
  };

  const sectionTabs = [
    { id: 'campaigns', label: t('af_campaignsDonations') },
    { id: 'personal', label: t('af_personalDetails') },
    { id: 'additional', label: t('af_additionalDetails') },
  ];

  // Count active filters per tab
  const tabCounts = useMemo(() => ({
    personal:
      selectedFirstNames.length +
      selectedLastNames.length +
      selectedCities.length +
      selectedStreets.length +
      selectedHouseNumbers.length +
      selectedTitlesBefore.length +
      selectedTitlesAfter.length +
      selectedFundraisers.length,
    campaigns:
      selectedCampaignIds.length +
      selectedSources.length +
      (standingOrder !== null ? 1 : 0) +
      (expectedRange.min > 0 || expectedRange.max < 1000000 ? 1 : 0) +
      (actualRange.min > 0 || actualRange.max < 1000000 ? 1 : 0) +
      (isFundraiser ? 1 : 0) +
      (rating > 0 ? 1 : 0) +
      selectedContactMethods.length,
    additional:
      selectedFatherNames.length +
      selectedMotherNames.length +
      selectedGroomAt.length +
      selectedWifeNames.length +
      selectedSynagogues.length +
      (ageFrom ? 1 : 0) +
      (ageTo ? 1 : 0),
  }), [selectedFirstNames, selectedLastNames, selectedCities, selectedStreets, selectedHouseNumbers, selectedTitlesBefore, selectedTitlesAfter, selectedFundraisers, selectedCampaignIds, selectedSources, standingOrder, expectedRange, actualRange, isFundraiser, rating, selectedContactMethods, selectedFatherNames, selectedMotherNames, selectedGroomAt, selectedWifeNames, selectedSynagogues, ageFrom, ageTo]);

  const totalFilterCount = tabCounts.personal + tabCounts.campaigns + tabCounts.additional;

  return (
    <>
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} />
      )}
      <div
        className={`${styles.filterContainer} ${isOpen ? styles.open : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className={styles.closeButton}>
          <X />
        </button>

        {/* Header */}
        <div className={styles.filterHeader}>
          <h2 className="headline-2">{t('advancedFilter')}</h2>
          {totalFilterCount > 0 && (
            <p className={styles.filterCountSubtitle}>ערכי סינון פעילים: {totalFilterCount}</p>
          )}
        </div>

        {/* Section Tabs */}
        <div className={styles.sectionTabs}>
          {sectionTabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.sectionTab} ${activeSection === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveSection(tab.id)}
            >
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span className={styles.tabBadge}>{tabCounts[tab.id]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className={styles.filterContentWrapper}>
          <div className={styles.filterContent}>

            {/* ==================== PERSONAL DETAILS ==================== */}
            {activeSection === 'personal' && (
              <div className={styles.sectionContent}>
                {/* First Name */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_firstName')}
                    options={filterOptions.firstNames}
                    selected={selectedFirstNames}
                    onChange={setSelectedFirstNames}
                    placeholder={t('af_firstNamePlaceholder')}
                  />
                </div>

                {/* Last Name */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_lastName')}
                    options={filterOptions.lastNames}
                    selected={selectedLastNames}
                    onChange={setSelectedLastNames}
                    placeholder={t('af_lastNamePlaceholder')}
                  />
                </div>

                {/* City */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_city')}
                    options={filterOptions.cities}
                    selected={selectedCities}
                    onChange={setSelectedCities}
                    placeholder={t('af_cityPlaceholder')}
                  />
                </div>

                {/* Street + House Number */}
                <div className={styles.filterFieldRow}>
                  <div className={styles.filterField} style={{ flex: 2 }}>
                    <SearchableMultiSelect
                      label={t('af_street')}
                      options={filterOptions.streets}
                      selected={selectedStreets}
                      onChange={setSelectedStreets}
                      placeholder={t('af_streetPlaceholder')}
                    />
                  </div>
                  <div className={styles.filterField} style={{ flex: 1 }}>
                    <SearchableMultiSelect
                      label={t('af_houseNumber')}
                      options={filterOptions.houseNumbers}
                      selected={selectedHouseNumbers}
                      onChange={setSelectedHouseNumbers}
                      placeholder={t('af_houseNumberPlaceholder')}
                    />
                  </div>
                </div>

                {/* Title Before */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_titleBefore')}
                    options={filterOptions.titlesBefore}
                    selected={selectedTitlesBefore}
                    onChange={setSelectedTitlesBefore}
                    placeholder={t('af_titleBeforePlaceholder')}
                  />
                </div>

                {/* Title After */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_titleAfter')}
                    options={filterOptions.titlesAfter}
                    selected={selectedTitlesAfter}
                    onChange={setSelectedTitlesAfter}
                    placeholder={t('af_titleAfterPlaceholder')}
                  />
                </div>

                {/* Responsible Fundraiser */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_responsibleFundraiser')}
                    options={filterOptions.fundraiserNames}
                    selected={selectedFundraisers}
                    onChange={setSelectedFundraisers}
                    placeholder={t('af_responsibleFundraiserPlaceholder')}
                  />
                </div>
              </div>
            )}

            {/* ==================== CAMPAIGNS & DONATIONS ==================== */}
            {activeSection === 'campaigns' && (
              <div className={styles.sectionContent}>
                {/* Campaign selection */}
                <div className={styles.filterField}>
                  <h4 className={styles.sectionHeading}>{t('af_selectCampaigns')}</h4>
                  <div className={styles.campaignPills}>
                    {loadingCampaigns ? (
                      <span className={styles.loadingText}>{t('loading')}</span>
                    ) : campaigns.length === 0 ? (
                      <span className={styles.emptyText}>{t('af_noCampaigns')}</span>
                    ) : (
                      campaigns.map((campaign) => {
                        const color = getCampaignPillColor(campaign.id);
                        const isSelected = selectedCampaignIds.includes(campaign.id);
                        return (
                          <button
                            key={campaign.id}
                            className={`${styles.campaignPill} ${isSelected ? styles.campaignPillSelected : ''}`}
                            style={{
                              backgroundColor: color.bg,
                              color: color.text,
                              borderColor: isSelected ? color.text : 'transparent',
                            }}
                            onClick={() => toggleCampaign(campaign.id)}
                          >
                            {isSelected && <span className={styles.checkmark}>✓</span>}
                            <span className={styles.campaignPillName}>{campaign.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Donation Source */}
                <div className={styles.filterField}>
                  <h4 className={styles.sectionHeading}>{t('af_donationSource')}</h4>
                  <div className={styles.sourceGrid}>
                    {DONATION_SOURCES.map(source => {
                      const isSelected = selectedSources.includes(source);
                      return (
                        <button
                          key={source}
                          className={`${styles.sourceBox} ${isSelected ? styles.sourceBoxSelected : ''}`}
                          onClick={() => toggleSource(source)}
                        >
                          <div className={styles.sourceIcon}>{sourceIconMap[source]}</div>
                          <span className={styles.sourceLabel}>{sourceLabelMap[source]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Standing Order Toggle */}
                <div className={styles.filterField}>
                  <h4 className={styles.sectionHeading}>{t('af_standingOrder')}</h4>
                  <div className={styles.toggleWrapper}>
                    <button
                      className={`${styles.toggle} ${standingOrder === true ? styles.toggleOn : ''}`}
                      onClick={() => setStandingOrder(prev => prev === true ? null : true)}
                    >
                      <span className={styles.toggleCircle} />
                    </button>
                    <span className={`${styles.toggleLabel} table-3`}>
                      {standingOrder === true ? t('af_hasStandingOrder') : t('af_allDonations')}
                    </span>
                  </div>
                </div>

                {/* Expected Donation Range */}
                <div className={styles.filterField}>
                  <h4 className={styles.sectionHeading}>{t('af_donationAmounts')}</h4>
                  <MultiRangeSlider
                    min={0}
                    max={1000000}
                    currentMin={expectedRange.min}
                    currentMax={expectedRange.max}
                    type="expected"
                    onChange={handleExpectedChange}
                  />
                </div>

                {/* Actual Donation Range */}
                <div className={styles.filterField}>
                  <MultiRangeSlider
                    min={0}
                    max={1000000}
                    currentMin={actualRange.min}
                    currentMax={actualRange.max}
                    type="actual"
                    onChange={handleActualChange}
                  />
                </div>

                {/* Is Fundraiser + Star Rating */}
                <div className={styles.filterField}>
                  <h4 className={styles.sectionHeading}>{t('af_fundraiserRating')}</h4>
                  <div className={styles.fundraiserRatingRow}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={isFundraiser}
                        onChange={(e) => setIsFundraiser(e.target.checked)}
                        className={styles.checkboxInput}
                      />
                      <span className="table-2">{t('af_isFundraiser')}</span>
                    </label>
                    <div className={styles.ratingStarsFilter}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          className={`${styles.starButton} ${star <= rating ? styles.starFilled : ''}`}
                          onClick={() => handleRatingClick(star)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact Method */}
                <div className={styles.filterField}>
                  <h4 className={styles.sectionHeading}>{t('af_contactMethod')}</h4>
                  <div className={styles.contactMethodPills}>
                    {CONTACT_METHODS.map(method => {
                      const isSelected = selectedContactMethods.includes(method);
                      return (
                        <button
                          key={method}
                          className={`${styles.contactMethodPill} ${isSelected ? styles.contactMethodPillSelected : ''}`}
                          onClick={() => toggleContactMethod(method)}
                        >
                          {contactMethodLabelMap[method]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== ADDITIONAL DETAILS ==================== */}
            {activeSection === 'additional' && (
              <div className={styles.sectionContent}>
                {/* Father Name */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_fatherName')}
                    options={filterOptions.fatherNames}
                    selected={selectedFatherNames}
                    onChange={setSelectedFatherNames}
                    placeholder={t('af_fatherNamePlaceholder')}
                  />
                </div>

                {/* Mother Name */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_motherName')}
                    options={filterOptions.motherNames}
                    selected={selectedMotherNames}
                    onChange={setSelectedMotherNames}
                    placeholder={t('af_motherNamePlaceholder')}
                  />
                </div>

                {/* Groom At */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_groomAt')}
                    options={[]}
                    selected={selectedGroomAt}
                    onChange={setSelectedGroomAt}
                    placeholder={t('af_groomAtPlaceholder')}
                  />
                </div>

                {/* Wife Name */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_wifeName')}
                    options={[]}
                    selected={selectedWifeNames}
                    onChange={setSelectedWifeNames}
                    placeholder={t('af_wifeNamePlaceholder')}
                  />
                </div>

                {/* Synagogue */}
                <div className={styles.filterField}>
                  <SearchableMultiSelect
                    label={t('af_synagogue')}
                    options={filterOptions.synagogues}
                    selected={selectedSynagogues}
                    onChange={setSelectedSynagogues}
                    placeholder={t('af_synagoguePlaceholder')}
                  />
                </div>

                {/* Age Range */}
                <div className={styles.filterField}>
                  <div className={styles.ageRow}>
                    <div className={styles.ageInput}>
                      <button className={styles.ageBtn} onClick={() => setAgeFrom(prev => Math.max(0, (parseInt(prev) || 0) - 1).toString())}>−</button>
                      <input
                        type="number"
                        className={styles.ageField}
                        value={ageFrom}
                        onChange={(e) => setAgeFrom(e.target.value)}
                        placeholder={t('af_from')}
                        min="0"
                        max="120"
                      />
                      <button className={styles.ageBtn} onClick={() => setAgeFrom(prev => Math.min(120, (parseInt(prev) || 0) + 1).toString())}>+</button>
                    </div>
                    <span className={styles.ageSeparator}>−</span>
                    <div className={styles.ageInput}>
                      <button className={styles.ageBtn} onClick={() => setAgeTo(prev => Math.max(0, (parseInt(prev) || 0) - 1).toString())}>−</button>
                      <input
                        type="number"
                        className={styles.ageField}
                        value={ageTo}
                        onChange={(e) => setAgeTo(e.target.value)}
                        placeholder={t('af_to')}
                        min="0"
                        max="120"
                      />
                      <button className={styles.ageBtn} onClick={() => setAgeTo(prev => Math.min(120, (parseInt(prev) || 0) + 1).toString())}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.filterFooter}>
          <button className={styles.applyButton} onClick={handleApply}>
            {Object.keys(collectFilters()).length > 0
              ? t('af_showResults', { count: totalResults ?? 0 })
              : t('af_close')
            }
          </button>
          <button className={styles.resetButton} onClick={handleReset}>
            {t('af_resetFilters')}
          </button>
        </div>
      </div>
    </>
  );
});

export default ContactsAdvancedFilter;
