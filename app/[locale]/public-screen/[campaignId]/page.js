'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import styles from './page.module.css';
import DoNextLoader from '@/app/components/DoNextLoader';
import DonationFormPublic from '@/components/DonationForm/DonationFormPublic';
import SiteHeader from '@/app/[locale]/landing/SiteHeader';

const ODOMETER_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Odometer-style number for the gauge "raised so far". Each digit is a vertical
// strip 0-9 that slides (via CSS transform + transition) to the current digit, so
// the number visibly rolls when it updates. Non-digit characters (commas, currency
// symbol, unit label) render statically. Works for both money and unit strings.
// Digits are keyed by position-from-the-right so trailing digits keep their DOM
// node across updates and animate instead of remounting.
function OdometerNumber({ value, className }) {
    const chars = String(value ?? '').split('');
    const len = chars.length;
    return (
        <span className={`${styles.odometer}${className ? ` ${className}` : ''}`}>
            {chars.map((ch, i) => {
                if (ch >= '0' && ch <= '9') {
                    const digit = Number(ch);
                    const posFromRight = len - i;
                    return (
                        <span key={`d${posFromRight}`} className={styles.odometerDigit}>
                            <span
                                className={styles.odometerStrip}
                                style={{ transform: `translateY(-${digit}em)` }}
                            >
                                {ODOMETER_DIGITS.map((n) => (
                                    <span key={n} className={styles.odometerCell}>{n}</span>
                                ))}
                            </span>
                        </span>
                    );
                }
                return <span key={`c${i}`}>{ch === ' ' ? ' ' : ch}</span>;
            })}
        </span>
    );
}

