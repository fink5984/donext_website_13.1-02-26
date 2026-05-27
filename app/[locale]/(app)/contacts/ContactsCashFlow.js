"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import DoNextLoader from '@/app/components/DoNextLoader';
import UpIcon from '@/app/icons/up.svg';
import DownIcon from '@/app/icons/down.svg';
import styles from './contactsCashFlow.module.scss';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const FORECAST_MONTHS = 12;

const TOTAL_COLOR = { stroke: '#0C4AD5', fill: 'rgba(12, 74, 213, 0.15)' };
const LAYER_PALETTE = [
  { stroke: '#E0457B', fill: 'rgba(224, 69, 123, 0.12)' },
  { stroke: '#22B07D', fill: 'rgba(34, 176, 125, 0.12)' },
  { stroke: '#F2A93B', fill: 'rgba(242, 169, 59, 0.15)' },
  { stroke: '#8B5CF6', fill: 'rgba(139, 92, 246, 0.12)' },
  { stroke: '#0EA5E9', fill: 'rgba(14, 165, 233, 0.12)' },
  { stroke: '#EF4444', fill: 'rgba(239, 68, 68, 0.12)' },
  { stroke: '#10B981', fill: 'rgba(16, 185, 129, 0.12)' },
];

function formatCurrency(value, locale) {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₪${Math.round(n).toLocaleString()}`;
  }
}

function shortMonthLabel(year, month, locale) {
  const date = new Date(year, month, 1);
  try {
    return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
      month: 'short',
      year: '2-digit',
    }).format(date);
  } catch {
    return `${month + 1}/${String(year).slice(-2)}`;
  }
}

// All time math is in "month offsets" from the current calendar month (index 0).
// Negative offsets are in the past; positive are in the future.

const UNLIMITED_MONTHS_HORIZON = 99;

function monthOffsetFromDate(date, now) {
  return (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
}

function buildMonthsFromOffset(startOffset, count) {
  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(startYear, startMonth + startOffset + i, 1);
    return { year: date.getFullYear(), month: date.getMonth(), date };
  });
}

// startOffset is in years from current year (0 = current year)
function buildYearsFromOffset(startOffset, count) {
  const now = new Date();
  const currentYear = now.getFullYear();
  return Array.from({ length: count }, (_, i) => ({ year: currentYear + startOffset + i }));
}

// Returns donation's lifetime as a [startOffset, endOffset) half-open interval (in months from now).
function donationActiveRange(d, now) {
  let startOffset = 0;
  if (d.createdAt) {
    const created = new Date(d.createdAt);
    startOffset = monthOffsetFromDate(created, now);
  }
  let duration;
  if (d.isUnlimited) {
    duration = UNLIMITED_MONTHS_HORIZON;
  } else {
    duration = Number(d.numberOfPayments) || Number(d.bevelPaymentsLeft) || 1;
  }
  return { startOffset, endOffset: startOffset + duration };
}

// Project monthly amounts inside the chart window [windowStart, windowStart + count) (offsets from now).
function projectDonationsForWindow(donations, windowStart, count) {
  const now = new Date();
  const series = new Array(count).fill(0);
  const counts = new Array(count).fill(0);
  for (const d of donations) {
    if (!d?.hasPaymentMethod) continue;
    const monthly = Number(d.monthlyAmount) || 0;
    if (monthly <= 0) continue;

    const { startOffset, endOffset } = donationActiveRange(d, now);
    for (let i = 0; i < count; i++) {
      const offset = windowStart + i;
      if (offset >= startOffset && offset < endOffset) {
        series[i] += monthly;
        counts[i] += 1;
      }
    }
  }
  return { series, counts };
}

// Project yearly totals — each window slot is one calendar year, summing active months in that year.
function projectDonationsForYearWindow(donations, windowStart, count) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const series = new Array(count).fill(0);
  const counts = new Array(count).fill(0);
  for (const d of donations) {
    if (!d?.hasPaymentMethod) continue;
    const monthly = Number(d.monthlyAmount) || 0;
    if (monthly <= 0) continue;
    const { startOffset, endOffset } = donationActiveRange(d, now);
    for (let i = 0; i < count; i++) {
      const targetYear = currentYear + windowStart + i;
      const yearStartOffset = (targetYear - currentYear) * 12 - currentMonth;
      const yearEndOffset = yearStartOffset + 11;
      const aStart = Math.max(startOffset, yearStartOffset);
      const aEnd = Math.min(endOffset - 1, yearEndOffset);
      const activeMonths = Math.max(0, aEnd - aStart + 1);
      if (activeMonths > 0) {
        series[i] += monthly * activeMonths;
        counts[i] += 1;
      }
    }
  }
  return { series, counts };
}

// Earliest start offset and latest end offset across all donations (in months from current month).
function computeDonationsRange(donations) {
  const now = new Date();
  let minOffset = null;
  let maxOffset = null;
  for (const d of donations) {
    if (!d?.hasPaymentMethod) continue;
    const monthly = Number(d.monthlyAmount) || 0;
    if (monthly <= 0) continue;
    const { startOffset, endOffset } = donationActiveRange(d, now);
    if (minOffset === null || startOffset < minOffset) minOffset = startOffset;
    if (maxOffset === null || endOffset - 1 > maxOffset) maxOffset = endOffset - 1;
  }
  return { minOffset: minOffset ?? 0, maxOffset: maxOffset ?? FORECAST_MONTHS - 1 };
}

// Yearly range — in years from current year.
function computeDonationsYearRange(donations) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let minYear = null;
  let maxYear = null;
  for (const d of donations) {
    if (!d?.hasPaymentMethod) continue;
    const monthly = Number(d.monthlyAmount) || 0;
    if (monthly <= 0) continue;
    const { startOffset, endOffset } = donationActiveRange(d, now);
    // Convert month-offsets to absolute year, then to year offset
    const startMonthAbs = currentYear * 12 + currentMonth + startOffset;
    const endMonthAbs = currentYear * 12 + currentMonth + endOffset - 1;
    const sY = Math.floor(startMonthAbs / 12) - currentYear;
    const eY = Math.floor(endMonthAbs / 12) - currentYear;
    if (minYear === null || sY < minYear) minYear = sY;
    if (maxYear === null || eY > maxYear) maxYear = eY;
  }
  return { minOffset: minYear ?? 0, maxOffset: maxYear ?? 0 };
}

// Total + remaining-balance for a target calendar year.
// Total rules:
//   current year → annualized: monthly × min(12, numberOfPayments or 12 for unlimited)
//                  (treats every active donation as if it ran for the full year)
//   future/past year → createdAt-based: count months that actually fall inside that year
// Balance rules (from the user):
//   past year   → balance = 0
//   current year → balance = current month to Dec (limited by donation active range)
//   future year → balance = total for that year
function computeYearStats(donations, targetYear) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const yearStartOffset = (targetYear - currentYear) * 12 - currentMonth;
  const yearEndOffset = yearStartOffset + 11;

  let total = 0;
  let balance = 0;
  for (const d of donations) {
    if (!d?.hasPaymentMethod) continue;
    const monthly = Number(d.monthlyAmount) || 0;
    if (monthly <= 0) continue;
    const { startOffset, endOffset } = donationActiveRange(d, now);

    if (targetYear === currentYear) {
      // Annualized total: independent of createdAt — assumes donation runs full year (or its plan length)
      const planLength = d.isUnlimited ? 12 : (Number(d.numberOfPayments) || 12);
      total += monthly * Math.min(12, planLength);

      // Balance: createdAt-aware, current month to Dec
      const balStart = Math.max(startOffset, 0);
      const balEnd = Math.min(endOffset - 1, 11 - currentMonth);
      const balanceMonths = Math.max(0, balEnd - balStart + 1);
      balance += monthly * balanceMonths;
    } else {
      // Past or future year — createdAt-based, count actual active months in that year
      const aStart = Math.max(startOffset, yearStartOffset);
      const aEnd = Math.min(endOffset - 1, yearEndOffset);
      const activeMonths = Math.max(0, aEnd - aStart + 1);
      total += monthly * activeMonths;
      if (targetYear > currentYear) {
        balance += monthly * activeMonths;
      }
      // past year → balance stays 0
    }
  }
  return { total, balance };
}
function computeLifetimeTotal(donations) {
  let total = 0;
  for (const d of donations) {
    if (!d?.hasPaymentMethod) continue;
    const monthly = Number(d.monthlyAmount) || 0;
    if (monthly <= 0) continue;

    if (d.isUnlimited) {
      total += monthly * UNLIMITED_MONTHS_HORIZON;
    } else {
      const payments = Number(d.numberOfPayments) || Number(d.bevelPaymentsLeft) || 1;
      total += monthly * payments;
    }
  }
  return total;
}

function applyLayerFilter(donations, layer) {
  switch (layer.type) {
    case 'total':
      return donations;
    case 'campaign':
      return donations.filter(d => d.donor?.campaignId === layer.value);
    case 'paymentMethod':
      return donations.filter(d => (d.paymentMethod || '') === layer.value);
    case 'unlimited':
      return donations.filter(d => d.isUnlimited === true);
    case 'finite':
      return donations.filter(d => d.isUnlimited !== true);
    default:
      return donations;
  }
}

export default function ContactsCashFlow({ clientId }) {
  const t = useTranslations('contactsPage');
  const tPayment = useTranslations('donations.paymentMethods');
  const locale = useLocale();
  const isRTL = locale === 'he';

  const translatePaymentMethod = useCallback((key) => {
    if (!key) return '';
    try {
      const v = tPayment(key);
      if (v && v !== `donations.paymentMethods.${key}`) return v;
    } catch {}
    return key;
  }, [tPayment]);

  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState([]);
  const [layers, setLayers] = useState([{ id: 'total', type: 'total', label: null }]);
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [pendingLayerType, setPendingLayerType] = useState(null);
  const [pendingLayerValue, setPendingLayerValue] = useState('');
  const [chartType, setChartType] = useState('line'); // 'line' | 'bar'
  const [granularity, setGranularity] = useState('monthly'); // 'monthly' | 'yearly'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [chartWindowStart, setChartWindowStart] = useState(0); // offset in months/years from current month/year
  const [isDraggingChart, setIsDraggingChart] = useState(false);
  const WINDOW_SIZE = granularity === 'yearly' ? 12 : FORECAST_MONTHS;
  const addLayerMenuRef = useRef(null);
  const layersScrollRef = useRef(null);
  const chartContainerRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startWindow: 0, accumulated: 0 });

  // Translate vertical wheel to horizontal scroll so users can scroll the chip row
  // even without a visible scrollbar.
  const handleLayersWheel = useCallback((e) => {
    const el = layersScrollRef.current;
    if (!el) return;
    if (e.deltaY === 0) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }, []);

  const fetchDonations = useCallback(async () => {
    if (!clientId) {
      setDonations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ clientId: String(clientId) });
      const res = await fetchWithAuth(`/api/donations/cash-flow?${params.toString()}`);
      if (!res?.ok) { setDonations([]); return; }
      const json = await res.json();
      setDonations(json?.data?.donations || []);
    } catch (err) {
      console.error('Cash flow fetch error:', err);
      setDonations([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchDonations(); }, [fetchDonations]);

  useEffect(() => {
    if (!showAddLayer) return;
    const handler = (e) => {
      if (addLayerMenuRef.current && !addLayerMenuRef.current.contains(e.target)) {
        setShowAddLayer(false);
        setPendingLayerType(null);
        setPendingLayerValue('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddLayer]);

  const periods = useMemo(() => (
    granularity === 'yearly'
      ? buildYearsFromOffset(chartWindowStart, WINDOW_SIZE)
      : buildMonthsFromOffset(chartWindowStart, WINDOW_SIZE)
  ), [granularity, chartWindowStart, WINDOW_SIZE]);

  // Range across all donations (used to clamp navigation), in the current granularity unit
  const donationsRange = useMemo(() => (
    granularity === 'yearly'
      ? computeDonationsYearRange(donations)
      : computeDonationsRange(donations)
  ), [granularity, donations]);

  // Clamp window when granularity, range, or window size changes
  useEffect(() => {
    const maxStart = Math.max(donationsRange.minOffset, donationsRange.maxOffset - WINDOW_SIZE + 1);
    setChartWindowStart(prev => {
      if (prev > maxStart) return maxStart;
      if (prev < donationsRange.minOffset) return donationsRange.minOffset;
      return prev;
    });
  }, [donationsRange.minOffset, donationsRange.maxOffset, WINDOW_SIZE]);

  const canScrollPrev = chartWindowStart > donationsRange.minOffset;
  const canScrollNext = chartWindowStart + WINDOW_SIZE - 1 < donationsRange.maxOffset;

  // ---- Drag-to-pan the chart ----
  const clampWindow = useCallback((v) => {
    const maxStart = Math.max(donationsRange.minOffset, donationsRange.maxOffset - WINDOW_SIZE + 1);
    return Math.min(maxStart, Math.max(donationsRange.minOffset, v));
  }, [donationsRange.minOffset, donationsRange.maxOffset, WINDOW_SIZE]);

  const onChartPointerDown = useCallback((e) => {
    // Only respond to primary mouse button / single touch
    if (e.button !== undefined && e.button !== 0) return;
    const el = chartContainerRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startWindow: chartWindowStart,
      accumulated: 0,
    };
    setIsDraggingChart(true);
    try { el.setPointerCapture?.(e.pointerId); } catch {}
  }, [chartWindowStart]);

  const onChartPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const el = chartContainerRef.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    const deltaX = e.clientX - dragRef.current.startX;
    // pixels → months. With LTR axis: drag right reveals older data → windowStart decreases.
    // With RTL (axis reversed): drag right reveals newer data → windowStart increases.
    const periodsPerPixel = WINDOW_SIZE / width;
    let deltaPeriods = -deltaX * periodsPerPixel;
    if (isRTL) deltaPeriods = -deltaPeriods;
    const next = clampWindow(Math.round(dragRef.current.startWindow + deltaPeriods));
    setChartWindowStart(next);
  }, [clampWindow, isRTL, WINDOW_SIZE]);

  const onChartPointerUp = useCallback((e) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setIsDraggingChart(false);
    const el = chartContainerRef.current;
    try { el?.releasePointerCapture?.(e.pointerId); } catch {}
  }, []);

  const layerProjections = useMemo(() => {
    return layers.map((layer, idx) => {
      const palette = layer.type === 'total'
        ? TOTAL_COLOR
        : LAYER_PALETTE[(idx - 1 + LAYER_PALETTE.length) % LAYER_PALETTE.length];
      const filtered = applyLayerFilter(donations, layer);
      const { series, counts } = granularity === 'yearly'
        ? projectDonationsForYearWindow(filtered, chartWindowStart, WINDOW_SIZE)
        : projectDonationsForWindow(filtered, chartWindowStart, WINDOW_SIZE);
      const windowTotal = series.reduce((s, v) => s + v, 0);
      // For the fixed "total" chip we show lifetime expected amount (all years);
      // other layer chips show the current chart-window total so the chip matches what's visible.
      const chipTotal = layer.type === 'total' ? computeLifetimeTotal(filtered) : windowTotal;
      const label = layer.label || (layer.type === 'total' ? t('cashFlowTotal') : '');
      return { layer, palette, series, counts, chipTotal, label, filtered };
    });
  }, [layers, donations, chartWindowStart, granularity, WINDOW_SIZE, t]);

  const campaignOptions = useMemo(() => {
    const map = new Map();
    for (const d of donations) {
      const id = d.donor?.campaignId;
      if (id && !map.has(id)) map.set(id, d.donor.campaignName || `#${id}`);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [donations]);

  const paymentMethodOptions = useMemo(() => {
    const set = new Set();
    for (const d of donations) { if (d.paymentMethod) set.add(d.paymentMethod); }
    return Array.from(set);
  }, [donations]);

  const { chartData, chartOptions } = useMemo(() => {
    const labels = periods.map(p => (
      granularity === 'yearly' ? String(p.year) : shortMonthLabel(p.year, p.month, locale)
    ));

    const commonScales = {
      x: {
        reverse: isRTL,
        grid: { display: false },
        ticks: { font: { family: 'var(--font-ping)', size: 12 }, color: '#5A78B0' },
      },
      y: {
        position: isRTL ? 'right' : 'left',
        beginAtZero: true,
        grid: { color: 'rgba(222, 231, 251, 0.7)' },
        ticks: {
          font: { family: 'var(--font-ping)', size: 11 },
          color: '#5A78B0',
          callback: (v) => formatCurrency(v, locale),
        },
      },
    };

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: isRTL,
          textDirection: isRTL ? 'rtl' : 'ltr',
          titleAlign: isRTL ? 'right' : 'left',
          bodyAlign: isRTL ? 'right' : 'left',
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          backgroundColor: 'rgba(27, 56, 121, 0.95)',
          titleFont: { family: 'var(--font-ping)', size: 13, weight: '600' },
          bodyFont: { family: 'var(--font-ping)', size: 12 },
          padding: 12,
          boxPadding: 6,
        },
      },
    };

    const datasets = layerProjections.map(lp => {
      const base = {
        label: lp.label,
        data: lp.series,
        counts: lp.counts,
        borderColor: lp.palette.stroke,
        backgroundColor: lp.palette.fill,
      };
      if (chartType === 'bar') {
        return {
          ...base,
          type: 'bar',
          borderWidth: 1,
          borderRadius: 6,
          backgroundColor: lp.palette.stroke,
        };
      }
      return {
        ...base,
        type: 'line',
        pointBackgroundColor: lp.palette.stroke,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: lp.layer.type === 'total',
        borderWidth: 2.5,
      };
    });

    return {
      chartData: { labels, datasets },
      chartOptions: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const ds = ctx.dataset;
                const value = ctx.parsed.y || 0;
                const count = ds.counts?.[ctx.dataIndex] || 0;
                const amount = formatCurrency(value, locale);
                const donationsLabel = t('cashFlowTooltipDonations', { count });
                return `${ds.label}: ${amount}  •  ${donationsLabel}`;
              },
              labelPointStyle: () => ({ pointStyle: 'circle', rotation: 0 }),
            },
          },
        },
        scales: commonScales,
      },
    };
  }, [chartType, granularity, periods, layerProjections, isRTL, locale, t]);

  // Year stats use the "total" layer (all matching donations)
  const yearStats = useMemo(() => {
    return computeYearStats(donations, selectedYear);
  }, [donations, selectedYear]);

  const hasAnyData = donations.length > 0;
  const currentYear = new Date().getFullYear();

  const handleAddLayer = () => {
    if (!pendingLayerType) return;
    if (pendingLayerType === 'campaign' || pendingLayerType === 'paymentMethod') {
      if (!pendingLayerValue) return;
    }
    const newLayer = {
      id: `${pendingLayerType}-${pendingLayerValue || Date.now()}`,
      type: pendingLayerType,
      value: pendingLayerType === 'campaign' ? Number(pendingLayerValue) : pendingLayerValue || null,
      label: '',
    };
    if (pendingLayerType === 'campaign') {
      const c = campaignOptions.find(c => c.id === Number(pendingLayerValue));
      newLayer.label = c?.name || `${t('cashFlowSelectCampaign')}`;
    } else if (pendingLayerType === 'paymentMethod') {
      newLayer.label = translatePaymentMethod(pendingLayerValue);
    } else if (pendingLayerType === 'unlimited') {
      newLayer.label = t('cashFlowLayerByUnlimited');
    } else if (pendingLayerType === 'finite') {
      newLayer.label = t('cashFlowLayerByFinite');
    }
    if (layers.some(l => l.id === newLayer.id)) {
      setShowAddLayer(false); setPendingLayerType(null); setPendingLayerValue(''); return;
    }
    setLayers([...layers, newLayer]);
    setShowAddLayer(false); setPendingLayerType(null); setPendingLayerValue('');
  };

  const removeLayer = (id) => {
    if (id === 'total') return;
    setLayers(layers.filter(l => l.id !== id));
  };

  if (loading) {
    return (
      <div className={styles.cashFlowLoading}>
        <DoNextLoader />
        <span>{t('cashFlowLoading')}</span>
      </div>
    );
  }

  return (
    <div className={styles.cashFlowWrapper} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={styles.cashFlowHeader}>
        <div className={styles.cashFlowYearCard}>
          <div className={styles.cashFlowYearSelector}>
            <button
              type="button"
              className={styles.cashFlowYearArrow}
              onClick={() => setSelectedYear(y => y + 1)}
              aria-label="next year"
            >
              <UpIcon width={14} height={14} />
            </button>
            <span className={styles.cashFlowYearValue}>{selectedYear}</span>
            <button
              type="button"
              className={styles.cashFlowYearArrow}
              onClick={() => setSelectedYear(y => y - 1)}
              aria-label="previous year"
            >
              <DownIcon width={14} height={14} />
            </button>
          </div>
        </div>
        <div className={styles.cashFlowMetricCard}>
          <span className={styles.cashFlowSummaryLabel}>{t('cashFlowTotalYear')}</span>
          <span className={styles.cashFlowSummaryValue}>{formatCurrency(yearStats.total, locale)}</span>
        </div>
        <div className={styles.cashFlowMetricCard}>
          <span className={styles.cashFlowSummaryLabel}>{t('cashFlowBalance')}</span>
          <span className={styles.cashFlowSummaryValue}>{formatCurrency(yearStats.balance, locale)}</span>
        </div>
      </div>

      {/* Layers row with fixed controls at the end */}
      <div className={styles.cashFlowLayersRow}>
        <div
          ref={layersScrollRef}
          className={styles.cashFlowLayersListScroll}
          onWheel={handleLayersWheel}
        >
          {layerProjections.map(lp => (
            <div
              key={lp.layer.id}
              className={styles.cashFlowLayerChip}
              title={`${lp.label}: ${formatCurrency(lp.chipTotal, locale)}`}
            >
              <span className={styles.cashFlowLayerDot} style={{ background: lp.palette.stroke }} />
              <span className={styles.cashFlowLayerLabel}>{lp.label}</span>
              <span className={styles.cashFlowLayerTotal}>{formatCurrency(lp.chipTotal, locale)}</span>
              {lp.layer.id !== 'total' && (
                <button
                  type="button"
                  className={styles.cashFlowLayerRemove}
                  onClick={() => removeLayer(lp.layer.id)}
                  aria-label="remove"
                >×</button>
              )}
            </div>
          ))}
        </div>
        <div className={styles.cashFlowFixedControls}>
          <div className={styles.cashFlowAddLayerWrap} ref={addLayerMenuRef}>
            <button
              type="button"
              className={styles.cashFlowAddLayerButton}
              onClick={() => setShowAddLayer(v => !v)}
            >+ {t('cashFlowAddLayer')}</button>
            {showAddLayer && (
              <div className={styles.cashFlowAddLayerMenu}>
                <div className={styles.cashFlowAddLayerTitle}>{t('cashFlowAddLayerTitle')}</div>
                <label className={styles.cashFlowAddLayerLabel}>{t('cashFlowAddLayerSelect')}</label>
                <select
                  className={styles.cashFlowSelect}
                  value={pendingLayerType || ''}
                  onChange={(e) => { setPendingLayerType(e.target.value || null); setPendingLayerValue(''); }}
                >
                  <option value="">—</option>
                  <option value="campaign">{t('cashFlowLayerByCampaign')}</option>
                  <option value="paymentMethod">{t('cashFlowLayerByPaymentMethod')}</option>
                  <option value="unlimited">{t('cashFlowLayerByUnlimited')}</option>
                  <option value="finite">{t('cashFlowLayerByFinite')}</option>
                </select>

                {pendingLayerType === 'campaign' && (
                  <select className={styles.cashFlowSelect} value={pendingLayerValue} onChange={(e) => setPendingLayerValue(e.target.value)}>
                    <option value="">{t('cashFlowSelectCampaign')}</option>
                    {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {pendingLayerType === 'paymentMethod' && (
                  <select className={styles.cashFlowSelect} value={pendingLayerValue} onChange={(e) => setPendingLayerValue(e.target.value)}>
                    <option value="">{t('cashFlowSelectPaymentMethod')}</option>
                    {paymentMethodOptions.map(pm => <option key={pm} value={pm}>{translatePaymentMethod(pm)}</option>)}
                  </select>
                )}

                <div className={styles.cashFlowAddLayerActions}>
                  <button type="button" className={styles.cashFlowAddLayerCancel}
                    onClick={() => { setShowAddLayer(false); setPendingLayerType(null); setPendingLayerValue(''); }}
                  >{t('cashFlowCancel')}</button>
                  <button type="button" className={styles.cashFlowAddLayerConfirm}
                    onClick={handleAddLayer}
                    disabled={!pendingLayerType || ((pendingLayerType === 'campaign' || pendingLayerType === 'paymentMethod') && !pendingLayerValue)}
                  >{t('cashFlowAdd')}</button>
                </div>
              </div>
            )}
          </div>
          <div className={styles.cashFlowChartTypeSwitcher} role="tablist" aria-label={t('cashFlowChartType')}>
            <button
              type="button"
              role="tab"
              aria-selected={chartType === 'line'}
              className={`${styles.cashFlowChartTypeBtn} ${chartType === 'line' ? styles.cashFlowChartTypeBtnActive : ''}`}
              onClick={() => setChartType('line')}
            >{t('cashFlowChartLine')}</button>
            <button
              type="button"
              role="tab"
              aria-selected={chartType === 'bar'}
              className={`${styles.cashFlowChartTypeBtn} ${chartType === 'bar' ? styles.cashFlowChartTypeBtnActive : ''}`}
              onClick={() => setChartType('bar')}
            >{t('cashFlowChartBar')}</button>
          </div>
        </div>
      </div>

      {/* Chart */}
      {!hasAnyData ? (
        <div className={styles.cashFlowEmpty}>{t('cashFlowEmpty')}</div>
      ) : (
        <>
          <div className={styles.cashFlowChartNav}>
            <div className={styles.cashFlowGranularitySwitcher} role="tablist" aria-label={t('cashFlowGranularity')}>
              <button
                type="button"
                role="tab"
                aria-selected={granularity === 'monthly'}
                className={`${styles.cashFlowGranularityBtn} ${granularity === 'monthly' ? styles.cashFlowGranularityBtnActive : ''}`}
                onClick={() => { setGranularity('monthly'); setChartWindowStart(0); }}
              >{t('cashFlowGranularityMonthly')}</button>
              <button
                type="button"
                role="tab"
                aria-selected={granularity === 'yearly'}
                className={`${styles.cashFlowGranularityBtn} ${granularity === 'yearly' ? styles.cashFlowGranularityBtnActive : ''}`}
                onClick={() => { setGranularity('yearly'); setChartWindowStart(0); }}
              >{t('cashFlowGranularityYearly')}</button>
            </div>
            <button
              type="button"
              className={styles.cashFlowChartNavBtn}
              onClick={() => setChartWindowStart(s => clampWindow(s - (granularity === 'yearly' ? 1 : 6)))}
              disabled={!canScrollPrev}
              aria-label="previous"
            >‹</button>
            <span className={styles.cashFlowChartRange}>
              {periods.length > 0 && (granularity === 'yearly'
                ? `${periods[0]?.year} – ${periods[periods.length - 1]?.year}`
                : `${shortMonthLabel(periods[0]?.year, periods[0]?.month, locale)} – ${shortMonthLabel(periods[periods.length - 1]?.year, periods[periods.length - 1]?.month, locale)}`)}
            </span>
            <button
              type="button"
              className={styles.cashFlowChartNavBtn}
              onClick={() => setChartWindowStart(s => clampWindow(s + (granularity === 'yearly' ? 1 : 6)))}
              disabled={!canScrollNext}
              aria-label="next"
            >›</button>
            <button
              type="button"
              className={styles.cashFlowChartNavToday}
              onClick={() => setChartWindowStart(0)}
              disabled={chartWindowStart === 0}
            >{t('cashFlowToday')}</button>
          </div>
          <div
            ref={chartContainerRef}
            className={`${styles.cashFlowChartContainer} ${isDraggingChart ? styles.cashFlowChartDragging : ''}`}
            onPointerDown={onChartPointerDown}
            onPointerMove={onChartPointerMove}
            onPointerUp={onChartPointerUp}
            onPointerCancel={onChartPointerUp}
          >
            <Chart key={chartType} type={chartType} data={chartData} options={chartOptions} />
          </div>
        </>
      )}
    </div>
  );
}
