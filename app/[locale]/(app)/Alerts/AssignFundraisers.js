"use client";
import Button from '@/app/components/Button';
import styles from './alerts.module.scss';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRef, useState, useEffect, useMemo, useContext, useCallback } from 'react';
import Person from '@/app/components/Person';
import Search from '@/app/components/Search';
import Link from "@/app/icons/donorLink.svg";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/stores/StoreContext";
import { groupPeopleByLastNameInitial } from '@/lib/utils';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { useTranslations } from 'next-intl';

// Helper for sorting by last name
const nameSorter = (a, b) => (a.last_name || '').localeCompare(b.last_name || '', 'he');

// Sorter definitions
const sorters = {
    asc: nameSorter,
    desc: (a, b) => nameSorter(b, a),
    unassigned: (a, b) => {
        const aIsAssigned = !!a.assigned_operator_id;
        const bIsAssigned = !!b.assigned_operator_id;
        return (aIsAssigned - bIsAssigned) || nameSorter(a, b);
    },
    assigned: (a, b) => {
        const aIsAssigned = !!a.assigned_operator_id;
        const bIsAssigned = !!b.assigned_operator_id;
        return (bIsAssigned - aIsAssigned) || nameSorter(a, b);
    }
};

/**
 * Dialog for assigning fundraisers to operators.
 * Matches the DonorAssignment dialog layout with left panel (assigned), right panel (available),
 * and bottom navigation between operators.
 */
