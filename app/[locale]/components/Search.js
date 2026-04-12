"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from 'next-intl';
import styles from './Search.module.scss';
import SearchIcon from '@/app/icons/search.svg';

export default function Search({
    onSearch,
    placeholder,
    long = false,
    className = "",
    value = "",
    suggestions = [],
    getLabel = (o) => (o?.name || o?.label || "").toString(),
    onSelect,       // אופציונלי
    emptyText,
    big = false,
}) {
    const t = useTranslations('common');
    const actualPlaceholder = placeholder ?? t('searchPlaceholder');
    const actualEmptyText = emptyText ?? t('noResultsFound');
    const [isFocused, setIsFocused] = useState(false);
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const listRef = useRef(null);
    useEffect(() => {
        if (!open) setHighlight(-1);
    }, [open]);

    const handleChange = (v) => {
        onSearch?.(v);
        // פותח רק אם יש onSelect (מצב select) ויש ערך
        if (onSelect && v.trim()) {
            setOpen(true);
        }
    };

    const handleKeyDown = (e) => {
        if (!onSelect || !suggestions.length) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => (i + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const pick = suggestions[highlight] ?? suggestions[0];
            if (pick) {
                onSelect(pick);
                setOpen(false);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        setTimeout(() => setOpen(false), 120); // לאפשר קליק על פריט
    };
    return (
        <div
            className={`${styles.searchWrapper} ${long ? styles.long : ''} ${big ? styles.big : ''} ${className || ''} button-1`}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
        >
            <input
                type="text"
                className={styles.searchField}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => { 
                    setIsFocused(true); 
                    // פותח רק אם יש onSelect ויש כבר ערך
                    if (onSelect && value.trim()) {
                        setOpen(true);
                    }
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={!isFocused && value === "" ? actualPlaceholder : ""}
                aria-autocomplete="list"
            />
            {!isFocused && value === "" && (
                <div className={styles.searchPlaceholder}>
                    <SearchIcon />
                    <span>{actualPlaceholder}</span>
                </div>
            )}
            {onSelect && open && (
                <div className={styles.searchList} ref={listRef} role="listbox">
                    {suggestions.length ? (
                        suggestions.map((opt, idx) => (
                            <button
                                key={idx}
                                type="button"
                                role="option"
                                aria-selected={idx === highlight}
                                className={`${styles.searchItem} ${idx === highlight ? styles.searchItemActive : ""}`}
                                onMouseEnter={() => setHighlight(idx)}
                                onMouseLeave={() => setHighlight(-1)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    onSelect?.(opt);
                                    setOpen(false);
                                }}
                            >
                                {getLabel(opt)}
                            </button>
                        ))
                    ) : (
                        <div className={`${styles.searchItem} ${styles.empty}`}>{actualEmptyText}</div>
                    )}
                </div>
            )}
        </div>
    );
}