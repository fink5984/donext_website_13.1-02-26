"use client";
import { useMemo, useState } from "react";
import { useTranslations } from 'next-intl';
import styles from "./CommunityTable.module.scss";
import Search from '@/app/components/Search';
import HeartIcon from "@/app/components/HeartIcon/HeartIcon";
import Coins from "@/app/icons/coinsSmall.svg";
import Note from "@/app/icons/note.svg";
import Up from "@/app/icons/up.svg";
import Down from "@/app/icons/down.svg";
import CalendarComponent from "@/app/components/calendar/Calendar";

function QuickNotePopover({ onSave, onClose, t }) {
    const [text, setText] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const canSave = text.trim() && followUpDate;

    const handleDateSelect = (dateData) => {
        const selectedDate = dateData?.date || dateData;
        if (selectedDate instanceof Date) {
            const yyyy = selectedDate.getFullYear();
            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(selectedDate.getDate()).padStart(2, '0');
            setFollowUpDate(`${yyyy}-${mm}-${dd}`);
        }
    };

    return (
        <div className={styles.quickNotePopover} onClick={(e) => e.stopPropagation()}>
            <textarea
                autoFocus
                className={styles.quickNoteInput}
                placeholder={t('notePlaceholder')}
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            <div className={styles.quickNoteDateRow}>
                <span className={styles.quickNoteDateLabel}>{t('followUpDateLabel')}</span>
                <CalendarComponent onDateSelect={handleDateSelect} range={false} iconOnly />
            </div>
            <div className={styles.quickNoteActions}>
                <button type="button" className={styles.quickNoteCancel} onClick={onClose}>{t('noteCancel')}</button>
                <button
                    type="button"
                    className={styles.quickNoteSave}
                    disabled={!canSave}
                    onClick={() => onSave(text.trim(), followUpDate)}
                >
                    {t('noteSave')}
                </button>
            </div>
        </div>
    );
}

export default function CommunityTable({ donors, loading, onToggleHeart, onQuickDonation, onQuickNote, isAdmin = false, titleElement }) {
    const t = useTranslations('myDonors.community');
    const [openNoteFor, setOpenNoteFor] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

    const columns = [
        { key: 'name', label: t('donorName') },
        { key: 'address', label: t('address') },
        { key: 'city', label: t('city') },
        { key: 'phone', label: t('phone') },
    ];

    const handleSort = (key, direction) => {
        if (sortConfig.key === key && sortConfig.direction === direction) {
            setSortConfig({ key: null, direction: null });
        } else {
            setSortConfig({ key, direction });
        }
    };

    const filteredDonors = useMemo(() => {
        if (!donors) return [];
        const term = searchTerm.trim().toLowerCase();
        if (!term) return donors;
        return donors.filter((donor) => {
            const fullName = `${donor.first_name} ${donor.last_name}`.toLowerCase();
            return fullName.includes(term) || (donor.phone || '').includes(term) || (donor.city || '').toLowerCase().includes(term);
        });
    }, [donors, searchTerm]);

    const sortedDonors = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return filteredDonors;
        const direction = sortConfig.direction === 'asc' ? 1 : -1;
        const sorted = [...filteredDonors];
        sorted.sort((a, b) => {
            if (sortConfig.key === 'hearts') {
                return ((a.heart_count || 0) - (b.heart_count || 0)) * direction;
            }
            let aValue, bValue;
            switch (sortConfig.key) {
                case 'name':
                    aValue = `${a.last_name || ''} ${a.first_name || ''}`;
                    bValue = `${b.last_name || ''} ${b.first_name || ''}`;
                    break;
                case 'address':
                    aValue = a.address || '';
                    bValue = b.address || '';
                    break;
                case 'city':
                    aValue = a.city || '';
                    bValue = b.city || '';
                    break;
                case 'phone':
                    aValue = a.phone || '';
                    bValue = b.phone || '';
                    break;
                default:
                    return 0;
            }
            return aValue.localeCompare(bValue, 'he') * direction;
        });
        return sorted;
    }, [filteredDonors, sortConfig]);

    return (
        <div className={styles.wrapper}>
            <div className={styles.tableTitle}>
                {titleElement || <h2 className="headline-2">{t('tabCommunity')}</h2>}
                <div className={styles.searchCenterWrapper}>
                    <Search value={searchTerm} onSearch={setSearchTerm} placeholder={t('searchPlaceholder')} />
                </div>
            </div>
            {loading ? (
                <div className={styles.stateMessage}>{t('loading')}</div>
            ) : !sortedDonors || sortedDonors.length === 0 ? (
                <div className={styles.stateMessage}>{t('empty')}</div>
            ) : (
                <div className={styles.table}>
                    <div className={`${styles.tableHeader} table-4`}>
                        <div className={styles.heartCell}>
                            <div className={styles.sortButtons}>
                                <button
                                    type="button"
                                    onClick={() => handleSort('hearts', 'desc')}
                                    className={`${styles.sortButton} ${sortConfig.key === 'hearts' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                >
                                    <Up />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSort('hearts', 'asc')}
                                    className={`${styles.sortButton} ${sortConfig.key === 'hearts' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                >
                                    <Down />
                                </button>
                            </div>
                        </div>
                        {columns.map((column) => (
                            <div key={column.key} className={styles.headerCell}>
                                <div className={styles.sortButtons}>
                                    <button
                                        type="button"
                                        onClick={() => handleSort(column.key, 'desc')}
                                        className={`${styles.sortButton} ${sortConfig.key === column.key && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                    >
                                        <Up />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSort(column.key, 'asc')}
                                        className={`${styles.sortButton} ${sortConfig.key === column.key && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                    >
                                        <Down />
                                    </button>
                                </div>
                                <span className={column.key === 'name' ? styles.donorName : ''}>{column.label}</span>
                            </div>
                        ))}
                        <div className={styles.headerCell}>
                            <span>{t('notes')}</span>
                        </div>
                        <div></div>
                    </div>
                    <div className={styles.tableBody}>
                        {sortedDonors.map((donor) => (
                            <div key={donor.id} className={`${styles.tableRow} table-3`}>
                                <div className={styles.heartCell}>
                                    <HeartIcon
                                        heartState={donor.heart_state}
                                        heartCount={donor.heart_count}
                                        canToggle={donor.heart_can_toggle}
                                        showNames={isAdmin}
                                        names={donor.heart_names}
                                        onToggle={() => onToggleHeart(donor.id)}
                                    />
                                </div>
                                <div className={`${styles.cell} ${styles.donorName}`}>{donor.first_name} {donor.last_name}</div>
                                <div className={styles.cell}>{donor.address}</div>
                                <div className={styles.cell}>{donor.city}</div>
                                <div className={styles.cell}>{donor.phone}</div>
                                <div className={styles.notesColumnCell}>
                                    <div className={styles.noteWrapper}>
                                        <button
                                            type="button"
                                            className={styles.notesButton}
                                            title={t('quickNote')}
                                            onClick={() => setOpenNoteFor(openNoteFor === donor.id ? null : donor.id)}
                                        >
                                            <Note />
                                        </button>
                                        {openNoteFor === donor.id && (
                                            <QuickNotePopover
                                                t={t}
                                                onClose={() => setOpenNoteFor(null)}
                                                onSave={(text, followUpDate) => {
                                                    onQuickNote(donor, text, followUpDate);
                                                    setOpenNoteFor(null);
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={styles.coins}
                                    title={t('quickDonation')}
                                    onClick={() => onQuickDonation(donor)}
                                >
                                    <Coins />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
