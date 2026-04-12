import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/stores/StoreContext';
import { buildRanks } from '../../donorForecast/rankUtils';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

export const TIMER_SECONDS = 30;
export const getTimerForRank = (rankIndex) => Math.max(15, TIMER_SECONDS - rankIndex * 5);

export function useOperatorForecast({ operatorId, ranksAmounts }) {
    const { operatorsStore, campaignId } = useStore();
    const router = useRouter();

    const [step, setStep] = useState("welcome"); // welcome | rank | finish
    const [rankIdx, setRankIdx] = useState(0);
    const [timer, setTimer] = useState(TIMER_SECONDS);
    const [fundraisers, setFundraisers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [draggedFundraiser, setDraggedFundraiser] = useState(null);
    const draggedFundraiserRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const timerRef = useRef();
    const dragTimeout = useRef();
    const [isDragging, setIsDragging] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const screenRef = useRef();
    const listRef = useRef();
    const [hasScroll, setHasScroll] = useState(false);
    const [hasEverScrolledToBottom, setHasEverScrolledToBottom] = useState(false);
    const [showScrollValidation, setShowScrollValidation] = useState(false);
    const [hasSelectedInCurrentRank, setHasSelectedInCurrentRank] = useState(false);
    const [totalFundraisersCount, setTotalFundraisersCount] = useState(0);

    const safeAmounts = Array.isArray(ranksAmounts) && ranksAmounts.length > 0
        ? ranksAmounts
        : [];
    const RANKS = buildRanks(safeAmounts);

    const [ranked, setRanked] = useState(() => Array(safeAmounts.length).fill().map(() => []));

    // Load fundraisers for this operator
    useEffect(() => {
        const loadFundraisers = async () => {
            if (!operatorId || !campaignId) return;
            try {
                setLoading(true);
                const res = await fetchWithAuth(`/api/operator-forecast?operatorId=${operatorId}`);
                const data = await res.json();
                
                const allFundraisers = (data.data || []).map((f, index) => ({
                    ...f,
                    originalIndex: index,
                    donorId: f.fundraiser_id, // for compatibility with DonorRankCard pattern
                    firstName: f.first_name || '',
                    lastName: f.last_name || '',
                    mainMobile: f.main_mobile || '',
                    isActive: f.isActive !== false,
                    lastForecastByOperatorId: f.last_forecast_by_operator_id
                }));

                setTotalFundraisersCount(allFundraisers.length);

                // Filter out fundraisers who already have forecast by this operator
                const fundraisersWithoutForecast = allFundraisers.filter(f => {
                    return f.lastForecastByOperatorId !== parseInt(operatorId);
                });
                
                setFundraisers(fundraisersWithoutForecast);
            } catch (error) {
                console.error('Error loading fundraisers for operator forecast:', error);
                setFundraisers([]);
            } finally {
                setLoading(false);
            }
        };
        loadFundraisers();
    }, [operatorId, campaignId]);

    useEffect(() => {
        setHasSelectedInCurrentRank(false);
    }, [rankIdx]);

    useEffect(() => {
        if (step === "welcome") {
            setRankIdx(0);
            setRanked(Array(RANKS.length).fill().map(() => []));
        }
    }, [step, RANKS.length]);

    // Timer
    useEffect(() => {
        if (step !== "rank") return;
        if (timer === 0) return;
        timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [timer, step, rankIdx]);

    useEffect(() => {
        if (step !== "rank") return;
        setTimer(getTimerForRank(rankIdx));
    }, [rankIdx, step]);

    // Scroll detection
    useEffect(() => {
        if (step !== "rank" || rankIdx !== 0) return;
        const el = listRef.current;
        if (!el) return;
        setHasScroll(el.scrollHeight > el.clientHeight);
        const onScroll = () => {
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
            if (atBottom) {
                setShowScrollValidation(false);
                setHasEverScrolledToBottom(true);
            }
        };
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [step, rankIdx, fundraisers]);

    useEffect(() => {
        if (step !== "rank") return;
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [rankIdx, step]);

    const availableFundraisers = fundraisers;
    const assignedIds = ranked.flat().map(f => f.originalIndex);
    const coins = ranked.map(arr => arr.length).reduce((acc, count, idx) => {
        acc[idx + 1] = count;
        return acc;
    }, {});

    const updateFundraiserOperatorExpected = async (fundraiserId, expectedAmount) => {
        try {
            await fetchWithAuth('/api/operator-forecast', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fundraiserId, 
                    operatorExpected: expectedAmount,
                    operatorId: parseInt(operatorId)
                })
            });
        } catch (error) {
            console.error('Error updating fundraiser operator expected:', error);
        }
    };

    const canProceed = () => {
        const allRanked = ranked.flat().length;
        if (allRanked === fundraisers.length) return true;
        if (timer > 0) return false;
        if (rankIdx === RANKS.length - 1) return allRanked === fundraisers.length;
        return true;
    };

    const addToRank = (fundraiser) => {
        if (ranked.flat().find(f => f.originalIndex === fundraiser.originalIndex)) return;
        setHasSelectedInCurrentRank(true);
        setRanked(prev => {
            const newRanked = prev.map((arr, idx) => idx === rankIdx ? [...arr, fundraiser] : arr);
            return newRanked;
        });
        if (fundraiser.fundraiser_id && RANKS[rankIdx]) {
            updateFundraiserOperatorExpected(fundraiser.fundraiser_id, RANKS[rankIdx].amount);
        }
    };

    const returnFundraiser = (fundraiser) => {
        setRanked(prev => prev.map(arr => arr.filter(f => f.originalIndex !== fundraiser.originalIndex)));
        if (fundraiser.fundraiser_id) {
            updateFundraiserOperatorExpected(fundraiser.fundraiser_id, 0);
        }
    };

    const updateMousePos = (e) => {
        if (screenRef.current) {
            const rect = screenRef.current.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
    };

    const nextRank = async () => {
        const finishForecasting = async () => {
            setStep("finish");
        };

        if (ranked.flat().length === fundraisers.length) {
            finishForecasting();
            return;
        }
        if (rankIdx === RANKS.length - 1) {
            finishForecasting();
            return;
        }

        setRankIdx(prev => prev + 1);
        setHasSelectedInCurrentRank(false);
    };

    const handleMouseDown = (fundraiser, e) => {
        draggedFundraiserRef.current = fundraiser;
        setDraggedFundraiser(fundraiser);
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
        if (overLeftPanel && draggedFundraiserRef.current) {
            addToRank(draggedFundraiserRef.current);
        }
        setIsDragging(false);
        setDraggedFundraiser(null);
        draggedFundraiserRef.current = null;
        setIsDragOver(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    };

    const handleMouseUpShort = (fundraiser) => {
        if (dragTimeout.current) {
            clearTimeout(dragTimeout.current);
            if (!isDragging) {
                addToRank(fundraiser);
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
        fundraisers,
        loading,
        draggedFundraiserRef,
        isDragOver,
        isDragging,
        mousePos,
        screenRef,
        listRef,
        hasScroll,
        showScrollValidation,
        setShowScrollValidation,
        hasEverScrolledToBottom,
        hasSelectedInCurrentRank,
        RANKS,
        ranked,
        availableFundraisers,
        assignedIds,
        coins,
        canProceed,
        nextRank,
        returnFundraiser,
        addToRank,
        handleMouseDown,
        handleMouseUpShort,
        totalFundraisersCount,
    };
}
