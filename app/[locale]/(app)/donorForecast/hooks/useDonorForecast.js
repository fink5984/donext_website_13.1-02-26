import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/stores/StoreContext';
import { buildRanks } from '../rankUtils';

export const TIMER_SECONDS = 30;

export const getTimerForRank = (rankIndex) => Math.max(15, TIMER_SECONDS - rankIndex * 5);

export function useDonorForecast({ fundraiserId, ranksAmounts }) {
    const {fundraisersStore, donorsStore, campaignId} = useStore();
    const router = useRouter();

    const [step, setStep] = useState("welcome"); // welcome | rank | finish
    const [rankIdx, setRankIdx] = useState(0);
    const [timer, setTimer] = useState(TIMER_SECONDS);
    const [donors, setDonors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [draggedDonor, setDraggedDonor] = useState(null);
    const draggedDonorRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const timerRef = useRef();
    const dragTimeout = useRef();
    const [isDragging, setIsDragging] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const screenRef = useRef();
    const donorListRef = useRef();
    const [hasScroll, setHasScroll] = useState(false);
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [showScrollValidation, setShowScrollValidation] = useState(false);
    const [hasEverScrolledToBottom, setHasEverScrolledToBottom] = useState(false);
    const [showNoDonorsPopup, setShowNoDonorsPopup] = useState(false);
    const [hasSeenNoDonorsPopup, setHasSeenNoDonorsPopup] = useState(false);
    const [hasSeenOneDonorPopup, setHasSeenOneDonorPopup] = useState(false);
    const [showOneDonorPopup, setShowOneDonorPopup] = useState(false);
    const [showChatBotPopup, setShowChatBotPopup] = useState(false);
    const [hasSeenChatBot, setHasSeenChatBot] = useState(false);
    const [showResetRankingPopup, setShowResetRankingPopup] = useState(false);
    const [skipPopupsUntilRank, setSkipPopupsUntilRank] = useState(-1);
    const [showSticker, setShowSticker] = useState(false);
    const [donorsCountAtPopupTime, setDonorsCountAtPopupTime] = useState({});
    const [notifications, setNotifications] = useState([]);
    const [shownNotifications, setShownNotifications] = useState(new Set());
    const [hasSelectedInCurrentRank, setHasSelectedInCurrentRank] = useState(false);
    const [hasSeenResetPopup, setHasSeenResetPopup] = useState(false);

    // ranksAmounts חייב להגיע מהקומפוננטה הקוראת - אין fallback
    const safeAmounts = Array.isArray(ranksAmounts) && ranksAmounts.length > 0
        ? ranksAmounts
        : [];
    const RANKS = buildRanks(safeAmounts);

    const [ranked, setRanked] = useState(() => Array(safeAmounts.length).fill().map(() => []));

    useEffect(() => {
        const loadDonors = async () => {
            if (!fundraiserId) {
                console.warn('No fundraiserId provided');
                return;
            }
            try {
                if (!campaignId) {
                    console.warn('campaignId is not available yet, waiting...');
                    return;
                }
                setLoading(true);

                await fundraisersStore.fetchDonorsForFundraiser(fundraiserId, true);
                const donorsForFundraiser = fundraisersStore.getDonorsForFundraiser(fundraiserId);
                
                // סינון תורמים - מציג רק תורמים פעילים שעדיין לא מילא עליהם צפי
                const donorsWithoutForecast = donorsForFundraiser.filter(donor => {
                    const hasForecasted = donor.lastForecastByFundraiserId === parseInt(fundraiserId);
                    const isActive = donor.isActive !== false; // מציג רק תורמים פעילים
                    return !hasForecasted && isActive;
                });
                
                console.log('🎯 useDonorForecast - Filtering donors:', {
                    fundraiserId: parseInt(fundraiserId),
                    totalDonors: donorsForFundraiser.length,
                    activeDonors: donorsForFundraiser.filter(donor => donor.isActive !== false).length,
                    donorsWithoutForecast: donorsWithoutForecast.length
                });
                
                setDonors(donorsWithoutForecast);
            } catch (error) {
                console.error('Error loading donors:', error);
                setDonors([]);
            } finally {
                setLoading(false);
            }
        };
        loadDonors();
    }, [fundraiserId, campaignId]);

    const showNotification = (type) => {
        if (rankIdx <= skipPopupsUntilRank) return;
        if (!shownNotifications.has(type)) {
            setNotifications(prev => [...prev, { type, id: Date.now() }]);
            setShownNotifications(prev => new Set(prev).add(type));
        }
    };
    
    useEffect(() => {
        if (rankIdx <= skipPopupsUntilRank) return;
        if (ranked[rankIdx].length === 1 && !shownNotifications.has('firstDonor') && rankIdx !== RANKS.length - 1) {
            showNotification('firstDonor');
        }
        if (rankIdx === 1 && ranked.flat().length === 0 && !shownNotifications.has('secondScreenEmpty')) {
            showNotification('secondScreenEmpty');
        }
        const isThirdRank = RANKS.length >= 5 ? rankIdx === 2 : false;
        const noSelectedDonorsInCurrentRank = ranked[rankIdx].length === 0;
        if (isThirdRank && noSelectedDonorsInCurrentRank && !shownNotifications.has('needMoreDonors')) {
            showNotification('needMoreDonors');
        }
    }, [rankIdx, step, ranked, RANKS.length, shownNotifications, skipPopupsUntilRank]);

    useEffect(() => {
        setHasSelectedInCurrentRank(false);
    }, [rankIdx]);

    useEffect(() => {
        if (step === "welcome") {
            setRankIdx(0);
            setRanked(Array(RANKS.length).fill().map(() => []));
        }
    }, [step, RANKS.length]);

    useEffect(() => {
        if (step !== "rank") return;
        if (timer === 0) return;
        if (rankIdx <= skipPopupsUntilRank) {
            setTimer(0);
            return;
        }
        timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [timer, step, rankIdx, skipPopupsUntilRank]);

    // Reset timer when moving to a new rank (only while in ranking step)
    useEffect(() => {
        if (step !== "rank") return;
        setTimer(getTimerForRank(rankIdx));
    }, [rankIdx, step]);

    useEffect(() => {
        if (step !== "rank" || rankIdx !== 0) return;
        const el = donorListRef.current;
        if (!el) return;
        setHasScroll(el.scrollHeight > el.clientHeight);
        const onScroll = () => {
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
            setScrolledToBottom(atBottom);
            if (atBottom) {
                setShowScrollValidation(false);
                setHasEverScrolledToBottom(true);
            }
        };
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [step, rankIdx, donors]);

    useEffect(() => {
        if (step !== "rank") return;
        if (donorListRef.current) {
            donorListRef.current.scrollTop = 0;
        }
    }, [rankIdx, step]);

    const availableDonors = donors;
    const assignedDonorIds = ranked.flat().map(d => d.originalIndex);
    const coins = ranked.map(arr => arr.length).reduce((acc, count, idx) => {
        acc[idx + 1] = count;
        return acc;
    }, {});

    const updateDonorExpectedDonation = async (donorId, expectedAmount) => {
        donorsStore.updateDonorExpectedDonation(donorId, expectedAmount);
    };

    const removeNotification = () => {
        setNotifications(prev => prev.slice(1));
    };

    const canShowOneDonorPopup = () => {
        if (rankIdx <= skipPopupsUntilRank) return false;
        if (hasSeenOneDonorPopup) return false;
        if (ranked[rankIdx].length !== 1) return false;
        if ([3, 4, 5].includes(RANKS.length)) return rankIdx === 0;
        if ([6, 7, 8].includes(RANKS.length)) return rankIdx === 0 || rankIdx === 1;
        return false;
    };

    const shouldShowSticker = () => {
        const currentRankDonors = ranked[rankIdx].length;
        const totalDonors = donors.length;
        if (currentRankDonors === 0) return false;
        const allRanked = ranked.flat().length;
        if (allRanked === totalDonors && rankIdx < RANKS.length - 1) return true;
        if (donorsCountAtPopupTime[rankIdx] !== undefined) {
            if (currentRankDonors <= donorsCountAtPopupTime[rankIdx]) return false;
        }
        const donorsUpToCurrentRank = ranked.slice(0, rankIdx + 1).flat().length;
        const percentageUpToCurrentRank = (donorsUpToCurrentRank / totalDonors) * 100;
        const remainingDonors = totalDonors - donorsUpToCurrentRank;
        const remainingPercentage = (remainingDonors / totalDonors) * 100;
        switch (RANKS.length) {
            case 3:
                if (rankIdx === 0 && percentageUpToCurrentRank >= 20) return true;
                if (rankIdx === 1 && percentageUpToCurrentRank >= 40) return true;
                if (rankIdx === 2 && remainingPercentage < 40) return true;
                break;
            case 4:
                if (rankIdx === 0) return true;
                if (rankIdx === 1 && percentageUpToCurrentRank >= 10) return true;
                if (rankIdx === 2 && percentageUpToCurrentRank >= 45) return true;
                if (rankIdx === 3 && remainingPercentage < 15) return true;
                break;
            case 5:
                if (rankIdx === 0) return true;
                if (rankIdx === 1 && percentageUpToCurrentRank >= 10) return true;
                if (rankIdx === 2 && percentageUpToCurrentRank >= 30) return true;
                if (rankIdx === 3 && percentageUpToCurrentRank >= 30) return true;
                if (rankIdx === 4 && remainingPercentage < 15) return true;
                break;
            case 6:
                if (rankIdx === 0) return true;
                if (rankIdx === 1 && percentageUpToCurrentRank >= 7) return true;
                if (rankIdx === 2 && percentageUpToCurrentRank >= 15) return true;
                if (rankIdx === 3 && percentageUpToCurrentRank >= 30) return true;
                if (rankIdx === 4 && percentageUpToCurrentRank >= 50) return true;
                if (rankIdx === 5 && remainingPercentage < 15) return true;
                break;
            case 7:
                if (rankIdx === 0) return true;
                if (rankIdx === 1 && percentageUpToCurrentRank >= 7) return true;
                if (rankIdx === 2 && percentageUpToCurrentRank >= 15) return true;
                if (rankIdx === 3 && percentageUpToCurrentRank >= 30) return true;
                if (rankIdx === 4 && percentageUpToCurrentRank >= 30) return true;
                if (rankIdx === 5 && percentageUpToCurrentRank >= 50) return true;
                if (rankIdx === 6 && remainingPercentage < 15) return true;
                break;
            case 8:
                if (rankIdx === 0) return true;
                if (rankIdx === 1 && percentageUpToCurrentRank >= 5) return true;
                if (rankIdx === 2 && percentageUpToCurrentRank >= 10) return true;
                if (rankIdx === 3 && percentageUpToCurrentRank >= 16) return true;
                if (rankIdx === 4 && percentageUpToCurrentRank >= 20) return true;
                if (rankIdx === 5 && percentageUpToCurrentRank >= 30) return true;
                if (rankIdx === 6 && percentageUpToCurrentRank >= 50) return true;
                if (rankIdx === 7 && remainingPercentage < 15) return true;
                break;
        }
        return false;
    };
    
    const canProceed = () => {
        if (rankIdx <= skipPopupsUntilRank) return true;
        const allRanked = ranked.flat().length;
        if (allRanked === donors.length) return true;
        if (timer > 0) return false;
        if (rankIdx === RANKS.length - 1) return allRanked === donors.length;
        return true;
    };

    const addToRank = (donor) => {
        if (ranked.flat().find(d => d.originalIndex === donor.originalIndex)) return;
        setHasSelectedInCurrentRank(true);
        setRanked(prev => {
            const newRanked = prev.map((arr, idx) => idx === rankIdx ? [...arr, donor] : arr);
            return newRanked;
        });
        if (donor.donorId && RANKS[rankIdx]) {
            updateDonorExpectedDonation(donor.donorId, RANKS[rankIdx].amount);
        }
    };

    const returnDonor = (donor) => {
        setRanked(prev => prev.map(arr => arr.filter(d => d.originalIndex !== donor.originalIndex)));
        if (donor.donorId) {
            updateDonorExpectedDonation(donor.donorId, 0);
        }
    };

    const updateMousePos = (e) => {
        if (screenRef.current) {
            const rect = screenRef.current.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
    };

    const handleStickerAndProceed = (nextAction) => {
        if (shouldShowSticker()) {
            setShowSticker(false);
            setTimeout(() => {
                setShowSticker(true);
                setTimeout(nextAction, 1000);
            }, 50);
        } else {
            nextAction();
        }
    };

    const handleResetRanking = () => {
        setRankIdx(0);
        setSkipPopupsUntilRank(2);
        setHasSelectedInCurrentRank(false);
    };

    const handleContinueWithoutReset = () => {
        setShowResetRankingPopup(false);
        setRankIdx(prev => prev + 1);
        setHasSelectedInCurrentRank(false);
    };

    const nextRank = async () => {
        const finishRanking = async () => {
            try {
                await fundraisersStore.updateStatus(fundraiserId, { status_forecast: 'SUCCESS' });
            } catch (error) {
                console.error('Failed to update forecast status to "SUCCESS":', error);
            }
            setStep("finish");
        };

        if (ranked.flat().length === donors.length) {
            handleStickerAndProceed(finishRanking);
            return;
        }
        if (rankIdx === RANKS.length - 1) {
            handleStickerAndProceed(finishRanking);
            return;
        }

        if (rankIdx === RANKS.length - 2) {
            const hasAnySelectedDonors = ranked.some(rank => rank.length > 0);
            if (hasAnySelectedDonors && !shownNotifications.has('alreadySelectedDonors')) {
                showNotification('alreadySelectedDonors');
                return;
            } else if (!hasAnySelectedDonors && !shownNotifications.has('lastScreenEmpty')) {
                showNotification('lastScreenEmpty');
                return;
            }
        }

        if (RANKS.length > 4 && rankIdx === 2 && !hasSelectedInCurrentRank && !hasSeenResetPopup) {
            setShowResetRankingPopup(true);
            setHasSeenResetPopup(true);
            return;
        }

        if (canShowOneDonorPopup()) {
            setDonorsCountAtPopupTime(prev => ({ ...prev, [rankIdx]: ranked[rankIdx].length }));
            setShowOneDonorPopup(true);
            setHasSeenOneDonorPopup(true);
            handleStickerAndProceed(() => {});
            return;
        }

        if (rankIdx === 0 && ranked[0].length === 0 && !hasSeenNoDonorsPopup && rankIdx > skipPopupsUntilRank) {
            setShowNoDonorsPopup(true);
            setHasSeenNoDonorsPopup(true);
            return;
        }

        if (rankIdx === 1 && ranked.flat().length === 0 && !showChatBotPopup && !hasSeenChatBot && rankIdx > skipPopupsUntilRank) {
            setShowChatBotPopup(true);
            setHasSeenChatBot(true);
            return;
        }

        handleStickerAndProceed(() => {
            setRankIdx(prev => prev + 1);
            setHasSelectedInCurrentRank(false);
        });
    };

    const handleMouseDown = (donor, e) => {
        draggedDonorRef.current = donor;
        setDraggedDonor(donor);
        setIsDragging(true);
        updateMousePos(e);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e) => {
        updateMousePos(e);
        if (screenRef.current) {
            const leftPanel = document.getElementById('selectedListPanel');
            if (leftPanel) {
                const rect = leftPanel.getBoundingClientRect();
                setIsDragOver(
                    e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom
                );
            }
        }
    };

    const handleMouseUp = (e) => {
        let overLeftPanel = false;
        const leftPanel = document.getElementById('selectedListPanel');
        if (leftPanel) {
            const rect = leftPanel.getBoundingClientRect();
            overLeftPanel = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
        }
        if (overLeftPanel && draggedDonorRef.current) {
            addToRank(draggedDonorRef.current);
        }
        setIsDragging(false);
        setDraggedDonor(null);
        draggedDonorRef.current = null;
        setIsDragOver(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    };

    const handleMouseUpShort = (donor) => {
        if (dragTimeout.current) {
            clearTimeout(dragTimeout.current);
            if (!isDragging) {
                addToRank(donor);
            }
        }
        setIsDragging(false);
    };

    return {
        router,
        step,
        setStep,
        rankIdx,
        setRankIdx,
        timer,
        setTimer,
        donors,
        loading,
        draggedDonor,
        draggedDonorRef,
        isDragOver,
        isDragging,
        mousePos,
        screenRef,
        donorListRef,
        hasScroll,
        scrolledToBottom,
        showScrollValidation,
        setShowScrollValidation,
        hasEverScrolledToBottom,
        setHasEverScrolledToBottom,
        showNoDonorsPopup,
        setShowNoDonorsPopup,
        hasSeenNoDonorsPopup,
        setHasSeenNoDonorsPopup,
        showOneDonorPopup,
        setShowOneDonorPopup,
        hasSeenOneDonorPopup,
        setHasSeenOneDonorPopup,
        showChatBotPopup,
        setShowChatBotPopup,
        hasSeenChatBot,
        setHasSeenChatBot,
        showResetRankingPopup,
        setShowResetRankingPopup,
        skipPopupsUntilRank,
        setSkipPopupsUntilRank,
        showSticker,
        setShowSticker,
        notifications,
        removeNotification,
        hasSelectedInCurrentRank,
        setHasSelectedInCurrentRank,
        RANKS,
        ranked,
        setRanked,
        availableDonors,
        assignedDonorIds,
        coins,
        canProceed,
        nextRank,
        returnDonor,
        addToRank,
        handleMouseDown,
        handleMouseUpShort,
        handleResetRanking,
        handleContinueWithoutReset,
    };
}
