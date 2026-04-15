"use client";

import { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from './layout.module.scss';
import GiveMoney from "@/app/icons/giveMoney.svg";
import Donation from "@/app/icons/donation.svg";
import Dashboard from "@/app/icons/dashboard.svg";
import Coins from "@/app/icons/coins.svg";
import RanksIcon from "@/app/icons/ranks.svg";
import Settings from "@/app/icons/settings.svg";
import Screens from "@/app/icons/screens.svg";

import MK from "@/app/icons/MK.svg"
import Logo from '@/app/icons/logo.svg';
import ManagLabel from "@/app/icons/managLabel.svg";
import OperatorIcon from "@/app/icons/operatorIcon.svg";
import IconTooltip from '@/app/[locale]/components/IconTooltip/IconTooltip';
import { AppContext, AppProvider } from "@/app/components/AppContext";
import ProtectedRoute from "@/app/[locale]/components/ProtectedRoute";
import NamesToFix from "./NamesToFix/NamesToFix.js";
import { StoreProvider, useStore } from "@/stores/StoreContext";
import rootStore from "@/stores/RootStore";
import { sessionStore } from "@/stores/SessionStore";
import { observer } from "mobx-react-lite";
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import LoadingOverlay from "@/app/[locale]/components/LoadingOverlay";
import LanguageSwitcher from "@/app/components/LanguageSwitcher/LanguageSwitcher";
import { getAllowedUserTypesForPath } from "@/lib/accessRules";
import { loadSession, isTokenValid, clearSession } from "@/lib/auth";
import ContactsIcon from "@/app/icons/contacts.svg";

// Sidebar for contacts page — icon sidebar + sub-sidebar with title & logout (like campaign selection page)
const ContactsSidebar = observer(function ContactsSidebar({ locale, isRTL, onLogout }) {
    return (
        <div className={`${styles.contactsSidebarWrapper} ${isRTL ? styles.rtl : ''}`}>
            <nav className={styles.contactsSidebarNav}>
                <div className={styles.contactsSidebarSection}>
                    <div className={styles.contactsSidebarItem} onClick={() => { window.location.href = `/${locale}/login?showCampaigns=true`; }}>
                        <IconTooltip icon={<Dashboard />} text="קמפיינים" />
                    </div>
                    <div className={`${styles.contactsSidebarItem} ${styles.active}`}>
                        <IconTooltip icon={<ContactsIcon />} text="אנשי קשר" />
                    </div>
                </div>
            </nav>
            <div className={styles.contactsSubSidebar}>
                {onLogout && (
                    <button onClick={onLogout} className={styles.contactsLogoutButton}>
                        יציאה מהמערכת
                    </button>
                )}
                <div className={styles.contactsSubSidebarMenu}>
                    <span className={`${styles.contactsSubSidebarItem} ${styles.active} table-2`}>
                        כל אנשי הקהילה
                    </span>
                    <button
                        className={`${styles.contactsSubSidebarItem} ${styles.importContactsBtn} table-2`}
                        onClick={() => rootStore.contactsStore.setShowExcelImport(true)}>
                        ייבוא אנשי קשר
                    </button>
                </div>
            </div>
        </div>
    );
});


// Simple wrapper for login page
function LoginLayoutWrapper({ children }) {
    return (
        <StoreProvider>
            <AppProvider>
                {children}
            </AppProvider>
        </StoreProvider>
    );
}

// Main dashboard layout
const DashLayoutContent = observer(function DashLayoutContent({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();
    const locale = params?.locale || 'he';
    
    const t = useTranslations('navigation');
    const [activeMenu, setActiveMenu] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { clientId, campaignId, clientName, fundraiserId, operatorId, campaign, isAdmin, isAdminOrManager, isOperator, userType, setClientId, setCampaignId, setFundraiserId, globalLoading, setGlobalLoading } = useContext(AppContext);
    
    // Check if public screen is enabled (from either field)
    const publicScreenEnabled = campaign?.publicScreenEnabled || campaign?.publicScreenSettings?.isEnabled || false;
    
    const [name, setName] = useState(null);
    const store = useStore();
    const { fundraisersStore, ranksStore } = store;

    // בדיקה אם יש דרגות מוגדרות
    const hasRanks = ranksStore.ranks.length > 0;
    const showRanksWarning = isAdminOrManager && !ranksStore.loadingRanks && !hasRanks && campaignId;

    // State לשמות לטיפול
    const [isNamesToFixOpen, setIsNamesToFixOpen] = useState(false);
    const [namesToFixCount, setNamesToFixCount] = useState(0);
    const [isNamesToFixFundraisersOpen, setIsNamesToFixFundraisersOpen] = useState(false);
    const [namesToFixFundraisersCount, setNamesToFixFundraisersCount] = useState(0);

    // טעינת מספר שמות לטיפול
    const fetchNamesToFixCount = async () => {
        if (!campaignId) return;
        try {
            const res = await fetchWithAuth('/api/people/with-issues');
            const data = await res.json();
            if (data.success) {
                setNamesToFixCount(data.summary?.total || 0);
            }
        } catch (error) {
            console.error('Error fetching names to fix count:', error);
        }
    };

    const fetchNamesToFixFundraisersCount = async () => {
        if (!campaignId) return;
        try {
            const res = await fetchWithAuth('/api/people/with-issues?mode=fundraisers');
            const data = await res.json();
            if (data.success) {
                setNamesToFixFundraisersCount(data.summary?.total || 0);
            }
        } catch (error) {
            console.error('Error fetching fundraiser names to fix count:', error);
        }
    };

    // טעינה ראשונית ורענון כשמשתנה campaignId או pathname (אחרי ייבוא אקסל וניווט)
    useEffect(() => {
        fetchNamesToFixCount();
        fetchNamesToFixFundraisersCount();
    }, [campaignId, pathname]);

    // האזנה לאירוע רענון שמות לטיפול (נשלח אחרי ייבוא אקסל)
    useEffect(() => {
        const handleRefreshNamesToFix = () => {
            fetchNamesToFixCount();
            fetchNamesToFixFundraisersCount();
        };
        window.addEventListener('refreshNamesToFixCounts', handleRefreshNamesToFix);
        return () => window.removeEventListener('refreshNamesToFixCounts', handleRefreshNamesToFix);
    }, [campaignId]);

    // עדכון RootStore עם clientId
    useEffect(() => {
        if (clientId) {
            store.setClientId(clientId);
            // אם יש fundraiserId, זה מתרים - הצג את שמו
            // אם אין fundraiserId, זה מנהל - קבל את השם מה-API
            if (fundraiserId && !isOperator) {
                // נחכה שהמתרים יטענו לפני שנקרא את השם
                if (store.fundraisersStore.fundraisers.length > 0) {
                    setName(getCurrentFundraiserName());
                }
            } else if (!isOperator) {
                setName(clientName);
            }
        }
    }, [clientId, fundraiserId, clientName, isOperator]);

    // מפעיל - טען שם ישירות מה-API
    useEffect(() => {
        if (isOperator && operatorId) {
            fetchWithAuth(`/api/fundraisers?fundraiserId=${operatorId}&profile=simpleName`)
                .then(res => res?.ok ? res.json() : null)
                .then(data => {
                    const f = data?.data?.[0];
                    if (f?.first_name) {
                        setName(`${f.first_name} ${f.last_name || ''}`.trim());
                    }
                })
                .catch(() => {});
        }
    }, [isOperator, operatorId]);

    // הסתרת טעינה כאשר הדף נטען
    useEffect(() => {
        setGlobalLoading(false);
        setIsMobileMenuOpen(false); // Close mobile menu on navigation
        
        // גיבוי: נקה את מצב הטעינה אחרי 2 שניות במקרה שמשהו השתבש
        const timeoutId = setTimeout(() => {
            setGlobalLoading(false);
        }, 2000);
        
        return () => clearTimeout(timeoutId);
    }, [pathname]);

    // Handle escape key to close mobile menu
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isMobileMenuOpen]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileMenuOpen]);

    // בדיקת תוקף טוקן באופן תקופתי (כל דקה) וכשחוזרים לטאב
    useEffect(() => {
        // דלג על בדיקה בדף הלוגין
        if (pathname?.includes('/login')) return;

        function checkTokenValidity() {
            const session = loadSession();
            const token = session?.token;
            
            if (!token || !isTokenValid(token)) {
                clearSession();
                rootStore.resetAllStores();
                sessionStore.logout();
                setClientId(null);
                setCampaignId(null);
                setFundraiserId(null);
                // שמירת ה-URL הנוכחי כדי לחזור אליו אחרי התחברות
                const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
                const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
                const campaignIdParam = urlParams.get('campaignId');
                const params = new URLSearchParams();
                if (currentUrl && !currentUrl.includes('/login')) {
                    params.set('redirect', currentUrl);
                }
                if (campaignIdParam) {
                    params.set('campaignId', campaignIdParam);
                }
                const qs = params.toString();
                router.push(qs ? `/login?${qs}` : '/login');
            }
        }

        // בדיקה ראשונית
        checkTokenValidity();

        // בדיקה תקופתית כל דקה (קלילה מאוד - רק משווה תאריכים)
        const intervalId = setInterval(checkTokenValidity, 60 * 1000);

        // בדיקה כשחוזרים לטאב
        function handleVisibilityChange() {
            if (!document.hidden) {
                checkTokenValidity();
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [pathname, router]);

    // עדכון שם כאשר המתרים מתעדכנים (לא למפעילים - להם יש useEffect נפרד)
    useEffect(() => {
        if (fundraiserId && !isOperator && fundraisersStore.fundraisers.length > 0) {
            setName(getCurrentFundraiserName());
        }
    }, [fundraiserId, isOperator, fundraisersStore.fundraisers.length]);

    // הגדרת הרשאות לדפים
    const getPagePermissions = () => {
        return getAllowedUserTypesForPath(pathname);
    };

    // מחשב את השם של המתרים לפי המזהה
    const getCurrentFundraiserName = () => {

        if (fundraiserId && fundraisersStore.fundraisers.length > 0) {

            const fundraiser = fundraisersStore.fundraisers.find(f =>
                f.fundraiser_id === fundraiserId
            );

            if (fundraiser) {
                return `${fundraiser.first_name} ${fundraiser.last_name}`;
            }
        }

        return t('fundraiserDefault'); // ברירת מחדל אם לא נמצא
    };

    const getMainTitle = () => {
        const [section, index] = activeMenu?.split('-') || [];
        return navItems?.[section]?.[index]?.title || '';
    };

    const getSubTitle = () => {
        const [section, index] = activeMenu?.split('-') || [];
        return navItems?.[section]?.[index]?.menu?.find(item => item.href === pathname)?.label || '';
    };

    // מצא את התפריט הפעיל לפי הניתוב הנוכחי
    useEffect(() => {
        const findActiveMenu = () => {
            for (const section in navItems) {
                if (Array.isArray(navItems[section])) {
                    const menuIndex = navItems[section].findIndex(item => {
                        // בדוק אם יש menu או href ישיר
                        if (item.menu) {
                            return item.menu.some(menuItem => menuItem.href === pathname);
                        } else if (item.href && item.href !== '#') {
                            return item.href === pathname;
                        }
                        return false;
                    });
                    if (menuIndex !== -1) {
                        setActiveMenu(`${section}-${menuIndex}`);
                        return;
                    }
                }
            }
        };
        findActiveMenu();
    }, [pathname, campaign?.has_operators, isAdminOrManager, namesToFixCount, namesToFixFundraisersCount, publicScreenEnabled]);

    const navItems = {
        profile: [
            {
                icon: <MK style={{ width: "40px", height: "40px" }} />,
                title: t('profile'),
                menu: [
                    { label: t('completeProfile'), href: `/${locale}/myDonors` }
                ]
            }
        ],
        top: [
            {
                icon: <Dashboard />,
                title: t('campaign'),
                iconHref: `/${locale}/login?showCampaigns=true`, // לחיצה על האייקון מעבירה לבחירת קמפיין
                menu: [
                    { label: t('newCampaign'), href: `/${locale}/new` }
                ]
            },
            // מפעילים - רק כאשר הקמפיין מאפשר מפעילים ומשתמש הוא אדמין/מנהל (לא מפעיל בעצמו)
            ...(campaign?.has_operators && isAdminOrManager && !isOperator ? [{
                icon: <OperatorIcon />,
                title: t('operators'),
                menu: [
                    { label: t('allOperators'), href: `/${locale}/operators` },
                    { label: t('addOperator'), href: `/${locale}/operators?openAdd=true` },
                    { label: t('operatorExpectedRanks'), href: `/${locale}/operators/ranks` }
                ]
            }] : []),
            {
                icon: <GiveMoney />,
                title: t('fundraisers'),
                menu: [
                    { label: t('allFundraisers'), href: `/${locale}/fundRaisers` },
                    ...(namesToFixFundraisersCount > 0 ? [{ 
                        label: t('namesToFix'), 
                        onClick: () => setIsNamesToFixFundraisersOpen(true),
                        badge: namesToFixFundraisersCount
                    }] : []),
                    { label: t('addFundraiser'), href: campaign?.campaign_type === 'crowdfunding' ? `/${locale}/fundRaisers?openAdd=true` : `/${locale}/AddEdit?formType=fundraiser` },
                    ...((campaign?.has_operators && (isOperator || isAdminOrManager)) ? [{ label: t('operatorForecast'), href: `/${locale}/operatorForecast` }] : [])
                ]
            },
            {
                icon: <Donation />,
                title: t('donors'),
                menu: [
                    { label: t('allDonors'), href: `/${locale}/donors` },
                    ...(namesToFixCount > 0 ? [{ 
                        label: t('namesToFix'), 
                        onClick: () => setIsNamesToFixOpen(true),
                        badge: namesToFixCount
                    }] : []),
                    ...(isAdminOrManager ? [{ label: t('millionQuestionnaire'), href: `/${locale}/questionnaire-settings` }] : []),
                    { label: t('addDonor'), href: `/${locale}/AddEdit?formType=donor` }
                ]
            },
            {
                icon: <Coins />,
                title: t('donations'),
                menu: [
                    { label: t('allDonations'), href: `/${locale}/donations` },
                    { label: t('newDonation'), href: `/${locale}/donations/new` },
                    { label: t('donationRanks'), href: `/${locale}/donations/ranks`, warning: showRanksWarning ? 'עדיין לא הגדרת דרגות' : null },
                ]
            },
            // מסך ציבורי למתרימים בגיוס המונים (רק לסוג משתמש מתרים)
            ...((userType === 'fundraiser' && campaign?.campaign_type === 'crowdfunding') ? [{
                icon: <Screens />,
                title: t('publicScreen'),
                menuOnly: true,
                menu: [
                    { label: t('publicScreenView'), href: campaignId ? `/${locale}/public-screen/${campaignId}?fundraiser=${fundraiserId}` : `/${locale}/notFound`, target: '_blank' },
                    { label: t('sendLinks'), href: '#' }
                ]
            }] : []),
            // מסך ציבורי למנהל קמפיין (לא אדמין - לאדמין יש בסקשן middle)
            ...((userType === 'manager' && !isAdmin && publicScreenEnabled) ? [{
                icon: <Screens />,
                title: t('publicScreen'),
                menuOnly: true,
                menu: [
                    { label: t('publicScreenView'), href: campaignId ? `/${locale}/public-screen/${campaignId}` : `/${locale}/notFound`, target: '_blank' },
                    { label: t('sendLinks'), href: '#' },
                    { label: t('additionalSettings'), href: `/${locale}/admin/additional-settings` }
                ]
            }] : []),
        ],
        middle: isAdmin ? [
            {
                icon: <Screens />,
                title: t('donationScreen'),
                menuOnly: true,
                menu: [{
                    label: t('screenSettings'),
                    href: campaignId ? `/${locale}/campaigns/${campaignId}/screen-settings` : `/${locale}/notFound`
                },
                {
                    label: t('donationScreenView'),
                    href: campaignId ? `/${locale}/campaigns/${campaignId}/donation-screen` : `/${locale}/notFound`,
                    target: '_blank'
                },
                {
                    label: t('approveDonations'),
                    href: campaignId ? `/${locale}/campaigns/${campaignId}/approve-donations` : `/${locale}/notFound`
                },
                { label: t('donationRanks'), href: campaignId ? `/${locale}/campaigns/${campaignId}/ranks` : `/${locale}/notFound` },
                ...(publicScreenEnabled ? [
                    { label: t('publicScreenView'), href: campaignId ? `/${locale}/public-screen/${campaignId}` : `/${locale}/notFound`, target: '_blank' },
                    { label: t('sendLinks'), href: '#' },
                ] : []),
                ]
            }
        ] : [],
        bottom: [],
        fundraiserScreen: [],
        // Debug: console.log('Manager menu check:', { userType, isAdmin, publicScreenEnabled: campaign?.publicScreenEnabled, campaign: campaign?.name });
        admin: isAdmin ? [
            {
                icon: <Settings />,
                title: t('admin'),
                menu: [
                    { label: t('clientManagement'), href: `/${locale}/admin/clients` },
                    { label: t('excelImport'), href: `/${locale}/admin/excel-import` },
                    { label: t('questionnaireManagement'), href: `/${locale}/admin/questionnaire-management` },
                    { label: t('campaignSettings'), href: `/${locale}/admin/campaign-settings` },
                    { label: t('additionalSettings'), href: `/${locale}/admin/additional-settings` },
                    { label: t('paymentSettings'), href: `/${locale}/admin/payment-settings` },
                    { label: 'Webhook', href: `/${locale}/admin/webhook` }
                ]
            }
        ] : [],
        logo: [
            {
                icon: campaign?.logo ? <img src={campaign.logo} alt="Campaign Logo" className={styles.campaignLogo} /> : <Logo />,
                title: t('logo'),
                menu: []
            }
        ],
    };

    // פונקציה ליציאה מהמערכת
    const handleLogout = () => {
        rootStore.resetAllStores();
        sessionStore.logout();
        setClientId(null);
        setCampaignId(null);
        setFundraiserId(null);
        router.push(`/${locale}/login`);
    };

    const handleIconClick = (sectionKey, index) => {
        const menuId = `${sectionKey}-${index}`;
        const selectedItem = navItems[sectionKey][index];
        
        // אם יש iconHref על האייקון - ננווט לשם בלחיצה על האייקון
        if (selectedItem.iconHref) {
            setGlobalLoading(true);
            router.push(selectedItem.iconHref);
            return;
        }
        
        // אם יש href ישיר על האייקון (ללא תפריט) - ננווט ישירות
        if (selectedItem.href && (!selectedItem.menu || selectedItem.menu.length === 0)) {
            const isSamePage = pathname === selectedItem.href;
            if (isSamePage) {
                setGlobalLoading(true);
                router.refresh();
                setTimeout(() => {
                    setGlobalLoading(false);
                }, 800);
            } else {
                setGlobalLoading(true);
                router.push(selectedItem.href);
            }
            return;
        }
        
        setActiveMenu(menuId);

        // אם menuOnly - רק פותח את התפריט בלי ניווט אוטומטי
        if (selectedItem.menuOnly) return;

        // אם לוחצים על אייקון חדש, ננווט לפריט הראשון בתפריט שלו
        if (activeMenu !== menuId) {
            if (selectedItem.menu && selectedItem.menu.length > 0) {
                const firstMenuItem = selectedItem.menu[0];
                if (firstMenuItem.href && firstMenuItem.href !== '#') {
                    const isSamePage = pathname === firstMenuItem.href;
                    if (isSamePage) {
                        // אם באותו דף - הצג טעינה קצרה ועשה refresh
                        setGlobalLoading(true);
                        router.refresh();
                        setTimeout(() => {
                            setGlobalLoading(false);
                        }, 800);
                    } else {
                        // אם דף אחר - טעינה רגילה
                        setGlobalLoading(true);
                        router.push(firstMenuItem.href);
                    }
                }
            }
        }
    };



    const renderNavSection = (items, sectionKey) => (
        <div className={styles[`${sectionKey}Nav`]}>
            {items.map((item, index) => {
                const menuId = sectionKey + '-' + index;
                return (
                    <div key={index} className={styles.navItemWrapper}>
                        <div
                            className={`${styles.navItem} ${activeMenu === menuId ? styles.active : ''}`}
                            onClick={() => handleIconClick(sectionKey, index)}
                        >
                            <IconTooltip icon={item.icon} text={item.title} />
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const isDonationScreen = pathname?.includes('/donation-screen');
    const isContactsPage = pathname?.includes('/contacts');
    const isRTL = locale === 'he';

    return (
        <ProtectedRoute allowedUserTypes={getPagePermissions()}>
            {pathname?.includes('/login') ? (
                // בדף הכניסה - מציג רק את התוכן ללא תפריט
                children
            ) : isContactsPage ? (
                // בדף אנשי קשר - מציג סיידבר עם תת-סיידבר כמו בדף בחירת קמפיין
                <div className={`${styles.contactsLayoutWrapper} ${isRTL ? styles.rtl : ''}`}>
                    <ContactsSidebar locale={locale} isRTL={isRTL} onLogout={() => {
                        setGlobalLoading(true);
                        handleLogout();
                    }} />
                    <main className={styles.contactsMain}>
                        {children}
                    </main>
                </div>
            ) : (
                // בשאר הדפים - מציג את התפריט המלא
                <div className={`${styles.layout} ${isRTL ? styles.rtl : ''}`}>
                    {!isDonationScreen && (
                        <>
                            {/* Mobile header bar */}
                            <div className={`${styles.mobileHeader} ${isRTL ? styles.rtl : ''}`}>
                                <div className={styles.mobileHeaderLogo}>
                                    <Logo />
                                </div>
                                <button 
                                    className={`${styles.mobileHeaderMenuButton} ${isMobileMenuOpen ? styles.open : ''}`}
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                                >
                                    <div className={styles.hamburgerIcon}>
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </button>
                            </div>
                            
                            {/* Mobile overlay */}
                            <div 
                                className={`${styles.mobileOverlay} ${isMobileMenuOpen ? styles.visible : ''}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            />
                            
                            <div className={`${styles.navWrapper} ${isRTL ? styles.rtl : ''} ${isMobileMenuOpen ? styles.mobileOpen : ''}`}>
                            <nav className={styles.sidebar}>
                                <div className={styles.section}>
                                    {/* {renderNavSection(navItems.profile, 'profile')} */}
                                    {renderNavSection(navItems.top, 'top')}
                                </div>

                                <div className={styles.section}>
                                    {renderNavSection(navItems.middle, 'middle')}
                                    {renderNavSection(navItems.fundraiserScreen, 'fundraiserScreen')}
                                </div>

                                <div className={styles.section}>
                                    {renderNavSection(navItems.bottom, 'bottom')}
                                    {renderNavSection(navItems.admin, 'admin')}
                                    <LanguageSwitcher />
                                    {renderNavSection(navItems.logo, 'logo')}
                                </div>
                                </nav>

                                {activeMenu && (
                                    <div className={styles.menuSidebar}>
                                        <div className={`${styles.menuItem} table-2`}>{t('greeting', { name })}</div>
                                        {/* Language switcher temporarily hidden - uncomment when full translation is ready */}
                                        {/* <LanguageSwitcher /> */}
                                        <button
                                            onClick={() => {
                                                setGlobalLoading(true);
                                                // הטעינה תישאר עד שהדף החדש נטען
                                                handleLogout();
                                            }}
                                            style={{
                                                background: '#f44336',
                                                color: 'white',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                margin: '8px 0',
                                                width: '100%'
                                            }}
                                        >
                                            {t('logout')}
                                        </button>
                                        <div className={styles.menu}>
                                            {Object.entries(navItems).map(([section, items]) =>
                                                items.map((item, index) => {
                                                    const menuId = `${section}-${index}`;
                                                    if (activeMenu === menuId) {
                                                        return item.menu.map((menuItem, menuIndex) => {
                                                            // אם יש onClick - כפתור, אחרת לינק
                                                            if (menuItem.onClick) {
                                                                return (
                                                                    <button
                                                                        key={menuIndex}
                                                                        className={`${styles.menuItem} ${styles.menuItemButton} table-2`}
                                                                        onClick={menuItem.onClick}
                                                                    >
                                                                        {menuItem.label}
                                                                        {menuItem.badge > 0 && (
                                                                            <span className={styles.menuBadge}>{menuItem.badge}</span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            }
                                                            return (
                                                                <Link
                                                                    key={menuIndex}
                                                                    href={menuItem.href}
                                                                    target={menuItem.target || undefined}
                                                                    rel={menuItem.target === '_blank' ? 'noopener noreferrer' : undefined}
                                                                    className={`${styles.menuItem} ${pathname === menuItem.href ? styles.activeMenuItem : ''} table-2`}
                                                                    onClick={(e) => {
                                                                        // הפעלת טעינה רק בניווט בלשונית הנוכחית (ללא מקשים משנים)
                                                                        const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
                                                                        const opensInNewTab = menuItem.target === '_blank';
                                                                        const isSamePage = pathname === menuItem.href;
                                                                        
                                                                        if (!opensInNewTab && !isModified) {
                                                                            if (isSamePage) {
                                                                                // אם באותו דף - הצג טעינה קצרה ועשה refresh
                                                                                e.preventDefault();
                                                                                setGlobalLoading(true);
                                                                                router.refresh();
                                                                                setTimeout(() => {
                                                                                    setGlobalLoading(false);
                                                                                }, 800);
                                                                            } else {
                                                                                // אם דף אחר - טעינה רגילה
                                                                                setGlobalLoading(true);
                                                                            }
                                                                        }
                                                                        // הטעינה תישאר עד שהדף החדש נטען
                                                                    }}
                                                                >
                                                                    {menuItem.warning && (
                                                                        <span className={styles.menuWarning} title={menuItem.warning}>
                                                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                                                <text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="bold">!</text>
                                                                            </svg>
                                                                            <span className={styles.menuWarningTooltip}>{menuItem.warning}</span>
                                                                        </span>
                                                                    )}
                                                                    {menuItem.label}
                                                                </Link>
                                                            );
                                                        });
                                                    }
                                                    return null;
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                        )}
                        <main className={styles.main} style={isDonationScreen ? { background: 'transparent' } : undefined}>
                            {!(pathname?.includes('/donation-screen')) && (
                                <div className={styles.pageHeader}>
                                    <h1 className={`${styles.pageMainTitle} headline-4`}>
                                        {getMainTitle()}
                                    </h1>
                                    <h2 className={`${styles.pageSubTitle} text`}>
                                        {getSubTitle()}
                                    </h2>
                                </div>
                            )}

                            {children}
                        </main>

                    </div>
            )}
            {globalLoading && <LoadingOverlay />}
            {isNamesToFixOpen && <NamesToFix
                open={isNamesToFixOpen}
                onClose={() => setIsNamesToFixOpen(false)}
                onRefresh={async () => {
                    await fetchNamesToFixCount();
                    // רענון רשימת התורמים מיידית דרך ה-store
                    if (store?.donorsStore) {
                        store.donorsStore.clearDonorsCache();
                        await store.donorsStore.fetchDonors();
                        await store.donorsStore.fetchDonorsSummary();
                    }
                }}
            />}
            {isNamesToFixFundraisersOpen && <NamesToFix
                open={isNamesToFixFundraisersOpen}
                onClose={() => setIsNamesToFixFundraisersOpen(false)}
                mode="fundraisers"
                onRefresh={async () => {
                    await fetchNamesToFixFundraisersCount();
                    // רענון רשימת המתרימים מיידית דרך ה-store
                    if (store?.fundraisersStore) {
                        store.fundraisersStore.invalidateFundraisersCache();
                        store.fundraisersStore.fundraisersSummaryCache.clear();
                        await store.fundraisersStore.fetchFundraisers();
                        await store.fundraisersStore.fetchFundraisersSummary();
                    }
                }}
            />}
        </ProtectedRoute>
    );
});

// Export wrapper that checks for login page
export default function DashLayout({ children }) {
    const pathname = usePathname();
    
    // For login page, use simple wrapper without dashboard layout
    if (pathname?.includes('/login')) {
        return <LoginLayoutWrapper>{children}</LoginLayoutWrapper>;
    }
    
    // For all other pages, wrap with providers and use the full dashboard layout
    return (
        <StoreProvider>
            <AppProvider>
                <DashLayoutContent>{children}</DashLayoutContent>
            </AppProvider>
        </StoreProvider>
    );
}