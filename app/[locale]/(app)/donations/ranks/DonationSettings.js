"use client";

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import styles from './ranks.module.scss';
import Eye from '@/app/icons/eye-small.svg';
import EyeOff from '@/app/icons/eye-off-small.svg';
import Hand from '@/app/icons/hand.svg';
import ChevronDown from '@/app/icons/dropDownSmall.svg';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { useAppContext } from '@/app/components/AppContext';

// Cache ברמת המודול למניעת קריאות כפולות
const screenSettingsCache = new Map();
const pendingFetches = new Map();

/**
 * קומפוננטת הגדרות נוספות ליום ההתרמה
 * מאפשרת הגדרת תקופת ברירת מחדל להו"ק ומדיניות הצגת תרומות נמוכות
 */
function DonationSettings({ campaignId }) {
    const t = useTranslations('ranksPage');
    const locale = useLocale();
    const isRTL = locale === 'he';
    const { stores, campaign } = useAppContext();
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savingHokMonths, setSavingHokMonths] = useState(false);
    const [savingLowDonation, setSavingLowDonation] = useState(false);

    // הגדרות הקמפיין - נשתמש ב-campaign מה-context
    const [defaultHokMonths, setDefaultHokMonths] = useState(12);
    const [customMonths, setCustomMonths] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [isUnlimited, setIsUnlimited] = useState(false);

    // הגדרות חישוב יעד לדף הציבורי
    const [monthsCalculation, setMonthsCalculation] = useState(1);
    const [donationsCalculation, setDonationsCalculation] = useState(1);
    const [savingMonthsCalc, setSavingMonthsCalc] = useState(false);
    const [savingDonationsCalc, setSavingDonationsCalc] = useState(false);

    // הגדרות מסך
    const [lowDonationDisplay, setLowDonationDisplay] = useState('HIDE');

    // פונקציה שמגוללת למטה כשההגדרות נפתחות
    function handleToggle() {
        if (!isExpanded) {
            // אם פותחים, נגלול למטה אחרי רנדר
            setIsExpanded(true);
            setTimeout(() => {
                const contentWrapper = document.querySelector('.contentWrapper');
                if (contentWrapper) {
                    contentWrapper.scrollTo({
                        top: contentWrapper.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            }, 100);
        } else {
            setIsExpanded(false);
        }
    }

    // עדכון defaultHokMonths מה-campaign שכבר נטען ב-RootStore
    useEffect(() => {
        if (campaign?.defaultHokMonths !== undefined) {
            if (campaign.defaultHokMonths === 0) {
                setIsUnlimited(true);
                setDefaultHokMonths(0);
                setIsCustom(false);
                setCustomMonths('');
            } else {
                setDefaultHokMonths(campaign.defaultHokMonths || 12);
                setIsUnlimited(false);
                // בדיקה אם זה מספר מותאם אישית (לא 12, 24, או 36)
                const isStandardValue = [12, 24, 36].includes(campaign.defaultHokMonths);
                if (!isStandardValue && campaign.defaultHokMonths) {
                    setIsCustom(true);
                    setCustomMonths(campaign.defaultHokMonths.toString());
                }
            }
        }
    }, [campaign]);

    // טעינת הגדרות חישוב יעד (monthsCalculation / donationsCalculation)
    useEffect(() => {
        if (!campaignId) return;
        let mounted = true;
        (async () => {
            try {
                const res = await fetchWithAuth(`/api/campaigns/${campaignId}/calculation-settings`);
                if (!mounted || !res.ok) return;
                const data = await res.json();
                setMonthsCalculation(data.monthsCalculation ?? 1);
                setDonationsCalculation(data.donationsCalculation ?? 1);
            } catch (error) {
                console.error('Error loading calculation settings:', error);
            }
        })();
        return () => { mounted = false; };
    }, [campaignId]);

    // טעינת הגדרות מסך בלבד
    useEffect(() => {
        if (!campaignId) {
            setLoading(false);
            return;
        }

        let mounted = true;
        
        async function loadScreenSettings() {
            // בדיקה אם כבר יש ב-cache
            if (screenSettingsCache.has(campaignId)) {
                const cachedData = screenSettingsCache.get(campaignId);
                if (mounted) {
                    setLowDonationDisplay(cachedData.lowDonationDisplay || 'HIDE');
                    setLoading(false);
                }
                return;
            }

            // בדיקה אם יש fetch בתהליך עבור אותו campaign
            if (pendingFetches.has(campaignId)) {
                try {
                    const data = await pendingFetches.get(campaignId);
                    if (mounted) {
                        setLowDonationDisplay(data.lowDonationDisplay || 'HIDE');
                        setLoading(false);
                    }
                } catch (error) {
                    if (mounted) {
                        setLoading(false);
                    }
                }
                return;
            }

            // יצירת fetch חדש
            setLoading(true);
            const fetchPromise = fetchWithAuth(`/api/campaigns/${campaignId}/screen-settings`)
                .then(async (screenRes) => {
                    if (screenRes.ok) {
                        const screenData = await screenRes.json();
                        screenSettingsCache.set(campaignId, screenData);
                        return screenData;
                    }
                    throw new Error('Failed to fetch screen settings');
                })
                .finally(() => {
                    pendingFetches.delete(campaignId);
                });

            pendingFetches.set(campaignId, fetchPromise);

            try {
                const data = await fetchPromise;
                if (mounted) {
                    setLowDonationDisplay(data.lowDonationDisplay || 'HIDE');
                }
            } catch (error) {
                if (mounted) {
                    console.error('Error fetching screen settings:', error);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }
        
        loadScreenSettings();
        
        return () => {
            mounted = false;
        };
    }, [campaignId]);

    async function saveDefaultHokMonths(months) {
        setSavingHokMonths(true);
        try {
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultHokMonths: months })
            });

            if (response.ok && stores) {
                stores.updateCampaign({ defaultHokMonths: months });
            }

            // תרחיש 2: כאשר תקופת ברירת המחדל אינה "ללא הגבלה",
            // סף הזיהוי לתרומה חודשית נגזר אוטומטית מתקופת ברירת המחדל.
            if (months > 0 && donationsCalculation !== months) {
                setDonationsCalculation(months);
                saveCalculationSettings({ donationsCalculation: months });
            }
        } catch (error) {
            console.error('Error saving defaultHokMonths:', error);
            alert('שגיאה בשמירת ההגדרה');
        } finally {
            setSavingHokMonths(false);
        }
    }

    async function saveCalculationSettings(payload) {
        const hasMonths = Object.prototype.hasOwnProperty.call(payload, 'monthsCalculation');
        const hasDonations = Object.prototype.hasOwnProperty.call(payload, 'donationsCalculation');
        if (hasMonths) setSavingMonthsCalc(true);
        if (hasDonations) setSavingDonationsCalc(true);
        try {
            await fetchWithAuth(`/api/campaigns/${campaignId}/calculation-settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Error saving calculation settings:', error);
            alert('שגיאה בשמירת הגדרת חישוב היעד');
        } finally {
            if (hasMonths) setSavingMonthsCalc(false);
            if (hasDonations) setSavingDonationsCalc(false);
        }
    }

    function handleMonthsCalculationChange(value) {
        if (savingMonthsCalc || monthsCalculation === value) return;
        setMonthsCalculation(value);
        const payload = { monthsCalculation: value };
        // בתרחיש 1 (ללא הגבלה) עם יעד של שנה ומעלה (value>1) אין הגדרה נפרדת לסף חודשי,
        // לכן מסנכרנים את הסף והפיצול לערך תקופת היעד עצמו.
        if (isUnlimited && value > 1 && donationsCalculation !== value) {
            setDonationsCalculation(value);
            payload.donationsCalculation = value;
        }
        saveCalculationSettings(payload);
    }

    function handleDonationsCalculationChange(value) {
        if (savingDonationsCalc || donationsCalculation === value) return;
        setDonationsCalculation(value);
        saveCalculationSettings({ donationsCalculation: value });
    }

    async function saveLowDonationDisplay(value) {
        setSavingLowDonation(true);
        try {
            await fetchWithAuth(`/api/campaigns/${campaignId}/screen-settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lowDonationDisplay: value })
            });
            
            // עדכון ה-cache לאחר שמירה
            if (screenSettingsCache.has(campaignId)) {
                const cached = screenSettingsCache.get(campaignId);
                screenSettingsCache.set(campaignId, { ...cached, lowDonationDisplay: value });
            }
        } catch (error) {
            console.error('Error saving lowDonationDisplay:', error);
            alert('שגיאה בשמירת ההגדרה');
        } finally {
            setSavingLowDonation(false);
        }
    }

    function handleHokMonthsChange(months) {
        setDefaultHokMonths(months);
        setIsCustom(false);
        setIsUnlimited(false);
        setCustomMonths('');
        saveDefaultHokMonths(months);
    }

    function handleUnlimitedClick() {
        setIsUnlimited(true);
        setIsCustom(false);
        setCustomMonths('');
        setDefaultHokMonths(0);
        saveDefaultHokMonths(0);
        // אם יעד התצוגה כבר שנה+ (monthsCalculation>1), נסנכרן את הסף לפיצול תרומות קצרות
        if (monthsCalculation > 1 && donationsCalculation !== monthsCalculation) {
            setDonationsCalculation(monthsCalculation);
            saveCalculationSettings({ donationsCalculation: monthsCalculation });
        }
    }

    function handleCustomMonthsClick() {
        setIsCustom(true);
        setIsUnlimited(false);
        if (customMonths) {
            const months = parseInt(customMonths);
            if (!isNaN(months) && months > 0) {
                setDefaultHokMonths(months);
                saveDefaultHokMonths(months);
            }
        }
    }

    function handleCustomMonthsChange(e) {
        const value = e.target.value;
        setCustomMonths(value);
    }

    function handleCustomMonthsBlur() {
        const months = parseInt(customMonths);
        if (!isNaN(months) && months > 0 && months <= 120) {
            setDefaultHokMonths(months);
            saveDefaultHokMonths(months);
        } else if (!customMonths || isNaN(months) || months <= 0) {
            // אם הערך לא תקין, חזור לערך הקודם
            setCustomMonths(defaultHokMonths.toString());
        }
    }

    function handleLowDonationDisplayChange(value) {
        setLowDonationDisplay(value);
        saveLowDonationDisplay(value);
    }

    const lowDonationOptions = [
        {
            value: 'HIDE',
            icon: <EyeOff />,
            label: t('lowDonationHide')
        },
        {
            value: 'SHOW_WITH_APPROVAL',
            icon: <Hand />,
            label: t('lowDonationApproval')
        },
        {
            value: 'SHOW_WITHOUT_APPROVAL',
            icon: <Eye />,
            label: t('lowDonationShow')
        }
    ];

    // if (loading) {
    //     return <div className={styles.settings}>טוען...</div>;
    // }

    return (
        <div className={`${styles.settings} ${isExpanded ? styles.expanded : ''}`}>
            <div className={styles.settingsHeader} onClick={handleToggle}>
                <h3 className={`headline-2 ${styles.settingsTitle}`}>{t('additionalSettings')}</h3>
                <ChevronDown className={`${styles.chevron} ${isExpanded ? styles.expanded : ''} ${!isRTL ? styles.ltrChevron : ''}`} />
            </div>

            {/* {isExpanded && ( */}
                <div className={`${styles.settingsContent} ${!isExpanded ? styles.closing : ''}`}>
                    {/* צד ימין: שאלה 1 בלבד */}
                    <div className={styles.settingsRightSide}>
                    {/* שאלה 1: מדיניות תרומות נמוכות */}
                    <div className={styles.settingSection}>
                        <div className={styles.questionHeader}>
                            <h4 className={`headline-5`}>
                                {t('lowDonationQuestion')}
                            </h4>
                        </div>
                         <div className={styles.cardsRow}>
                            {lowDonationOptions.map((option) => (
                                <button
                                    key={option.value}
                                    className={`${styles.optionCard} ${lowDonationDisplay === option.value ? styles.active : ''} ${savingLowDonation ? styles.disabled : ''}`}
                                    onClick={() => handleLowDonationDisplayChange(option.value)}
                                    disabled={savingLowDonation}
                                >
                                    <div className={styles.cardIcon}>
                                        {option.icon}
                                    </div>
                                    <span className={`table-3 ${styles.cardLabel}`}>
                                        {savingLowDonation && lowDonationDisplay === option.value ? t('saving') : option.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                    </div>

                    {/* צד שמאל: שאלות 2, 3, 4 - זו מתחת לזו, מיושרות לימין עד גבול האמצע */}
                    <div className={styles.settingsLeftSide}>
                    {/* שאלה 2: תקופת תשלום */}
                    <div className={styles.settingSection}>
                        <div className={styles.questionHeader}>
                            <h4 className={`headline-5`}>
                                {t('defaultHokQuestion')}
                            </h4>
                            <p className={`table-3 ${styles.questionSubtext}`}>
                                {t('fundraiserCanChange')}
                            </p>
                        </div>
                        <div className={styles.optionsRow}>
                            <button
                                className={`${styles.optionButton} ${defaultHokMonths === 12 && !isCustom && !isUnlimited ? styles.active : ''} ${savingHokMonths ? styles.disabled : ''}`}
                                onClick={() => handleHokMonthsChange(12)}
                                disabled={savingHokMonths}
                            >
                                {savingHokMonths && defaultHokMonths === 12 ? t('saving') : t('oneYear')}
                            </button>
                            <button
                                className={`${styles.optionButton} ${defaultHokMonths === 24 && !isCustom && !isUnlimited ? styles.active : ''} ${savingHokMonths ? styles.disabled : ''}`}
                                onClick={() => handleHokMonthsChange(24)}
                                disabled={savingHokMonths}
                            >
                                {savingHokMonths && defaultHokMonths === 24 ? t('saving') : t('twoYears')}
                            </button>
                            <button
                                className={`${styles.optionButton} ${defaultHokMonths === 36 && !isCustom && !isUnlimited ? styles.active : ''} ${savingHokMonths ? styles.disabled : ''}`}
                                onClick={() => handleHokMonthsChange(36)}
                                disabled={savingHokMonths}
                            >
                                {savingHokMonths && defaultHokMonths === 36 ? t('saving') : t('threeYears')}
                            </button>
                            {(campaign?.donationType === 'monthly' || campaign?.donation_type === 'monthly') && (
                                <button
                                    className={`${styles.optionButton} ${isUnlimited ? styles.active : ''} ${savingHokMonths ? styles.disabled : ''}`}
                                    onClick={handleUnlimitedClick}
                                    disabled={savingHokMonths}
                                >
                                    {savingHokMonths && isUnlimited ? t('saving') : t('noLimit')}
                                </button>
                            )}
                            <div className={`${styles.customOption} ${isCustom ? styles.active : ''}`}>
                                <button
                                    className={`${styles.optionButton} ${styles.customButton} ${savingHokMonths ? styles.disabled : ''}`}
                                    onClick={handleCustomMonthsClick}
                                    disabled={savingHokMonths}
                                >
                                    {isCustom ? (
                                        <div className={styles.customButtonContent}>
                                            <input
                                                type="number"
                                                min="1"
                                                max="120"
                                                value={customMonths}
                                                onChange={handleCustomMonthsChange}
                                                onBlur={handleCustomMonthsBlur}
                                                placeholder="__"
                                                disabled={savingHokMonths}
                                                className={styles.customNumberInput}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span>{t('months')}</span>
                                        </div>
                                    ) : (
                                        t('other')
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* שאלה 3: תקופת יעד בדף הציבורי - שורה משלה למטה */}
                    {(campaign?.donationType === 'monthly' || campaign?.donation_type === 'monthly') && (
                        <div className={styles.settingSection}>
                            <div className={styles.questionHeader}>
                                <h4 className={`headline-5`}>{t('targetPeriodQuestion')}</h4>
                            </div>
                            <div className={styles.optionsRow}>
                                {[
                                    { value: 1, label: t('targetPeriodMonth') },
                                    { value: 12, label: t('targetPeriodYear') },
                                    { value: 24, label: t('targetPeriodTwoYears') },
                                    { value: 36, label: t('targetPeriodThreeYears') }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`${styles.optionButton} ${monthsCalculation === opt.value ? styles.active : ''} ${savingMonthsCalc ? styles.disabled : ''}`}
                                        onClick={() => handleMonthsCalculationChange(opt.value)}
                                        disabled={savingMonthsCalc}
                                    >
                                        {savingMonthsCalc && monthsCalculation === opt.value ? t('saving') : opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* שאלה 4: סף לזיהוי תרומה חודשית - שורה משלה, מותנית בתרחיש 1 + יעד חודשי */}
                    {(campaign?.donationType === 'monthly' || campaign?.donation_type === 'monthly') &&
                     isUnlimited && monthsCalculation === 1 && (
                        <div className={styles.settingSection}>
                            <div className={styles.questionHeader}>
                                <h4 className={`headline-5`}>{t('minMonthsForMonthlyQuestion')}</h4>
                                <p className={`table-3 ${styles.questionSubtext}`}>
                                    {t('minMonthsHint')}
                                </p>
                            </div>
                            <div className={styles.optionsRow}>
                                {[
                                    { value: 12, label: t('targetPeriodYear') },
                                    { value: 24, label: t('targetPeriodTwoYears') },
                                    { value: 36, label: t('targetPeriodThreeYears') }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`${styles.optionButton} ${donationsCalculation === opt.value ? styles.active : ''} ${savingDonationsCalc ? styles.disabled : ''}`}
                                        onClick={() => handleDonationsCalculationChange(opt.value)}
                                        disabled={savingDonationsCalc}
                                    >
                                        {savingDonationsCalc && donationsCalculation === opt.value ? t('saving') : opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    </div>
                </div>
        </div>
    );
}

export default DonationSettings;
