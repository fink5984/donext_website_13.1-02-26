"use client";
import Button from '@/app/components/Button';
import styles from './alerts.module.scss';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRef, useState, useMemo } from 'react';
import Search from '@/app/components/Search';
import { observer } from "mobx-react-lite";
import { groupPeopleByLastNameInitial } from '@/lib/utils';
import PersonList from './PersonList';
import { useOperatorManagement } from './useOperatorManagement';
import { getProgressBarClass, getProgressWidth, sortPeople } from './helpers';
import { useTranslations } from 'next-intl';

const AddOperator = observer(({ open, onClose }) => {
    const t = useTranslations('operatorsPage.addDialog');
    const {
        fundraisers,
        isLoading,
        loadingStates,
        operators,
        handleOperatorToggle
    } = useOperatorManagement(open);

    const popupRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');

    const handleOpenChange = (open) => {
        if (!open) onClose();
    };

    const handleSortChange = (value) => {
        setSortOrder(value);
    };

    const getDisplayText = (value) => {
        const options = {
            'asc': t('sortAsc'),
            'desc': t('sortDesc'),
            'fundraisers': t('sortOperators'),
            'donors': t('sortFundraisers')
        };
        return `${t('sortBy')} ${options[value]}`;
    };

    // Map fundraisers to PersonList format - map isOperator to isFundraiser for rendering
    const peopleForList = useMemo(() => fundraisers.map(f => ({
        ...f,
        person_id: f.person_id,
        first_name: f.first_name || '',
        last_name: f.last_name || '',
        main_mobile: f.main_mobile || '',
        email: f.email || '',
        city_name: f.city || '',
        street_name: f.street_name || '',
        house_number: f.house_number || '',
        isFundraiser: f.isOperator // PersonList uses isFundraiser for selection display
    })), [fundraisers]);

    const filteredPeople = useMemo(() => peopleForList.filter(person =>
        ((person.first_name || '') + ' ' + (person.last_name || ''))
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    ), [peopleForList, searchTerm]);

    const sortedData = useMemo(() => sortPeople(filteredPeople, sortOrder), [filteredPeople, sortOrder]);

    const namesCount = useMemo(() => {
        const counts = {};
        sortedData.forEach(person => {
            const fullName = `${person.first_name || ''} ${person.last_name || ''}`;
            counts[fullName] = (counts[fullName] || 0) + 1;
        });
        return counts;
    }, [sortedData]);

    const groupedData = useMemo(() => groupPeopleByLastNameInitial(sortedData), [sortedData]);

    // Handle toggle - map back from PersonList format to fundraiser
    const handleToggle = (person) => {
        // Find the original fundraiser object
        const fundraiser = fundraisers.find(f => f.person_id === person.person_id);
        if (fundraiser) {
            handleOperatorToggle(fundraiser);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogPortal>
                <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                <AlertDialogContent className={`${styles.content} w-[1300px] h-[750px] max-h-[90%] max-w-[80%] rounded-[16px] shadow-lg p-[56px]`}>
                    <AlertDialogTitle className="sr-only">{t('srTitle')}</AlertDialogTitle>
                    <div ref={popupRef} className={styles.modalContent}>
                        <div className={styles.header}>
                            <h1 className='headline-1'>{t('title')} <span>{t('titleHighlight')}</span> {t('titleEnd')}</h1>
                            <h2 className='headline-4'>
                                {t('subtitle', { count: fundraisers.length })}
                            </h2>
                        </div>
                        <div className={styles.bigWrapper}>
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
                                            <SelectTrigger className="selectTrigger">
                                                <SelectValue className="small-button-1">{getDisplayText(sortOrder)}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className="selectGroup">
                                                <SelectGroup className="small-button-1">
                                                    <SelectItem className="selectItem" value="asc">{t('sortAsc')}</SelectItem>
                                                    <SelectItem className="selectItem" value="desc">{t('sortDesc')}</SelectItem>
                                                    <SelectItem className="selectItem" value="fundraisers">{t('sortOperators')}</SelectItem>
                                                    <SelectItem className="selectItem" value="donors">{t('sortFundraisers')}</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <div className={`${styles.wrapper} ${styles.peopleWrapper}`}>
                                {isLoading ? (
                                    <div className={styles.loadingText}>{t('loading')}</div>
                                ) : (
                                    <PersonList
                                        sortOrder={sortOrder}
                                        sortedData={sortedData}
                                        groupedData={groupedData}
                                        namesCount={namesCount}
                                        handleFundraiserToggle={handleToggle}
                                        loadingStates={loadingStates}
                                    />
                                )}
                            </div>
                        </div>
                        <div className={styles.progressBar}>
                            <div className={styles.barContainer}>
                                <div
                                    className={`${styles.bar} ${styles[getProgressBarClass(operators.length, 1, fundraisers.length)]}`}
                                    style={{ width: operators.length > 0 && fundraisers.length > 0 ? `${(operators.length / fundraisers.length) * 100}%` : '0%' }}
                                />
                            </div>
                            <div className={`${styles.progressText} small-button-1`}>
                                <span><span className={styles.recommendation}>{t('selected')} </span><span className='small-button-2'>{t('operatorsCount', { count: operators.length })}</span></span>
                                <span><span className={styles.recommendation}>{t('fromFundraisers')} </span><span className='small-button-2'>{fundraisers.length}</span></span>
                            </div>
                        </div>
                        <div className={styles.bottomButtons}>
                            <Button
                                onClick={onClose}
                                text={t('done')}
                                primary
                            />
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
});

export default AddOperator;
