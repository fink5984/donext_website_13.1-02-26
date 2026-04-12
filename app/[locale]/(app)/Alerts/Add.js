"use client";
import Button from '@/app/components/Button';
import styles from './alerts.module.scss';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRef, useState, useMemo } from 'react';
import Feedback from './feedback.js';
import Search from '@/app/components/Search';
import NewPerson from "@/app/icons/newPerson.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import AlertDeleteComponent from './AlertDelete';
import { observer } from "mobx-react-lite";
import { groupPeopleByLastNameInitial } from '@/lib/utils';
import PersonList from './PersonList';
import { useFundraiserManagement } from './useFundraiserManagement';
import { getProgressBarClass, getProgressWidth, sortPeople } from './helpers';
import { useTranslations } from 'next-intl';

const Add = observer(({ open, onClose, addNew }) => {
    const t = useTranslations('alerts.add');
    const {
        people,
        isLoading,
        loadingStates,
        isDeleteDialogOpen,
        selectedDeleteFundraiser,
        fundraisers,
        handleFundraiserToggle,
        handleConfirmDelete,
        setDeleteDialogOpen,
        setSelectedDeleteFundraiser
    } = useFundraiserManagement(open);

    const popupRef = useRef(null);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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
            'fundraisers': t('sortFundraisers'),
            'donors': t('sortDonors')
        };
        return `${t('sortBy')} ${options[value]}`;
    };

    const filteredPeople = useMemo(() => people.filter(person =>
        ((person.first_name || '') + ' ' + (person.last_name || ''))
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    ), [people, searchTerm]);

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

    const { min, max } = useMemo(() => {
        const max = Math.max(1, Math.floor(people.length / 12));
        const min = Math.max(1, Math.ceil(people.length / 18));
        return { min, max };
    }, [people.length]);

    return (
        <>
            {isDeleteDialogOpen && (
                <AlertDeleteComponent
                    isOpen={isDeleteDialogOpen}
                    onClose={() => {
                        setDeleteDialogOpen(false);
                        setSelectedDeleteFundraiser(null);
                    }}
                    fundraiserName={`${selectedDeleteFundraiser?.first_name} ${selectedDeleteFundraiser?.last_name}`}
                    handleConfirmDelete={handleConfirmDelete}
                    donors={selectedDeleteFundraiser?.donors || []}
                />
            )}
            <AlertDialog open={open} onOpenChange={handleOpenChange}>
                <AlertDialogPortal>
                    <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                    <AlertDialogContent className={`${styles.content} w-[1300px] h-[750px] max-h-[90%] max-w-[80%] rounded-[16px] shadow-lg p-[56px]`}>
                        <AlertDialogTitle className="sr-only">{t('srTitle')}</AlertDialogTitle>
                        <div ref={popupRef} className={styles.modalContent}>
                            <div className={styles.header}>
                                <h1 className='headline-1'>{t('title')} <span>{t('titleHighlight')}</span> {t('titleEnd')}</h1>
                                <h2 className='headline-4'>
                                    {t('recommendation', { count: people.length, min, max })}
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
                                        <button onClick={addNew}>
                                            <IconTooltip
                                                icon={<NewPerson />}
                                                up
                                                text={t('addNewTooltip')}
                                            />
                                        </button>
                                        <div className={`${styles.sortWrapper} small-button-1`}>
                                            <Select value={sortOrder} onValueChange={handleSortChange}>
                                                <SelectTrigger className="selectTrigger">
                                                    <SelectValue className="small-button-1">{getDisplayText(sortOrder)}</SelectValue>
                                                </SelectTrigger>
                                                <SelectContent className="selectGroup">
                                                    <SelectGroup className="small-button-1">
                                                        <SelectItem className="selectItem" value="asc">{t('sortAsc')}</SelectItem>
                                                        <SelectItem className="selectItem" value="desc">{t('sortDesc')}</SelectItem>
                                                        <SelectItem className="selectItem" value="fundraisers">{t('sortFundraisers')}</SelectItem>
                                                        <SelectItem className="selectItem" value="donors">{t('sortDonors')}</SelectItem>
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
                                            handleFundraiserToggle={handleFundraiserToggle}
                                            loadingStates={loadingStates}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className={styles.progressBar}>
                                <div className={styles.barContainer}>
                                    <div
                                        className={`${styles.bar} ${styles[getProgressBarClass(fundraisers.length, min, max)]}`}
                                        style={{ width: getProgressWidth(fundraisers.length, min, max) }}
                                    />
                                </div>
                                <div className={`${styles.progressText} small-button-1`}>
                                    <span><span className={styles.recommendation}>{t('selected')} </span><span className='small-button-2'>{t('fundraisersCount', { count: fundraisers.length })}</span> </span>
                                    <span>
                                        <span className={styles.recommendation}>{t('ourRecommendation')} </span><span className='small-button-2'>{t('atLeast', { min })}</span> {t('fundraisersWord')} {t('noMoreThan', { max })}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.bottomButtons}>
                                <Button
                                    onClick={() => setIsFeedbackOpen(true)}
                                    text={t('done')}
                                    primary={!(fundraisers.length < min || fundraisers.length > max)}
                                />
                                <Button
                                    textOnly text={t('chooseLater')} onClick={onClose} />
                            </div>
                        </div>
                    </AlertDialogContent>
                </AlertDialogPortal>
            </AlertDialog>
            {isFeedbackOpen && <Feedback
                fundRaisers={fundraisers}
                max={max}
                min={min}
                isOpen={isFeedbackOpen}
                onOpenChange={setIsFeedbackOpen}
                onButtonClick={() => {
                    // setIsErrorOpen(false);
                }}
                allPeople={people}
                onClose={onClose}
                onFundraiserToggle={handleFundraiserToggle}
            />}
        </>
    );
});

export default Add;