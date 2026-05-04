"use client";
import Button from '@/app/components/Button';
import styles from './alerts.module.scss';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRef, useState, useEffect, useContext, useMemo } from 'react';
import Person from '@/app/components/Person';
import Search from '@/app/components/Search';
import Link from "@/app/icons/donorLink.svg"
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/stores/StoreContext";
import { groupPeopleByLastNameInitial } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// Helper for sorting by last name
const nameSorter = (a, b) => (a.last_name || '').localeCompare(b.last_name || '', 'he');

// Sorter definitions
const sorters = {
    asc: nameSorter,
    desc: (a, b) => nameSorter(b, a),
    unassigned: (a, b) => {
        const aIsAssigned = !!a.assigned_fundraiser_id;
        const bIsAssigned = !!b.assigned_fundraiser_id;
        // The expression (aIsAssigned - bIsAssigned) sorts booleans (false, true)
        // so unassigned donors (false) will come first.
        return (aIsAssigned - bIsAssigned) || nameSorter(a, b);
    },
    assigned: (a, b) => {
        const aIsAssigned = !!a.assigned_fundraiser_id;
        const bIsAssigned = !!b.assigned_fundraiser_id;
        // The expression (bIsAssigned - aIsAssigned) sorts booleans (true, false)
        // so assigned donors (true) will come first.
        return (bIsAssigned - aIsAssigned) || nameSorter(a, b);
    }
};

