"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/app/components/AppContext';
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/StoreContext";
import styles from './contacts.module.scss';
import Search from '@/app/components/Search';
import Pagination from '../Pagination/Pagination.js';
import Up from "@/app/icons/up.svg";
import Down from "@/app/icons/down.svg";
import Circle from "@/app/icons/circle24.svg";
import Plus from "@/app/icons/plus.svg";
import Menu from "@/app/icons/menu.svg";
import XIcon from "@/app/icons/exitMini.svg";
import MailSmall from "@/app/icons/mailSmall.svg";
import DeleteIcon from "@/app/icons/deleteSmall.svg";
import DragHandle from "@/app/icons/dragHandle.svg";
import SearchIcon from "@/app/icons/search.svg";
import FilterIcon from '@/app/icons/filter.svg';
import Person from '@/app/icons/person.svg';
import CommunityMemberIcon from '@/app/icons/communityMember.svg';
import AddedDonorIcon from '@/app/icons/addedDonor.svg';
import UnknownDonorIcon from '@/app/icons/unknownDonor.svg';
import OneTimeDonorIcon from '@/app/icons/oneTimeDonor.svg';
import SourceLandingIcon from '@/app/icons/sourceLandingPage.svg';
import SourceSystemIcon from '@/app/icons/sourceSystemFeed.svg';
import SourcePhoneIcon from '@/app/icons/sourcePhone.svg';
import SourceVowsIcon from '@/app/icons/sourceVows.svg';
import SourceCreditIcon from '@/app/icons/sourceCreditCard.svg';
import DoNextLoader from '@/app/components/DoNextLoader';
import AddToCampaignModal from './AddToCampaignModal';
import ContactsExcelImport from './ContactsExcelImport';
import { formStore } from '@/app/stores/formStore';
import AddEdit from '../AddEdit/AddEdit';
import FilterChipDropdown from './FilterChipDropdown';
import CampaignFilterDropdown from './CampaignFilterDropdown';
import ContactsAdvancedFilter from './ContactsAdvancedFilter';
import ContactsNeedsAttention from './ContactsNeedsAttention';
import IconTooltip from '@/app/[locale]/components/IconTooltip/IconTooltip';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { AlertDialog, AlertDialogContent, AlertDialogPortal, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import Button from '@/app/components/Button';
import NewDonor from '@/app/icons/newDonor.svg';

// =====================
// Default column definitions (fallback if not loaded from DB)
// =====================
const DEFAULT_COLUMN_DEFS = [
  { id: 'city', width: '90px', sortKey: 'city', label: 'colCity' },
  { id: 'address', width: '140px', sortKey: 'address', label: 'colAddress' },
  { id: 'mobile', width: '100px', sortKey: 'mainMobile', label: 'colMobile' },
  { id: 'email', width: '140px', sortKey: 'email', label: 'colEmail' },
  { id: 'campaigns', width: '220px', sortKey: 'campaigns', label: 'colCampaigns' },
  { id: 'totalDonations', width: '130px', sortKey: 'totalDonations', label: 'colTotalDonations' },
  { id: 'tags', width: '120px', sortKey: 'tags', label: 'colTags' },
  { id: 'rating', width: '90px', sortKey: 'rating', label: 'colRating' },
  { id: 'synagogue', width: '110px', sortKey: 'synagogue', label: 'colSynagogue' },
  { id: 'fatherName', width: '100px', sortKey: 'fatherName', label: 'colFatherName' },
  { id: 'source', width: '140px', sortKey: 'source', label: 'colSource' },
  { id: 'responsibleFundraiser', width: '150px', sortKey: 'responsibleFundraiser', label: 'colResponsibleFundraiser' },
];

// Campaign pill color palette (deterministic by campaign ID)
const CAMPAIGN_COLORS = [
  { bg: '#DAEAFE', text: '#0C4AD5' },
  { bg: '#F3F5F7', text: '#454B4E' },
  { bg: '#ECE9FC', text: '#744ABF' },
  { bg: '#FDE4E3', text: '#B35056' },
  { bg: 'rgba(50, 255, 255, 0.2)', text: '#26A9A9' },
  { bg: '#FBE7F3', text: '#CC7093' },
];
function getCampaignColor(campaignId) {
  const idx = (typeof campaignId === 'number' ? campaignId : parseInt(campaignId) || 0) % CAMPAIGN_COLORS.length;
  return CAMPAIGN_COLORS[idx];
}

// Campaign tag with conditional tooltip (only when text is truncated)
function CampaignTag({ name, color }) {
  const textRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [name]);

  return (
    <span className={styles.campaignTag} style={{ backgroundColor: color.bg, color: color.text }}>
      <span ref={textRef} className={styles.campaignTagText}>{name}</span>
      {isTruncated && <span className={styles.campaignTagTooltip}>{name}</span>}
    </span>
  );
}

const COLUMN_WIDTH_MAP = Object.fromEntries(DEFAULT_COLUMN_DEFS.map(c => [c.id, c.width]));
const DEFAULT_COLUMN_ORDER = DEFAULT_COLUMN_DEFS.map(c => c.id);
const DEFAULT_VISIBLE = new Set(['city', 'address', 'mobile', 'email', 'campaigns', 'totalDonations', 'tags', 'rating']);

