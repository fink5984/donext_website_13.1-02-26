import { useState, useEffect, useContext, useCallback } from 'react';
import { StoreContext } from "@/stores/StoreContext";

export function useFundraiserManagement(open) {
    const store = useContext(StoreContext);
    const [people, setPeople] = useState([]);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedDeleteFundraiser, setSelectedDeleteFundraiser] = useState(null);
    const [loadingStates, setLoadingStates] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    // Store all fundraisers locally (not affected by main page's search filter)
    const [allFundraisers, setAllFundraisers] = useState([]);

    const refreshFundraisersAndPeople = useCallback(async (isFirst = false) => {
        if (isFirst) setIsLoading(true);
        try {
            // Fetch ALL fundraisers directly without affecting store filters
            const [fetchedFundraisers] = await Promise.all([
                store.fundraisersStore.fetchAllFundraisersForExport(),
                store.donorsStore.fetchDonors({ noLimit: true })
            ]);
            
            // Store all fundraisers locally
            setAllFundraisers(fetchedFundraisers);

            let peopleData = store.donorsStore.donors;
            const currentFundraisers = fetchedFundraisers;
            const fundraiserPersonIds = new Set(currentFundraisers.map(f => f.person_id || f.id));

            peopleData = peopleData.filter(p => p.active || fundraiserPersonIds.has(p.person_id));

            function getPersonDetails(personId) {
                const person = peopleData.find(p => p.person_id === personId);
                if (person) return person;
                const fundraiser = currentFundraisers.find(f => f.person_id === personId);
                if (fundraiser) {
                    return {
                        person_id: fundraiser.person_id,
                        first_name: fundraiser.first_name || '',
                        last_name: fundraiser.last_name || '',
                        street_name: fundraiser.street_name || '',
                        house_number: fundraiser.house_number || '',
                        city_name: fundraiser.city || fundraiser.city_name || '',
                        main_mobile: fundraiser.main_mobile || '',
                        email: fundraiser.email || '',
                    };
                }
                return { person_id: personId, first_name: '', last_name: '', street_name: '', house_number: '', city_name: '', main_mobile: '', email: '' };
            }

            const missingFundraisers = currentFundraisers.filter(f => !peopleData.some(p => p.person_id === f.person_id));
            peopleData = [
                ...peopleData,
                ...missingFundraisers.map(f => ({
                    ...getPersonDetails(f.person_id),
                    isFundraiser: true,
                }))
            ];

            const updatedPeople = peopleData.map(p => ({
                ...p,
                isFundraiser: fundraiserPersonIds.has(p.person_id)
            }));
            setPeople(updatedPeople);
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            if (isFirst) {
                setIsLoading(false);
            }
        }
    }, [store.fundraisersStore, store.donorsStore]);

    useEffect(() => {
        if (open) {
            refreshFundraisersAndPeople(true);
        }
    }, [open, refreshFundraisersAndPeople]);

    const handleFundraiserToggle = async (person) => {
        setLoadingStates(prev => ({ ...prev, [person.person_id]: true }));
        try {
            const isCurrentlyFundraiser = allFundraisers.some(f => f.person_id === person.person_id);
            if (isCurrentlyFundraiser) {
                await removeFundraiser(person);
            } else {
                const result = await store.fundraisersStore.addFundraiser(person.person_id);
                // Update local allFundraisers state by adding the new fundraiser
                if (result.success && result.data) {
                    setAllFundraisers(prev => [result.data, ...prev]);
                }
            }
            // Get the latest fundraiser person IDs from local state
            setAllFundraisers(currentFundraisers => {
                const fundraiserPersonIds = new Set(currentFundraisers.map(f => f.person_id || f.id));
                setPeople(prevPeople => prevPeople.map(p => ({
                    ...p,
                    isFundraiser: fundraiserPersonIds.has(p.person_id)
                })));
                return currentFundraisers;
            });
        } catch (err) {
            console.error('Error in handleFundraiserToggle:', err);
            alert(err.message || 'Error saving fundraisers');
        } finally {
            setLoadingStates(prev => ({ ...prev, [person.person_id]: false }));
        }
    };

    const removeFundraiser = async (person) => {
        const fundraiser = allFundraisers.find(f => f.person_id === person.person_id);
        if (!fundraiser) return;

        const hasDonors = fundraiser.donorsCount > 0;
        
        if (hasDonors) {
            // Fetch donors before showing dialog to have full data for summary update
            const fundraiserId = fundraiser.fundraiser_id || fundraiser.id;
            await store.fundraisersStore.fetchDonorsForFundraiser(fundraiserId);
            const donors = store.fundraisersStore.getDonorsForFundraiser(fundraiserId);
            setSelectedDeleteFundraiser({ ...fundraiser, donors });
            setDeleteDialogOpen(true);
        } else {
            await store.fundraisersStore.deleteFundraiser(fundraiser);
            // Update local allFundraisers state by removing the deleted fundraiser
            const fundraiserId = fundraiser.fundraiser_id || fundraiser.id;
            setAllFundraisers(prev => prev.filter(f => (f.fundraiser_id || f.id) !== fundraiserId));
        }
    };

    const handleConfirmDelete = async () => {
        if (selectedDeleteFundraiser) {
            try {
                await store.fundraisersStore.deleteFundraiser(selectedDeleteFundraiser, true);
                // Update local allFundraisers state by removing the deleted fundraiser
                const fundraiserId = selectedDeleteFundraiser.fundraiser_id || selectedDeleteFundraiser.id;
                setAllFundraisers(prev => {
                    const updated = prev.filter(f => (f.fundraiser_id || f.id) !== fundraiserId);
                    const fundraiserPersonIds = new Set(updated.map(f => f.person_id || f.id));
                    setPeople(prevPeople => prevPeople.map(p => ({
                        ...p,
                        isFundraiser: fundraiserPersonIds.has(p.person_id)
                    })));
                    return updated;
                });
            } catch (err) {
                console.error('Error deleting fundraiser:', err);
                alert(err.message || 'Error deleting fundraiser');
            } finally {
                setDeleteDialogOpen(false);
                setSelectedDeleteFundraiser(null);
            }
        }
    };


    return {
        people,
        isLoading,
        loadingStates,
        isDeleteDialogOpen,
        selectedDeleteFundraiser,
        fundraisers: allFundraisers,
        handleFundraiserToggle,
        handleConfirmDelete,
        setDeleteDialogOpen,
        setSelectedDeleteFundraiser
    };
}
