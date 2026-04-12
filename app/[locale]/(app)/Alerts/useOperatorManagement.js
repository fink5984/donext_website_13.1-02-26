import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { StoreContext } from "@/stores/StoreContext";
import fetchWithAuth from '@/app/utils/fetchWithAuth';

export function useOperatorManagement(open) {
    const store = useContext(StoreContext);
    const [fundraisers, setFundraisers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingStates, setLoadingStates] = useState({});
    // Store all operators locally
    const [allOperators, setAllOperators] = useState([]);
    const hasFetchedRef = useRef(false);

    const refreshData = useCallback(async (isFirst = false) => {
        if (isFirst) setIsLoading(true);
        try {
            // Fetch ALL fundraisers (source for operator selection)
            const fetchedFundraisers = await store.fundraisersStore.fetchAllFundraisersForExport();
            
            // Fetch current operators directly via API to avoid triggering parent observer re-renders
            const res = await fetchWithAuth('/api/operators');
            const result = await res.json();
            const currentOperators = (result.data || []).map(f => ({
                ...f,
                id: f.fundraiser_id,
                donorsCount: parseInt(f.donors_count) || 0,
            }));
            
            setAllOperators(currentOperators);
            
            // Mark which fundraisers are already operators
            const operatorFundraiserIds = new Set(currentOperators.map(o => o.fundraiser_id || o.id));
            
            const withOperatorFlags = fetchedFundraisers.map(f => ({
                ...f,
                person_id: f.person_id,
                first_name: f.first_name || '',
                last_name: f.last_name || '',
                city: f.city || '',
                main_mobile: f.main_mobile || '',
                email: f.email || '',
                isOperator: operatorFundraiserIds.has(f.fundraiser_id || f.id)
            }));
            
            setFundraisers(withOperatorFlags);
        } catch (err) {
            console.error("Error fetching operator data:", err);
        } finally {
            if (isFirst) {
                setIsLoading(false);
            }
        }
    }, [store.fundraisersStore]);

    useEffect(() => {
        if (open && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            refreshData(true);
        }
        if (!open) {
            hasFetchedRef.current = false;
        }
    }, [open, refreshData]);

    const handleOperatorToggle = async (fundraiser) => {
        const fundraiserId = fundraiser.fundraiser_id || fundraiser.id;
        setLoadingStates(prev => ({ ...prev, [fundraiserId]: true }));
        try {
            const isCurrentlyOperator = fundraiser.isOperator;
            
            // Toggle via direct API call to avoid triggering parent observer
            await fetchWithAuth('/api/operators', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fundraiserId, isOperator: !isCurrentlyOperator })
            });
            
            // Update local states
            if (isCurrentlyOperator) {
                // Remove from operators
                setAllOperators(prev => prev.filter(o => (o.fundraiser_id || o.id) !== fundraiserId));
            } else {
                // Add to operators - fetch fresh list via API
                const res = await fetchWithAuth('/api/operators');
                const result = await res.json();
                const freshOperators = (result.data || []).map(f => ({
                    ...f,
                    id: f.fundraiser_id,
                    donorsCount: parseInt(f.donors_count) || 0,
                }));
                setAllOperators(freshOperators);
            }
            
            // Update the fundraisers list
            setFundraisers(prev => prev.map(f => {
                const fId = f.fundraiser_id || f.id;
                if (fId === fundraiserId) {
                    return { ...f, isOperator: !isCurrentlyOperator };
                }
                return f;
            }));
            
        } catch (err) {
            console.error('Error in handleOperatorToggle:', err);
        } finally {
            setLoadingStates(prev => ({ ...prev, [fundraiserId]: false }));
        }
    };

    return {
        fundraisers,
        isLoading,
        loadingStates,
        operators: allOperators,
        handleOperatorToggle
    };
}
