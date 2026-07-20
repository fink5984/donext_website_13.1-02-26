"use client";
import { useMemo, useState } from "react";
import { useTranslations } from 'next-intl';
import styles from "./CommunityTable.module.scss";
import Search from '@/app/components/Search';
import HeartIcon from "@/app/components/HeartIcon/HeartIcon";
import Coins from "@/app/icons/coinsSmall.svg";
import Note from "@/app/icons/note.svg";

function QuickNotePopover({ onSave, onClose, t }) {
    const [text, setText] = useState('');
    return (
        <div className={styles.quickNotePopover} onClick={(e) => e.stopPropagation()}>
            <textarea
                autoFocus
                className={styles.quickNoteInput}
                placeholder={t('notePlaceholder')}
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            <div className={styles.quickNoteActions}>
                <button type="button" className={styles.quickNoteCancel} onClick={onClose}>{t('noteCancel')}</button>
                <button
                    type="button"
                    className={styles.quickNoteSave}
                    disabled={!text.trim()}
                    onClick={() => onSave(text.trim())}
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

    const filteredDonors = useMemo(() => {
        if (!donors) return [];
        const term = searchTerm.trim().toLowerCase();
        if (!term) return donors;
        return donors.filter((donor) => {
            const fullName = `${donor.first_name} ${donor.last_name}`.toLowerCase();
            return fullName.includes(term) || (donor.phone || '').includes(term) || (donor.city || '').toLowerCase().includes(term);
        });
    }, [donors, searchTerm]);

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
            ) : !filteredDonors || filteredDonors.length === 0 ? (
                <div className={styles.stateMessage}>{t('empty')}</div>
            ) : (
                <div className={styles.table}>
                    <div className={`${styles.tableHeader} table-4`}>
                        <div className={styles.heartCell}></div>
                        <div className={styles.headerCell}>{t('firstName')}</div>
                        <div className={styles.headerCell}>{t('lastName')}</div>
                        <div className={styles.headerCell}>{t('phone')}</div>
                        <div className={styles.headerCell}>{t('address')}</div>
                        <div className={styles.headerCell}>{t('city')}</div>
                        <div></div>
                    </div>
                    <div className={styles.tableBody}>
                        {filteredDonors.map((donor) => (
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
                                <div className={styles.cell}>{donor.first_name}</div>
                                <div className={styles.cell}>{donor.last_name}</div>
                                <div className={styles.cell}>{donor.phone}</div>
                                <div className={styles.cell}>{donor.address}</div>
                                <div className={styles.cell}>{donor.city}</div>
                                <div className={styles.actionsCell}>
                                    <button
                                        type="button"
                                        className={styles.actionButton}
                                        title={t('quickDonation')}
                                        onClick={() => onQuickDonation(donor)}
                                    >
                                        <Coins />
                                    </button>
                                    <div className={styles.noteWrapper}>
                                        <button
                                            type="button"
                                            className={styles.actionButton}
                                            title={t('quickNote')}
                                            onClick={() => setOpenNoteFor(openNoteFor === donor.id ? null : donor.id)}
                                        >
                                            <Note />
                                        </button>
                                        {openNoteFor === donor.id && (
                                            <QuickNotePopover
                                                t={t}
                                                onClose={() => setOpenNoteFor(null)}
                                                onSave={(text) => {
                                                    onQuickNote(donor, text);
                                                    setOpenNoteFor(null);
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
