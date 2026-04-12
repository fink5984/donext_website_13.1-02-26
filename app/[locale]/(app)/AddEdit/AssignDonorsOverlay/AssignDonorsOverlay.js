import Search from "@/app/components/Search";
import styles from "./AssignDonorsOverlay.module.scss";
import Button from "@/app/components/Button";
import X from "@/app/icons/x.svg"
import XHover from "@/app/icons/xHover.svg"
import { useEffect, useState, useMemo } from "react";
import Person from "@/app/components/Person";
import Link from "@/app/icons/donorLink.svg";
import { useAppContext } from "@/app/components/AppContext";
import { observer } from "mobx-react-lite";
import { useTranslations } from 'next-intl';

export default observer(function AssignDonorsOverlay({ fundraiser, onClose }) {
    const { stores } = useAppContext();
    const { donorsStore } = stores;
    const t = useTranslations('fundraiserManagement');
    
    // Fetch assignable donors when component mounts
    useEffect(() => {
        donorsStore.fetchAssignableDonors();
    }, [donorsStore]);
    
    const [isHovered, setIsHovered] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filter donors based on search term - memoized to prevent unnecessary recalculations
    const filteredDonors = useMemo(() => {
        return donorsStore.assignableDonors.filter(person => {
            if (!searchTerm) return true;
            const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
            return fullName.includes(searchTerm.toLowerCase()) || 
                   (person.phone || '').includes(searchTerm) || 
                   (person.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [donorsStore.assignableDonors, searchTerm]);

    const sortPeople = () => {
        return [...filteredDonors].sort((a, b) => {
            return (a.lastName || '').localeCompare(b.lastName || '', 'he');
        });
    };

    // Memoize sorted data to prevent unnecessary recalculations
    const sortedData = useMemo(() => sortPeople(), [filteredDonors]);
    
    // Memoize grouped data to prevent unnecessary recalculations
    const groupedData = useMemo(() => {
        const grouped = sortedData.reduce((acc, person) => {
            const lastName = person.lastName || '';
            const firstLetter = lastName.length > 0 ? lastName[0].toUpperCase() : 'א';
            if (!acc[firstLetter]) {
                acc[firstLetter] = [];
            }
            acc[firstLetter].push(person);
            return acc;
        }, {});
        
        
        return grouped;
    }, [sortedData]);

    const namesCount = {};
    sortedData.forEach(person => {
        const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
        if (fullName) {
            namesCount[fullName] = (namesCount[fullName] || 0) + 1;
        }
    });

    const [donorsAssignedCount, setDonorsAssignedCount] = useState(0);
    
    useEffect(() => {
        if (fundraiser?.fundraiser_id) {
            const count = donorsStore.getDonorsForFundraiser(fundraiser.fundraiser_id).length;
            setDonorsAssignedCount(count);
        }
    }, [donorsStore.assignableDonors, fundraiser?.fundraiser_id, donorsStore]);

    const toggleDonor = async (donorId) => {
        const result = await donorsStore.toggleDonorAssignment(donorId, fundraiser?.fundraiser_id);
        
        // עדכון מידי של הספירה
        if (result.success && fundraiser?.fundraiser_id) {
            const newCount = donorsStore.getDonorsForFundraiser(fundraiser.fundraiser_id).length;
            setDonorsAssignedCount(newCount);
        }
    };

    const cancelAssign = async (donorId) => {
        await donorsStore.cancelDonorAssignment(donorId);
        
        // עדכון מידי של הספירה
        if (fundraiser?.fundraiser_id) {
            const newCount = donorsStore.getDonorsForFundraiser(fundraiser.fundraiser_id).length;
            setDonorsAssignedCount(newCount);
        }
    };

    const min = 12;
    const max = 18;
    const getProgressBarClass = () => {
        if (donorsAssignedCount === 0) return 'empty';
        // if (count < min - 4) return 'under';
        if (donorsAssignedCount < min) return 'below';
        // if (count <= (min + max) / 2) return 'normal';
        if (donorsAssignedCount <= max) return 'nice';
        if (donorsAssignedCount < max + 3) return 'above';
        return 'max';
    };
    
    const getProgressWidth = () => {
        if (donorsAssignedCount === 0) return '0%';
        if (donorsAssignedCount <= max) {
            return `${(donorsAssignedCount / max) * 100}%`;
        }
        return '100%';
    };

    // פונקציה להשגת שם המגיס
    const getFundraiserName = () => {
        if (!fundraiser) return t('unknown');
        return `${fundraiser.first_name} ${fundraiser.last_name}`;
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                <span className="headline-5">
                    {t('selectDonorsUnder')} <span className={styles.donors}>{t('donors')}</span> {t('underFundraiser')} {fundraiser.last_name}
                </span>
                <button
                    className="absolute right-[24px] top-[24px] p-1 cursor-pointer z-50"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={onClose}
                >
                    {isHovered ? (
                        <XHover style={{ color: 'var(--Brand-Blue-900, #103D98)' }} />
                    ) : (
                        <X style={{ color: 'var(--Icon-able-Icon, #0C4AD5)' }} />
                    )}
                </button>
            </div>

            <div className={styles.body}>
                <div className={styles.bigWrapper}>
                    <Search
                        onSearch={setSearchTerm}
                        long
                    />
                    <div className={`${styles.assignedPeopleWrapper}`}>
                        {donorsStore.loadingAssignableDonors ? (
                            <div style={{ padding: '20px', textAlign: 'center' }}>
                                <p>{t('loadingData')}</p>
                            </div>
                        ) : (
                            <div className={styles.peopleGrid}>
                                {Object.keys(groupedData).length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center' }}>
                                        <p>{t('noDataToDisplay')}</p>
                                        <p>{t('availableDonorsCount')}: {donorsStore.assignableDonors?.length || 0}</p>
                                    </div>
                                ) : (
                                    Object.keys(groupedData).map(group => (
                                        <div key={group} className={styles.letterGroup}>
                                            <h3 className={`button-1 ${styles.letter}`}>{group}</h3>
                                            <div className={styles.peopleInLetter}>
                                                {groupedData[group].map(person => {
                                                    // שם המגיס שהתורם משויך אליו - מהנתונים שכבר יש בתורם
                                                    const fundraiserName = person.fundraiser_first_name && person.fundraiser_last_name ? 
                                                        `${person.fundraiser_first_name} ${person.fundraiser_last_name}` : null;
                                                    
                                                    return (
                                                        <Person
                                                            key={person.originalIndex}
                                                            firstName={person.firstName || ''}
                                                            lastName={person.lastName || ''}
                                                            sameName={namesCount[`${person.firstName || ''} ${person.lastName || ''}`.trim()] > 1}
                                                            onClick={() => toggleDonor(person.id)}
                                                            disabled={person.assigned_fundraiser_id != null && person.assigned_fundraiser_id !== fundraiser?.fundraiser_id}
                                                            icon={person.assigned_fundraiser_id && <Link />}
                                                            donor
                                                            details={{
                                                                phone: person.phone,
                                                                email: person.email,
                                                                address: person.address,
                                                                city: person.city
                                                            }}
                                                            fundraiserName={fundraiserName}
                                                            onCancelFund={() => cancelAssign(person.id)}
                                                            donorSelected={person.assigned_fundraiser_id === fundraiser?.fundraiser_id}
                                                            donorSelectedBold={person.assigned_fundraiser_id === fundraiser?.fundraiser_id}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.progressBar}>
                    <div className={styles.barContainer}>
                        <div
                            className={`${styles.bar} ${styles[getProgressBarClass()]}`}
                            style={{ width: getProgressWidth() }}
                        />
                    </div>
                    <div className={`${styles.progressText} small-button-1`}>
                        <span><span className={styles.recommendation}>{t('youSelected')} </span><span className='small-button-2'>{donorsAssignedCount} {t('donorsCount')}</span> </span>
                        <span>
                            <span className={styles.recommendation}>{t('ourRecommendation')} </span><span className='small-button-2'>{t('atLeast')} {min}</span> {t('andNoMoreThan')} {max}
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.footer}>
                <Button text={t('doneSelecting')} onClick={onClose} />
            </div>
        </div>
    );
});