// Render text where segments wrapped in *asterisks* are shown bold
function renderRichText(text) {
    if (!text) return null;
    const parts = String(text).split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <strong key={i}>{part.slice(1, -1)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

export default function PublicCampaignScreen() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const campaignId = params?.campaignId;
    const locale = params?.locale || 'he';
    const fundraiserId = searchParams.get('fundraiser');
    // המתרים מה-URL כמספר — משמש כברירת מחדל לשיוך תרומות גם במצב "אודות בלבד"
    // (showDonationDetails=false), שבו טאב המתרימים מוסתר ו-selectedFundraiser לא נקבע.
    const urlFundraiserId = fundraiserId && !Number.isNaN(parseInt(fundraiserId)) ? parseInt(fundraiserId) : null;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedAmount, setSelectedAmount] = useState(null);
    const [activeTab, setActiveTab] = useState('donors');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFundraiser, setSelectedFundraiser] = useState(null);
    const [sortBy, setSortBy] = useState('recent'); // recent, oldest, highest
    const [fundraiserSortBy, setFundraiserSortBy] = useState('amount'); // amount, donors, progress, target
    const [expandedCommunityId, setExpandedCommunityId] = useState(null); // Community whose fundraisers are expanded inline
    const [communitySortBy, setCommunitySortBy] = useState('amount'); // amount, donors, fundraisers, progress, target
    const [visibleCount, setVisibleCount] = useState(15); // Number of items to show (5 rows × 3 cards)
    const [columnsCount, setColumnsCount] = useState(3);
    const pusherRef = useRef(null);
    const channelRef = useRef(null);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
    const [previousBannerIndex, setPreviousBannerIndex] = useState(null);
    const [isSliding, setIsSliding] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, status: 'loading' });
    const [showDonationModal, setShowDonationModal] = useState(false);
    // Thank-you overlay (confetti) shown after a successful donation.
    const [showThankYou, setShowThankYou] = useState(false);
    const thankYouCanvasRef = useRef(null);
    // Guard so the modal portal only renders on the client (document exists).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Confetti burst while the thank-you overlay is visible (same feel as campaign 179).
    useEffect(() => {
        if (!showThankYou) return;
        let alive = true;
        let interval;
        let myConfetti;
        let stopTimer;
        (async () => {
            try {
                const mod = await import('canvas-confetti');
                if (!alive || !thankYouCanvasRef.current) return;
                const confetti = mod.default;
                myConfetti = confetti.create(thankYouCanvasRef.current, { resize: true, useWorker: false });
                const colors = ['#0C4AD5', '#00EB3F', '#6E99EC', '#f5d78e', '#fff'];
                const fire = () => {
                    if (!myConfetti) return;
                    // Burst outward from the center of the screen — i.e. out of the card itself.
                    myConfetti({ particleCount: 90, spread: 360, startVelocity: 32, decay: 0.9, gravity: 0.9, origin: { x: 0.5, y: 0.5 }, colors, scalar: 1.1, ticks: 180 });
                };
                fire();
                interval = setInterval(fire, 800);
                // Ease off the bursts after a few seconds; overlay stays until dismissed.
                stopTimer = setTimeout(() => { if (interval) clearInterval(interval); }, 3000);
            } catch (_) {}
        })();
        return () => {
            alive = false;
            if (interval) clearInterval(interval);
            if (stopTimer) clearTimeout(stopTimer);
            try { myConfetti?.reset?.(); } catch (_) {}
        };
    }, [showThankYou]);
    const [donationModalFundraiser, setDonationModalFundraiser] = useState(null);
    const [donationStep, setDonationStep] = useState(1); // 1: select amount, 2: checkout
    const [donationFormData, setDonationFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        amount: 0
    });
    const [language, setLanguage] = useState(locale); // Use locale from URL
    const [currentStatIndex, setCurrentStatIndex] = useState(0); // For rotating stats in middle circle
    const [isTransitioning, setIsTransitioning] = useState(false); // For fade animation
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(false); // For add donation form
    const [selectedDonationFundraiserId, setSelectedDonationFundraiserId] = useState(null); // Fundraiser for donation
    const [initialDonationAmount, setInitialDonationAmount] = useState(null); // Initial amount for donation form
    const [showPromoVideo, setShowPromoVideo] = useState(false); // Floating promo video overlay
    const [promoVideoPlaying, setPromoVideoPlaying] = useState(false); // Whether video is playing
    const promoVideoRef = useRef(null);
    
    // Translations object
    const translations = {
        he: {
            donate: 'תרום',
            share: 'שתף',
            donors: 'תורמים',
            fundraisers: 'מתרימים',
            communities: 'קהילות',
            noCommunitiesYet: 'אין קהילות עדיין',
            fundraisersLabel: 'מתרימים',
            showFundraisers: 'הצג מתרימים',
            hideFundraisers: 'הסתר מתרימים',
            outOfGoal: 'מתוך יעד של',
            outOfMonthlyGoal: 'מתוך יעד חודשי של',
            originalGoal: 'היעד המקורי',
            additionalGoal: 'יעד בונוס',
            raisedSoFar: 'עד כה נתרם',
            perMonth: 'לחודש',
            timeToStart: 'זמן לתחילה',
            timeToEnd: 'זמן לסיום',
            ended: 'הסתיים',
            days: 'ימים',
            hours: 'שעות',
            minutes: 'דקות',
            seconds: 'שניות',
            liveUpdate: 'מתעדכן בזמן אמת',
            showMore: 'הצג עוד',
            donated: 'תרם',
            under: 'תחת',
            donations: 'תרומות',
            totalDonations: 'סה"כ תרומות',
            donateUnder: 'תרומה תחת',
            continueToPayment: 'המשך לתשלום',
            back: 'חזרה',
            completeDetails: 'השלמת פרטים',
            fillDetails: 'מלא את הפרטים שלך להשלמת התרומה',
            donationAmount: 'סכום התרומה',
            firstName: 'שם פרטי',
            lastName: 'שם משפחה',
            email: 'אימייל',
            phone: 'טלפון',
            required: '*',
            completeDonation: 'השלם תרומה',
            enterFirstName: 'הכנס שם פרטי',
            enterLastName: 'הכנס שם משפחה',
            searchFundraisers: 'חיפוש מתרימים...',
            sortBy: 'מיון לפי',
            amount: 'סכום',
            numberOfDonors: 'מספר תורמים',
            progress: 'התקדמות',
            target: 'יעד',
            about: 'אודות',
            oldest: 'ראשונים',
            highest: 'גבוהים',
            top: 'מובילים',
            noDonorsYet: 'אין תורמים עדיין',
            noFundraisersYet: 'אין מתרימים עדיין',
            noTopDonors: 'אין נתונים על תורמים מובילים',
            noRecentDonations: 'אין תרומות אחרונות',
            noData: 'אין נתונים להצגה',
            donateToFundraiser: 'תרום למתרים',
            goal: 'יעד',
            byDonors: 'לפי תורמים',
            noResultsFor: 'לא נמצאו תוצאות עבור',
            linkCopied: 'הקישור הועתק ללוח!',
            searchByName: 'חיפוש לפי שם...',
            clearSearch: 'נקה חיפוש',
            total: 'סה"כ',
            donationSuccess: 'תרומה נשלחה בהצלחה!',
            banner: 'בנר',
            via: 'דרך',
            mostRecent: 'הכי עדכני',
            oldest2: 'הכי ישן',
            high: 'גבוה',
            byAmount: 'לפי סכום',
            byProgress: 'לפי התקדמות',
            byTarget: 'לפי יעד',
            byFundraisers: 'לפי מתרימים',
            byLastDonation: 'לפי תרומה אחרונה',
            monthly: 'חודשי',
            showDonations: 'הצג תרומות',
            contactTitle: 'פרטי יצירת קשר',
            bankTransferTitle: 'פרטים להעברה בנקאית',
            bankName: 'בנק',
            bankBranch: 'סניף',
            bankAccount: 'חשבון',
            bankHolder: 'ע"ש',
            thankYouTitle: 'תודה!',
            thankYouLine1: 'תרומתך נקלטה בהצלחה',
            thankYouLine2: 'קבלה תישלח במייל בהמשך',
            thankYouClose: 'סגירה'
        },
        en: {
            donate: 'Donate',
            share: 'Share',
            donors: 'Donors',
            fundraisers: 'Fundraisers',
            communities: 'Communities',
            noCommunitiesYet: 'No communities yet',
            fundraisersLabel: 'Fundraisers',
            showFundraisers: 'Show fundraisers',
            hideFundraisers: 'Hide fundraisers',
            outOfGoal: 'out of a goal of',
            outOfMonthlyGoal: 'out of a monthly goal of',
            originalGoal: 'Original goal',
            additionalGoal: 'Bonus goal',
            raisedSoFar: 'Raised so far',
            perMonth: '/ month',
            timeToStart: 'Time to start',
            timeToEnd: 'Time to end',
            ended: 'Ended',
            days: 'Days',
            hours: 'Hours',
            minutes: 'Minutes',
            seconds: 'Seconds',
            liveUpdate: 'Live updates',
            showMore: 'Show more',
            donated: 'donated',
            under: 'under',
            donations: 'donations',
            totalDonations: 'Total donations',
            donateUnder: 'Donate under',
            continueToPayment: 'Continue to payment',
            back: 'Back',
            completeDetails: 'Complete details',
            fillDetails: 'Fill in your details to complete the donation',
            donationAmount: 'Donation amount',
            firstName: 'First name',
            lastName: 'Last name',
            email: 'Email',
            phone: 'Phone',
            required: '*',
            completeDonation: 'Complete donation',
            enterFirstName: 'Enter first name',
            enterLastName: 'Enter last name',
            searchFundraisers: 'Search fundraisers...',
            sortBy: 'Sort by',
            amount: 'Amount',
            numberOfDonors: 'Number of donors',
            progress: 'Progress',
            target: 'Target',
            about: 'About',
            oldest: 'Oldest',
            highest: 'Highest',
            top: 'Top',
            noDonorsYet: 'No donors yet',
            noFundraisersYet: 'No fundraisers yet',
            noTopDonors: 'No top donors data',
            noRecentDonations: 'No recent donations',
            noData: 'No data to display',
            donateToFundraiser: 'Donate to fundraiser',
            goal: 'Goal',
            byDonors: 'By donors',
            noResultsFor: 'No results for',
            linkCopied: 'Link copied to clipboard!',
            searchByName: 'Search by name...',
            clearSearch: 'Clear search',
            total: 'Total',
            donationSuccess: 'Donation submitted successfully!',
            banner: 'Banner',
            via: 'via',
            mostRecent: 'Most recent',
            oldest2: 'Oldest',
            high: 'High',
            byAmount: 'By amount',
            byProgress: 'By progress',
            byTarget: 'By target',
            byFundraisers: 'By fundraisers',
            byLastDonation: 'By last donation',
            monthly: 'Monthly',
            showDonations: 'Show donations',
            contactTitle: 'Contact details',
            bankTransferTitle: 'Bank transfer details',
            bankName: 'Bank',
            bankBranch: 'Branch',
            bankAccount: 'Account',
            bankHolder: 'Account holder',
            thankYouTitle: 'Thank you!',
            thankYouLine1: 'Your donation was received successfully',
            thankYouLine2: 'A receipt will be sent to your email shortly',
            thankYouClose: 'Close'
        }
    };
    
    const t = (key) => translations[locale][key] || key;
    
    // Refs for progress path animation
    const progressPathRef = useRef(null);
    const progressArrowRef = useRef(null);

    // Fetch initial campaign data with retry logic
    useEffect(() => {
        if (!campaignId) return;

        async function fetchData(retryCount = 0) {
            try {
                const response = await fetch(`/api/campaigns/${campaignId}/public-stats`);
                
                // If response is not OK and we haven't exceeded retries, try again
                if (!response.ok && retryCount < 2) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                    return fetchData(retryCount + 1);
                }
                
                const result = await response.json();

                if (result.success) {
                    setData(result.data);
                    // Set initial selected amount from first rank
                    if (!selectedAmount && result.data.ranks && result.data.ranks.length > 0) {
                        setSelectedAmount(result.data.ranks[0].amount);
                    }
                    setLoading(false);
                    setError(null); // Clear any previous errors
                } else {
                    // If first load failed, show error, otherwise silently continue
                    if (loading) {
                        setError(result.error || 'Failed to load campaign data');
                        setLoading(false);
                    }
                }
            } catch (err) {
                // If fetch fails and we haven't exceeded retries, try again
                if (retryCount < 2) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return fetchData(retryCount + 1);
                }
                console.error('Error fetching campaign data:', err);
                // Only show error on initial load
                if (loading) {
                    setError('Failed to load campaign data');
                    setLoading(false);
                }
            }
        }

        fetchData();
        
        // Refresh data every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [campaignId]);

    // The promo video no longer opens automatically — the visitor opens it via
    // the persistent PLAY button shown over the banners (see promoPlayButton).

    // Set default tab to 'about' when showDonationDetails is false
    useEffect(() => {
        if (!data || loading) return;

        if (data.showDonationDetails === false) {
            setActiveTab('about');
        }
    }, [data, loading]);

    // Track the donors grid columns count to enforce full rows
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updateColumns = () => {
            const w = window.innerWidth;
            if (w >= 1024) setColumnsCount(3);
            else if (w >= 768) setColumnsCount(2);
            else setColumnsCount(1);
        };
        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    // Round visibleCount down to full rows when more items exist beyond what's shown
    const getFullRowsCount = (totalLength) => {
        if (totalLength <= visibleCount) return totalLength;
        const fullRows = Math.floor(visibleCount / columnsCount) * columnsCount;
        return fullRows || columnsCount;
    };

    const loadMoreStep = () => columnsCount * 4;

    // Leaving the fundraiser detail view — also drop the ?fundraiser= param so the
    // URL effect doesn't re-select it on the next data refresh (poll / Pusher).
    const clearSelectedFundraiser = () => {
        setSelectedFundraiser(null);
        if (fundraiserId) router.replace(pathname, { scroll: false });
    };

    // Handle fundraiser from URL parameter
    useEffect(() => {
        if (!data || !data.fundraisers || !fundraiserId || loading) return;
        
        // If showDonationDetails is false, don't switch to fundraiser tab
        if (data.showDonationDetails === false) return;
        
        // Already showing the fundraiser from the URL — don't re-apply on every
        // data refresh (poll / Pusher), otherwise it resets the view and scroll.
        if (selectedFundraiser?.id === parseInt(fundraiserId)) return;

        // Find the fundraiser by ID
        const fundraiser = data.fundraisers?.find(f => f.id === parseInt(fundraiserId));

        if (fundraiser) {
            setActiveTab('fundraisers');
            // Save the complete fundraiser object
            setSelectedFundraiser(fundraiser);
        }
    }, [data, fundraiserId, loading, selectedFundraiser]);

    // Setup Pusher for real-time updates
    useEffect(() => {
        if (!campaignId) return;

        async function setupPusher() {
            try {
                const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
                if (!key) {
                    return;
                }

                const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';
                const PusherLib = (await import('pusher-js')).default;
                
                pusherRef.current = new PusherLib(key, {
                    cluster,
                    enabledTransports: ['ws', 'wss']
                });

                const channelName = `donation-screen.${campaignId}`;
                channelRef.current = pusherRef.current.subscribe(channelName);

                channelRef.current.bind('DonationScreen', (event) => {
                    // Refresh data when new donation arrives
                    fetch(`/api/campaigns/${campaignId}/public-stats`)
                        .then(res => res.json())
                        .then(result => {
                            if (result.success) {
                                setData(result.data);
                            }
                        })
                        .catch(err => console.error('Error refreshing data:', err));
                });

                return () => {
                    if (channelRef.current) {
                        channelRef.current.unbind('DonationScreen');
                        pusherRef.current?.unsubscribe(channelName);
                    }
                    if (pusherRef.current) {
                        pusherRef.current.disconnect();
                    }
                };
            } catch (err) {
                // Pusher setup failed - will use polling
            }
        }

        const cleanup = setupPusher();
        return () => {
            if (cleanup && typeof cleanup.then === 'function') {
                cleanup.then(fn => fn && fn());
            }
        };
    }, [campaignId]);

    // Banner rotation effect - change every 10 seconds
    useEffect(() => {
        if (!data?.publicScreenBanners || data.publicScreenBanners.length <= 1) {
            return; // No rotation needed for 0 or 1 banner
        }

        const interval = setInterval(() => {
            setPreviousBannerIndex(currentBannerIndex);
            setIsSliding(true);
            setCurrentBannerIndex((prev) => 
                (prev + 1) % data.publicScreenBanners.length
            );
            // Reset sliding state after animation completes
            setTimeout(() => {
                setIsSliding(false);
                setPreviousBannerIndex(null);
            }, 600);
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [data?.publicScreenBanners, currentBannerIndex]);

    // Timer countdown effect - update every second
    useEffect(() => {
        const calculateTimeRemaining = () => {
            const now = new Date();
            const startDate = data?.publicScreenStartDate ? new Date(data.publicScreenStartDate) : null;
            const endDate = data?.publicScreenEndDate ? new Date(data.publicScreenEndDate) : null;

            // No dates configured
            if (!startDate && !endDate) {
                setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, status: 'no-dates' });
                return;
            }

            // Campaign hasn't started yet
            if (startDate && now < startDate) {
                const diff = startDate - now;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeRemaining({ days, hours, minutes, seconds, status: 'before-start' });
                return;
            }

            // Campaign is ongoing
            if (endDate && now < endDate) {
                const diff = endDate - now;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeRemaining({ days, hours, minutes, seconds, status: 'ongoing' });
                return;
            }

            // Campaign has ended
            setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, status: 'ended' });
        };

        calculateTimeRemaining();
        const interval = setInterval(calculateTimeRemaining, 1000);

        return () => clearInterval(interval);
    }, [data?.publicScreenStartDate, data?.publicScreenEndDate]);

    // Rotate stats every 7 seconds with fade transition. We currently expose 3 stats.
    useEffect(() => {
        if (!data) return;
        const totalStats = 3;

        const interval = setInterval(() => {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentStatIndex((prev) => (prev + 1) % totalStats);
                setIsTransitioning(false);
            }, 400);
        }, 7000);

        return () => clearInterval(interval);
    }, [data]);

    // Animate progress path
    useEffect(() => {
        if (!progressPathRef.current || !data) return;

        const path = progressPathRef.current;
        const arrow = progressArrowRef.current;
        
        const percent = Math.min(
            Math.round((data.statistics.totalCollected / data.statistics.targetAmount) * 100),
            100
        );

        const length = path.getTotalLength();

        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;

        // Force reflow
        path.getBoundingClientRect();

        const visible = length * (percent / 100);
        path.style.transition = "stroke-dashoffset 1.6s cubic-bezier(0.4, 0, 0.2, 1)";
        path.style.strokeDashoffset = `${length - visible}`;

        if (arrow) {
            arrow.style.transition = "opacity 0.4s ease";
            arrow.style.opacity = percent > 0 ? "1" : "0";
        }
    }, [data?.statistics?.totalCollected, data?.statistics?.targetAmount]);

    const formatCurrency = (value) => {
        const currencyFromDB = data?.campaign?.currency || 'ILS';
        
        // Convert currency symbol to currency code
        const currencyMap = {
            '₪': 'ILS',
            '$': 'USD',
            '€': 'EUR',
            '£': 'GBP',
            'ILS': 'ILS',
            'USD': 'USD',
            'EUR': 'EUR',
            'GBP': 'GBP'
        };
        
        const currency = currencyMap[currencyFromDB] || currencyFromDB || 'ILS';
        
        // Get currency symbol
        const symbolMap = {
            'ILS': '₪',
            'USD': '$',
            'EUR': '€',
            'GBP': '£'
        };
        const symbol = symbolMap[currency] || currency;
        
        // Format number with commas and put symbol on LEFT with space
        // Allow up to 2 decimals so divided values (e.g. one-time / months) display correctly
        const numericValue = Number(value) || 0;
        const hasFraction = Math.abs(numericValue - Math.trunc(numericValue)) > 0.0001;
        const formattedNumber = new Intl.NumberFormat('he-IL', {
            minimumFractionDigits: hasFraction ? 2 : 0,
            maximumFractionDigits: hasFraction ? 2 : 0
        }).format(numericValue);

        // Wrap with Unicode LRI/PDI so the symbol stays visually to the LEFT of the number even in RTL contexts
        return `⁦${symbol} ${formattedNumber}⁩`;
    };

    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('he-IL');
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <DoNextLoader />
                    <span>טוען נתוני קמפיין...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>{error}</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>לא נמצאו נתוני קמפיין</div>
            </div>
        );
    }

    const { campaign, statistics, settings, recentDonations, topDonors, ranks, publicScreenRanks, fundraisers, communities, publicScreenAbout, showDonationDetails } = data;
    const hasCommunities = Array.isArray(communities) && communities.length > 0;

    // "Unit mode": instead of showing the raised amount of money, show how many units
    // (e.g. meters, bricks) were raised. unitPrice converts money <-> units; the goal in
    // units is derived from the money goal ÷ unitPrice (percentage is identical either way).
    const unitPrice = Number(settings?.unitPrice) || 0;
    const unitMode = !!settings?.unitMode && unitPrice > 0;
    const unitLabelSingular = settings?.unitLabel || '';
    const unitLabelPlural = settings?.unitLabelPlural || settings?.unitLabel || '';
    const formatUnits = (moneyValue) => {
        if (!unitPrice) return '';
        const units = (Number(moneyValue) || 0) / unitPrice;
        // Round to nearest whole unit, but keep one decimal when it isn't whole
        const rounded = Math.round(units * 10) / 10;
        const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.05;
        const display = isWhole ? Math.round(rounded) : rounded;
        const num = new Intl.NumberFormat('he-IL').format(display);
        const label = display === 1 ? unitLabelSingular : unitLabelPlural;
        return label ? `${num} ${label}` : num;
    };
    // In unit mode raised/goal amounts are shown as units; otherwise as formatted currency.
    // Used for the donor / fundraiser / top-donor cards.
    // Amounts below a single unit fall back to currency so cards never show a fraction of a unit.
    const formatAmount = (moneyValue) => {
        if (!unitMode) return formatCurrency(moneyValue);
        const units = (Number(moneyValue) || 0) / unitPrice;
        return units >= 1 ? formatUnits(moneyValue) : formatCurrency(moneyValue);
    };
    // The main progress gauge ("raised so far" + goal) can opt out of units and show
    // money even while unit mode is on (settings.unitGaugeInMoney), leaving the cards in units.
    // Gauge amounts are rounded to whole shekels - no agorot on the main gauge.
    const gaugeInMoney = unitMode && !!settings?.unitGaugeInMoney;
    const formatGaugeAmount = (moneyValue) => {
        const wholeValue = Math.round(Number(moneyValue) || 0);
        return gaugeInMoney ? formatCurrency(wholeValue) : formatAmount(wholeValue);
    };

    // When a monthly campaign is displayed in monthly units (monthsCalculation === 1), every amount on the page
    // represents a monthly figure. We append "לחודש" next to amounts so it stays unambiguous for viewers.
    const isMonthlyUnitMode = campaign?.donationType === 'monthly' && (statistics.monthsCalculation || 1) === 1;
    // יעד הבונוס הוא תוספת מעבר ליעד המקורי. אחרי שהקמפיין עובר 100% מהיעד המקורי,
    // העיגול עובר לתצוגת בונוס קבועה: האחוז הגדול נשאר מול היעד המקורי, ומתחת לסכום
    // מוצגים היעד המקורי (ללא אחוז) וסכום יעד הבונוס עצמו. מילוי הנוזל עובר לסקאלת
    // היעד המורחב (מקורי + בונוס) כדי לשקף את הדרך שנותרה ליעד הנוסף.
    const bonusTargetAmount = Number(statistics.bonusTargetAmount) || 0;
    const bonusGoalEnabled = !!(settings?.bonusGoalEnabled && bonusTargetAmount > 0);
    const bonusExtendedTarget = (statistics.targetAmount || 0) + bonusTargetAmount;
    const bonusPercentage = bonusExtendedTarget > 0 ? (statistics.totalCollected / bonusExtendedTarget) * 100 : 0;
    const gaugeShowsBonus = bonusGoalEnabled && (statistics.progressPercentage || 0) >= 100;
    // progressPercent for visual fill (capped at 100 for the wave)
    const progressPercent = Math.min(gaugeShowsBonus ? bonusPercentage : statistics.progressPercentage, 100);
    // Display percentage - can be above 100%
    const displayPercent = statistics.progressPercentage;

    // קונפטי עדין סביב עיגול היעד אחרי הגעה ל-100%. החלקיקים מפוזרים סביב טבעת
    // העיגול בעזרת נוסחאות דטרמיניסטיות לפי אינדקס (ולא Math.random) כדי שהפיזור
    // יהיה יציב בין רינדורים ולא יקפוץ בכל רענון נתונים.
    // כשיעד בונוס מופעל - הקונפטי מופיע רק אחרי הגעה ליעד הבונוס (היעד המורחב).
    const goalReached = bonusGoalEnabled
        ? bonusExtendedTarget > 0 && statistics.totalCollected >= bonusExtendedTarget
        : statistics.progressPercentage >= 100;
    const confettiColors = ['#f59e0b', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'];
    const confettiPieces = goalReached ? Array.from({ length: 28 }, (_, i) => {
        const angle = ((i * 360) / 28 + ((i * 47) % 14) - 7) * (Math.PI / 180);
        const radius = 45 + ((i * 29) % 9); // % מהמרכז - מעט מחוץ לטבעת העיגול
        return {
            left: 50 + radius * Math.cos(angle),
            top: 50 + radius * Math.sin(angle),
            size: 6 + ((i * 13) % 5),
            delay: ((i * 37) % 32) / 10,
            duration: 2.8 + ((i * 17) % 16) / 10,
            driftX: ((i * 11) % 13) - 6,
            maxOpacity: 0.55 + (((i * 7) % 3) / 10),
            color: confettiColors[i % confettiColors.length],
            round: i % 3 === 0
        };
    }) : [];

    // Gauge display option: show only the raised amount (no percentage, no "out of goal" line)
    const gaugeRaisedOnly = !!settings?.gaugeRaisedOnly;
    // Layout option: hide the time + statistics circles, leaving only the progress gauge
    const showOnlyProgressCircle = !!settings?.showOnlyProgressCircle;
    
    // Function to convert Google Drive URL to direct image URL
    const convertGoogleDriveUrl = (url) => {
        if (!url || !url.includes('drive.google.com')) {
            return url;
        }
        
        // Extract file ID from various Google Drive URL formats
        let fileId = null;
        
        // Format: https://drive.google.com/file/d/FILE_ID/view
        const match1 = url.match(/\/file\/d\/([^\/]+)/);
        if (match1) {
            fileId = match1[1];
        }
        
        // Format: https://drive.google.com/open?id=FILE_ID
        const match2 = url.match(/[?&]id=([^&]+)/);
        if (match2) {
            fileId = match2[1];
        }
        
        // Already has file ID in uc format
        const match3 = url.match(/[?&]id=([^&]+)/);
        if (match3) {
            fileId = match3[1];
        }
        
        // If already in direct format, return as is
        if (url.includes('/uc?export=view') || url.includes('/uc?id=')) {
            // Extract ID from the URL
            const idMatch = url.match(/[?&]id=([^&]+)/);
            if (idMatch) {
                fileId = idMatch[1];
            }
        }
        
        // Convert to high quality direct URL using thumbnail endpoint with large size
        if (fileId) {
            // Use thumbnail with sz=w2000 for high quality image display
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
        }
        
        return url;
    };
    
    // Use publicScreenRanks if available (with images), otherwise use campaign ranks or fallback
    let donationAmounts = publicScreenRanks && publicScreenRanks.length > 0
        ? publicScreenRanks // Use custom public screen ranks with images (all of them)
        : ranks && ranks.length > 0 
            ? ranks.slice(0, 7) // Use campaign ranks (limit to 7)
            : [{ name: '₪18', amount: 18 }, { name: '₪36', amount: 36 }, { name: '₪54', amount: 54 }]; // Fallback
    
    // Convert Google Drive URLs in donation amounts
    // Note: ranks may have image stored as "icon" (from additional-settings) or "image"
    donationAmounts = donationAmounts.map(rank => ({
        ...rank,
        image: rank.icon ? convertGoogleDriveUrl(rank.icon) : (rank.image ? convertGoogleDriveUrl(rank.image) : null)
    }));

    // Function to get relative time with language support
    const getRelativeTime = (dateString) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffHours < 1) {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            if (language === 'he') {
                return diffMinutes <= 1 ? 'לפני דקה' : `לפני ${diffMinutes} דקות`;
            } else {
                return diffMinutes <= 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
            }
        } else if (diffHours < 24) {
            if (language === 'he') {
                return diffHours === 1 ? 'לפני שעה' : `לפני ${diffHours} שעות`;
            } else {
                return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
            }
        }
        return null; // Don't show time for donations older than 24 hours
    };

    // Function to get initials from name
    const getInitials = (firstName, lastName) => {
        const first = firstName?.charAt(0)?.toUpperCase() || '';
        const last = lastName?.charAt(0)?.toUpperCase() || '';
        return (first + last) || 'א';
    };

    // Inline SVG icons used in the middle stats circle - stroke uses currentColor so they pick up the accent
    const SVG_ICONS = {
        cash: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                <rect x="2.5" y="6" width="19" height="12" rx="2" />
                <circle cx="12" cy="12" r="2.6" />
                <path d="M6 9.5h.01M18 14.5h.01" />
            </svg>
        ),
        clock: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15.5 14" />
            </svg>
        ),
        trendingUp: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                <polyline points="3 17 9 11 13 15 21 7" />
                <polyline points="15 7 21 7 21 13" />
            </svg>
        )
    };

    // Calculate dynamic statistics for middle circle
    const calculateDynamicStats = () => {
        if (!data || !recentDonations) return [];

        const stats = [];
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Filter donations made today (local time)
        const donationsToday = recentDonations.filter(d => {
            if (!d.createdAt) return false;
            return new Date(d.createdAt) >= startOfToday;
        });

        const raisedToday = donationsToday.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
        const targetAmount = Number(data?.statistics?.targetAmount) || 0;
        const donationsTodayCount = donationsToday.length;

        // ---- 1. תרומות היום (Number of donations made today) ----
        stats.push({
            title: language === 'he' ? 'תרומות היום' : 'Donations today',
            value: donationsTodayCount > 0
                ? new Intl.NumberFormat('he-IL').format(donationsTodayCount)
                : (language === 'he' ? 'אין עדיין' : 'None yet'),
            icon: SVG_ICONS.cash
        });

        // ---- 2. תרומה אחרונה (Last donation, relative time) ----
        if (recentDonations.length > 0) {
            const last = recentDonations[0];
            const lastDate = new Date(last.createdAt);
            const diffMs = now - lastDate;
            const minutes = Math.floor(diffMs / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            let value;
            if (language === 'he') {
                if (minutes < 1) value = 'הרגע';
                else if (minutes < 60) value = minutes === 1 ? 'לפני דקה' : `לפני ${minutes} דקות`;
                else if (hours < 24) value = hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`;
                else value = days === 1 ? 'לפני יום' : `לפני ${days} ימים`;
            } else {
                if (minutes < 1) value = 'Just now';
                else if (minutes < 60) value = minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
                else if (hours < 24) value = hours === 1 ? '1 hour ago' : `${hours} hours ago`;
                else value = days === 1 ? '1 day ago' : `${days} days ago`;
            }

            stats.push({
                title: language === 'he' ? 'תרומה אחרונה' : 'Last donation',
                value,
                icon: SVG_ICONS.clock
            });
        } else {
            stats.push({
                title: language === 'he' ? 'תרומה אחרונה' : 'Last donation',
                value: language === 'he' ? 'אין עדיין' : 'None yet',
                icon: SVG_ICONS.clock
            });
        }

        // ---- 3. קצב התקדמות (Today's contribution to goal, in %) ----
        const percentToday = targetAmount > 0 ? (raisedToday / targetAmount) * 100 : 0;
        const formattedPercent = percentToday >= 10
            ? Math.round(percentToday).toString()
            : (percentToday > 0 ? percentToday.toFixed(2).replace(/\.?0+$/, '') : '0');

        stats.push({
            title: language === 'he' ? 'קצב התקדמות' : 'Progress rate',
            value: targetAmount > 0
                ? (percentToday > 0
                    ? `${formattedPercent}% ${language === 'he' ? 'היום' : 'today'}`
                    : (language === 'he' ? 'אין תרומות היום' : 'No donations today'))
                : (language === 'he' ? 'ללא יעד' : 'No goal set'),
            icon: SVG_ICONS.trendingUp
        });

        return stats;
    };

    const dynamicStats = calculateDynamicStats();

    // Get data based on active tab
    const getTabContent = () => {
        switch (activeTab) {
            case 'donors':
                // All donors with donations - filter only those who donated
                return {
                    data: recentDonations?.filter(donation => donation.totalAmount > 0).map((donation, index) => ({
                        id: donation.id || index,
                        donorName: donation.donorName,
                        donorFirstName: donation.donorFirstName,
                        donorLastName: donation.donorLastName,
                        isAnonymous: donation.isAnonymous,
                        amount: donation.monthlyAmount || donation.amount,
                        monthlyAmount: donation.monthlyAmount || donation.amount,
                        numberOfPayments: donation.numberOfPayments || 1,
                        totalAmount: donation.totalAmount,
                        fundraiserName: donation.fundraiserName,
                        createdAt: donation.createdAt,
                        dedication: donation.dedication,
                        type: 'donation'
                    })) || [],
                    emptyMessage: t('noDonorsYet')
                };
            case 'fundraisers':
                // All fundraisers with their statistics (show all fundraisers, even without donations)
                return {
                    data: fundraisers?.map((fundraiser, index) => {
                        // Find the most recent donation from all donors
                        const lastDonation = fundraiser.donors?.reduce((latest, donor) => {
                            if (!donor.lastDonation) return latest;
                            if (!latest) return donor.lastDonation;
                            return new Date(donor.lastDonation) > new Date(latest) ? donor.lastDonation : latest;
                        }, null);
                        
                        return {
                            id: fundraiser.id,
                            fundraiserName: fundraiser.name,
                            totalRaised: fundraiser.totalRaised,
                            monthlyRaised: fundraiser.monthlyRaised,
                            targetAmount: fundraiser.targetAmount || 0,
                            donorCount: fundraiser.donorCount,
                            donors: fundraiser.donors,
                            lastDonationDate: lastDonation,
                            type: 'fundraiser'
                        };
                    }) || [],
                    emptyMessage: t('noFundraisersYet')
                };
            case 'communities':
                // All communities (operators / מפעילים) with aggregated statistics
                return {
                    data: (communities || []).map((community) => ({
                        id: community.id,
                        communityName: community.name,
                        totalRaised: community.totalRaised,
                        monthlyRaised: community.monthlyRaised,
                        targetAmount: community.targetAmount || 0,
                        donorCount: community.donorCount,
                        fundraiserCount: community.fundraiserCount,
                        members: community.members || [],
                        type: 'community'
                    })),
                    emptyMessage: t('noCommunitiesYet')
                };
            case 'top':
                // Top donors
                return {
                    data: topDonors?.map((donor, index) => ({
                        id: donor.id,
                        donorName: donor.donorName || `${donor.firstName} ${donor.lastName}`.trim(),
                        donorFirstName: donor.firstName,
                        donorLastName: donor.lastName,
                        amount: donor.monthlyAmount || donor.totalAmount,
                        monthlyAmount: donor.monthlyAmount || donor.totalAmount,
                        numberOfPayments: donor.numberOfPayments || 1,
                        totalAmount: donor.totalAmount,
                        rank: index + 1,
                        isAnonymous: donor.isAnonymous || false,
                        type: 'top'
                    })) || [],
                    emptyMessage: t('noTopDonors')
                };
            case 'about':
                // About campaign - display publicScreenAbout text
                return {
                    data: [],
                    aboutText: publicScreenAbout || '',
                    emptyMessage: ''
                };
            default:
                return { data: [], emptyMessage: t('noData') };
        }
    };

    const tabContent = getTabContent();
    
    // Sort function
    const sortData = (data) => {
        // If we're in donors tab and not viewing a specific fundraiser, use donor sorting
        if (activeTab === 'donors' && !selectedFundraiser) {
            const sorted = [...data];
            switch (sortBy) {
                case 'recent':
                    return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                case 'oldest':
                    return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                case 'highest':
                    // Sort by the amount actually shown on the card (totalAmount), so the
                    // visible order matches — `amount` is only the monthly figure and
                    // diverges from the displayed total in unit / mixed-donation modes.
                    return sorted.sort((a, b) => (b.totalAmount ?? b.amount ?? 0) - (a.totalAmount ?? a.amount ?? 0));
                default:
                    return sorted;
            }
        }

        // If we're in fundraisers tab and not viewing a specific fundraiser, use fundraiser sorting
        if (activeTab === 'fundraisers' && !selectedFundraiser) {
            const sorted = [...data];
            switch (fundraiserSortBy) {
                case 'amount':
                    return sorted.sort((a, b) => (b.totalRaised || 0) - (a.totalRaised || 0));
                case 'donors':
                    return sorted.sort((a, b) => (b.donorCount || 0) - (a.donorCount || 0));
                case 'progress':
                    return sorted.sort((a, b) => {
                        const progressA = a.targetAmount > 0 ? (a.totalRaised / a.targetAmount) * 100 : 0;
                        const progressB = b.targetAmount > 0 ? (b.totalRaised / b.targetAmount) * 100 : 0;
                        return progressB - progressA;
                    });
                case 'target':
                    return sorted.sort((a, b) => (b.targetAmount || 0) - (a.targetAmount || 0));
                case 'lastDonation':
                    return sorted.sort((a, b) => {
                        if (!a.lastDonationDate && !b.lastDonationDate) return 0;
                        if (!a.lastDonationDate) return 1;
                        if (!b.lastDonationDate) return -1;
                        return new Date(b.lastDonationDate) - new Date(a.lastDonationDate);
                    });
                default:
                    return sorted;
            }
        }
        
        // Communities tab: sort operators by the selected criterion
        if (activeTab === 'communities') {
            const sorted = [...data];
            switch (communitySortBy) {
                case 'amount':
                    return sorted.sort((a, b) => (b.totalRaised || 0) - (a.totalRaised || 0));
                case 'donors':
                    return sorted.sort((a, b) => (b.donorCount || 0) - (a.donorCount || 0));
                case 'fundraisers':
                    return sorted.sort((a, b) => (b.fundraiserCount || 0) - (a.fundraiserCount || 0));
                case 'progress':
                    return sorted.sort((a, b) => {
                        const progressA = a.targetAmount > 0 ? (a.totalRaised / a.targetAmount) * 100 : 0;
                        const progressB = b.targetAmount > 0 ? (b.totalRaised / b.targetAmount) * 100 : 0;
                        return progressB - progressA;
                    });
                case 'target':
                    return sorted.sort((a, b) => (b.targetAmount || 0) - (a.targetAmount || 0));
                default:
                    return sorted;
            }
        }

        return data;
    };

    // Filter data based on search term
    const filteredData = searchTerm
        ? tabContent.data.filter(item => {
            if (item.type === 'community') {
                const communityName = item.communityName || '';
                return communityName.toLowerCase().includes(searchTerm.toLowerCase());
            }
            if (item.type === 'fundraiser') {
                const fundraiserName = item.fundraiserName || '';
                const searchLower = searchTerm.toLowerCase();
                return fundraiserName.toLowerCase().includes(searchLower);
            }
            const fullName = item.donorName || '';
            const searchLower = searchTerm.toLowerCase();
            return fullName.toLowerCase().includes(searchLower);
        })
        : tabContent.data;
    
    // Apply sorting
    const sortedAndFilteredData = sortData(filteredData);

    // Persistent PLAY button shown over the banners/hero when a promo video exists.
    // Clicking it opens the video overlay and starts playback (no auto-popup).
    const promoPlayButton = data?.promoVideoUrl ? (
        <button
            className={styles.promoPlayFab}
            onClick={() => {
                setPromoVideoPlaying(true);
                setShowPromoVideo(true);
            }}
            aria-label={locale === 'he' ? 'הפעל סרטון' : 'Play video'}
        >
            <svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
            </svg>
        </button>
    ) : null;

    return (
        <div className={`${styles.container} ${styles.withSiteHeader}`} style={{ direction: locale === 'he' ? 'rtl' : 'ltr' }}>
            {/* Fixed DONEXT marketing header (links deep-link to the landing page sections) */}
            <SiteHeader logos={data?.publicScreenHeaderLogos || []} />

            {/* Language Toggle Button - Floating Round Button */}
            <button 
                className={`${styles.languageToggle} ${locale === 'he' ? styles.languageToggleRtl : styles.languageToggleLtr}`}
                onClick={() => {
                    const newLocale = locale === 'he' ? 'en' : 'he';
                    const newPath = pathname.replace(`/${locale}/`, `/${newLocale}/`);
                    router.push(newPath);
                }}
                title={locale === 'he' ? 'Switch to English' : 'החלף לעברית'}
                aria-label={locale === 'he' ? 'Switch to English' : 'החלף לעברית'}
            >
                <svg 
                    style={{ width: '22px', height: '22px' }}
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
            </button>

            {/* Promo Video Overlay */}
            {showPromoVideo && data?.promoVideoUrl && (
                <div className={styles.promoVideoOverlay}>
                    <div className={styles.promoVideoBox}>
                        <button
                            className={styles.promoVideoClose}
                            onClick={() => {
                                setShowPromoVideo(false);
                                if (promoVideoRef.current) promoVideoRef.current.pause();
                            }}
                            aria-label="סגור סרטון"
                        >
                            ✕
                        </button>
                        {!promoVideoPlaying ? (
                            <div className={styles.promoVideoThumbnail}>
                                <video
                                    ref={promoVideoRef}
                                    src={data.promoVideoUrl}
                                    className={styles.promoVideoEl}
                                    preload="metadata"
                                />
                                <button
                                    className={styles.promoVideoPlayBtn}
                                    onClick={() => {
                                        setPromoVideoPlaying(true);
                                        setTimeout(() => promoVideoRef.current?.play(), 50);
                                    }}
                                    aria-label="הפעל סרטון"
                                >
                                    ▶
                                </button>
                            </div>
                        ) : (
                            <video
                                ref={promoVideoRef}
                                src={data.promoVideoUrl}
                                className={styles.promoVideoEl}
                                controls
                                autoPlay
                                onEnded={() => setPromoVideoPlaying(false)}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Banner Section - replaces Hero when banners exist */}
            {data.publicScreenBanners && data.publicScreenBanners.length > 0 ? (
                <div className={styles.bannerSection}>
                    {/* Previous banner (sliding out) */}
                    {isSliding && previousBannerIndex !== null && (
                        <img 
                            src={convertGoogleDriveUrl(data.publicScreenBanners[previousBannerIndex])}
                            alt={`${t('banner')} ${previousBannerIndex + 1}`}
                            className={`${styles.bannerImage} ${styles.bannerImageOut}`}
                        />
                    )}
                    {/* Current banner (sliding in) */}
                    <img 
                        src={convertGoogleDriveUrl(data.publicScreenBanners[currentBannerIndex])}
                        alt={`${t('banner')} ${currentBannerIndex + 1}`}
                        className={`${styles.bannerImage} ${isSliding ? styles.bannerImageIn : ''}`}
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                        onLoad={(e) => {
                            e.target.style.display = 'block';
                        }}
                    />
                    {promoPlayButton}
                </div>
            ) : (
                /* Hero Section - only shows when no banners */
                <div className={styles.hero}>
                    {promoPlayButton}
                    <div className={styles.heroOverlay}>
                        <div className={styles.heroContent}>
                            {campaign.logo && (
                                <img 
                                    src={campaign.logo} 
                                    alt={campaign.name} 
                                    className={styles.heroLogo}
                                />
                            )}
                            <h1 className={styles.heroTitle}>{campaign.name}</h1>
                            {campaign.description && (
                                <p className={styles.heroSubtitle}>{campaign.description}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Donation Amounts Bar */}
            <div 
                className={styles.quickAmountsBar}
                style={{
                    background: data?.publicScreenRanksBackgroundColor || '#b45309'
                }}
            >
                {donationAmounts.map((rank, index) => {
                    return (
                    <button
                        key={rank.id || rank.amount || index}
                        onClick={() => {
                            setSelectedDonationFundraiserId(selectedFundraiser?.id ?? null);
                            setInitialDonationAmount(rank.amount);
                            setIsDonationFormOpen(true);
                        }}
                        className={`${styles.quickAmountBtn} ${selectedAmount === rank.amount ? styles.quickAmountBtnActive : ''}`}
                        style={rank.colorLeft && rank.colorRight ? {
                            background: selectedAmount === rank.amount 
                                ? 'white' 
                                : `linear-gradient(135deg, ${rank.colorLeft} 0%, ${rank.colorRight} 100%)`
                        } : {}}
                    >
                        {rank.image ? (
                            // If rank has an image, display it
                            <img 
                                src={convertGoogleDriveUrl(rank.image)} 
                                alt={rank.name}
                                className={styles.quickAmountImage}
                                onLoad={(e) => {
                                }}
                                onError={(e) => {
                                    // Fallback to text if image fails to load
                                    e.target.style.display = 'none';
                                    const textDiv = e.target.parentElement.querySelector('.' + styles.quickAmountText);
                                    if (textDiv) textDiv.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div 
                            className={styles.quickAmountText}
                            style={{ display: rank.image ? 'none' : 'flex', flexDirection: 'column', gap: '0.125rem' }}
                        >
                            <div className={styles.quickAmountLabel}>{rank.name}</div>
                            <div className={styles.quickAmountValue}>{formatCurrency(rank.amount)}</div>
                        </div>
                    </button>
                    );
                })}
            </div>

            {/* Main Stats Section */}
            <section className={styles.statsSection}>
                <div className={styles.mainStatsCard}>
                    <div className={styles.statsContainer}>
                        {/* Progress Display - Right Side */}
                        <div className={styles.progressSection}>
                            {settings.hasGoal && statistics.targetAmount > 0 ? (
                                <div className={styles.liquidGaugeContainer}>
                                    {/* Liquid Fill Gauge */}
                                    <div className={styles.liquidGauge}>
                                        {/* Subtle breathing glow behind the gauge */}
                                        <div
                                            className={styles.circleAmbient}
                                            style={{ '--ambient-color': data?.publicScreenRanksBackgroundColor || '#b45309' }}
                                            aria-hidden="true"
                                        />
                                        {goalReached && (
                                            <div className={styles.goalConfetti} aria-hidden="true">
                                                {confettiPieces.map((p, i) => (
                                                    <span
                                                        key={i}
                                                        className={styles.confettiPiece}
                                                        style={{
                                                            left: `${p.left}%`,
                                                            top: `${p.top}%`,
                                                            '--size': `${p.size}px`,
                                                            '--delay': `${p.delay}s`,
                                                            '--duration': `${p.duration}s`,
                                                            '--drift-x': `${p.driftX}px`,
                                                            '--max-opacity': p.maxOpacity,
                                                            '--confetti-color': p.color,
                                                            borderRadius: p.round ? '50%' : '1px'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <svg viewBox="0 0 200 200" className={styles.gaugeSvg}>
                                            <defs>
                                                {/* Clip path for circle */}
                                                <clipPath id="circleClip">
                                                    <circle cx="100" cy="100" r="85" />
                                                </clipPath>
                                                
                                                {/* Gradient for liquid - lighter version of the color */}
                                                <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor={data?.publicScreenRanksBackgroundColor || '#b45309'} stopOpacity="0.25" />
                                                    <stop offset="100%" stopColor={data?.publicScreenRanksBackgroundColor || '#b45309'} stopOpacity="0.4" />
                                                </linearGradient>
                                            </defs>
                                            
                                            {/* Circle outline */}
                                            <circle
                                                cx="100"
                                                cy="100"
                                                r="85"
                                                fill="none"
                                                stroke={data?.publicScreenRanksBackgroundColor || '#b45309'}
                                                strokeWidth="10"
                                            />
                                            
                                            {/* Wave effect only - clipped to circle */}
                                            <g clipPath="url(#circleClip)">
                                                <path
                                                    d={`M -50 ${185 - (progressPercent * 1.7)} Q -25 ${180 - (progressPercent * 1.7)}, 0 ${185 - (progressPercent * 1.7)} T 50 ${185 - (progressPercent * 1.7)} T 100 ${185 - (progressPercent * 1.7)} T 150 ${185 - (progressPercent * 1.7)} T 200 ${185 - (progressPercent * 1.7)} T 250 ${185 - (progressPercent * 1.7)} V 250 H -50 Z`}
                                                    fill="url(#liquidGradient)"
                                                    className={styles.wave}
                                                />
                                            </g>
                                        </svg>
                                        
                                        {/* Text overlay - keyed by view so switching to/from the bonus goal fades in */}
                                        <div className={styles.gaugeContent} key={gaugeShowsBonus ? 'bonus' : 'main'}>
                                            {/* When "raised only" is set we drop the percentage and the goal line,
                                                showing a "raised so far" label above just the raised amount. */}
                                            {gaugeRaisedOnly ? (
                                                <div className={styles.gaugeTarget}>
                                                    {t('raisedSoFar')}
                                                </div>
                                            ) : (
                                                <div className={styles.gaugePercent}>
                                                    {displayPercent.toFixed(0)}%
                                                </div>
                                            )}
                                            <div className={styles.gaugeAmount}>
                                                <OdometerNumber value={formatGaugeAmount(statistics.totalCollected)} />
                                            </div>
                                            {!gaugeRaisedOnly && (gaugeShowsBonus ? (
                                                <>
                                                    <div className={styles.gaugeTarget}>
                                                        {t('originalGoal')} {formatGaugeAmount(statistics.targetAmount)}
                                                    </div>
                                                    <div className={`${styles.gaugeTarget} ${styles.bonusExtendedTarget}`}>
                                                        {t('additionalGoal')} {formatGaugeAmount(bonusTargetAmount)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className={styles.gaugeTarget}>
                                                    {campaign?.donationType === 'monthly' && (statistics.monthsCalculation || 1) === 1
                                                        ? t('outOfMonthlyGoal')
                                                        : t('outOfGoal')} {formatGaugeAmount(statistics.targetAmount)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // No goal
                                <div className={styles.liquidGaugeContainer}>
                                    <div className={styles.gaugeTarget}>
                                        {t('raisedSoFar')}
                                    </div>
                                    <div className={styles.gaugeAmount}>
                                        <OdometerNumber value={formatGaugeAmount(statistics.totalCollected)} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Middle Circle - Dynamic Stats */}
                        {!showOnlyProgressCircle && dynamicStats.length > 0 && (() => {
                            const accent = data?.publicScreenRanksBackgroundColor || '#b45309';
                            const activeStat = dynamicStats[currentStatIndex] || dynamicStats[0];
                            return (
                                <div className={styles.middleStatsSection}>
                                    <div
                                        className={styles.middleStatsCircle}
                                        style={{
                                            '--accent': accent,
                                            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), rgba(255,255,255,0.65) 50%, ${accent}1f 100%)`,
                                            borderColor: `${accent}33`
                                        }}
                                    >
                                        <div className={styles.middleStatsGlow} style={{ background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)` }} />

                                        <div
                                            className={styles.middleStatsContent}
                                            key={currentStatIndex}
                                            style={{ opacity: isTransitioning ? 0 : 1 }}
                                        >
                                            <div className={styles.middleStatsIconWrap} style={{ background: `${accent}1a`, color: accent }}>
                                                <span className={styles.middleStatsIcon}>{activeStat?.icon}</span>
                                            </div>
                                            <div className={styles.middleStatsTitle}>{activeStat?.title}</div>
                                            <div className={styles.middleStatsValue} style={{ color: accent }}>{activeStat?.value}</div>
                                        </div>

                                        <div className={styles.middleStatsDots}>
                                            {dynamicStats.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    aria-label={`stat ${idx + 1}`}
                                                    onClick={() => {
                                                        if (idx === currentStatIndex) return;
                                                        setIsTransitioning(true);
                                                        setTimeout(() => {
                                                            setCurrentStatIndex(idx);
                                                            setIsTransitioning(false);
                                                        }, 200);
                                                    }}
                                                    className={`${styles.middleStatsDot} ${idx === currentStatIndex ? styles.middleStatsDotActive : ''}`}
                                                    style={idx === currentStatIndex ? { background: accent } : undefined}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Timer Section - Left Side */}
                        {!showOnlyProgressCircle && (
                        <div className={styles.timerSection}>
                            {/* Progress Circle */}
                            <div className={styles.timerCircle}>
                                {/* Subtle breathing glow behind the timer */}
                                <div
                                    className={styles.circleAmbient}
                                    style={{ '--ambient-color': data?.publicScreenRanksBackgroundColor || '#b45309' }}
                                    aria-hidden="true"
                                />
                                <svg className={styles.timerCircleSvg} viewBox="0 0 200 200">
                                    {/* Background circle */}
                                    <circle
                                        cx="100"
                                        cy="100"
                                        r="85"
                                        fill="none"
                                        stroke="#e2e8f0"
                                        strokeWidth="10"
                                    />
                                    {/* Progress circle */}
                                    <circle
                                        cx="100"
                                        cy="100"
                                        r="85"
                                        fill="none"
                                        stroke={data?.publicScreenRanksBackgroundColor || '#b45309'}
                                        strokeWidth="10"
                                        strokeLinecap="round"
                                        strokeDasharray={534}
                                        strokeDashoffset={
                                            timeRemaining.status === 'ended' ? 534 :
                                            timeRemaining.status === 'no-dates' ? 534 :
                                            (() => {
                                                const currentSeconds = timeRemaining.days * 86400 + 
                                                    timeRemaining.hours * 3600 + 
                                                    timeRemaining.minutes * 60 + 
                                                    timeRemaining.seconds;
                                                const startDate = data?.publicScreenStartDate ? new Date(data.publicScreenStartDate) : null;
                                                const endDate = data?.publicScreenEndDate ? new Date(data.publicScreenEndDate) : null;
                                                if (!endDate) return 534;
                                                const totalDuration = endDate - (startDate || new Date());
                                                const totalDurationSeconds = Math.max(1, totalDuration / 1000);
                                                const progress = Math.max(0, Math.min(1, currentSeconds / totalDurationSeconds));
                                                return 534 - (534 * progress);
                                            })()
                                        }
                                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                                    />
                                    {/* Clock icon - at the leading edge of the progress */}
                                    <g 
                                        transform={`rotate(${
                                            90 + (() => {
                                                const currentSeconds = timeRemaining.days * 86400 + 
                                                    timeRemaining.hours * 3600 + 
                                                    timeRemaining.minutes * 60 + 
                                                    timeRemaining.seconds;
                                                const startDate = data?.publicScreenStartDate ? new Date(data.publicScreenStartDate) : null;
                                                const endDate = data?.publicScreenEndDate ? new Date(data.publicScreenEndDate) : null;
                                                if (!endDate) return 0;
                                                if (timeRemaining.status === 'ended') return 360;
                                                if (timeRemaining.status === 'no-dates') return 0;
                                                const totalDuration = endDate - (startDate || new Date());
                                                const totalDurationSeconds = Math.max(1, totalDuration / 1000);
                                                const progress = Math.max(0, Math.min(1, currentSeconds / totalDurationSeconds));
                                                return progress * 360;
                                            })()
                                        } 100 100)`}
                                        style={{ transition: 'transform 1s linear' }}
                                    >
                                        {/* Clock background */}
                                        <circle cx="100" cy="15" r="10" fill="white" stroke={data?.publicScreenRanksBackgroundColor || '#b45309'} strokeWidth="2.5"/>
                                        {/* Clock icon - rotate back to keep it upright */}
                                        <g transform={`translate(100, 15) rotate(${
                                            -90 - (() => {
                                                const currentSeconds = timeRemaining.days * 86400 + 
                                                    timeRemaining.hours * 3600 + 
                                                    timeRemaining.minutes * 60 + 
                                                    timeRemaining.seconds;
                                                const startDate = data?.publicScreenStartDate ? new Date(data.publicScreenStartDate) : null;
                                                const endDate = data?.publicScreenEndDate ? new Date(data.publicScreenEndDate) : null;
                                                if (!endDate) return 0;
                                                if (timeRemaining.status === 'ended') return 360;
                                                if (timeRemaining.status === 'no-dates') return 0;
                                                const totalDuration = endDate - (startDate || new Date());
                                                const totalDurationSeconds = Math.max(1, totalDuration / 1000);
                                                const progress = Math.max(0, Math.min(1, currentSeconds / totalDurationSeconds));
                                                return progress * 360;
                                            })()
                                        })`}>
                                            <circle cx="0" cy="0" r="6" fill="none" stroke={data?.publicScreenRanksBackgroundColor || '#b45309'} strokeWidth="1.2"/>
                                            <line x1="0" y1="0" x2="0" y2="-3.5" stroke={data?.publicScreenRanksBackgroundColor || '#b45309'} strokeWidth="1.2" strokeLinecap="round"/>
                                            <line x1="0" y1="0" x2="2.5" y2="0" stroke={data?.publicScreenRanksBackgroundColor || '#b45309'} strokeWidth="1.2" strokeLinecap="round"/>
                                        </g>
                                    </g>
                                </svg>
                                
                                <div className={styles.timerCircleText}>
                                    <div className={styles.timerCircleLabel}>
                                        {timeRemaining.status === 'before-start' && t('timeToStart')}
                                        {timeRemaining.status === 'ongoing' && t('timeToEnd')}
                                        {timeRemaining.status === 'ended' && t('ended')}
                                        {timeRemaining.status === 'no-dates' && ''}
                                    </div>
                                </div>

                                {/* Timer Numbers Inside Circle */}
                                <div className={styles.timerDisplay}>
                                    {timeRemaining.days > 0 && (
                                        <>
                                            <div className={styles.timerUnit}>
                                                <div className={styles.timerValue}>
                                                    {timeRemaining.days}
                                                </div>
                                                <div className={styles.timerLabel}>{t('days')}</div>
                                            </div>
                                            <div className={styles.timerSeparator}>:</div>
                                        </>
                                    )}
                                    <div className={styles.timerUnit}>
                                        <div className={styles.timerValue}>
                                            {String(timeRemaining.hours).padStart(2, '0')}
                                        </div>
                                        <div className={styles.timerLabel}>{t('hours')}</div>
                                    </div>
                                    <div className={styles.timerSeparator}>:</div>
                                    <div className={styles.timerUnit}>
                                        <div className={styles.timerValue}>
                                            {String(timeRemaining.minutes).padStart(2, '0')}
                                        </div>
                                        <div className={styles.timerLabel}>{t('minutes')}</div>
                                    </div>
                                    <div className={styles.timerSeparator}>:</div>
                                    <div className={styles.timerUnit}>
                                        <div className={styles.timerValue}>
                                            {String(timeRemaining.seconds).padStart(2, '0')}
                                        </div>
                                        <div className={styles.timerLabel}>{t('seconds')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.actionButtons}>
                    <button 
                        className={styles.donateBtn}
                        onClick={() => {
                            setSelectedDonationFundraiserId(selectedFundraiser?.id ?? null);
                            setInitialDonationAmount(null);
                            setIsDonationFormOpen(true);
                        }}
                    >
                        {t('donate')}
                    </button>
                    <button className={styles.shareBtn}>
                        <svg className={styles.shareIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        {t('share')}
                    </button>
                </div>

                {/* Transfer / contact details below the donate button */}
                {(data.publicScreenBankName || data.publicScreenBankBranch || data.publicScreenBankAccountNumber || data.publicScreenBankAccountHolder || data.publicScreenBankAdditionalText || data.publicScreenPhone || data.publicScreenEmail) && (
                    <div className={styles.donateInfoBlock}>
                        {(data.publicScreenBankName || data.publicScreenBankBranch || data.publicScreenBankAccountNumber || data.publicScreenBankAccountHolder || data.publicScreenBankAdditionalText) && (
                            <div className={styles.donateInfoCard}>
                                <h4 className={styles.donateInfoTitle}>{t('bankTransferTitle')}</h4>
                                <div className={styles.donateInfoRows}>
                                    {data.publicScreenBankName && (
                                        <div className={styles.donateInfoRow}>
                                            <span className={styles.donateInfoLabel}>{t('bankName')}</span>
                                            <span className={styles.donateInfoValue}>{data.publicScreenBankName}</span>
                                        </div>
                                    )}
                                    {data.publicScreenBankBranch && (
                                        <div className={styles.donateInfoRow}>
                                            <span className={styles.donateInfoLabel}>{t('bankBranch')}</span>
                                            <span className={styles.donateInfoValue}>{data.publicScreenBankBranch}</span>
                                        </div>
                                    )}
                                    {data.publicScreenBankAccountNumber && (
                                        <div className={styles.donateInfoRow}>
                                            <span className={styles.donateInfoLabel}>{t('bankAccount')}</span>
                                            <span className={styles.donateInfoValue}>{data.publicScreenBankAccountNumber}</span>
                                        </div>
                                    )}
                                    {data.publicScreenBankAccountHolder && (
                                        <div className={styles.donateInfoRow}>
                                            <span className={styles.donateInfoLabel}>{t('bankHolder')}</span>
                                            <span className={styles.donateInfoValue}>{data.publicScreenBankAccountHolder}</span>
                                        </div>
                                    )}
                                    {data.publicScreenBankAdditionalText && (
                                        <div className={styles.donateInfoNote}>
                                            {renderRichText(data.publicScreenBankAdditionalText)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {(data.publicScreenPhone || data.publicScreenEmail) && (
                            <div className={styles.donateInfoCard}>
                                <h4 className={styles.donateInfoTitle}>{t('contactTitle')}</h4>
                                <div className={styles.donateInfoRows}>
                                    {data.publicScreenPhone && (
                                        <div className={styles.donateInfoRow}>
                                            <span className={styles.donateInfoLabel}>{t('phone')}</span>
                                            <a className={styles.donateInfoValue} href={`tel:${data.publicScreenPhone}`} dir="ltr">{data.publicScreenPhone}</a>
                                        </div>
                                    )}
                                    {data.publicScreenEmail && (
                                        <div className={styles.donateInfoRow}>
                                            <span className={styles.donateInfoLabel}>{t('email')}</span>
                                            <a className={styles.donateInfoValue} href={`mailto:${data.publicScreenEmail}`} dir="ltr">{data.publicScreenEmail}</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Tabs Section */}
            <section className={styles.tabsSection}>
                <div className={styles.tabsHeader}>
                    {showDonationDetails !== false && (
                        <>
                            <button
                                onClick={() => {
                                    setActiveTab('donors');
                                    clearSelectedFundraiser();
                                    setVisibleCount(15);
                                }}
                                className={`${styles.tab} ${activeTab === 'donors' ? styles.tabActive : ''}`}
                            >
                                <span className={styles.tabLabel}>
                                    {t('donors')}
                                    {recentDonations?.filter(donation => donation.totalAmount > 0).length > 0 && (
                                        <span className={styles.tabBadge}>
                                            {recentDonations?.filter(donation => donation.totalAmount > 0).length}
                                        </span>
                                    )}
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('fundraisers');
                                    setVisibleCount(15);
                                }}
                                className={`${styles.tab} ${activeTab === 'fundraisers' ? styles.tabActive : ''}`}
                            >
                                <span className={styles.tabLabel}>
                                    {t('fundraisers')}
                                    {fundraisers && fundraisers.length > 0 && (
                                        <span className={styles.tabBadge}>
                                            {fundraisers.length}
                                        </span>
                                    )}
                                </span>
                            </button>
                            {hasCommunities && (
                                <button
                                    onClick={() => {
                                        setActiveTab('communities');
                                        clearSelectedFundraiser();
                                        setExpandedCommunityId(null);
                                        setSearchTerm('');
                                        setVisibleCount(15);
                                    }}
                                    className={`${styles.tab} ${activeTab === 'communities' ? styles.tabActive : ''}`}
                                >
                                    <span className={styles.tabLabel}>
                                        {t('communities')}
                                        <span className={styles.tabBadge}>{communities.length}</span>
                                    </span>
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setActiveTab('top');
                                    clearSelectedFundraiser();
                                    setVisibleCount(15);
                                }}
                                className={`${styles.tab} ${activeTab === 'top' ? styles.tabActive : ''}`}
                            >
                                <span className={styles.tabLabel}>{t('top')}</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => {
                            setActiveTab('about');
                            clearSelectedFundraiser();
                            setVisibleCount(15);
                        }}
                        className={`${styles.tab} ${activeTab === 'about' ? styles.tabActive : ''}`}
                    >
                        <span className={styles.tabLabel}>{t('about')}</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className={styles.tabsContent}>
                    {/* Fundraiser Details Header (shown when a fundraiser is selected) */}
                    {selectedFundraiser && activeTab === 'fundraisers' && (() => {
                        // totalRaised and targetAmount are now both in the same projected units (×months for monthly campaigns)
                        const amountForProgress = selectedFundraiser.totalRaised || 0;
                        const progressPercentage = selectedFundraiser.targetAmount > 0
                            ? (amountForProgress / selectedFundraiser.targetAmount) * 100
                            : 0;

                        const displayAmount = selectedFundraiser.totalRaised || 0;
                        
                        const fundraiserShareUrl = `${window.location.origin}/public-screen/${campaignId}?fundraiser=${selectedFundraiser.id}`;
                        
                        return (
                            <div className={styles.fundraiserDetailsHeader}>
                                <button
                                    onClick={() => clearSelectedFundraiser()}
                                    className={styles.backBtn}
                                    aria-label={t('back')}
                                >
                                    ✕
                                </button>
                                <div className={styles.fundraiserDetailsContent}>
                                    <div className={styles.fundraiserDetailsTop}>
                                        <div className={styles.fundraiserDetailsInfo}>
                                            <div className={styles.fundraiserDetailsAvatar}>
                                                {(selectedFundraiser.name || selectedFundraiser.fundraiserName)?.charAt(0)?.toUpperCase() || 'מ'}
                                            </div>
                                            <div className={styles.fundraiserDetailsText}>
                                                <h2 className={styles.fundraiserDetailsName}>{selectedFundraiser.name || selectedFundraiser.fundraiserName}</h2>
                                                <div className={styles.fundraiserDetailsStats}>
                                                    <span>{selectedFundraiser.donorCount} {t('donors')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.fundraiserDetailsAmount} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span>{formatAmount(displayAmount)}</span>
                                            {isMonthlyUnitMode && (
                                                <span style={{ fontSize: '0.55em', color: '#94a3b8', fontWeight: 'normal', marginTop: '-2px' }}>
                                                    {t('perMonth')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Progress bar */}
                                    <div className={styles.fundraiserDetailsProgress}>
                                        <div className={styles.progressBarContainer}>
                                            <div 
                                                className={styles.progressBarFill}
                                                style={{ 
                                                    width: `${Math.min(progressPercentage, 100)}%`,
                                                    backgroundColor: data?.publicScreenRanksBackgroundColor || '#b45309'
                                                }}
                                            />
                                        </div>
                                        <div className={styles.progressText}>
                                            <span>{progressPercentage.toFixed(0)}%</span>
                                            {selectedFundraiser.targetAmount > 0 && (
                                                <span>{t('goal')}: {formatAmount(selectedFundraiser.targetAmount)}</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className={styles.fundraiserHeaderActions}>
                                        <button
                                            className={styles.fundraiserHeaderDonateBtn}
                                            onClick={() => {
                                                setSelectedDonationFundraiserId(selectedFundraiser.id);
                                                setInitialDonationAmount(null);
                                                setIsDonationFormOpen(true);
                                            }}
                                        >
                                            <span>{t('donateToFundraiser')}</span>
                                            <span className={styles.btnArrow}>⟵</span>
                                        </button>
                                        <button
                                            className={styles.fundraiserHeaderShareBtn}
                                            onClick={() => {
                                                navigator.clipboard.writeText(fundraiserShareUrl);
                                                alert(t('linkCopied'));
                                            }}
                                            title={t('share')}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                    
                    {/* Search Box - hidden in about tab */}
                    {activeTab !== 'about' && (
                    <div className={styles.searchBox}>
                        <input
                            type="text"
                            placeholder={t('searchByName')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className={styles.clearSearchBtn}
                                aria-label={t('clearSearch')}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    )}
                    
                    {/* Sort Buttons for donors tab */}
                    {activeTab === 'donors' && !selectedFundraiser && (
                        <div style={{ 
                            display: 'flex',
                            padding: '8px',
                            alignItems: 'center',
                            gap: '2px',
                            borderRadius: '40px',
                            background: '#FFF',
                            boxShadow: '0 39px 11px 0 rgba(168, 188, 230, 0.00), 0 25px 10px 0 rgba(168, 188, 230, 0.01), 0 14px 8px 0 rgba(168, 188, 230, 0.03), 0 6px 6px 0 rgba(168, 188, 230, 0.04), 0 2px 3px 0 rgba(168, 188, 230, 0.05)',
                            marginTop: '1rem',
                            marginBottom: '1.5rem',
                            justifyContent: 'center',
                            width: 'fit-content',
                            marginLeft: 'auto',
                            marginRight: 'auto'
                        }}>
                            <button
                                onClick={() => setSortBy('recent')}
                                style={{
                                    display: 'flex',
                                    padding: '4px 10px',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '10px',
                                    borderRadius: '40px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    minWidth: '100px',
                                    border: sortBy === 'recent' ? '1px solid #6E99EC' : 'none',
                                    background: sortBy === 'recent' ? '#EDF5FD' : 'transparent',
                                    color: sortBy === 'recent' ? '#0C4AD5' : '#64748b'
                                }}
                            >
                                {t('mostRecent')}
                            </button>
                            <button
                                onClick={() => setSortBy('oldest')}
                                style={{
                                    display: 'flex',
                                    padding: '4px 10px',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '10px',
                                    borderRadius: '40px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    minWidth: '100px',
                                    border: sortBy === 'oldest' ? '1px solid #6E99EC' : 'none',
                                    background: sortBy === 'oldest' ? '#EDF5FD' : 'transparent',
                                    color: sortBy === 'oldest' ? '#0C4AD5' : '#64748b'
                                }}
                            >
                                {t('oldest2')}
                            </button>
                            <button
                                onClick={() => setSortBy('highest')}
                                style={{
                                    display: 'flex',
                                    padding: '4px 10px',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '10px',
                                    borderRadius: '40px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    minWidth: '100px',
                                    border: sortBy === 'highest' ? '1px solid #6E99EC' : 'none',
                                    background: sortBy === 'highest' ? '#EDF5FD' : 'transparent',
                                    color: sortBy === 'highest' ? '#0C4AD5' : '#64748b'
                                }}
                            >
                                {t('high')}
                            </button>
                        </div>
                    )}
                    
                    {/* Sort Buttons for fundraisers tab */}
                    {activeTab === 'fundraisers' && !selectedFundraiser && (
                        <div className={styles.fundraiserSortBar}>
                            {[
                                { key: 'amount', label: t('byAmount') },
                                { key: 'donors', label: t('byDonors') },
                                { key: 'progress', label: t('byProgress') },
                                { key: 'lastDonation', label: t('byLastDonation') },
                                { key: 'target', label: t('byTarget') }
                            ].map(option => (
                                <button
                                    key={option.key}
                                    onClick={() => setFundraiserSortBy(option.key)}
                                    className={`${styles.fundraiserSortBtn} ${fundraiserSortBy === option.key ? styles.fundraiserSortBtnActive : ''}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Sort Buttons for communities tab */}
                    {activeTab === 'communities' && (
                        <div className={styles.fundraiserSortBar}>
                            {[
                                { key: 'amount', label: t('byAmount') },
                                { key: 'donors', label: t('byDonors') },
                                { key: 'fundraisers', label: t('byFundraisers') },
                                { key: 'progress', label: t('byProgress') },
                                { key: 'target', label: t('byTarget') }
                            ].map(option => (
                                <button
                                    key={option.key}
                                    onClick={() => setCommunitySortBy(option.key)}
                                    className={`${styles.fundraiserSortBtn} ${communitySortBy === option.key ? styles.fundraiserSortBtnActive : ''}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* About Tab Content */}
                    {activeTab === 'about' && (
                        <div className={styles.aboutContent} style={{
                            padding: '2rem',
                            background: '#fff',
                            borderRadius: '16px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            marginBottom: '1rem',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.8',
                            fontSize: '16px',
                            color: '#333',
                            textAlign: language === 'he' ? 'right' : 'left'
                        }}>
                            {tabContent.aboutText || t('noData')}
                        </div>
                    )}
                    
                    {activeTab !== 'about' && (
                    <div className={styles.donorsGrid}>
                        {(() => {
                            // If fundraiser is selected, show their donors who donated
                            if (selectedFundraiser && activeTab === 'fundraisers') {
                                const fundraiserDonors = selectedFundraiser.donors || [];
                                // Filter only donors who actually donated (totalAmount > 0)
                                const donorsWhoDonated = fundraiserDonors.filter(donor => donor.totalAmount > 0);
                                const filteredFundraiserDonors = searchTerm
                                    ? donorsWhoDonated.filter(donor => {
                                        const fullName = donor.donorName || '';
                                        return fullName.toLowerCase().includes(searchTerm.toLowerCase());
                                    })
                                    : donorsWhoDonated;
                                
                                if (filteredFundraiserDonors.length === 0 && searchTerm) {
                                    return <div className={styles.emptyState}>{t('noResultsFor')} "{searchTerm}"</div>;
                                }
                                if (filteredFundraiserDonors.length === 0) {
                                    return <div className={styles.emptyState}>{t('noDonorsYet')}</div>;
                                }
                                
                                const displayCount = getFullRowsCount(filteredFundraiserDonors.length);
                                const visibleDonors = filteredFundraiserDonors.slice(0, displayCount);
                                const hasMore = filteredFundraiserDonors.length > displayCount;
                                
                                return (
                                    <>
                                        {visibleDonors.map((donor, index) => {
                                            const isMonthly = data?.campaign?.donationType === 'monthly';
                                            const payments = donor.numberOfPayments || 1;
                                            // totalAmount is already calculated correctly in the API
                                            const displayAmount = donor.totalAmount;
                                            // Show monthly breakdown for monthly campaigns when the configured months > 1 (otherwise monthly == total)
                                            const showMonthlyInfo = isMonthly && (statistics.monthsCalculation || 1) > 1;
                                            
                                            return (
                                    <div key={donor.id || index} className={styles.donorCard} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div className={styles.donorCardHeader} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                            <div className={styles.donorHeaderRight}>
                                                <div className={styles.donorAvatar}>
                                                    {donor.isAnonymous ? 'א' : getInitials(donor.firstName, donor.lastName)}
                                                </div>
                                                <span className={styles.donorName}>
                                                    {donor.isAnonymous ? 'בעילום שם' : donor.donorName}
                                                </span>
                                            </div>
                                            <div className={styles.donorAmount} style={{ display: 'flex', alignItems: 'center' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '2px',
                                                    padding: '8px 12px',
                                                    backgroundColor: 'rgba(180, 83, 9, 0.1)',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(180, 83, 9, 0.2)'
                                                }}>
                                                    <div style={{ fontWeight: 'bold', fontSize: '1.1em', textAlign: 'center' }}>
                                                        {formatAmount(displayAmount)}
                                                    </div>
                                                    {isMonthlyUnitMode && (
                                                        <div style={{ fontSize: '0.7em', fontWeight: 'normal', color: '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                            {t('perMonth')}
                                                        </div>
                                                    )}
                                                    {showMonthlyInfo && (
                                                        <div style={{
                                                            fontSize: '0.75em',
                                                            fontWeight: 'normal',
                                                            color: '#666',
                                                            whiteSpace: 'nowrap',
                                                            textAlign: 'center'
                                                        }}>
                                                            {t('monthly')}: {formatAmount(donor.monthlyAmount || donor.amount)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {donor.dedication ? (
                                            <div className={styles.dedicationBox}>
                                                {donor.dedication}
                                            </div>
                                        ) : (
                                            <div className={styles.dedicationSlot} aria-hidden="true">&nbsp;</div>
                                        )}
                                    </div>
                                    );
                                        })}
                                {hasMore && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '1rem' }}>
                                        <button 
                                            onClick={() => setVisibleCount(prev => prev + loadMoreStep())}
                                            className={styles.loadMoreBtn}
                                        >
                                            {t('showMore')}
                                        </button>
                                    </div>
                                )}
                                    </>
                                );
                            }
                            
                            // Otherwise show regular sorted and filtered data
                            if (sortedAndFilteredData.length === 0 && searchTerm) {
                                return <div className={styles.emptyState}>{t('noResultsFor')} "{searchTerm}"</div>;
                            }
                            if (sortedAndFilteredData.length === 0) {
                                return <div className={styles.emptyState}>{tabContent.emptyMessage}</div>;
                            }
                            
                            const displayCount = getFullRowsCount(sortedAndFilteredData.length);
                            const visibleData = sortedAndFilteredData.slice(0, displayCount);
                            const hasMore = sortedAndFilteredData.length > displayCount;
                            
                            return (
                                <>
                                    {visibleData.map((item, index) => {
                                // Community card (operator / מפעיל) - aggregates all its fundraisers
                                if (item.type === 'community') {
                                    const accent = data?.publicScreenRanksBackgroundColor || '#b45309';
                                    const amountForProgress = item.totalRaised || 0;
                                    const progressPercentage = item.targetAmount > 0
                                        ? (amountForProgress / item.targetAmount) * 100
                                        : 0;
                                    const isExpanded = expandedCommunityId === item.id;

                                    return (
                                        <div
                                            key={`community-${item.id || index}`}
                                            className={styles.fundraiserCard}
                                            style={{ display: 'flex', flexDirection: 'column', minHeight: '200px', position: 'relative', overflow: 'visible', paddingTop: '2rem' }}
                                        >
                                            {/* Avatar circle - half outside, half inside */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '-1.5rem',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: '3rem',
                                                height: '3rem',
                                                borderRadius: '50%',
                                                background: accent,
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.25rem',
                                                fontWeight: '700',
                                                border: '3px solid white',
                                                boxShadow: `0 0 0 1px ${accent}, 0 2px 8px rgba(0,0,0,0.1)`,
                                                zIndex: 10
                                            }}>
                                                {item.communityName?.charAt(0)?.toUpperCase() || 'ק'}
                                            </div>

                                            {/* Community name + stats */}
                                            <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                                                <span className={styles.fundraiserName}>{item.communityName}</span>
                                                <div className={styles.fundraiserStats} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', minHeight: '2.5rem' }}>
                                                    <span>{item.fundraiserCount} {t('fundraisersLabel')} · {item.donorCount} {t('donors')}</span>
                                                </div>
                                            </div>

                                            {/* Amount display */}
                                            <div style={{
                                                textAlign: 'center',
                                                marginBottom: '0.5rem',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                width: '100%',
                                                paddingLeft: '1rem',
                                                paddingRight: '1rem'
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '2px',
                                                    padding: '12px 24px',
                                                    backgroundColor: 'rgba(180, 83, 9, 0.1)',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(180, 83, 9, 0.2)',
                                                    width: '100%'
                                                }}>
                                                    <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#1e293b', textAlign: 'center' }}>
                                                        {data?.campaign?.donationType === 'monthly' && (statistics.monthsCalculation || 1) > 1 ? `${t('total')}: ` : ''}{formatAmount(item.totalRaised)}
                                                    </div>
                                                    {isMonthlyUnitMode && (
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                            {t('perMonth')}
                                                        </div>
                                                    )}
                                                    {data?.campaign?.donationType === 'monthly' && (statistics.monthsCalculation || 1) > 1 && (
                                                        <div style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                            {t('monthly')}: {formatAmount(item.monthlyRaised || (item.totalRaised / (statistics.monthsCalculation || data?.campaign?.defaultHokMonths || 1)))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className={styles.fundraiserProgress} style={{ minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <div className={styles.progressBarContainer}>
                                                    <div
                                                        className={styles.progressBarFill}
                                                        style={{
                                                            width: `${Math.min(progressPercentage, 100)}%`,
                                                            backgroundColor: accent
                                                        }}
                                                    />
                                                </div>
                                                <div className={styles.progressText}>
                                                    <span>{progressPercentage.toFixed(0)}%</span>
                                                    {item.targetAmount > 0 && (
                                                        <span>{t('goal')}: {formatAmount(item.targetAmount)}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expandable fundraisers list */}
                                            {isExpanded && item.members && item.members.length > 0 && (
                                                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 0 }}>
                                                    {item.members.map((member) => (
                                                        <div
                                                            key={member.id}
                                                            onClick={() => router.push(`${pathname}?fundraiser=${member.id}`)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '0.5rem',
                                                                padding: '8px 12px',
                                                                background: '#f8fafc',
                                                                borderRadius: '8px',
                                                                border: '1px solid #e2e8f0',
                                                                cursor: 'pointer',
                                                                minWidth: 0
                                                            }}
                                                        >
                                                            <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: '#334155', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {member.name}
                                                            </span>
                                                            <span style={{ flexShrink: 0, fontWeight: 700, color: accent, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                                                {formatAmount(member.totalRaised)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className={styles.fundraiserActions} style={{ marginTop: 'auto' }}>
                                                <button
                                                    className={styles.fundraiserShowBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedCommunityId(isExpanded ? null : item.id);
                                                    }}
                                                    disabled={!item.members || item.members.length === 0}
                                                >
                                                    {isExpanded ? t('hideFundraisers') : t('showFundraisers')}{item.members?.length ? ` (${item.members.length})` : ''}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                // Fundraiser card - clickable to view donors
                                if (item.type === 'fundraiser') {
                                    const fundraiserUrl = `${window.location.origin}/public-screen/${campaignId}?fundraiser=${item.id}`;
                                    // totalRaised and targetAmount are both in projected units (×months for monthly campaigns)
                                    const amountForProgress = item.totalRaised || 0;
                                    const progressPercentage = item.targetAmount > 0
                                        ? (amountForProgress / item.targetAmount) * 100
                                        : 0;
                                    
                                    // Determine circle color based on progress
                                    let circleColor;
                                    if (progressPercentage < 33.33) {
                                        circleColor = '#fc5e5e'; // אדום
                                    } else if (progressPercentage < 66.66) {
                                        circleColor = '#ffce20'; // כתום
                                    } else {
                                        circleColor = '#10e991'; // ירוק
                                    }
                                    
                                    return (
                                        <div 
                                            key={item.id || index} 
                                            className={styles.fundraiserCard}
                                            onClick={() => {
                                                setSearchTerm('');
                                                setVisibleCount(15);
                                                setSelectedFundraiser(item);
                                            }}
                                            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: '200px', position: 'relative', overflow: 'visible', paddingTop: '2rem' }}
                                        >
                                            {/* Avatar circle - half outside, half inside */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '-1.5rem',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: '3rem',
                                                height: '3rem',
                                                borderRadius: '50%',
                                                background: circleColor,
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.25rem',
                                                fontWeight: '700',
                                                border: '3px solid white',
                                                boxShadow: `0 0 0 1px ${circleColor}, 0 2px 8px rgba(0,0,0,0.1)`,
                                                zIndex: 10
                                            }}>
                                                {item.fundraiserName?.charAt(0)?.toUpperCase() || 'מ'}
                                            </div>
                                            
                                            {/* Fundraiser name centered */}
                                            <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                                                <span className={styles.fundraiserName}>{item.fundraiserName}</span>
                                                <div className={styles.fundraiserStats} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', minHeight: '2.5rem' }}>
                                                    <span>{item.donorCount} {t('donors')}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', minHeight: '1rem' }}>
                                                        {item.lastDonationDate && getRelativeTime(item.lastDonationDate) 
                                                            ? getRelativeTime(item.lastDonationDate)
                                                            : '\u00A0'
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Amount display above progress bar */}
                                            <div style={{ 
                                                textAlign: 'center', 
                                                marginBottom: '0.5rem',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                width: '100%',
                                                paddingLeft: '1rem',
                                                paddingRight: '1rem'
                                            }}>
                                                {data?.campaign?.donationType === 'monthly' ? (
                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '2px',
                                                        padding: '12px 24px',
                                                        backgroundColor: 'rgba(180, 83, 9, 0.1)',
                                                        borderRadius: '8px',
                                                        border: '1px solid rgba(180, 83, 9, 0.2)',
                                                        width: '100%'
                                                    }}>
                                                        <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#1e293b', textAlign: 'center' }}>
                                                            {(statistics.monthsCalculation || 1) > 1 ? `${t('total')}: ` : ''}{formatAmount(item.totalRaised)}
                                                        </div>
                                                        {isMonthlyUnitMode && (
                                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                {t('perMonth')}
                                                            </div>
                                                        )}
                                                        {(statistics.monthsCalculation || 1) > 1 && (
                                                            <div style={{ fontSize: '0.75rem', color: '#666', whiteSpace: 'nowrap' }}>
                                                                {t('monthly')}: {formatAmount(item.monthlyRaised || (item.totalRaised / (statistics.monthsCalculation || data?.campaign?.defaultHokMonths || 1)))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        padding: '12px 24px',
                                                        backgroundColor: 'rgba(180, 83, 9, 0.1)',
                                                        borderRadius: '8px',
                                                        border: '1px solid rgba(180, 83, 9, 0.2)',
                                                        width: '100%'
                                                    }}>
                                                        <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#1e293b' }}>
                                                            {formatAmount(item.totalRaised)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Progress bar - show percentage raised vs target */}
                                            <div className={styles.fundraiserProgress} style={{ minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <div className={styles.progressBarContainer}>
                                                    <div 
                                                        className={styles.progressBarFill}
                                                        style={{ 
                                                            width: `${Math.min(progressPercentage, 100)}%`,
                                                            backgroundColor: data?.publicScreenRanksBackgroundColor || '#b45309'
                                                        }}
                                                    />
                                                </div>
                                                <div className={styles.progressText}>
                                                    <span>{progressPercentage.toFixed(0)}%</span>
                                                    {item.targetAmount > 0 && (
                                                        <span>יעד: {formatAmount(item.targetAmount)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className={styles.fundraiserActions} style={{ marginTop: 'auto' }}>
                                                <button
                                                    className={styles.fundraiserShowBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSearchTerm('');
                                                        setVisibleCount(15);
                                                        setSelectedFundraiser(item);
                                                    }}
                                                >
                                                    {t('showDonations')}
                                                </button>
                                                <button
                                                    className={styles.fundraiserShowBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedDonationFundraiserId(item.id);
                                                        setInitialDonationAmount(null);
                                                        setIsDonationFormOpen(true);
                                                    }}
                                                >
                                                    {t('donate')}
                                                </button>
                                                <button
                                                    className={styles.fundraiserShowBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(fundraiserUrl);
                                                        alert(t('linkCopied'));
                                                    }}
                                                >
                                                    {t('share')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                                
                                // Regular donor/donation card
                                const isMonthly = data?.campaign?.donationType === 'monthly';
                                const payments = item.numberOfPayments || 1;
                                // Use totalAmount from API - it's already calculated correctly
                                const displayAmount = item.totalAmount || item.amount;
                                // Show monthly breakdown for monthly campaigns when the configured months > 1 (otherwise monthly == total)
                                const showMonthlyInfo = isMonthly && (statistics.monthsCalculation || 1) > 1;
                                
                                return (
                                    <div key={item.id || index} className={styles.donorCard} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
                                        {/* Top donors show rank badge */}
                                        {item.type === 'top' && (
                                            <div className={styles.rankBadge}>
                                                #{item.rank}
                                            </div>
                                        )}
                                        
                                        {/* Left side: Donor info and content */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                                            {/* Card Header: Donor Name + Avatar */}
                                            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                                <div className={styles.donorHeaderRight}>
                                                    <div className={styles.donorAvatar}>
                                                        {item.isAnonymous ? 'א' : getInitials(item.donorFirstName, item.donorLastName)}
                                                    </div>
                                                    <span className={styles.donorNameWrap}>
                                                        <span className={styles.donorName}>
                                                            {item.isAnonymous ? 'בעילום שם' : item.donorName}
                                                        </span>
                                                        {!item.isAnonymous && (item.donorName?.length || 0) > 20 && (
                                                            <span className={styles.nameTooltip} role="tooltip">
                                                                {item.donorName}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Card Content: Fundraiser + Time + Payment Info */}
                                            <div className={styles.donorCardContent}>
                                            {/* Show fundraiser name */}
                                            {item.fundraiserName && (
                                                <div
                                                    className={styles.donorVia}
                                                    title={`${t('via')} ${item.fundraiserName}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const fundraiser = fundraisers?.find(f =>
                                                            f.name === item.fundraiserName
                                                        );
                                                        if (fundraiser) {
                                                            router.push(`${pathname}?fundraiser=${fundraiser.id}`);
                                                        }
                                                    }}
                                                >
                                                    {t('via')} {item.fundraiserName}
                                                </div>
                                            )}

                                            {/* Show relative time if within 24 hours */}
                                            {item.createdAt && (() => {
                                                const relativeTime = getRelativeTime(item.createdAt);
                                                return relativeTime ? (
                                                    <div className={styles.donationTime}>
                                                        {relativeTime}
                                                    </div>
                                                ) : null;
                                            })()}
                                            
                                            {item.dedication ? (
                                                <div className={styles.dedicationBox}>
                                                    {item.dedication}
                                                </div>
                                            ) : (
                                                <div className={styles.dedicationSlot} aria-hidden="true">&nbsp;</div>
                                            )}
                                        </div>
                                        </div>
                                        
                                        {/* Right side: Amount box - centered vertically */}
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '2px',
                                                padding: '8px 12px',
                                                backgroundColor: 'rgba(180, 83, 9, 0.1)',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(180, 83, 9, 0.2)'
                                            }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '1.1em', textAlign: 'center' }}>
                                                    {formatAmount(displayAmount)}
                                                </div>
                                                {isMonthlyUnitMode && (
                                                    <div style={{ fontSize: '0.7em', fontWeight: 'normal', color: '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        {t('perMonth')}
                                                    </div>
                                                )}
                                                {showMonthlyInfo && (
                                                    <div style={{
                                                        fontSize: '0.75em',
                                                        fontWeight: 'normal',
                                                        color: '#666',
                                                        whiteSpace: 'nowrap',
                                                        textAlign: 'center'
                                                    }}>
                                                        {t('monthly')}: {formatAmount(item.monthlyAmount || item.amount)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {hasMore && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '1rem' }}>
                                    <button 
                                        onClick={() => setVisibleCount(prev => prev + loadMoreStep())}
                                        className={styles.loadMoreBtn}
                                    >
                                        {t('showMore')}
                                    </button>
                                </div>
                            )}
                        </>
                    );
                        })()}
                    </div>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <p className={styles.liveIndicator}>
                    <span className={styles.liveDot}></span>
                    {t('liveUpdate')}
                </p>
            </footer>

            {/* Donation Modal — rendered in a portal on document.body so the fixed
                DONEXT SiteHeader can never overlap it via an ancestor stacking context. */}
            {mounted && showDonationModal && createPortal(
                <div className={styles.modalOverlay} onClick={() => {
                    setShowDonationModal(false);
                    setDonationStep(1);
                    setDonationFormData({ firstName: '', lastName: '', email: '', phone: '', amount: 0 });
                }}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <button 
                            className={styles.modalCloseBtn}
                            onClick={() => {
                                setShowDonationModal(false);
                                setDonationStep(1);
                                setDonationFormData({ firstName: '', lastName: '', email: '', phone: '', amount: 0 });
                            }}
                        >
                            ✕
                        </button>
                        
                        {donationStep === 1 ? (
                            <>
                                <h2 className={styles.modalTitle}>{t('donateUnder')} {donationModalFundraiser?.fundraiserName}</h2>
                                
                                <div className={styles.modalRanks}>
                                    {donationAmounts.map((rank, index) => (
                                        <div 
                                            key={rank.id || rank.amount || index}
                                            className={`${styles.modalRankCard} ${donationFormData.amount === rank.amount ? styles.modalRankCardSelected : ''}`}
                                            onClick={() => setDonationFormData({ ...donationFormData, amount: rank.amount })}
                                        >
                                            {rank.image ? (
                                                <div className={styles.modalRankImageContainer}>
                                                    <img 
                                                        src={convertGoogleDriveUrl(rank.image)} 
                                                        alt={rank.name}
                                                        className={styles.modalRankImage}
                                                    />
                                                </div>
                                            ) : (
                                                <div className={styles.modalRankPlaceholder}>
                                                    <span className={styles.modalRankIcon}>💎</span>
                                                </div>
                                            )}
                                            <div className={styles.modalRankInfo}>
                                                <div className={styles.modalRankName}>{rank.name}</div>
                                                <div className={styles.modalRankAmount}>{formatCurrency(rank.amount)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {donationFormData.amount > 0 && (
                                    <div className={styles.modalFooter}>
                                        <button 
                                            className={styles.modalContinueBtn}
                                            onClick={() => setDonationStep(2)}
                                        >
                                            {t('continueToPayment')}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <button 
                                    className={styles.modalBackBtn}
                                    onClick={() => setDonationStep(1)}
                                >
                                    ← {t('back')}
                                </button>
                                
                                <div className={styles.formHeader}>
                                    <h2 className={styles.modalTitle}>{t('completeDetails')}</h2>
                                    <p className={styles.formHeaderDescription}>
                                        {t('fillDetails')}
                                    </p>
                                </div>
                                
                                <div className={styles.modalSubtitle}>
                                    <span>{t('donationAmount')}</span>
                                    <strong>{formatCurrency(donationFormData.amount)}</strong>
                                </div>
                                
                                <form className={styles.donationForm} onSubmit={(e) => {
                                    e.preventDefault();
                                    alert(t('donationSuccess'));
                                    setShowDonationModal(false);
                                    setDonationStep(1);
                                    setDonationFormData({ firstName: '', lastName: '', email: '', phone: '', amount: 0 });
                                }}>
                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>{t('firstName')} {t('required')}</label>
                                            <input 
                                                type="text"
                                                className={styles.formInput}
                                                placeholder={t('enterFirstName')}
                                                value={donationFormData.firstName}
                                                onChange={(e) => setDonationFormData({ ...donationFormData, firstName: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>{t('lastName')} {t('required')}</label>
                                            <input 
                                                type="text"
                                                className={styles.formInput}
                                                placeholder={t('enterLastName')}
                                                value={donationFormData.lastName}
                                                onChange={(e) => setDonationFormData({ ...donationFormData, lastName: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>{t('email')}</label>
                                        <input 
                                            type="email"
                                            className={styles.formInput}
                                            placeholder="example@email.com"
                                            value={donationFormData.email}
                                            onChange={(e) => setDonationFormData({ ...donationFormData, email: e.target.value })}
                                        />
                                    </div>
                                    
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>{t('phone')} {t('required')}</label>
                                        <input 
                                            type="tel"
                                            className={styles.formInput}
                                            placeholder="050-1234567"
                                            value={donationFormData.phone}
                                            onChange={(e) => setDonationFormData({ ...donationFormData, phone: e.target.value })}
                                            required
                                        />
                                    </div>
                                    
                                    <button type="submit" className={styles.modalSubmitBtn}>
                                        💳 {t('completeDonation')}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Floating donate button - stays fixed and visible while scrolling */}
            {showDonationDetails !== false && !isDonationFormOpen && !showThankYou && (
                <button
                    className={styles.floatingDonateBtn}
                    style={{ backgroundColor: data?.publicScreenRanksBackgroundColor || '#b45309' }}
                    onClick={() => {
                        setSelectedDonationFundraiserId(selectedFundraiser?.id ?? null);
                        setInitialDonationAmount(null);
                        setIsDonationFormOpen(true);
                    }}
                    aria-label={t('donate')}
                >
                    {t('donate')}
                </button>
            )}

            {/* Add Donation Form Modal */}
            <DonationFormPublic
                campaignId={campaignId}
                fundraiserId={selectedDonationFundraiserId ?? urlFundraiserId}
                initialAmount={initialDonationAmount}
                isOpen={isDonationFormOpen}
                hideDonorDetails={showDonationDetails === false}
                onClose={() => {
                    setIsDonationFormOpen(false);
                    setSelectedDonationFundraiserId(null);
                    setInitialDonationAmount(null);
                }}
                onSuccess={() => {
                    setIsDonationFormOpen(false);
                    setSelectedDonationFundraiserId(null);
                    setInitialDonationAmount(null);
                    // Celebrate the successful donation with a thank-you overlay + confetti
                    setShowThankYou(true);
                    // Refresh data after successful donation
                    if (campaignId) {
                        fetch(`/api/campaigns/${campaignId}/public-stats`)
                            .then(res => res.json())
                            .then(result => {
                                if (result.success) {
                                    setData(result.data);
                                }
                            })
                            .catch(err => console.error('Error refreshing data:', err));
                    }
                }}
            />

            {/* Thank-you overlay with confetti after a successful donation */}
            {mounted && showThankYou && createPortal((() => {
                const accent = data?.publicScreenRanksBackgroundColor || '#b45309';
                return (
                <div className={styles.thankYouOverlay} onClick={() => setShowThankYou(false)}>
                    <canvas ref={thankYouCanvasRef} className={styles.thankYouCanvas} />
                    <div className={styles.thankYouCard} onClick={(e) => e.stopPropagation()}>
                        <img className={styles.thankYouSticker} src={encodeURI('/stickers/הסטוריה.svg')} alt="" aria-hidden="true" />
                        <h2 className={styles.thankYouTitle} style={{ color: accent }}>{t('thankYouTitle')}</h2>
                        <p className={styles.thankYouLine1}>{t('thankYouLine1')}</p>
                        <p className={styles.thankYouLine2}>{t('thankYouLine2')}</p>
                        <button
                            className={styles.thankYouCloseBtn}
                            style={{ color: accent, borderColor: accent }}
                            onClick={() => setShowThankYou(false)}
                        >
                            {t('thankYouClose')}
                        </button>
                    </div>
                </div>
                );
            })(),
                document.body
            )}
        </div>
    );
}

