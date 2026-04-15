import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from '../excel.module.scss';
import dupStyles from './DuplicatedPhones.module.scss';
import Clock from "@/app/icons/clock.svg";
import Delete from "@/app/icons/delete.svg";
import Edit from "@/app/icons/edit.svg";
import Phone from "@/app/icons/phoneSmall.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';

export default function DuplicatedPhones({
    groupedDuplicates,
    handleDefer,
    openBulkDialog,
    handleDelete,
    handleUpdatePhone,
    handleIgnoreDuplicatePhones,
    existingPhoneOwners = {},
    ownersLoaded = true
}) {
    const t = useTranslations('admin.excelUpload.page4.bugs');

    // For each phone group: which person was chosen (originalIndex), or null
    const [chosenMap, setChosenMap] = useState({});
    // For each remaining person: new phone input value
    const [newPhones, setNewPhones] = useState({});

    const handleChoose = (phone, originalIndex) => {
        setChosenMap(prev => ({
            ...prev,
            [phone]: prev[phone] === originalIndex ? null : originalIndex
        }));
    };

    const handleNewPhoneChange = (originalIndex, value) => {
        setNewPhones(prev => ({ ...prev, [originalIndex]: value }));
    };

    const handleSaveNewPhone = (originalIndex) => {
        const val = (newPhones[originalIndex] || '').trim();
        if (val) handleUpdatePhone(originalIndex, val);
    };

    // Act on a single remaining row directly (no dialog needed).
    // Only resolve the chosen person once the LAST remaining is handled.
    const handleRemainingAction = (action, originalIndex, phone, remaining) => {
        if (action === 'delete') handleDelete(originalIndex);
        else handleDefer(originalIndex);
        if (remaining.length === 1 && handleIgnoreDuplicatePhones) {
            handleIgnoreDuplicatePhones(chosenMap[phone]);
        }
    };

    // Handle ALL remaining at once, then resolve the chosen person.
    const handleBulkRemainingAction = (action, phone, remaining) => {
        remaining.forEach(({ originalIndex }) => {
            if (action === 'delete') handleDelete(originalIndex);
            else handleDefer(originalIndex);
        });
        if (handleIgnoreDuplicatePhones) {
            handleIgnoreDuplicatePhones(chosenMap[phone]);
        }
    };

    const groups = Object.entries(groupedDuplicates);
    const total = groups.length;

    return (
        <div className={styles.problemInner}>
            <div className={styles.problemHeader}>
                <div className={styles.titles}>
                    <h2 className={`${styles.title} headline-5`}>
                        {total > 1 ? (
                            <><span className="headline-4">{t('duplicatePhones.titlePlural')} {total}</span> {t('duplicatePhones.titlePluralSuffix')}</>
                        ) : (
                            t('duplicatePhones.titleSingle')
                        )}
                    </h2>
                    <p className={dupStyles.description}>{t('duplicatePhones.descriptionNew')}</p>
                </div>
            </div>

            <div className={dupStyles.cardList}>
                {groups.map(([phone, entries]) => {
                    const chosenIndex = chosenMap[phone] ?? null;
                    const chosen = chosenIndex !== null
                        ? entries.find(e => e.originalIndex === chosenIndex)
                        : null;
                    const remaining = chosenIndex !== null
                        ? entries.filter(e => e.originalIndex !== chosenIndex)
                        : [];
                    // בעל המספר — איש קשר רגיל (status:null) שכבר מחזיק במספר הזה
                    // אם השליפה עדיין לא בוצעה — משתמשים בnull כברירת מחדל, אבל הקארד ייחסם עד הגעת התשובה
                    const phoneOwner = ownersLoaded ? (existingPhoneOwners[phone] ?? null) : undefined;

                    return (
                        <div key={phone} className={dupStyles.card}>
                            {phoneOwner === undefined ? (
                                /* טוען — ממתין שהשליפה תסתיים לפני הצגת אפשרויות */
                                <div className={dupStyles.cardLoading}>
                                    <p className={dupStyles.cardPhone}><Phone /> {phone}</p>
                                    <p style={{ color: '#999', fontSize: 13, margin: '8px 0' }}>טוען...</p>
                                </div>
                            ) : phoneOwner ? (
                                /* מצב בעלים: המספר כבר שייך לאיש קשר קיים — אין לבחור מנצח, רק שנה-טלפון או מחק */
                                <div className={dupStyles.subPanel}>
                                    <div className={dupStyles.subPanelHeader}>
                                        <div>
                                            <p className={dupStyles.cardPhone}><Phone /> {phone}</p>
                                            <p className={dupStyles.subPanelTitle}>
                                                {t('duplicatePhones.ownerTitle')} {phoneOwner.firstName} {phoneOwner.lastName}
                                            </p>
                                            <p className={dupStyles.subPanelSubtitle}>{t('duplicatePhones.ownerSubtitle')}</p>
                                        </div>
                                    </div>
                                    {entries.map(({ row, originalIndex }) => (
                                        <div key={originalIndex} className={dupStyles.remainingRow}>
                                            <span className={dupStyles.remainingName}>{row.firstName} {row.lastName}</span>
                                            <div className={dupStyles.remainingInput}>
                                                <Edit className={dupStyles.editIcon} />
                                                <input
                                                    type="text"
                                                    placeholder={t('duplicatePhones.addPhone')}
                                                    value={newPhones[originalIndex] || ''}
                                                    onChange={e => handleNewPhoneChange(originalIndex, e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleSaveNewPhone(originalIndex)}
                                                    className={dupStyles.phoneInput}
                                                />
                                            </div>
                                            <div className={dupStyles.remainingActions}>
                                                <button onClick={() => handleDelete(originalIndex)}>
                                                    <IconTooltip icon={<Delete />} text={t('delete')} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className={dupStyles.cardActions}>
                                        <button
                                            className={dupStyles.actionBtn}
                                            onClick={() => openBulkDialog('delete', entries.map(e => e.originalIndex))}
                                        >
                                            <Delete /> {t('delete')}
                                        </button>
                                    </div>
                                </div>
                            ) : chosenIndex === null ? (
                                <>
                                    <p className={dupStyles.cardPhone}><Phone /> {phone}</p>
                                    <div className={dupStyles.nameChips}>
                                        {entries.map(({ row, originalIndex }) => (
                                            <button
                                                key={originalIndex}
                                                className={dupStyles.nameChip}
                                                onClick={() => handleChoose(phone, originalIndex)}
                                            >
                                                {row.firstName} {row.lastName}
                                            </button>
                                        ))}
                                    </div>
                                    <div className={dupStyles.cardActions}>
                                        <button
                                            className={dupStyles.actionBtn}
                                            onClick={() => openBulkDialog('delete', entries.map(e => e.originalIndex))}
                                        >
                                            <Delete /> {t('delete')}
                                        </button>
                                        <button
                                            className={dupStyles.actionBtn}
                                            onClick={() => openBulkDialog('defer', entries.map(e => e.originalIndex))}
                                        >
                                            <Clock /> {t('handleLater')}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className={dupStyles.subPanel}>
                                    <div className={dupStyles.subPanelHeader}>
                                        <div>
                                            <p className={dupStyles.subPanelTitle}>
                                                {t('duplicatePhones.chosenTitle')} {chosen?.row?.firstName} {chosen?.row?.lastName}
                                            </p>
                                            <p className={dupStyles.subPanelSubtitle}>{t('duplicatePhones.chosenSubtitle')}</p>
                                        </div>
                                        <button
                                            className={dupStyles.closeBtn}
                                            onClick={() => setChosenMap(prev => ({ ...prev, [phone]: null }))}
                                        >×</button>
                                    </div>

                                    {remaining.map(({ row, originalIndex }) => (
                                        <div key={originalIndex} className={dupStyles.remainingRow}>
                                            <span className={dupStyles.remainingName}>{row.firstName} {row.lastName}</span>
                                            <div className={dupStyles.remainingInput}>
                                                <Edit className={dupStyles.editIcon} />
                                                <input
                                                    type="text"
                                                    placeholder={t('duplicatePhones.addPhone')}
                                                    value={newPhones[originalIndex] || ''}
                                                    onChange={e => handleNewPhoneChange(originalIndex, e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleSaveNewPhone(originalIndex)}
                                                    className={dupStyles.phoneInput}
                                                />
                                            </div>
                                            <div className={dupStyles.remainingActions}>
                                                <button onClick={() => handleRemainingAction('delete', originalIndex, phone, remaining)}>
                                                    <IconTooltip icon={<Delete />} text={t('delete')} />
                                                </button>
                                                <button onClick={() => handleRemainingAction('defer', originalIndex, phone, remaining)}>
                                                    <IconTooltip icon={<Clock />} text={t('handleLater')} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <div className={dupStyles.cardActions}>
                                        <button
                                            className={dupStyles.actionBtn}
                                            onClick={() => handleBulkRemainingAction('delete', phone, remaining)}
                                        >
                                            <Delete /> {t('delete')}
                                        </button>
                                        <button
                                            className={dupStyles.actionBtn}
                                            onClick={() => handleBulkRemainingAction('defer', phone, remaining)}
                                        >
                                            <Clock /> {t('handleLater')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