export default observer(function DonorAssignment({ open, onClose, fundIndex }) {
    const t = useTranslations('alerts.donorAssignment');
    const store = useContext(StoreContext);
    const [currentFundraiserIndex, setCurrentFundraiserIndex] = useState();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [currentFundraiser, setCurrentFundraiser] = useState(null);
    const [currentFundraiserName, setCurrentFundraiserName] = useState('');
    const [namesCount, setNamesCount] = useState({});
    
    const [assignedDonors, setAssignedDonors] = useState([]);
    const [assignedCount, setAssignedCount] = useState(0);
    const tableBodyRef = useRef(null);
    const [shouldScroll, setShouldScroll] = useState(false);
    const [maxHeight, setMaxHeight] = useState(0);
    const [loadingStates, setLoadingStates] = useState({});
    const originalFiltersRef = useRef(null);
    const allDonorsRef = useRef([]); // Store all donors (unfiltered) for assigned donors section
    const isInitialLoadRef = useRef(true); // Track whether it's the first load vs a filter reload
    const [openSynagogue, setOpenSynagogue] = useState(false);
    const [openSort, setOpenSort] = useState(false);

    const donors = store.donorsStore.assignableDonors; // Use the new dedicated state
    const fundraisers = store.fundraisersStore.fundraisers;

    const min = 12;
    const max = 18;

    // Calculate donor count per fundraiser once - use allDonorsRef (unfiltered) for accurate counts
    const fundraiserDonorCounts = useMemo(() => {
        const counts = new Map();
        // Use allDonorsRef if available, otherwise fall back to donors
        const donorsSource = allDonorsRef.current.length > 0 ? allDonorsRef.current : donors;
        const activeDonors = donorsSource.filter(d => d.active !== false);
        
        // Initialize all fundraisers with 0
        fundraisers.forEach(f => counts.set(f.fundraiser_id, 0));
        
        // Efficient counting
        activeDonors.forEach(donor => {
            if (donor.assigned_fundraiser_id) {
                const current = counts.get(donor.assigned_fundraiser_id) || 0;
                counts.set(donor.assigned_fundraiser_id, current + 1);
            }
        });
        
        return counts;
    }, [fundraisers, donors, assignedDonors]); // Added assignedDonors to recalculate when assignments change

    const completionText = useMemo(() => {
        const completed = fundraisers.filter(f => {
            const count = fundraiserDonorCounts.get(f.fundraiser_id) || 0;
            return count >= min;
        }).length;

        const total = fundraisers.length;

        return completed === 1
            ? t('completionSingle', { total })
            : t('completionPlural', { completed, total });
    }, [fundraisers, fundraiserDonorCounts, min, t]);

    // This effect handles assigning data once it's loaded or when the index changes
    useEffect(() => {
        if (open && fundraisers.length > 0 && typeof currentFundraiserIndex === 'number') {
            handleAssignData(currentFundraiserIndex);
        }
    }, [open, donors, fundraisers, currentFundraiserIndex]);


    // This effect handles data fetching and state reset when the modal opens
    useEffect(() => {
        if (open) {
            // Reset initial load flag each time dialog opens
            isInitialLoadRef.current = true;
            // Save original filters - deep copy
            originalFiltersRef.current = JSON.parse(JSON.stringify(store.donorsStore.filters));
            
            // Reset filters before loading data
            store.donorsStore.setFilters({});
            
            const loadData = async () => {
                await Promise.all([
                    store.donorsStore.fetchAssignableDonors(),
                    store.fundraisersStore.fetchFundraisers(true)
                ]);
                // Save all donors (unfiltered) for assigned donors section
                allDonorsRef.current = [...store.donorsStore.assignableDonors];
                store.donorsStore.fetchSynagogues();
                isInitialLoadRef.current = false;
            };

            loadData();
            if (fundraisers.length > 0) {
                if (fundIndex) {
                    const index = fundraisers.findIndex(f => f.fundraiser_id === fundIndex);
                    setCurrentFundraiserIndex(index > -1 ? index : 0);
                } else {
                    setCurrentFundraiserIndex(0);
                }
            }
            setSearchTerm('');
            setSortOrder('asc');
        }
    }, [open]);

    useEffect(() => {
        const newNamesCount = donors.reduce((acc, person) => {
            const fullName = `${person.first_name} ${person.last_name}`;
            acc[fullName] = (acc[fullName] || 0) + 1;
            return acc;
        }, {});
        setNamesCount(newNamesCount);
    }, [donors]);

    useEffect(() => {
        if (!open) return;

        requestAnimationFrame(() => {
            if (tableBodyRef.current) {
                const viewportHeight = window.innerHeight;
                const calculatedMax = Math.min(52, viewportHeight * 0.9 - 464);
                setMaxHeight(calculatedMax);
                const tableHeight = tableBodyRef.current.scrollHeight;
                setShouldScroll(tableHeight > maxHeight);
            }
        });
    }, [open, tableBodyRef.current, donors]);

    // Filter donors by search term - only active donors from selected synagogue
    const getFilteredDonors = () => {
        const activeDonors = donors.filter(donor => donor.active !== false);

        if (!searchTerm.trim()) return activeDonors;

        const term = searchTerm.toLowerCase();
        return activeDonors.filter(donor =>
            donor.first_name?.toLowerCase().includes(term) ||
            donor.last_name?.toLowerCase().includes(term) ||
            donor.email?.toLowerCase().includes(term) ||
            donor.main_mobile?.includes(term) ||
            donor.city_name?.toLowerCase().includes(term)
        );
    };

    // Sort donors function (returns new copy)
    const sortPeople = () => {
        const filteredDonors = getFilteredDonors();
        const sorter = sorters[sortOrder] || sorters.asc;
        return [...filteredDonors].sort(sorter);
    };

    const sortedData = useMemo(() => {
        return sortPeople();
    }, [sortOrder, donors, searchTerm]);

    const groupedData = useMemo(() => {
        return groupPeopleByLastNameInitial(sortedData);
    }, [sortedData]);

    function handleSynagogueChange(synagogue) {
        // Convert 'all' to null to clear the filter
        const synagogueValue = synagogue === 'all' ? null : synagogue;
        console.log('🏛️ handleSynagogueChange:', { synagogue, synagogueValue });
        store.donorsStore.setFilters({
            ...store.donorsStore.filters,
            synagogue: synagogueValue
        });
        console.log('🏛️ Current filters after set:', store.donorsStore.filters);
        store.donorsStore.fetchAssignableDonors();
    }

    function handleAssignData(index) {
        // Safety check to ensure fundraisers array is populated
        if (index < 0 || index >= fundraisers.length) {
            console.warn(`handleAssignData called with invalid index: ${index}`);
            return;
        }

        const newCurrentFundraiser = fundraisers[index];
        setCurrentFundraiser(newCurrentFundraiser);
        setCurrentFundraiserName(`${newCurrentFundraiser.first_name} ${newCurrentFundraiser.last_name}`);
        
        if (newCurrentFundraiser) {
            // Use allDonorsRef (unfiltered) for assigned donors, not the filtered donors list
            const donorsSource = allDonorsRef.current.length > 0 ? allDonorsRef.current : donors;
            const count = fundraiserDonorCounts.get(newCurrentFundraiser.fundraiser_id) || 0;
            const newAssignedDonors = donorsSource.filter(d =>
                d.assigned_fundraiser_id === newCurrentFundraiser.fundraiser_id && d.active !== false
            );
            setAssignedDonors(newAssignedDonors);
            setAssignedCount(count);
        } else {
            setAssignedDonors([]);
            setAssignedCount(0);
        }   
    }
    
    const handleClose = () => {
        // Restore original filters and refetch
        if (originalFiltersRef.current !== null) {
            store.donorsStore.setFilters(originalFiltersRef.current);
            store.donorsStore.fetchDonors();
            store.donorsStore.fetchDonorsSummary();
        }
        onClose();
    };

    const handleOpenChange = (isOpen) => {
        // This function is called by the Dialog when the user tries to close it.
        if (!isOpen) {
            handleClose();
        }
    };
    
    const handleAssignDonor = async (donorId) => {
        if (!currentFundraiser) return;

        setLoadingStates(prev => ({ ...prev, [donorId]: true }));

        try {
            const result = await store.donorsStore.assignDonorToFundraiser(donorId, currentFundraiser.fundraiser_id);
            
            // Update allDonorsRef when assignment changes
            if (result.success) {
                allDonorsRef.current = allDonorsRef.current.map(d => 
                    d.id === donorId ? { ...d, assigned_fundraiser_id: currentFundraiser.fundraiser_id } : d
                );
                // Update assigned donors list
                const assignedDonor = allDonorsRef.current.find(d => d.id === donorId);
                if (assignedDonor) {
                    setAssignedDonors(prev => [...prev, assignedDonor].sort(nameSorter));
                    setAssignedCount(prev => prev + 1);
                }
            }

        } finally {
            setLoadingStates(prev => ({ ...prev, [donorId]: false }));
        }
    };

    const cancelAssign = async (donorId) => {
        setLoadingStates(prev => ({ ...prev, [donorId]: true }));

        try {
            const result = await store.donorsStore.cancelDonorAssignment(donorId);
            
            // Update allDonorsRef when assignment is cancelled
            if (result.success) {
                allDonorsRef.current = allDonorsRef.current.map(d => 
                    d.id === donorId ? { ...d, assigned_fundraiser_id: null } : d
                );
                // Update assigned donors list
                setAssignedDonors(prev => prev.filter(d => d.id !== donorId));
                setAssignedCount(prev => Math.max(0, prev - 1));
            }

        } finally {
            setLoadingStates(prev => ({ ...prev, [donorId]: false }));
        }
    };

    const handleNextFundraiser = () => {
        setCurrentFundraiserIndex((prev) => Math.min(prev + 1, fundraisers.length - 1));
    };

    const handlePrevFundraiser = () => {
        setCurrentFundraiserIndex((prev) => Math.max(prev - 1, 0));
    };

    const handleSortChange = (value) => {
        setSortOrder(value);
    };

    const getBorderColorClass = () => {
        if (assignedCount === 0) return styles.borderEmpty;
        if (assignedCount < min) return styles.borderBelow;
        if (assignedCount <= max) return styles.borderGood;
        return styles.borderOver;
    };

    const getDisplayText = (value) => {
        const options = {
            'asc': t('sortAsc'),
            'desc': t('sortDesc'),
            'unassigned': t('sortUnassigned'),
            'assigned': t('sortAssigned')
        };
        return `${t('sortBy')} ${options[value] || ''}`;
    };

    const getColorClass = (count) => {
        if (count < min) return styles.navUnder;
        if (count <= max) return styles.navGood;
        return styles.navOver;
    };

    const renderAvailableDonor = (person, assignedList = false) => {
        if (assignedList) {
            return (<Person
                key={person.id}
                firstName={person.first_name}
                lastName={person.last_name}
                icon={<Link />}
                donorSelected
                onClick={() => cancelAssign(person.id)}
                details={{
                    phone: person.main_mobile,
                    email: person.email,
                    address: person.street_name ? `${person.street_name} ${person.houseNumber || ''}` : person.address,
                    city: person.city_name
                }}
                onCancelFund={() => cancelAssign(person.id)}
                fundraiserName={currentFundraiserName}
                loading={loadingStates[person.id]}
                disabled={loadingStates[person.id]}
            />);
        }
        const assignedFundraiser = fundraisers.find(f => f.fundraiser_id === person.assigned_fundraiser_id);
        const fundraiserName = assignedFundraiser ? `${assignedFundraiser.first_name} ${assignedFundraiser.last_name}` : null;
               
        return (<Person
            key={person.id}
            firstName={person.first_name}
            lastName={person.last_name}
            sameName={namesCount[`${person.first_name} ${person.last_name}`] > 1}
            onClick={() => handleAssignDonor(person.id)}
            disabled={person.assigned_fundraiser_id || loadingStates[person.id]}
            icon={person.assigned_fundraiser_id ? <Link /> : null}
            donorSelected={false}
            donor
            details={{
                phone: person.main_mobile,
                email: person.email,
                address: person.street_name ? `${person.street_name} ${person.houseNumber || ''}` : person.address,
                city: person.city_name
            }}
            fundraiserName={fundraiserName}
            onCancelFund={() => cancelAssign(person.id)}
            loading={loadingStates[person.id]}
        />);
    };

    return (
        <>
            <AlertDialog open={open}
                onOpenChange={handleOpenChange}
            >
                {/* <AlertDialogTrigger>Open</AlertDialogTrigger> */}
                <AlertDialogPortal>
                    <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                    <AlertDialogContent className={`${styles.content} w-[1315px] p-[0] h-[805px] max-h-[90%] max-w-[95%] lg:max-w-[80%] rounded-[16px] shadow-lg`}>
                        <AlertDialogTitle className="sr-only">{t('srTitle')}</AlertDialogTitle>
                        <div className={`${styles.modalMatchingContent} ${styles.modalContent}`}>

                            {/* Initial loading state only */}
                            {((isInitialLoadRef.current && store.donorsStore.loadingAssignableDonors) || store.fundraisersStore.loadingFundraisers || !currentFundraiser) ? (
                                <div className={styles.loadingState}>
                                    <div>{t('loadingData')}</div>
                                </div>
                            ) : (
                            <>
                                <div className={styles.assignedDonors}>
                                    <div className={styles.borderProgressWrapper}>
                                        {assignedCount < min && (
                                            <div
                                                className={styles.borderProgressFill}
                                                style={{
                                                    '--progress-fill': `${Math.min((assignedCount / min) * 100, 100)}%`
                                                }}
                                            />
                                        )}
                                        <div className={`${styles.assignedContent} ${getBorderColorClass()}`}>
                                            <div className={styles.assignTitels}>
                                                <div className='table-2'>{t('selectDonorsFor')}</div>
                                                <p className='headline-2'>{currentFundraiserName} </p>
                                            </div>
                                            <div className={styles.assignedDonorsButtons}
                                                ref={tableBodyRef} style={{
                                                    paddingRight: shouldScroll ? "18px" : "12px"
                                                }}
                                            >
                                                {assignedDonors.map((donor) => renderAvailableDonor(donor, true))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`small-button-1 ${styles.recommendation}`}>
                                        {t('selected')}{" "}
                                        <span className={`${styles.donorsCount} ${assignedCount > max ? styles.aboveMax : ''}`}>
                                            {t('donorsCount', { count: assignedCount })}
                                        </span>{" "}
                                        {t('ourRecommendation')}{" "}
                                        <span className={styles.bold}>
                                            {t('atLeast', { min })} {t('noMoreThan', { max })}
                                        </span>
                                    </div>
                                </div>
                                <div className={`${styles.bigWrapper} ${styles.assignedWrapper}`}>
                                    <div className={styles.searchAndSortContainer}>
                                        <Search
                                            onSearch={setSearchTerm}
                                            long
                                            className={styles.centeredSearch}
                                            value={searchTerm}
                                        />
                                        <div className={styles.iconSortWrapper}>
                                            {/* Synagogue selection box */}
                                            <div className={`${styles.sortWrapper} small-button-1`}>
                                                <Select
                                                    value={store.donorsStore.filters.synagogue || 'all'}
                                                    onValueChange={(value) => handleSynagogueChange(value)}
                                                    disabled={store.donorsStore.loadingSynagogues}
                                                    open={openSynagogue}
                                                    onOpenChange={(o) => { setOpenSynagogue(o); if (o) setOpenSort(false); }}
                                                >
                                                    <SelectTrigger className="selectTrigger selectTriggerSynagogue">
                                                        <SelectValue placeholder={t('selectSynagogue')} />
                                                    </SelectTrigger>
                                                    <SelectContent className="selectGroup selectGroupSynagogue">
                                                        <SelectGroup>
                                                            <SelectItem className="selectItem" key={"all"} value="all">{t('all')}</SelectItem>
                                                            {store.donorsStore.synagogues.map((synagogue) => (
                                                                <SelectItem className="selectItem" key={synagogue} value={synagogue}>{synagogue}</SelectItem>
                                                            ))}
                                                            <SelectItem className="selectItem" key={"no-synagogue"} value={"no-synagogue"}>{t('noSynagogue')}</SelectItem>
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className={`${styles.sortWrapper} small-button-1`}>
                                                <Select value={sortOrder} onValueChange={handleSortChange}
                                                    open={openSort}
                                                    onOpenChange={(o) => { setOpenSort(o); if (o) setOpenSynagogue(false); }}
                                                >
                                                    <SelectTrigger className="selectTrigger selectTriggerDonors">
                                                        <SelectValue className="small-button-1">{getDisplayText(sortOrder)}</SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className="selectGroup selectGroupDonors">
                                                        <SelectGroup className="small-button-1">
                                                            <SelectItem className="selectItem" value="asc">{t('sortAsc')}</SelectItem>
                                                            <SelectItem className="selectItem" value="desc">{t('sortDesc')}</SelectItem>
                                                            <SelectItem className="selectItem" value="unassigned">{t('sortUnassigned')}</SelectItem>
                                                            <SelectItem className="selectItem" value="assigned">{t('sortAssigned')}</SelectItem>
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`${styles.assignedPeopleWrapper}`}>
                                        {store.donorsStore.loadingAssignableDonors ? (
                                            <div className={styles.donorsListLoading}>
                                                <div className={styles.spinner} />
                                            </div>
                                        ) : (
                                        <div className={styles.peopleGrid}>
                                            {sortOrder === 'assigned' || sortOrder === 'unassigned' ? (
                                                <>
                                                    <div className={styles.sortedWrapper}>
                                                        <span className="button-1">{sortOrder == "assigned" ? t('assignedNames') : t('unassignedNames')}</span>
                                                        <div className={styles.peopleInLetter}>
                                                            {sortedData.filter(person => sortOrder == "assigned" ? person.assigned_fundraiser_id : !person.assigned_fundraiser_id).map((person)=>renderAvailableDonor(person, false))}
                                                        </div>
                                                    </div>
                                                    <div className={styles.groupSpacing}></div>
                                                    <div className={styles.sortedWrapper}>
                                                        <span className="button-1">{sortOrder == "assigned" ? t('unassignedNames') : t('assignedNames')}</span>
                                                        <div className={styles.peopleInLetter}>
                                                            {sortedData.filter(person => sortOrder == "assigned" ? !person.assigned_fundraiser_id : person.assigned_fundraiser_id).map((person)=>renderAvailableDonor(person, false))}
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                Object.keys(groupedData).map(group => (
                                                    <div key={group} className={styles.letterGroup}>
                                                        <h3 className={`button-1 ${styles.letter}`}>{group}</h3>
                                                        <div className={styles.peopleInLetter}>
                                                            {groupedData[group].map((person)=>renderAvailableDonor(person, false))}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        )}
                                    </div>
                                </div>
                                <div className={styles.assignedBottom}>
                                    <div className={styles.buttons}>
                                        <div className={styles.navigationButtons}>
                                            <Button
                                                onClick={handlePrevFundraiser}
                                                text={t('prevFundraiser')}
                                                smallSmall
                                                disabled={currentFundraiserIndex <= 0}
                                            />
                                            <Button
                                                onClick={handleNextFundraiser}
                                                text={t('nextFundraiser')}
                                                primary
                                                smallSmall
                                                disabled={currentFundraiserIndex >= fundraisers.length - 1}
                                            />
                                        </div>
                                        <div className={styles.bottomButtons}>
                                            <Button
                                                onClick={handleClose}
                                                disabled={fundraisers.some(f =>
                                                    !donors.some(d => d.assigned_fundraiser_id === f.fundraiser_id && d.active !== false)
                                                )}
                                                text={t('doneWithAll')}
                                                primary
                                            />
                                            <Button
                                                textOnly text={t('continueLater')} onClick={handleClose} />
                                        </div>
                                    </div>
                                    <div className={styles.navigation}>
                                        <div className={styles.navigationsWithNames}>
                                            {fundraisers.map((fundraiser, index) => {
                                                // Use count from cache instead of heavy filter
                                                const count = fundraiserDonorCounts.get(fundraiser.fundraiser_id) || 0;
                                                return (
                                                    <button onClick={() => setCurrentFundraiserIndex(index)} className={styles.navWrapper} key={index}>
                                                        <div className={`${styles.navTooltip} small-button-1`}>{fundraiser.last_name} {fundraiser.first_name}</div>
                                                        <div
                                                            className={`${styles.navBar} ${getColorClass(count)} ${index === currentFundraiserIndex ? styles.active : ''}`}

                                                        />
                                                    </button>

                                                );
                                            })}
                                        </div>
                                        <p className='validation'>
                                            {completionText}
                                        </p>
                                    </div>
                                </div>
                            </>
                            )}
                        </div>
                    </AlertDialogContent>
                </AlertDialogPortal>
            </AlertDialog>
        </>
    );
})