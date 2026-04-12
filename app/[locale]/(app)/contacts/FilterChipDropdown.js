"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styles from './contacts.module.scss';
import Down from "@/app/icons/down.svg";
import XIcon from "@/app/icons/exitMini.svg";
import SearchIcon from "@/app/icons/search.svg";

/**
 * FilterChipDropdown — Figma "MENU" component
 * A pill-shaped chip that opens a dropdown with checkbox list.
 *
 * Two variants:
 *  1. Full (default): search field + scrollable list + apply/clear buttons
 *  2. Simple: just a flat list of items (no search, no action buttons)
 *
 * Props:
 *  - label: string — placeholder/label shown on the chip
 *  - options: string[] — all available options
 *  - selected: string[] — currently selected values
 *  - onChange: (selected: string[]) => void — callback when selection changes
 *  - showSearch: boolean — show search field (default: true)
 *  - showActions: boolean — show apply/clear buttons (default: true)
 *  - icons: Record<string, React.ReactNode> — optional icon map per option value
 *  - searchText: string — label for the search placeholder
 *  - applyText: string — label for apply/search button
 *  - clearText: string — label for clear button
 */
export default function FilterChipDropdown({
  label,
  options = [],
  selected = [],
  onChange,
  showSearch = true,
  showActions = true,
  icons = {},
  searchText = 'הקלד שם',
  applyText = 'חפש',
  clearText = 'נקה בחירה',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Internal working selection (committed on "apply")
  const [workingSelected, setWorkingSelected] = useState(selected);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync working selection when external selected changes
  useEffect(() => {
    setWorkingSelected(selected);
  }, [selected]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!showSearch || !searchQuery.trim()) return options;
    const q = searchQuery.trim().toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, searchQuery, showSearch]);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
    setSearchQuery('');
    if (!isOpen) {
      setWorkingSelected(selected);
    }
  }, [isOpen, selected]);

  const handleCheckboxChange = useCallback((option, checked) => {
    const newSelected = checked
      ? [...workingSelected, option]
      : workingSelected.filter(s => s !== option);
    setWorkingSelected(newSelected);
    // Live update: also update parent immediately so table filters in real-time
    onChange(newSelected);
  }, [workingSelected, onChange]);

  const handleApply = useCallback(() => {
    onChange(workingSelected);
    setIsOpen(false);
    setSearchQuery('');
  }, [workingSelected, onChange]);

  const handleClear = useCallback(() => {
    setWorkingSelected([]);
    onChange([]);
  }, [onChange]);

  const handleRemoveAll = useCallback((e) => {
    e.stopPropagation();
    setWorkingSelected([]);
    onChange([]);
    setIsOpen(false);
    setSearchQuery('');
  }, [onChange]);

  const hasSelection = selected.length > 0;
  const isActive = isOpen || hasSelection;
  const isSimple = !showSearch && !showActions;

  return (
    <div className={styles.chipDropdownContainer} ref={containerRef}>
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
        <div className={`${styles.chipDropdownPanel} ${isSimple ? styles.chipDropdownPanelSimple : ''}`}>
          {/* Search field — only when showSearch */}
          {showSearch && (
            <div className={styles.chipDropdownSearch}>
              <input
                ref={searchInputRef}
                type="text"
                className={styles.chipDropdownSearchInput}
                placeholder={searchText}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <SearchIcon className={styles.chipDropdownSearchIcon} />
            </div>
          )}

          {/* List — scrollable wrapper for full variant, auto-height for simple */}
          <div className={isSimple ? styles.chipDropdownListSimple : styles.chipDropdownListWrapper}>
            <div className={isSimple ? styles.chipDropdownListSimple : styles.chipDropdownList}>
              {filteredOptions.map((option) => {
                const isChecked = workingSelected.includes(option);
                const icon = icons[option];
                return (
                  <label key={option} className={styles.chipDropdownItem}>
                    <input
                      type="checkbox"
                      className={styles.chipDropdownCheckbox}
                      checked={isChecked}
                      onChange={(e) => handleCheckboxChange(option, e.target.checked)}
                    />
                    <span className={`${styles.chipDropdownCheckmark} ${isChecked ? styles.chipDropdownCheckmarkChecked : ''}`}>
                      {isChecked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    {icon && (
                      <span className={styles.chipDropdownItemIcon}>{icon}</span>
                    )}
                    <span className={styles.chipDropdownItemLabel}>{option}</span>
                  </label>
                );
              })}
              {filteredOptions.length === 0 && (
                <div className={styles.chipDropdownEmpty}>—</div>
              )}
            </div>
          </div>

          {/* Bottom action bar — only when showActions */}
          {showActions && (
            <div className={styles.chipDropdownActions}>
              <button
                type="button"
                className={styles.chipDropdownApply}
                onClick={handleApply}
              >
                {applyText}
              </button>
              <button
                type="button"
                className={styles.chipDropdownClear}
                onClick={handleClear}
              >
                {clearText}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