const ContactsPage = observer(function ContactsPage() {
  const t = useTranslations('contactsPage');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const router = useRouter();
  const { clientId } = useAppContext();
  const store = useStore();
  const contactsStore = store.contactsStore;

  // Modals
  const [showAddToCampaignModal, setShowAddToCampaignModal] = useState(false);
  const showExcelImport = contactsStore.showExcelImport;
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const advancedFilterRef = useRef(null);

  // Columns (local state, synced with DB)
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const [dragColumnId, setDragColumnId] = useState(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const columnMenuRef = useRef(null);
  const columnMenuButtonRef = useRef(null);

  // Custom top scrollbar
  const tableContainerRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({ width: '0%', right: '0%' });

  const updateScrollThumb = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const { clientWidth, scrollWidth, scrollLeft } = el;
    if (scrollWidth <= clientWidth) {
      setThumbStyle({ width: '100%', right: '0%' });
      return;
    }
    const thumbWidthPct = (clientWidth / scrollWidth) * 100;
    const maxScroll = scrollWidth - clientWidth;
    const scrolled = Math.abs(scrollLeft);
    const scrollRatio = Math.min(scrolled / maxScroll, 1);
    const maxTravel = 100 - thumbWidthPct;
    const offset = scrollRatio * maxTravel;
    setThumbStyle({ width: `${thumbWidthPct}%`, right: `${offset}%` });
  }, []);

  // Scroll thumb sync
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollThumb);
    const ro = new ResizeObserver(updateScrollThumb);
    ro.observe(el);
    updateScrollThumb();
    return () => {
      el.removeEventListener('scroll', updateScrollThumb);
      ro.disconnect();
    };
  }, [updateScrollThumb]);

  // Initial fetch
  useEffect(() => {
    if (!clientId) return;
    contactsStore.fetchContacts();
    contactsStore.fetchColumnSettings();
    contactsStore.fetchTags();
    contactsStore.fetchCustomFields();
    contactsStore.fetchNeedsAttentionCount();
  }, [clientId]);

  // Sync column settings from DB to local state
  useEffect(() => {
    if (!contactsStore.columnSettings) return;
    try {
      const settings = typeof contactsStore.columnSettings === 'string'
        ? JSON.parse(contactsStore.columnSettings)
        : contactsStore.columnSettings;
      if (Array.isArray(settings)) {
        const savedIds = settings.map(s => s.id).filter(Boolean);
        // Merge any new DEFAULT columns not yet in saved settings (appended at end, hidden)
        const allDefaultIds = DEFAULT_COLUMN_DEFS.map(c => c.id);
        const missingIds = allDefaultIds.filter(id => !savedIds.includes(id));
        const order = [...savedIds, ...missingIds];
        const visible = new Set(settings.filter(s => s.visible !== false).map(s => s.id));
        if (order.length > 0) {
          setColumnOrder(order);
          setVisibleColumns(visible);
        }
      }
    } catch (e) {
      console.error('Error parsing column settings:', e);
    }
  }, [contactsStore.columnSettings]);

  // Save column settings to DB
  const saveColumnSettings = useCallback((overrideVisible) => {
    const vis = overrideVisible || visibleColumns;
    // Ensure all DEFAULT columns are represented (new columns may not yet be in columnOrder)
    const allDefaultIds = DEFAULT_COLUMN_DEFS.map(c => c.id);
    const missingIds = allDefaultIds.filter(id => !columnOrder.includes(id));
    const fullOrder = [...columnOrder, ...missingIds];
    const settings = fullOrder.map(id => ({
      id, visible: vis.has(id), width: COLUMN_WIDTH_MAP[id] || '100px',
    }));
    contactsStore.saveColumnSettings(settings);
  }, [columnOrder, visibleColumns, contactsStore]);

  // Open contact card (same as donors page)
  const handleOpenEditForm = useCallback(async (contact) => {
    const personData = {
      ...contact,
      person_id: contact.id,
      id: contact.id,
    };
    await formStore.openEditForm(personData, 'donor');
  }, []);

  const handleFormSubmit = useCallback(async (formData) => {
    const result = await formStore.submitForm(clientId, null, formData);
    if (result) {
      contactsStore.fetchContacts();
      formStore.closeForm();
    }
    return result;
  }, [clientId, contactsStore]);

  // Search & sort
  const handleSearch = (term) => contactsStore.setSearch(term);
  const handleSort = (key, direction) => {
    if (contactsStore.sortField === key && contactsStore.sortDirection === direction) {
      contactsStore.setSort('firstName', 'asc');
    } else {
      contactsStore.setSort(key, direction);
    }
  };

  // Bulk delete
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasDonationsDialogOpen, setHasDonationsDialogOpen] = useState(false);
  const [hasDonationsAffectedCount, setHasDonationsAffectedCount] = useState(0);
  const [pendingDeleteIds, setPendingDeleteIds] = useState([]);

  const handleBulkDelete = () => {
    if (contactsStore.selectedContactIds.size === 0) return;
    setIsDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const ids = Array.from(contactsStore.selectedContactIds);
      const res = await fetchWithAuth('/api/people/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res?.ok) throw new Error('Failed to delete contacts');
      const data = await res.json();
      if (data.hasDonations) {
        setPendingDeleteIds(ids);
        setHasDonationsAffectedCount(data.affectedCount);
        setHasDonationsDialogOpen(true);
        return;
      }
      contactsStore.clearSelection();
      contactsStore.fetchContacts();
      contactsStore.fetchNeedsAttentionCount();
    } catch (err) {
      console.error('Bulk delete error:', err);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const confirmForceDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetchWithAuth('/api/people/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: pendingDeleteIds, force: true }),
      });
      if (!res?.ok) throw new Error('Failed to delete contacts');
      contactsStore.clearSelection();
      contactsStore.fetchContacts();
      contactsStore.fetchNeedsAttentionCount();
    } catch (err) {
      console.error('Force delete error:', err);
    } finally {
      setIsDeleting(false);
      setHasDonationsDialogOpen(false);
      setPendingDeleteIds([]);
    }
  };

  // Selection
  const handleSelectAll = (checked) => {
    if (checked) {
      contactsStore.toggleSelectAll();
    } else {
      contactsStore.clearSelection();
    }
  };
  const isAllSelected = contactsStore.allFilteredIds.length > 0
    ? contactsStore.allFilteredIds.length === contactsStore.selectedContactIds.size &&
      contactsStore.allFilteredIds.every(id => contactsStore.selectedContactIds.has(id))
    : contactsStore.contacts.length > 0 &&
      contactsStore.contacts.every(c => contactsStore.selectedContactIds.has(c.id));

  // Column drag
  const handleColumnDragStart = (e, columnId) => {
    setDragColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  };
  const handleColumnDragOver = (e, columnId) => {
    e.preventDefault();
    if (!dragColumnId || dragColumnId === columnId) return;
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const dragIdx = newOrder.indexOf(dragColumnId);
      const hoverIdx = newOrder.indexOf(columnId);
      if (dragIdx === -1 || hoverIdx === -1) return prev;
      newOrder.splice(dragIdx, 1);
      newOrder.splice(hoverIdx, 0, dragColumnId);
      return newOrder;
    });
  };
  const handleColumnDragEnd = () => { setDragColumnId(null); saveColumnSettings(); };

  const toggleColumnVisibility = (colId) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId); else next.add(colId);
      // Save immediately with the new set to avoid stale closure
      setTimeout(() => saveColumnSettings(next), 50);
      return next;
    });
  };

  // Close column menu on outside click
  useEffect(() => {
    if (!showColumnMenu) return;
    const handleClickOutside = (e) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target) &&
          columnMenuButtonRef.current && !columnMenuButtonRef.current.contains(e.target)) {
        setShowColumnMenu(false);
        setColumnSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnMenu]);

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Grid template
  const activeColumns = useMemo(() => columnOrder.filter(id => visibleColumns.has(id)), [columnOrder, visibleColumns]);
  const gridTemplateColumns = useMemo(() => {
    const colWidths = activeColumns.map(id => COLUMN_WIDTH_MAP[id] || '100px').join(' ');
    return `30px 30px 180px ${colWidths} minmax(40px, 1fr)`;
  }, [activeColumns]);

  // Summary
  const summaryStats = useMemo(() => {
    const allContacts = contactsStore.contacts;
    const uniqueCities = new Set(allContacts.map(c => c.city).filter(Boolean));
    return {
      contacts: contactsStore.totalContacts,
      totalDonations: contactsStore.totalDonationsSum,
      cities: uniqueCities.size,
      selected: contactsStore.selectedContactIds.size,
    };
  }, [contactsStore.contacts, contactsStore.totalContacts, contactsStore.totalDonationsSum, contactsStore.selectedContactIds.size]);

  const getColumnDef = (colId) => DEFAULT_COLUMN_DEFS.find(c => c.id === colId);

  const handleAddToCampaignSuccess = (result) => {
    setShowAddToCampaignModal(false);
    contactsStore.clearSelection();
    contactsStore.fetchContacts();
    // אם הוספנו מתרים — פסול מטמון תורמים כדי שה-isFundraiser יתרענן
    if (result?.role === 'fundraiser' && store.donorsStore) {
      store.donorsStore.invalidateDonorsCache();
    }
  };

  const clearFilters = () => {
    contactsStore.clearFilters();
    advancedFilterRef.current?.reset();
  };
  const hasActiveFilters = contactsStore.search ||
    // Chip bar filters
    contactsStore.filters.name ||
    contactsStore.filters.city ||
    contactsStore.filters.campaignIds?.length > 0 ||
    contactsStore.filters.source ||
    contactsStore.filters.type ||
    // Advanced-only filters (plural array keys)
    contactsStore.filters.tagIds?.length > 0 ||
    contactsStore.filters.firstNames?.length > 0 ||
    contactsStore.filters.lastNames?.length > 0 ||
    contactsStore.filters.cities?.length > 0 ||
    contactsStore.filters.streets?.length > 0 ||
    contactsStore.filters.houseNumbers?.length > 0 ||
    contactsStore.filters.titlesBefore?.length > 0 ||
    contactsStore.filters.titlesAfter?.length > 0 ||
    contactsStore.filters.fundraiserNames?.length > 0 ||
    contactsStore.filters.fatherNames?.length > 0 ||
    contactsStore.filters.motherNames?.length > 0 ||
    contactsStore.filters.groomAt?.length > 0 ||
    contactsStore.filters.wifeNames?.length > 0 ||
    contactsStore.filters.synagogues?.length > 0 ||
    contactsStore.filters.rating > 0 ||
    contactsStore.filters.isFundraiser ||
    (contactsStore.filters.standingOrder !== undefined && contactsStore.filters.standingOrder !== null) ||
    contactsStore.filters.contactMethod?.length > 0 ||
    contactsStore.filters.sources?.length > 0 ||
    contactsStore.filters.ageFrom > 0 ||
    contactsStore.filters.ageTo > 0 ||
    (contactsStore.filters.expectedMin > 0) ||
    (contactsStore.filters.expectedMax !== undefined && contactsStore.filters.expectedMax < 1000000) ||
    (contactsStore.filters.actualMin > 0) ||
    (contactsStore.filters.actualMax !== undefined && contactsStore.filters.actualMax < 1000000);

  // Detect filters that are ONLY in the advanced panel (not visible as chip filters)
  // Chip bar covers: name, city, campaignIds, source, type
  // Everything else is advanced-only
  const hasAdvancedOnlyFilters =
    contactsStore.filters.tagIds?.length > 0 ||
    contactsStore.filters.firstNames?.length > 0 ||
    contactsStore.filters.lastNames?.length > 0 ||
    contactsStore.filters.streets?.length > 0 ||
    contactsStore.filters.houseNumbers?.length > 0 ||
    contactsStore.filters.titlesBefore?.length > 0 ||
    contactsStore.filters.titlesAfter?.length > 0 ||
    contactsStore.filters.fundraiserNames?.length > 0 ||
    contactsStore.filters.fatherNames?.length > 0 ||
    contactsStore.filters.motherNames?.length > 0 ||
    contactsStore.filters.groomAt?.length > 0 ||
    contactsStore.filters.wifeNames?.length > 0 ||
    contactsStore.filters.synagogues?.length > 0 ||
    contactsStore.filters.rating > 0 ||
    contactsStore.filters.isFundraiser ||
    contactsStore.filters.standingOrder !== undefined && contactsStore.filters.standingOrder !== null ||
    contactsStore.filters.contactMethod?.length > 0 ||
    contactsStore.filters.sources?.length > 0 ||
    contactsStore.filters.ageFrom > 0 ||
    contactsStore.filters.ageTo > 0 ||
    (contactsStore.filters.expectedMin > 0) ||
    (contactsStore.filters.expectedMax !== undefined && contactsStore.filters.expectedMax < 1000000) ||
    (contactsStore.filters.actualMin > 0) ||
    (contactsStore.filters.actualMax !== undefined && contactsStore.filters.actualMax < 1000000);

  // Advanced filter apply — replace all advanced filters (keep search/sort intact)
  const handleAdvancedFilterApply = useCallback((filters) => {
    // Clear previous advanced filter keys, then set new ones
    const advancedKeys = [
      'firstNames', 'lastNames', 'cities', 'streets', 'houseNumbers',
      'titlesBefore', 'titlesAfter', 'fundraiserNames',
      'campaignIds', 'sources', 'source', 'standingOrder', 'expectedMin', 'expectedMax',
      'actualMin', 'actualMax', 'isFundraiser', 'rating', 'contactMethod',
      'fatherNames', 'motherNames', 'groomAt', 'wifeNames', 'synagogues',
      'ageFrom', 'ageTo',
      // legacy single-value keys
      'firstName', 'lastName', 'city', 'street', 'houseNumber', 'fatherName', 'motherName', 'synagogue',
    ];
    const cleaned = { ...contactsStore.filters };
    advancedKeys.forEach(k => delete cleaned[k]);
    contactsStore.filters = cleaned;

    // Map advanced keys to chip-bar-compatible keys for bidirectional display
    const merged = { ...filters };
    // cities (advanced, array) → city (chip bar, string)
    if (merged.cities?.length === 1) merged.city = merged.cities[0];
    else if (merged.cities?.length > 1) merged.city = '';
    // campaignIds is the same key — already compatible

    contactsStore.setFilters(merged);
  }, [contactsStore]);

  // Advanced filter reset — clears store AND chip bar
  const handleAdvancedFilterReset = useCallback(() => {
    contactsStore.clearFilters();
  }, [contactsStore]);

  // Hydrate advanced filter from store when opening
  useEffect(() => {
    if (showAdvancedFilter && advancedFilterRef.current) {
      advancedFilterRef.current.hydrateFromStore(contactsStore.filters);
    }
  }, [showAdvancedFilter]);

  // { id, name }[] — all campaigns seen in current contacts
  const uniqueCampaigns = useMemo(() => {
    const map = new Map(); // id → name
    contactsStore.contacts.forEach(c => {
      if (c.campaignRoles) {
        Object.values(c.campaignRoles).forEach(role => {
          if (role.campaignId && role.campaignName) map.set(role.campaignId, role.campaignName);
        });
      }
      if (c.campaigns) {
        c.campaigns.forEach(cam => {
          if (cam.id && cam.name) map.set(cam.id, cam.name);
        });
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [contactsStore.contacts, locale]);

  // name → id lookup for the campaign filter onChange
  const campaignNameToId = useMemo(() => {
    const m = {};
    uniqueCampaigns.forEach(c => { m[c.name] = c.id; });
    return m;
  }, [uniqueCampaigns]);

  const uniqueCities = useMemo(() => {
    const cities = new Set();
    contactsStore.contacts.forEach(c => {
      const city = c.city || c.city_name;
      if (city) cities.add(city);
    });
    return [...cities].sort((a, b) => a.localeCompare(b, locale));
  }, [contactsStore.contacts, locale]);

  const sourceOptions = useMemo(() => [
    t('sourceLanding'), t('sourceSystem'), t('sourcePhone'), t('sourceVows'), t('sourceCredit')
  ], [t]);

  const sourceIcons = useMemo(() => ({
    [t('sourceLanding')]: <SourceLandingIcon className={styles.filterOptionIcon} />,
    [t('sourceSystem')]: <SourceSystemIcon className={styles.filterOptionIcon} />,
    [t('sourcePhone')]: <SourcePhoneIcon className={styles.filterOptionIcon} />,
    [t('sourceVows')]: <SourceVowsIcon className={styles.filterOptionIcon} />,
    [t('sourceCredit')]: <SourceCreditIcon className={styles.filterOptionIcon} />,
  }), [t]);

  const typeOptions = useMemo(() => [
    t('typeCommunity'), t('typeAdded'), t('typeRegular'), t('typeOneTime')
  ], [t]);

  const typeIcons = useMemo(() => ({
    [t('typeCommunity')]: <CommunityMemberIcon className={styles.filterOptionIcon} />,
    [t('typeAdded')]: <AddedDonorIcon className={styles.filterOptionIcon} />,
    [t('typeRegular')]: <UnknownDonorIcon className={styles.filterOptionIcon} />,
    [t('typeOneTime')]: <OneTimeDonorIcon className={styles.filterOptionIcon} />,
  }), [t]);

  const tagOptions = useMemo(() => contactsStore.tags.map(tag => tag.name), [contactsStore.tags]);

  const tabs = [
    { id: 'myContacts', label: t('myContacts') },
    { id: 'segments', label: t('segments') },
    { id: 'needsAttention', label: t('needsAttention'), count: contactsStore.needsAttentionCount },
  ];

  const activeTab = contactsStore.activeTab;

  // ===================== RENDER =====================
  return (
    <div className={styles.contactsLayout}>
      <div className={styles.contactsMainContent}>
        {/* Header */}
        <div className={styles.contactsHeader}>
          <div className={styles.headerActions}>

          </div>
          <div className={styles.contactsHeaderTitle}>
            <h1>{t('title')}</h1>
            <span className={styles.contactsSubtitle}>{t('subtitle')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.contactsTabs}>
          {tabs.map(tab => (
            <button key={tab.id} className={`${styles.contactsTab} ${activeTab === tab.id ? styles.activeTab : ''}`} onClick={() => contactsStore.setActiveTab(tab.id)}>
              {tab.label}
              {tab.count > 0 && <span className={styles.tabBadge}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Content — Needs Attention (Page4-style correction UI) */}
        {activeTab === 'needsAttention' && (
          <div className={styles.contactsContentWrapper}>
            <ContactsNeedsAttention
              clientId={clientId}
              onCountChange={(count) => { contactsStore.needsAttentionCount = count; }}
            />
          </div>
        )}

        {/* Content — Regular table */}
        {activeTab !== 'needsAttention' && (
        <>
        {/* Content Wrapper */}
        <div className={styles.contactsContentWrapper}>
          {/* Filter Bar */}
          <div className={styles.contactsFilterBar}>
            <div className={styles.contactsSearchWrapper}>
              <Search value={contactsStore.search} onSearch={handleSearch} placeholder={t('searchPlaceholder')} />
            </div>
            <div className={styles.allFilters}>
              {/* שם פרטי ומשפחה */}
              <FilterChipDropdown
                label={t('filterName')}
                options={[]}
                selected={contactsStore.filters.name ? [contactsStore.filters.name] : []}
                onChange={(val) => contactsStore.setFilters({ name: val[0] || '' })}
                showSearch={true}
                showActions={false}
                searchText={t('dropdownSearch')}
                applyText={t('dropdownApply')}
                clearText={t('dropdownClear')}
              />
              {/* עיר מגורים */}
              <FilterChipDropdown
                label={t('filterCity')}
                options={uniqueCities}
                selected={contactsStore.filters.city ? [contactsStore.filters.city] : []}
                onChange={(val) => contactsStore.setFilters({ city: val[0] || '', cities: val.length ? val : [] })}
                searchText={t('dropdownSearch')}
                applyText={t('dropdownApply')}
                clearText={t('dropdownClear')}
              />
              {/* בחר קמפיין */}
              <CampaignFilterDropdown
                label={t('filterCampaign')}
                options={uniqueCampaigns.map(c => c.name)}
                campaignIds={uniqueCampaigns.map(c => c.id)}
                selected={(contactsStore.filters.campaignIds || []).map(id => {
                  const found = uniqueCampaigns.find(c => c.id === id);
                  return found ? found.name : String(id);
                })}
                onChange={(selectedNames) => {
                  const ids = selectedNames.map(name => campaignNameToId[name]).filter(Boolean);
                  contactsStore.setFilters({ campaignIds: ids.length ? ids : [] });
                }}
              />
              {/* מקור התרומה */}
              <FilterChipDropdown
                label={t('filterSource')}
                options={sourceOptions}
                icons={sourceIcons}
                selected={contactsStore.filters.source ? [contactsStore.filters.source] : []}
                onChange={(val) => contactsStore.setFilters({ source: val[0] || '' })}
                showSearch={false}
                showActions={false}
                searchText={t('dropdownSearch')}
                applyText={t('dropdownApply')}
                clearText={t('dropdownClear')}
              />
              {/* סוג */}
              <FilterChipDropdown
                label={t('filterType')}
                options={typeOptions}
                icons={typeIcons}
                selected={contactsStore.filters.type ? [contactsStore.filters.type] : []}
                onChange={(val) => contactsStore.setFilters({ type: val[0] || '' })}
                showSearch={false}
                showActions={false}
                searchText={t('dropdownSearch')}
                applyText={t('dropdownApply')}
                clearText={t('dropdownClear')}
              />
              {hasActiveFilters && (
                <button className={styles.clearFilters} onClick={clearFilters}>
                  {t('clearFilters')}
                </button>
              )}
            </div>
            <div className={styles.columnMenuWrapper}>
              <button ref={columnMenuButtonRef} className={`${styles.columnToggleButton} ${showColumnMenu ? styles.columnToggleButtonActive : ''}`} onClick={() => { setShowColumnMenu(prev => !prev); setColumnSearchTerm(''); }}>
                <Plus />
              </button>
              {showColumnMenu && (
                <div className={styles.columnMenuDropdown} ref={columnMenuRef}>
                  <div className={styles.columnMenuSearch}>
                    <input type="text" value={columnSearchTerm} onChange={(e) => setColumnSearchTerm(e.target.value)} placeholder={t('searchColumn')} className={styles.columnMenuSearchInput} autoFocus />
                    <SearchIcon className={styles.columnMenuSearchIcon} />
                  </div>
                  {(() => {
                    const filteredVisible = activeColumns.filter(id => { if (!columnSearchTerm) return true; const def = getColumnDef(id); return def && t(def.label).includes(columnSearchTerm); });
                    const hiddenIds = DEFAULT_COLUMN_DEFS.map(c => c.id).filter(id => !visibleColumns.has(id));
                    const filteredHidden = hiddenIds.filter(id => { if (!columnSearchTerm) return true; const def = getColumnDef(id); return def && t(def.label).includes(columnSearchTerm); });
                    return (
                      <>
                        {filteredVisible.length > 0 && (<><div className={styles.columnMenuSectionLabel}>{t('visibleColumns')}</div>
                          {filteredVisible.map(colId => { const def = getColumnDef(colId); if (!def) return null; return (
                            <div key={colId} className={`${styles.columnMenuRow} ${styles.columnMenuRowVisible}`}>
                              <input type="checkbox" checked onChange={() => toggleColumnVisibility(colId)} className={styles.columnMenuCheckbox} />
                              <span className={styles.columnMenuRowLabel}>{t(def.label)}</span>
                              <DragHandle className={styles.columnMenuDrag} />
                            </div>); })}</>)}
                        {filteredHidden.length > 0 && (<><div className={styles.columnMenuSectionLabel}>{t('hiddenColumns')}</div>
                          {filteredHidden.map(colId => { const def = getColumnDef(colId); if (!def) return null; return (
                            <div key={colId} className={`${styles.columnMenuRow} ${styles.columnMenuRowHidden}`}>
                              <input type="checkbox" checked={false} onChange={() => toggleColumnVisibility(colId)} className={styles.columnMenuCheckbox} />
                              <span className={styles.columnMenuRowLabel}>{t(def.label)}</span>
                            </div>); })}</>)}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            <button className={`${styles.filterIconButton} ${hasAdvancedOnlyFilters ? styles.filterIconButtonActive : ''}`} title={t('advancedFilter')} onClick={() => setShowAdvancedFilter(true)}>
              <FilterIcon />
              {hasAdvancedOnlyFilters && <span className={styles.filterIconDot} />}
            </button>
            <button className={styles.addContactButton} onClick={() => formStore.openAddForm('donor')}>
              <IconTooltip icon={<NewDonor />} text={t('addNewContact')} />
            </button>
            <div className={styles.exportMenuWrapper} ref={exportMenuRef}>
              <button className={styles.menuButton} title={t('exportAndPrint')} onClick={() => setShowExportMenu(prev => !prev)}>
                <Menu className={styles.menuIcon} />
              </button>
              {showExportMenu && (
                <div className={styles.exportMenuDropdown}>
                  <button className={styles.exportMenuItem} onClick={() => { setShowExportMenu(false); window.print(); }}>
                    <span>{t('printList')}</span>
                  </button>
                  <button className={styles.exportMenuItem} onClick={async () => {
                    setShowExportMenu(false);
                    try {
                      const data = await contactsStore.exportContacts();
                      if (data?.rows) {
                        const headers = Object.keys(data.rows[0] || {});
                        const csvContent = [headers.join(','), ...data.rows.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
                        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `contacts_${new Date().toISOString().slice(0, 10)}.pdf`; a.click();
                        URL.revokeObjectURL(url);
                      }
                    } catch (e) { console.error('Export PDF error:', e); }
                  }}>
                    <span>{t('exportPdf')}</span>
                  </button>
                  <button className={styles.exportMenuItem} onClick={async () => {
                    setShowExportMenu(false);
                    try {
                      const data = await contactsStore.exportContacts();
                      if (data?.rows) {
                        const headers = Object.keys(data.rows[0] || {});
                        const csvContent = [headers.join(','), ...data.rows.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
                        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
                        URL.revokeObjectURL(url);
                      }
                    } catch (e) { console.error('Export Excel error:', e); }
                  }}>
                    <span>{t('exportCsv')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className={styles.contactsTableWrapper}>
            {/* Scrollable Table Body */}
            <div className={styles.contactsTableContainer} ref={tableContainerRef} onScroll={updateScrollThumb}>
            {/* Table Header — sticky inside scroll container */}
            <div className={styles.contactsTableHeader} style={{ gridTemplateColumns }}>

              {/* Checkbox */}
              <div className={`${styles.contactsHeaderCell} ${styles.headerCheckboxCell}`}>
                <input type="checkbox" className={styles.headerCheckbox} checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} />
              </div>
              {/* Type icon — sort arrows only */}
              <div className={`${styles.contactsHeaderCell} ${styles.headerIconCell}`}>
                <div className={styles.contactsSortButtons}>
                  <button onClick={() => handleSort('contactType', 'desc')} className={`${styles.sortButton} ${contactsStore.sortField === 'contactType' && contactsStore.sortDirection === 'desc' ? styles.active : ''}`}><Up /></button>
                  <button onClick={() => handleSort('contactType', 'asc')} className={`${styles.sortButton} ${contactsStore.sortField === 'contactType' && contactsStore.sortDirection === 'asc' ? styles.active : ''}`}><Down /></button>
                </div>
              </div>

              {/* Name */}
              <div className={`${styles.contactsHeaderCell} ${styles.nameHeader}`}>
                <span>{t('colName')}</span>
                <div className={styles.contactsSortButtons}>
                  <button onClick={() => handleSort('firstName', 'desc')} className={`${styles.sortButton} ${contactsStore.sortField === 'firstName' && contactsStore.sortDirection === 'desc' ? styles.active : ''}`}><Up /></button>
                  <button onClick={() => handleSort('firstName', 'asc')} className={`${styles.sortButton} ${contactsStore.sortField === 'firstName' && contactsStore.sortDirection === 'asc' ? styles.active : ''}`}><Down /></button>
                </div>
              </div>
              {activeColumns.map((colId) => {
                const colDef = getColumnDef(colId);
                if (!colDef) return null;
                return (
                  <div key={colId} className={`${styles.contactsHeaderCell} ${colId === 'totalDonations' ? styles.totalDonationsHeader : ''} ${dragColumnId === colId ? styles.draggingColumn : ''}`} onDragOver={(e) => handleColumnDragOver(e, colId)}>
                    <span>{t(colDef.label)}</span>
                    {colDef.sortKey && (
                      <div className={styles.contactsSortButtons}>
                        <button onClick={() => handleSort(colDef.sortKey, 'desc')} className={`${styles.sortButton} ${contactsStore.sortField === colDef.sortKey && contactsStore.sortDirection === 'desc' ? styles.active : ''}`}><Up /></button>
                        <button onClick={() => handleSort(colDef.sortKey, 'asc')} className={`${styles.sortButton} ${contactsStore.sortField === colDef.sortKey && contactsStore.sortDirection === 'asc' ? styles.active : ''}`}><Down /></button>
                      </div>
                    )}
                    <span className={styles.headerDragHandle} draggable onDragStart={(e) => handleColumnDragStart(e, colId)} onDragEnd={handleColumnDragEnd}>
                      <DragHandle />
                    </span>
                  </div>
                );
              })}
              <div className={`${styles.contactsHeaderCell} ${styles.headerAddCell}`}>
              </div>
            </div>
              <div className={styles.contactsTableBody}>
                {contactsStore.loadingContacts ? (
                  <div className={styles.contactsLoadingState}><DoNextLoader /></div>
                ) : contactsStore.contacts.length === 0 ? (
                  <div className={styles.contactsEmptyState}><span className="table-3">{t('noContacts')}</span></div>
                ) : (
                  contactsStore.contacts.map((contact, index) => (
                    <div key={contact.id || index}
                      className={`${styles.contactsTableRow} ${contactsStore.selectedContactIds.has(contact.id) ? styles.selectedRow : ''}`}
                      style={{ gridTemplateColumns }}>

                      {/* Checkbox */}
                      <div className={`${styles.contactsCell} ${styles.checkboxCell}`} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className={styles.rowCheckbox} checked={contactsStore.selectedContactIds.has(contact.id)} onChange={() => contactsStore.toggleContactSelection(contact.id)} />
                      </div>
                      {/* Type icon */}
                      <div className={`${styles.contactsCell} ${styles.typeIconCell}`}>
                        <CommunityMemberIcon className={styles.contactTypeIcon} />
                      </div>

                      {/* Name */}
                      <div className={`${styles.contactsCell} ${styles.nameCell}`} onClick={(e) => { e.stopPropagation(); handleOpenEditForm(contact); }}>
                        <span className={`${styles.contactName} ${styles.clickableName}`}>{`${contact.lastName || contact.last_name || ''} ${contact.firstName || contact.first_name || ''}`.trim()}</span>
                      </div>
                      {activeColumns.map((colId) => renderCell(colId, contact, t, styles))}
                      <div className={`${styles.contactsCell} ${activeTab === 'needsAttention' ? styles.statusActionCell : ''}`}>
                        {activeTab === 'needsAttention' && contact.status && (
                          <>
                            <span className={styles.statusBadge} data-status={contact.status}>{getStatusLabel(contact.status, t)}</span>
                            <button className={styles.resolveButton} onClick={(e) => { e.stopPropagation(); contactsStore.resolveContact(contact.id); }}>
                              {t('resolve')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Selection Action Bar */}
          {contactsStore.selectedContactIds.size > 0 && (
            <div className={styles.selectionActionBar}>
              <button className={styles.selectionCloseBtn} onClick={() => contactsStore.clearSelection()}>
                <XIcon />
              </button>
              <div className={styles.selectionCount}>
                <span className={styles.selectionCountValue}>{contactsStore.selectedContactIds.size}</span>
                <span className={styles.selectionCountLabel}>{t('peopleSelected')}</span>
              </div>
              <div className={styles.selectionDivider} />
              <button className={styles.selectionActionBtn} onClick={() => setShowAddToCampaignModal(true)}>
                <MailSmall className={styles.selectionMailIcon} />
                <span>{t('addToExistingCampaign')}</span>
              </button>
              <button className={styles.selectionActionBtn} onClick={() => {
                const ids = Array.from(contactsStore.selectedContactIds);
                if (ids.length > 0) sessionStorage.setItem('pendingContactsForCampaign', JSON.stringify(ids));
                router.push(`/${locale}/new`);
              }}>
                <MailSmall className={styles.selectionMailIcon} />
                <span>{t('openNewCampaign')}</span>
              </button>
              <div className={styles.selectionDivider} />
              <button className={`${styles.selectionActionBtn} ${styles.selectionDeleteBtn}`} onClick={handleBulkDelete}>
                <DeleteIcon className={styles.selectionDeleteIcon} />
                <span>{t('deleteContacts')}</span>
              </button>
              <div className={styles.selectionDivider} />
              <div className={styles.moreMenuWrapper} ref={moreMenuRef}>
                <button className={styles.selectionActionBtn} onClick={() => setShowMoreMenu(prev => !prev)}>
                  <span>{t('moreActions')}</span>
                </button>
                {showMoreMenu && (
                  <div className={styles.moreMenuDropdown}>
                    <button className={styles.moreMenuItem} onClick={() => { setShowMoreMenu(false); }}>
                      <MailSmall className={styles.moreMenuIcon} />
                      <span>{t('moreSendReceipt')}</span>
                    </button>
                    <button className={styles.moreMenuItem} onClick={() => { setShowMoreMenu(false); }}>
                      <MailSmall className={styles.moreMenuIcon} />
                      <span>{t('moreSendMessage')}</span>
                    </button>
                    <button className={styles.moreMenuItem} onClick={() => { setShowMoreMenu(false); }}>
                      <MailSmall className={styles.moreMenuIcon} />
                      <span>{t('moreAddTag')}</span>
                    </button>
                    <button className={styles.moreMenuItem} onClick={() => { setShowMoreMenu(false); }}>
                      <MailSmall className={styles.moreMenuIcon} />
                      <span>{t('moreAssignTag')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Summary Row — inside white container */}
        <div className={styles.summaryRow}>
          <div className={styles.summaryItem}><span className={styles.summaryNumber}>{summaryStats.cities.toLocaleString()}</span><span className={styles.summaryLabel}>{t('summaryCities')}</span></div>
          <div className={styles.summaryItem}><span className={styles.summaryNumber}>{summaryStats.contacts.toLocaleString()}</span><span className={styles.summaryLabel}>{t('summaryContacts')}</span></div>
          <div className={styles.summaryItem}><span className={styles.summaryCurrency}>&#8362;</span><span className={styles.summaryNumber}>{summaryStats.totalDonations.toLocaleString()}</span><span className={styles.summaryLabel}>{t('summaryTotalDonations')}</span></div>
          <div className={styles.summaryItem}><span className={styles.summaryNumber}>{summaryStats.selected.toLocaleString()}</span><span className={styles.summaryLabel}>{t('summarySelected')}</span></div>
        </div>

        </div>

        {/* Pagination — outside white container */}
        <div className={styles.contactsPaginationWrapper}>
          <Pagination totalPages={contactsStore.totalPages || 1} currentPage={contactsStore.page} onPageChange={(p) => contactsStore.setPage(p)} />
          <RowsPerPageDropdown
            value={contactsStore.pageSize}
            onChange={(v) => contactsStore.setPageSize(v)}
            label={t('rowsPerPage')}
          />
        </div>
        </>
        )}
      </div>

      {showAddToCampaignModal && (
        <AddToCampaignModal isOpen={showAddToCampaignModal} onClose={() => setShowAddToCampaignModal(false)} onSuccess={handleAddToCampaignSuccess}
          selectedPersonIds={[...contactsStore.selectedContactIds]} clientId={clientId} />
      )}

      <ContactsAdvancedFilter
        ref={advancedFilterRef}
        isOpen={showAdvancedFilter}
        onClose={() => setShowAdvancedFilter(false)}
        onApply={handleAdvancedFilterApply}
        onReset={handleAdvancedFilterReset}
        clientId={clientId}
        totalResults={contactsStore.totalContacts}
      />

      {showExcelImport && (
        <ContactsExcelImport open={showExcelImport} onClose={() => contactsStore.setShowExcelImport(false)}
          onSuccess={() => { contactsStore.setShowExcelImport(false); contactsStore.fetchContacts(); contactsStore.fetchNeedsAttentionCount(); }} clientId={clientId} />
      )}

      {formStore.isOpen && <AddEdit
        isOpen={formStore.isOpen}
        mode={formStore.mode}
        formType={formStore.formType}
        onClose={() => formStore.closeForm()}
        onSubmit={handleFormSubmit}
        hideAddDonation
      />}

      {/* Delete Confirmation Dialog */}
      {isDeleteDialogOpen && (
        <AlertDialog open={isDeleteDialogOpen}>
          <AlertDialogPortal>
            <AlertDialogContent hasOverlay={false} className="deletePopup w-[auto] max-w-[none] rounded-[16px]">
              <AlertDialogTitle className="sr-only">{t('deleteContacts')}</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">{t('confirmDeleteContacts', { count: contactsStore.selectedContactIds.size })}</AlertDialogDescription>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <p className="headline-4">{t('confirmDeleteContacts', { count: contactsStore.selectedContactIds.size })}</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                <Button onClick={() => setIsDeleteDialogOpen(false)} text={t('cancelDelete')} disabled={isDeleting} />
                <Button onClick={confirmBulkDelete} text={t('confirmDelete')} primary loading={isDeleting} />
              </div>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialog>
      )}

      {/* Has Donations Warning Dialog */}
      {hasDonationsDialogOpen && (
        <AlertDialog open={hasDonationsDialogOpen}>
          <AlertDialogPortal>
            <AlertDialogContent hasOverlay={false} className="deletePopup w-[auto] max-w-[none] rounded-[16px]">
              <AlertDialogTitle className="sr-only">{t('hasDonationsTitle')}</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">{t('hasDonationsTitle')}</AlertDialogDescription>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <p className="headline-4">{t('hasDonationsTitle')}</p>
                <p className="body-1" style={{ textAlign: 'center', color: '#6E99EC' }}>
                  {t('hasDonationsDescription', { count: hasDonationsAffectedCount })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                <Button onClick={() => { setHasDonationsDialogOpen(false); setPendingDeleteIds([]); }} text={t('hasDonationsCancel')} disabled={isDeleting} />
                <Button onClick={confirmForceDelete} text={t('hasDonationsConfirm')} primary loading={isDeleting} />
              </div>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialog>
      )}
    </div>
  );
});

// =====================
// Rows Per Page Dropdown (Figma spec)
// =====================
function RowsPerPageDropdown({ value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const options = [20, 50, 100];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={styles.rowsPerPage} ref={containerRef}>
      <span className={styles.rowsPerPageLabel}>{label}</span>
      <div className={styles.rowsSelectContainer}>
        <button
          className={`${styles.rowsSelectTrigger} ${isOpen ? styles.rowsSelectTriggerOpen : ''}`}
          onClick={() => setIsOpen(prev => !prev)}
        >
          <span className={styles.rowsSelectIcon}><Down /></span>
          <span className={styles.rowsSelectValue}>{value}</span>
        </button>
        {isOpen && (
          <div className={styles.rowsSelectDropdown}>
            {options.map((opt) => (
              <button
                key={opt}
                className={`${styles.rowsSelectOption} ${opt === value ? styles.rowsSelectOptionActive : ''}`}
                onClick={() => { onChange(opt); setIsOpen(false); }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================
// Status label helper
// =====================
function getStatusLabel(status, t) {
  const labels = {
    'duplicated_phone': t('statusDuplicatedPhone'),
    'duplicated_name': t('statusDuplicatedName'),
    'missing_phone': t('statusMissingPhone'),
    'missing_email': t('statusMissingEmail'),
    'invalid_email': t('statusInvalidEmail'),
  };
  return labels[status] || status;
}

// =====================
// Cell renderer helper
// =====================
function renderCell(colId, contact, t, styles) {
  switch (colId) {
    case 'city':
      return <div key={colId} className={styles.contactsCell}>{contact.city || contact.city_name || ''}</div>;
    case 'address':
      return <div key={colId} className={`${styles.contactsCell} ${styles.addressCell}`}>{[contact.street || contact.street_name, contact.houseNumber || contact.house_number].filter(Boolean).join(' ')}</div>;
    case 'mobile':
      return <div key={colId} className={styles.contactsCell}>{contact.mainMobile || contact.main_mobile || ''}</div>;
    case 'email':
      return <div key={colId} className={styles.contactsCell}>{contact.email || ''}</div>;
    case 'campaigns': {
      const roles = Array.isArray(contact.campaignRoles) ? contact.campaignRoles : [];
      const count = roles.length;
      return (
        <div key={colId} className={`${styles.contactsCell} ${styles.campaignsCell}`}>
          <span className={styles.campaignCount}>{count}</span>
          <div className={styles.campaignTags}>
            {roles.map((role, i) => {
              const color = getCampaignColor(role.campaignId);
              return (
                <CampaignTag key={role.campaignId ?? i} name={role.campaignName} color={color} />
              );
            })}
          </div>
        </div>
      );
    }
    case 'totalDonations':
      return (
        <div key={colId} className={`${styles.contactsCell} ${styles.totalDonationsCell} ${!contact.totalDonations ? styles.totalDonationsEmpty : ''}`}>
          {contact.totalDonations ? (
            <>
              <span className={styles.donationAmount}>{Number(contact.totalDonations).toLocaleString()}</span>
              <span className={styles.donationCurrency}>&#8362;</span>
            </>
          ) : '-'}
        </div>
      );
    case 'responsibleFundraiser': {
      const fundraiserEntries = (contact.campaignRoles || []).filter(r => r.fundraiserName);
      if (fundraiserEntries.length === 0) return <div key={colId} className={styles.contactsCell}><span className={styles.noCampaigns}>-</span></div>;
      const uniqueNames = [...new Map(fundraiserEntries.map(e => [e.fundraiserName, e])).values()];
      if (uniqueNames.length === 1) {
        return <div key={colId} className={styles.contactsCell}><span className={styles.fundraiserPill}>{uniqueNames[0].fundraiserName}</span></div>;
      }
      return <div key={colId} className={styles.contactsCell}><FundraiserDropdownCell entries={uniqueNames} styles={styles} /></div>;
    }
    case 'tags':
      return (
        <div key={colId} className={styles.contactsCell}>
          {contact.tags?.length > 0 ? (
            <div className={styles.campaignTags}>
              {contact.tags.slice(0, 2).map((tag, i) => (
                <span key={i} className={styles.campaignTag} style={{ backgroundColor: tag.color || '#e0e0e0' }}>{tag.name || tag}</span>
              ))}
              {contact.tags.length > 2 && <span className={styles.campaignMore}>+{contact.tags.length - 2}</span>}
            </div>
          ) : '-'}
        </div>
      );
    case 'rating':
      return (
        <div key={colId} className={`${styles.contactsCell} ${styles.ratingCell}`}>
          <div className={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`${styles.star} ${star <= (contact.rating || 0) ? styles.starFilled : ''}`}>{'\u2605'}</span>
            ))}
          </div>
        </div>
      );
    case 'synagogue':
      return <div key={colId} className={styles.contactsCell}>{contact.synagogue || ''}</div>;
    case 'fatherName':
      return <div key={colId} className={styles.contactsCell}>{contact.fatherName || ''}</div>;
    case 'source':
      return <div key={colId} className={styles.contactsCell}><span className={styles.sourceTag}>{contact.importId ? t('importSource') : t('manualSource')}</span></div>;
    default:
      if (contact.customFields?.[colId] !== undefined) {
        return <div key={colId} className={styles.contactsCell}>{contact.customFields[colId]}</div>;
      }
      return <div key={colId} className={styles.contactsCell}>-</div>;
  }
}

// =====================
// Side Panel component
// =====================
function SidePanel({ contact, onClose, isRTL }) {
  const c = contact;
  return (
    <div style={{
      position: 'fixed', top: 0, [isRTL ? 'left' : 'right']: 0,
      width: '400px', height: '100vh', backgroundColor: '#fff',
      boxShadow: '-4px 0 16px rgba(0,0,0,0.1)', zIndex: 1000,
      padding: '24px', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>{`${c.firstName || c.first_name || ''} ${c.lastName || c.last_name || ''}`.trim()}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><XIcon /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(c.mainMobile || c.main_mobile) && <div><strong>{'\u05E0\u05D9\u05D9\u05D3'}:</strong> {c.mainMobile || c.main_mobile}</div>}
        {c.email && <div><strong>{'\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC'}:</strong> {c.email}</div>}
        {(c.city || c.city_name) && <div><strong>{'\u05E2\u05D9\u05E8'}:</strong> {c.city || c.city_name}</div>}
        {c.synagogue && <div><strong>{'\u05D1\u05D9\u05EA \u05DB\u05E0\u05E1\u05EA'}:</strong> {c.synagogue}</div>}

        {c.campaignRoles && Object.keys(c.campaignRoles).length > 0 && (
          <div>
            <strong>{'\u05E7\u05DE\u05E4\u05D9\u05D9\u05E0\u05D9\u05DD'}:</strong>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Object.entries(c.campaignRoles).map(([campId, role]) => (
                <div key={campId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', backgroundColor: '#f5f5f5', borderRadius: '6px', fontSize: '13px' }}>
                  <span style={{ fontWeight: 500 }}>{role.campaignName}</span>
                  {role.roles?.map(r => (
                    <span key={r} style={{
                      padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                      backgroundColor: r === 'donor' ? '#e3f2fd' : r === 'fundraiser' ? '#e8f5e9' : '#fff3e0',
                      color: r === 'donor' ? '#1565c0' : r === 'fundraiser' ? '#2e7d32' : '#e65100',
                    }}>
                      {r === 'donor' ? '\u05EA\u05D5\u05E8\u05DD' : r === 'fundraiser' ? '\u05DE\u05EA\u05E8\u05D9\u05DD' : '\u05DE\u05E4\u05E2\u05D9\u05DC'}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {c.tags?.length > 0 && (
          <div>
            <strong>{'\u05EA\u05D2\u05D9\u05D5\u05EA'}:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {c.tags.map((tag, i) => (
                <span key={i} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', backgroundColor: tag.color || '#e0e0e0' }}>{tag.name || tag}</span>
              ))}
            </div>
          </div>
        )}

        {c.customFields && Object.keys(c.customFields).length > 0 && (
          <div>
            <strong>{'\u05E9\u05D3\u05D5\u05EA \u05E0\u05D5\u05E1\u05E4\u05D9\u05DD'}:</strong>
            <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.entries(c.customFields).map(([key, value]) => (
                <div key={key} style={{ fontSize: '13px' }}><span style={{ color: '#666' }}>{key}:</span> {value}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { ContactsPage };
export default ContactsPage;

function FundraiserDropdownCell({ entries, styles }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const ChevronIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 6.5L8 9.5L5 6.5" stroke="#6E99EC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger – "2 option" style: name + chevron, no border */}
      <div
        className={styles.fundraiserTrigger}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <ChevronIcon />
        <span className={styles.fundraiserTriggerText}>{entries[0].fundraiserName}</span>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className={styles.fundraiserDropdownPanel}>
          {entries.map((e, i) => (
            <div key={i} className={styles.fundraiserDropdownEntry}>
              <ChevronIcon size={14} />
              <span>{e.fundraiserName}</span>
            </div>
          ))}

          {/* Count row */}
          <div className={styles.fundraiserDropdownCount}>
            {entries.length} מתרימים
          </div>

          {/* "Select fundraiser" button */}
          <div className={styles.fundraiserDropdownBtn}>
            בחר מתרים
          </div>
        </div>
      )}
    </div>
  );
}