const AssignFundraisers = observer(({ open, onClose, operatorId, operatorName }) => {
    const t = useTranslations('operatorsPage.assignDialog');
    const store = useContext(StoreContext);

    const [currentOperatorIndex, setCurrentOperatorIndex] = useState(0);
    const [currentOperator, setCurrentOperator] = useState(null);
    const [currentOperatorName, setCurrentOperatorName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [fundraisers, setFundraisers] = useState([]);
    const [assignedFundraisers, setAssignedFundraisers] = useState([]);
    const [assignedCount, setAssignedCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingStates, setLoadingStates] = useState({});
    const tableBodyRef = useRef(null);
    const [shouldScroll, setShouldScroll] = useState(false);
    const [maxHeight, setMaxHeight] = useState(0);
    const allFundraisersRef = useRef([]);

    const operators = store.operatorsStore.operators;

    const min = 3;
    const max = 8;

    // Calculate fundraiser count per operator
    const operatorFundraiserCounts = useMemo(() => {
        const counts = new Map();
        const fundraiserSource = allFundraisersRef.current.length > 0 ? allFundraisersRef.current : fundraisers;
        operators.forEach(op => counts.set(op.id, 0));
        fundraiserSource.forEach(f => {
            if (f.assigned_operator_id) {
                const current = counts.get(Number(f.assigned_operator_id)) || 0;
                counts.set(Number(f.assigned_operator_id), current + 1);
            }
        });
        return counts;
    }, [operators, fundraisers, assignedFundraisers]);

    const completionText = useMemo(() => {
        const completed = operators.filter(op => {
            const count = operatorFundraiserCounts.get(op.id) || 0;
            return count >= min;
        }).length;
        const total = operators.length;
        return completed === 1
            ? t('completionSingle', { total })
            : t('completionPlural', { completed, total });
    }, [operators, operatorFundraiserCounts, min, t]);

    const fetchAllFundraisers = useCallback(async () => {
        setIsLoading(true);
        try {
            const allFundraisers = await store.fundraisersStore.fetchAllFundraisersForExport();
            const regularFundraisers = allFundraisers.filter(f => !f.is_operator);
            const mapped = regularFundraisers.map(f => ({
                ...f,
                person_id: f.person_id,
                first_name: f.first_name || '',
                last_name: f.last_name || '',
                city: f.city || '',
                city_name: f.city || '',
                main_mobile: f.main_mobile || '',
                email: f.email || '',
                street_name: f.street_name || '',
                house_number: f.house_number || '',
            }));
            setFundraisers(mapped);
            allFundraisersRef.current = [...mapped];
        } catch (err) {
            console.error("Error fetching fundraisers for assignment:", err);
        } finally {
            setIsLoading(false);
        }
    }, [store.fundraisersStore]);

    // Handle data assignment when operator changes
    const handleAssignData = useCallback((index) => {
        if (index < 0 || index >= operators.length) return;
        const op = operators[index];
        setCurrentOperator(op);
        const name = `${op.last_name || ''} ${op.first_name || ''}`.trim();
        setCurrentOperatorName(name);

        const fundraiserSource = allFundraisersRef.current.length > 0 ? allFundraisersRef.current : fundraisers;
        const count = operatorFundraiserCounts.get(op.id) || 0;
        const assigned = fundraiserSource.filter(f =>
            f.assigned_operator_id != null && Number(f.assigned_operator_id) === Number(op.id)
        );
        setAssignedFundraisers(assigned);
        setAssignedCount(count);
    }, [operators, fundraisers, operatorFundraiserCounts]);

    // Fetch data when dialog opens
    useEffect(() => {
        if (open) {
            fetchAllFundraisers();
            store.operatorsStore.fetchOperators(true);
            if (operators.length > 0 && operatorId) {
                const index = operators.findIndex(op => op.id === operatorId);
                setCurrentOperatorIndex(index > -1 ? index : 0);
            } else {
                setCurrentOperatorIndex(0);
            }
            setSearchTerm('');
            setSortOrder('asc');
        }
    }, [open]);

    // Update assigned data when operator index or fundraisers change
    useEffect(() => {
        if (open && operators.length > 0 && typeof currentOperatorIndex === 'number') {
            handleAssignData(currentOperatorIndex);
        }
    }, [open, fundraisers, operators, currentOperatorIndex]);

    // Scroll detection
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
    }, [open, tableBodyRef.current, fundraisers]);

    const handleAssignFundraiser = async (person) => {
        if (!currentOperator) return;
        const fundraiserId = person.fundraiser_id || person.id;
        setLoadingStates(prev => ({ ...prev, [person.person_id || person.id]: true }));
        try {
            await fetchWithAuth('/api/fundraisers/assign-operator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fundraiserId, operatorId: currentOperator.id })
            });

            // Update local state
            const updatedFundraisers = fundraisers.map(f => {
                const fId = f.fundraiser_id || f.id;
                if (fId === fundraiserId) {
                    return { ...f, assigned_operator_id: currentOperator.id };
                }
                return f;
            });
            setFundraisers(updatedFundraisers);
            allFundraisersRef.current = [...updatedFundraisers];

            // Update assigned list
            const assignedF = updatedFundraisers.find(f => (f.fundraiser_id || f.id) === fundraiserId);
            if (assignedF) {
                setAssignedFundraisers(prev => [...prev, assignedF].sort(nameSorter));
                setAssignedCount(prev => prev + 1);
            }
        } catch (err) {
            console.error('Error assigning fundraiser:', err);
        } finally {
            setLoadingStates(prev => ({ ...prev, [person.person_id || person.id]: false }));
        }
    };

    const handleCancelAssign = async (person) => {
        const fundraiserId = person.fundraiser_id || person.id;
        setLoadingStates(prev => ({ ...prev, [person.person_id || person.id]: true }));
        try {
            await fetchWithAuth('/api/fundraisers/assign-operator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fundraiserId, operatorId: null })
            });

            // Update local state
            const updatedFundraisers = fundraisers.map(f => {
                const fId = f.fundraiser_id || f.id;
                if (fId === fundraiserId) {
                    return { ...f, assigned_operator_id: null };
                }
                return f;
            });
            setFundraisers(updatedFundraisers);
            allFundraisersRef.current = [...updatedFundraisers];

            // Update assigned list
            setAssignedFundraisers(prev => prev.filter(f => (f.fundraiser_id || f.id) !== fundraiserId));
            setAssignedCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error cancelling assignment:', err);
        } finally {
            setLoadingStates(prev => ({ ...prev, [person.person_id || person.id]: false }));
        }
    };

    const handleNextOperator = () => {
        setCurrentOperatorIndex(prev => Math.min(prev + 1, operators.length - 1));
    };

    const handlePrevOperator = () => {
        setCurrentOperatorIndex(prev => Math.max(prev - 1, 0));
    };

    const handleSortChange = (value) => {
        setSortOrder(value);
    };

    const handleClose = () => {
        onClose();
    };

    const handleOpenChange = (isOpen) => {
        if (!isOpen) handleClose();
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

    // Filter and sort fundraisers
    const getFilteredFundraisers = () => {
        if (!searchTerm.trim()) return fundraisers;
        const term = searchTerm.toLowerCase();
        return fundraisers.filter(f =>
            f.first_name?.toLowerCase().includes(term) ||
            f.last_name?.toLowerCase().includes(term) ||
            f.email?.toLowerCase().includes(term) ||
            f.main_mobile?.includes(term) ||
            f.city?.toLowerCase().includes(term)
        );
    };

    const sortedData = useMemo(() => {
        const filtered = getFilteredFundraisers();
        const sorter = sorters[sortOrder] || sorters.asc;
        return [...filtered].sort(sorter);
    }, [sortOrder, fundraisers, searchTerm]);

    const groupedData = useMemo(() => {
        return groupPeopleByLastNameInitial(sortedData);
    }, [sortedData]);

    const namesCount = useMemo(() => {
        const counts = {};
        sortedData.forEach(person => {
            const fullName = `${person.first_name || ''} ${person.last_name || ''}`;
            counts[fullName] = (counts[fullName] || 0) + 1;
        });
        return counts;
    }, [sortedData]);

    const renderAvailableFundraiser = (person, assignedList = false) => {
        const personKey = person.person_id || person.id;
        if (assignedList) {
            return (
                <Person
                    key={personKey}
                    firstName={person.first_name}
                    lastName={person.last_name}
                    icon={<Link />}
                    donorSelected
                    onClick={() => handleCancelAssign(person)}
                    details={{
                        phone: person.main_mobile,
                        email: person.email,
                        address: person.street_name ? `${person.street_name} ${person.house_number || ''}` : '',
                        city: person.city_name || person.city
                    }}
                    onCancelFund={() => handleCancelAssign(person)}
                    fundraiserName={currentOperatorName}
                    loading={loadingStates[personKey]}
                    disabled={loadingStates[personKey]}
                />
            );
        }
        const assignedOperator = operators.find(op => op.id === Number(person.assigned_operator_id));
        const opName = assignedOperator ? `${assignedOperator.last_name || ''} ${assignedOperator.first_name || ''}`.trim() : null;

        return (
            <Person
                key={personKey}
                firstName={person.first_name}
                lastName={person.last_name}
                sameName={namesCount[`${person.first_name} ${person.last_name}`] > 1}
                onClick={() => handleAssignFundraiser(person)}
                disabled={!!person.assigned_operator_id || loadingStates[personKey]}
                icon={person.assigned_operator_id ? <Link /> : null}
                donorSelected={false}
                donor
                details={{
                    phone: person.main_mobile,
                    email: person.email,
                    address: person.street_name ? `${person.street_name} ${person.house_number || ''}` : '',
                    city: person.city_name || person.city
                }}
                fundraiserName={opName}
                onCancelFund={() => handleCancelAssign(person)}
                loading={loadingStates[personKey]}
            />
        );
    };

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogPortal>
                <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                <AlertDialogContent className={`${styles.content} w-[1315px] p-[0] h-[805px] max-h-[90%] max-w-[95%] lg:max-w-[80%] rounded-[16px] shadow-lg`}>
                    <AlertDialogTitle className="sr-only">{t('srTitle')}</AlertDialogTitle>
                    <div className={`${styles.modalMatchingContent} ${styles.modalContent}`}>

                        {(isLoading || !currentOperator) ? (
                            <div className={styles.loadingState}>
                                <div>{t('loading')}</div>
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
                                            <div className='table-2'>{t('selectFundraisersFor')}</div>
                                            <p className='headline-2'>{currentOperatorName}</p>
                                        </div>
                                        <div className={styles.assignedDonorsButtons}
                                            ref={tableBodyRef} style={{
                                                paddingRight: shouldScroll ? "18px" : "12px"
                                            }}
                                        >
                                            {assignedFundraisers.map((f) => renderAvailableFundraiser(f, true))}
                                        </div>
                                    </div>
                                </div>

                                <div className={`small-button-1 ${styles.recommendation}`}>
                                    {t('selected')}{" "}
                                    <span className={`${styles.donorsCount} ${assignedCount > max ? styles.aboveMax : ''}`}>
                                        {t('fundraisersCount', { count: assignedCount })}
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
                                        <div className={`${styles.sortWrapper} small-button-1`}>
                                            <Select value={sortOrder} onValueChange={handleSortChange}>
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
                                    <div className={styles.peopleGrid}>
                                        {sortOrder === 'assigned' || sortOrder === 'unassigned' ? (
                                            <>
                                                <div className={styles.sortedWrapper}>
                                                    <span className="button-1">{sortOrder === "assigned" ? t('assignedNames') : t('unassignedNames')}</span>
                                                    <div className={styles.peopleInLetter}>
                                                        {sortedData.filter(person => sortOrder === "assigned" ? person.assigned_operator_id : !person.assigned_operator_id).map((person) => renderAvailableFundraiser(person, false))}
                                                    </div>
                                                </div>
                                                <div className={styles.groupSpacing}></div>
                                                <div className={styles.sortedWrapper}>
                                                    <span className="button-1">{sortOrder === "assigned" ? t('unassignedNames') : t('assignedNames')}</span>
                                                    <div className={styles.peopleInLetter}>
                                                        {sortedData.filter(person => sortOrder === "assigned" ? !person.assigned_operator_id : person.assigned_operator_id).map((person) => renderAvailableFundraiser(person, false))}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            Object.keys(groupedData).map(group => (
                                                <div key={group} className={styles.letterGroup}>
                                                    <h3 className={`button-1 ${styles.letter}`}>{group}</h3>
                                                    <div className={styles.peopleInLetter}>
                                                        {groupedData[group].map((person) => renderAvailableFundraiser(person, false))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.assignedBottom}>
                                <div className={styles.buttons}>
                                    <div className={styles.navigationButtons}>
                                        <Button
                                            onClick={handlePrevOperator}
                                            text={t('prevOperator')}
                                            smallSmall
                                            disabled={currentOperatorIndex <= 0}
                                        />
                                        <Button
                                            onClick={handleNextOperator}
                                            text={t('nextOperator')}
                                            primary
                                            smallSmall
                                            disabled={currentOperatorIndex >= operators.length - 1}
                                        />
                                    </div>
                                    <div className={styles.bottomButtons}>
                                        <Button
                                            onClick={handleClose}
                                            text={t('doneWithAll')}
                                            primary
                                        />
                                        <Button
                                            textOnly text={t('continueLater')} onClick={handleClose} />
                                    </div>
                                </div>
                                <div className={styles.navigation}>
                                    <div className={styles.navigationsWithNames}>
                                        {operators.map((op, index) => {
                                            const count = operatorFundraiserCounts.get(op.id) || 0;
                                            return (
                                                <button onClick={() => setCurrentOperatorIndex(index)} className={styles.navWrapper} key={index}>
                                                    <div className={`${styles.navTooltip} small-button-1`}>{op.last_name} {op.first_name}</div>
                                                    <div
                                                        className={`${styles.navBar} ${getColorClass(count)} ${index === currentOperatorIndex ? styles.active : ''}`}
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
    );
});

export default AssignFundraisers;
