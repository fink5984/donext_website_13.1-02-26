import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/app/components/AppContext';
import styles from './DonationForm.module.scss';
import EditDonor from "@/app/icons/editDonor.svg"
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import DoNextLoader from '@/app/components/DoNextLoader';
import { useTranslations, useLocale } from 'next-intl';

const DonorNameHeader = ({ donor, onDonorChange, isAnonymous, onAnonymousChange }) => {
    const t = useTranslations('donorNameHeader');
    const locale = useLocale();
    const isRTL = locale === 'he';
    const { campaignId, fundraiserId } = useAppContext();
    
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [allDonors, setAllDonors] = useState([]); // כל התורמים לסינון מקומי
    const [filteredDonors, setFilteredDonors] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const [hasMoreDonors, setHasMoreDonors] = useState(false); // האם יש יותר תורמים מהמגבלה
    const [totalCount, setTotalCount] = useState(0);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const [hoveredDonorId, setHoveredDonorId] = useState(null);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);
    
    const INITIAL_LIMIT = 5000; // מגבלה ראשונית גבוהה יותר

    const handleMouseEnter = (e, donorId) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPosition({
            top: rect.top + rect.height / 2,
            left: rect.left - 10
        });
        setHoveredDonorId(donorId);
    };

    const handleMouseLeave = () => {
        setHoveredDonorId(null);
    };

    // Initialize search term with current donor name
    useEffect(() => {
        if (donor) {
            const donorName = `${donor.firstName || donor.first_name || ''} ${donor.lastName || donor.last_name || ''}`.trim();
            setSearchTerm(donorName);
        } else {
            setSearchTerm('');
        }
    }, [donor]);

    // טעינת כל התורמים פעם אחת בפתיחה
    useEffect(() => {
        const loadAllDonors = async () => {
            if (initialLoadDone) return;
            
            setIsLoading(true);
            try {
                const params = new URLSearchParams({
                    limit: INITIAL_LIMIT.toString()
                });

                if (fundraiserId) {
                    if (campaignId !== 72) { // Special case for campaign 72
                        params.append('fundraiserId', fundraiserId.toString());
                    }
                }

                const response = await fetchWithAuth(`/api/donors/all?${params}`);
                
                if (response.ok) {
                    const data = await response.json();
                    const donors = data.data?.donors || [];
                    const total = data.data?.totalCount || donors.length;
                    setAllDonors(donors);
                    setFilteredDonors(donors);
                    setTotalCount(total);
                    setHasMoreDonors(total > donors.length);
                } else {
                    setAllDonors([]);
                    setFilteredDonors([]);
                }
            } catch (error) {
                console.error('Error loading all donors:', error);
                setAllDonors([]);
                setFilteredDonors([]);
            } finally {
                setIsLoading(false);
                setInitialLoadDone(true);
            }
        };

        // טוען את כל התורמים רק כשאין תורם נבחר או כשמתחילים לערוך
        if (!donor || isEditing) {
            loadAllDonors();
        }
    }, [fundraiserId, campaignId, donor, isEditing, initialLoadDone]);

    // חיפוש - סינון מקומי או חיפוש בשרת בהתאם למצב
    useEffect(() => {
        // אם אין טקסט חיפוש, מציג את כל התורמים שנטענו
        if (!searchTerm.trim()) {
            setFilteredDonors(allDonors);
            return;
        }

        const trimmedSearch = searchTerm.trim().toLowerCase();
        const searchParts = trimmedSearch.split(/\s+/);

        // סינון מקומי תמיד - כולל שמות בעברית, אנגלית וטלפון
        const localFiltered = allDonors.filter(donorOption => {
            const firstName = (donorOption.firstName || '').toLowerCase();
            const lastName = (donorOption.lastName || '').toLowerCase();
            const fullName = `${firstName} ${lastName}`;
            
            // שמות באנגלית
            const englishFirstName = (donorOption.english_first_name || donorOption.englishFirstName || '').toLowerCase();
            const englishLastName = (donorOption.english_last_name || donorOption.englishLastName || '').toLowerCase();
            const englishFullName = `${englishFirstName} ${englishLastName}`;

            // טלפון
            const phone = (donorOption.phone || '').toLowerCase();

            return searchParts.every(part => 
                firstName.includes(part) || 
                lastName.includes(part) || 
                fullName.includes(part) ||
                englishFirstName.includes(part) ||
                englishLastName.includes(part) ||
                englishFullName.includes(part) ||
                phone.includes(part)
            );
        });

        // אם יש יותר תורמים מהמגבלה, מחפש גם בשרת
        if (hasMoreDonors && searchTerm.trim().length >= 2) {
            const searchInServer = async () => {
                try {
                    const params = new URLSearchParams({
                        search: searchTerm.trim(),
                        limit: '100'
                    });

                    if (fundraiserId) {
                        if (campaignId !== 72) {
                            params.append('fundraiserId', fundraiserId.toString());
                        }
                    }

                    const response = await fetchWithAuth(`/api/donors/search?${params}`);
                    
                    if (response.ok) {
                        const data = await response.json();
                        const serverDonors = data.data?.donors || [];
                        
                        // מיזוג תוצאות - מסיר כפילויות
                        const localIds = new Set(localFiltered.map(d => d.id));
                        const uniqueServerDonors = serverDonors.filter(d => !localIds.has(d.id));
                        const merged = [...localFiltered, ...uniqueServerDonors];
                        
                        // מיון לפי שם
                        merged.sort((a, b) => {
                            const nameA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
                            const nameB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
                            return nameA.localeCompare(nameB, 'he');
                        });
                        
                        setFilteredDonors(merged);
                    }
                } catch (error) {
                    console.error('Error searching donors on server:', error);
                    // במקרה של שגיאה, משתמש בסינון המקומי
                    setFilteredDonors(localFiltered);
                }
            };

            // Debounce לחיפוש בשרת
            const timeoutId = setTimeout(searchInServer, 300);
            setFilteredDonors(localFiltered); // מציג תוצאות מקומיות מיד
            return () => clearTimeout(timeoutId);
        } else {
            setFilteredDonors(localFiltered);
        }
    }, [searchTerm, allDonors, hasMoreDonors, fundraiserId, campaignId]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
                setIsEditing(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleEditClick = () => {
        setIsEditing(true);
        setShowDropdown(true);
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 100);
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setShowDropdown(true);
    };

    const handleDonorSelect = (selectedDonor) => {
        setSearchTerm(`${selectedDonor.firstName || selectedDonor.first_name || ''} ${selectedDonor.lastName || selectedDonor.last_name || ''}`.trim());
        setShowDropdown(false);
        setIsEditing(false);
        if (onDonorChange) {
            onDonorChange(selectedDonor);
        }
    };

    const handleInputClick = () => {
        setShowDropdown(true);
        setIsEditing(true);
    };

    const getDisplayText = () => {
        if (donor) {
            const donorName = `${donor.firstName || donor.first_name || ''} ${donor.lastName || donor.last_name || ''}`.trim();
            return donorName;
        }
        return t('selectDonor');
    };

    const getDisplayClass = () => {
        if (donor) {
            return styles.donorName;
        }
        return styles.selectDonorPlaceholder;
    };

    const anonymousToggle = (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '8px'
        }}>
            <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '44px',
                height: '22px',
                cursor: 'pointer',
                flexShrink: 0
            }}>
                <input
                    type="checkbox"
                    checked={!!isAnonymous}
                    onChange={(e) => onAnonymousChange?.(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: isAnonymous ? '#6E99EC' : '#cbd5e1',
                    transition: '0.3s',
                    borderRadius: '22px'
                }}>
                    <span style={{
                        position: 'absolute',
                        height: '16px',
                        width: '16px',
                        left: isAnonymous ? '25px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '0.3s',
                        borderRadius: '50%',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                </span>
            </label>
            <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#6E99EC',
                cursor: 'pointer',
                userSelect: 'none'
            }} onClick={() => onAnonymousChange?.(!isAnonymous)}>
                {t('showAnonymous')}
            </span>
        </div>
    );

    if (isEditing || !donor) {
        return (
            <div className={styles.donorNameHeader}>
                <div className={styles.donorNameContainer} ref={dropdownRef}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={handleInputChange}
                        onClick={handleInputClick}
                        className={`${styles.donorSearchInput} headline-3-b`}
                        placeholder={t('selectDonor')}
                    />
                    <div className={`${styles.searchIcon} ${showDropdown ? styles.searchIconOpen : ''} ${!isRTL ? styles.ltrSearchIcon : ''}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M7.24127 6.11691L4.4146 8.94358C4.35212 9.00555 4.30252 9.07929 4.26867 9.16053C4.23483 9.24177 4.2174 9.3289 4.2174 9.41691C4.2174 9.50492 4.23483 9.59206 4.26867 9.6733C4.30252 9.75454 4.35212 9.82827 4.4146 9.89025C4.53951 10.0144 4.70848 10.0841 4.8846 10.0841C5.06073 10.0841 5.22969 10.0144 5.3546 9.89025L7.7146 7.53025L10.0746 9.89024C10.1995 10.0144 10.3685 10.0841 10.5446 10.0841C10.7207 10.0841 10.8897 10.0144 11.0146 9.89024C11.0764 9.82795 11.1253 9.75407 11.1585 9.67285C11.1916 9.59162 11.2084 9.50465 11.2079 9.41691C11.2084 9.32917 11.1916 9.2422 11.1585 9.16097C11.1253 9.07975 11.0764 9.00587 11.0146 8.94358L8.18794 6.11691C8.12596 6.05443 8.05223 6.00483 7.97099 5.97098C7.88975 5.93714 7.80261 5.91971 7.7146 5.91971C7.62659 5.91971 7.53946 5.93714 7.45822 5.97098C7.37698 6.00483 7.30324 6.05443 7.24127 6.11691Z" fill="currentcolor"/>
                        </svg>
                    </div>
                    {showDropdown && (
                        <div className={styles.donorDropdown}>
                            {isLoading ? (
                                <div className={styles.loading}>
                                    <DoNextLoader small />
                                    <span>{t('loading')}</span>
                                </div>
                            ) : filteredDonors.length > 0 ? (
                                filteredDonors.map((donorOption) => {
                                    const donorName = `${donorOption.firstName || ''} ${donorOption.lastName || ''}`.trim();
                                    const isSelected = donor && donor.id === donorOption.id;
                                    const phone = donorOption.phone || '';
                                    const address = donorOption.address || '';
                                    const city = donorOption.city || '';
                                    const isHovered = hoveredDonorId === donorOption.id;
                                    const hasDetails = phone || address || city;
                                    
                                    return (
                                        <div
                                            key={donorOption.id}
                                            className={`body-1 ${styles.donorOption} ${isSelected ? styles.selectedDonor : ''}`}
                                            onClick={() => handleDonorSelect(donorOption)}
                                            onMouseEnter={(e) => handleMouseEnter(e, donorOption.id)}
                                            onMouseLeave={handleMouseLeave}
                                        >
                                            {donorName}
                                            {isHovered && hasDetails && (
                                                <div 
                                                    className={styles.donorTooltip}
                                                    style={{
                                                        top: tooltipPosition.top,
                                                        left: tooltipPosition.left,
                                                        transform: 'translate(-100%, -50%)'
                                                    }}
                                                >
                                                    <div className={styles.tooltipContent}>
                                                        {address && <div className={styles.tooltipRow}>🏠 {address}</div>}
                                                        {city && <div className={styles.tooltipRow}>📍 {city}</div>}
                                                        {phone && <div className={styles.tooltipRow}>📞 {phone}</div>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className={styles.noResults}>{t('noResults')}</div>
                            )}
                        </div>
                    )}
                </div>
                {anonymousToggle}
            </div>
        );
    }
    
    return (
        <div className={styles.donorNameHeader}>
            <div className={`${styles.donorNameLabel} table-2`}>{t('donorNameLabel')}</div>
            <div className={styles.donorNameContainer}>
                <span className={`${getDisplayClass()} headline-3-b`}>{getDisplayText()}</span>
                <button className={styles.editButton} onClick={handleEditClick}>
                    <EditDonor/>
                </button>
            </div>
            {anonymousToggle}
        </div>
    );
};

export default DonorNameHeader; 