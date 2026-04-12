"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './contacts.module.scss';
import Down from "@/app/icons/down.svg";
import XIcon from "@/app/icons/exitMini.svg";

/**
 * Predefined colour palette for campaign pills.
 * Each entry: { bg, text } — cycles through campaigns by index.
 */
const CAMPAIGN_COLORS = [
  { bg: '#DAEAFE', text: '#0C4AD5' },   // blue
  { bg: '#F3F5F7', text: '#454B4E' },   // gray
  { bg: '#ECE9FC', text: '#744ABF' },   // purple
  { bg: '#FDE4E3', text: '#B35056' },   // pink / red
  { bg: 'rgba(50, 255, 255, 0.2)', text: '#26A9A9' }, // teal
  { bg: '#FBE7F3', text: '#CC7093' },   // pink
];

function getCampaignColor(campaignId) {
  const idx = (typeof campaignId === 'number' ? campaignId : parseInt(campaignId) || 0) % CAMPAIGN_COLORS.length;
  return CAMPAIGN_COLORS[idx];
}

/**
 * CampaignFilterDropdown — Figma "campain menu" component
 *
 * A pill-shaped trigger that opens a dropdown of coloured campaign chips.
 * Selected campaigns show a ✔ checkmark and a 2 px blue border.
 *
 * Props:
 *  - label:    string      — trigger label ("בחר קמפיין")
 *  - options:  string[]    — campaign names
 *  - campaignIds: number[]  — campaign IDs (parallel to options, for color mapping)
 *  - selected: string[]    — currently selected campaign names
 *  - onChange: (selected: string[]) => void
 */
export default function CampaignFilterDropdown({
  label,
  options = [],
  campaignIds = [],
  selected = [],
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handlePillClick = useCallback((option) => {
    const isSelected = selected.includes(option);
    const newSelected = isSelected
      ? selected.filter(s => s !== option)
      : [...selected, option];
    onChange(newSelected);
  }, [selected, onChange]);

  const handleRemoveAll = useCallback((e) => {
    e.stopPropagation();
    onChange([]);
    setIsOpen(false);
  }, [onChange]);

  const hasSelection = selected.length > 0;
  const isActive = isOpen || hasSelection;

  return (
    <div className={styles.campaignDropdownContainer} ref={containerRef}>
      {/* Trigger chip */}
      <button
        type="button"
        className={`${styles.filterChip} ${isActive ? styles.filterChipActive : ''} ${hasSelection ? styles.filterChipHasSelection : ''}`}
        onClick={handleToggle}
      >
        <span className={styles.filterChipLabel}>{label}</span>
        <span className={styles.filterChipTrailing}>
          {hasSelection ? (
            <>
              <span className={styles.filterBadge}>{selected.length}</span>
              <button
                type="button"
                className={styles.filterChipClose}
                onClick={handleRemoveAll}
              >
                <XIcon />
              </button>
            </>
          ) : (
            <Down className={`${styles.filterDropdownIcon} ${isOpen ? styles.filterDropdownIconOpen : ''}`} />
          )}
        </span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className={styles.campaignDropdownPanel}>
          {options.map((option, idx) => {
            const isChecked = selected.includes(option);
            const cId = campaignIds[idx];
            const color = cId != null ? getCampaignColor(cId) : CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length];
            return (
              <button
                key={option}
                type="button"
                className={`${styles.campaignPill} ${isChecked ? styles.campaignPillSelected : ''}`}
                style={{
                  background: color.bg,
                  color: color.text,
                  borderColor: isChecked ? '#0C4AD5' : color.bg,
                }}
                onClick={() => handlePillClick(option)}
              >
                <span className={styles.campaignPillLabel}>{option}</span>
                <span
                  className={styles.campaignPillCheck}
                  style={{ opacity: isChecked ? 1 : 0 }}
                >
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="#0C4AD5"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
