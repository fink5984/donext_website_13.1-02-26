import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import styles from './DonationForm.module.scss';

const DonorNameHeaderPublic = ({ donor, onDonorChange, isAnonymous, onAnonymousChange, hideDonorDetails = false, showAddress = false }) => {
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const isRtl = locale === 'he';

    // Keep the required "*" on the right: in RTL inputs a trailing "*" renders on
    // the left, so prefix it instead; in LTR it stays as a suffix.
    const requiredPlaceholder = (label) => (isRtl ? `* ${label}` : `${label} *`);
    
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    // Address details (city / street / house number) - shown and required only
    // when the campaign opted in (settings.requireAddress)
    const [city, setCity] = useState('');
    const [street, setStreet] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    // Public display / receipt name: auto-filled from first + last name until the
    // donor edits it manually, after which we stop overriding their choice.
    const [displayName, setDisplayName] = useState('');
    const [displayNameEdited, setDisplayNameEdited] = useState(false);

    // Initialize with current donor
    useEffect(() => {
        setFirstName(donor?.firstName || '');
        setLastName(donor?.lastName || '');
        setPhone(donor?.phone || '');
        setEmail(donor?.email || '');
        setCity(donor?.city || '');
        setStreet(donor?.street || '');
        setHouseNumber(donor?.houseNumber || '');
        const composed = `${donor?.firstName || ''} ${donor?.lastName || ''}`.trim();
        setDisplayName(donor?.displayName || composed);
        setDisplayNameEdited(Boolean(donor?.displayName) && donor.displayName !== composed);
    }, [donor]);

    const updateDonor = (updates) => {
        const nextFirst = updates.firstName ?? firstName;
        const nextLast = updates.lastName ?? lastName;
        const nextDisplay = updates.displayName ?? displayName;
        onDonorChange?.({
            firstName: nextFirst,
            lastName: nextLast,
            phone: updates.phone ?? phone,
            email: updates.email ?? email,
            first_name: nextFirst,
            last_name: nextLast,
            displayName: nextDisplay,
            city: updates.city ?? city,
            street: updates.street ?? street,
            houseNumber: updates.houseNumber ?? houseNumber
        });
    };

    const handleFirstNameChange = (e) => {
        const newFirstName = e.target.value;
        setFirstName(newFirstName);
        if (!displayNameEdited) {
            const auto = `${newFirstName} ${lastName}`.trim();
            setDisplayName(auto);
            updateDonor({ firstName: newFirstName, displayName: auto });
        } else {
            updateDonor({ firstName: newFirstName });
        }
    };

    const handleLastNameChange = (e) => {
        const newLastName = e.target.value;
        setLastName(newLastName);
        if (!displayNameEdited) {
            const auto = `${firstName} ${newLastName}`.trim();
            setDisplayName(auto);
            updateDonor({ lastName: newLastName, displayName: auto });
        } else {
            updateDonor({ lastName: newLastName });
        }
    };

    const handleDisplayNameChange = (e) => {
        const newDisplayName = e.target.value;
        setDisplayName(newDisplayName);
        setDisplayNameEdited(true);
        updateDonor({ displayName: newDisplayName });
    };

    const handlePhoneChange = (e) => {
        const newPhone = e.target.value;
        setPhone(newPhone);
        updateDonor({ phone: newPhone });
    };

    const handleEmailChange = (e) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        updateDonor({ email: newEmail });
    };

    const handleCityChange = (e) => {
        const newCity = e.target.value;
        setCity(newCity);
        updateDonor({ city: newCity });
    };

    const handleStreetChange = (e) => {
        const newStreet = e.target.value;
        setStreet(newStreet);
        updateDonor({ street: newStreet });
    };

    const handleHouseNumberChange = (e) => {
        const newHouseNumber = e.target.value;
        setHouseNumber(newHouseNumber);
        updateDonor({ houseNumber: newHouseNumber });
    };

    return (
        <div style={{ 
            display: 'flex',
            padding: 'clamp(16px, 4vw, 32px) clamp(12px, 3vw, 48px)',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 'var(--Spacing-Spacing-5, 12px)',
            alignSelf: 'stretch',
            borderRadius: 'var(--Border-Radius-lg, 24px)',
            background: 'var(--Surface-01, #F6F9FC)',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            <div className="headline-3" style={{ 
                color: 'var(--Text-Default, #6E99EC)',
                width: '100%',
                textAlign: isRtl ? 'right' : 'left'
            }}>{t('donorDetails')}</div>
            <div style={{ 
                display: 'flex', 
                width: '100%', 
                gap: '16px',
                flexWrap: 'wrap'
            }}>
                <div style={{ 
                    flex: '1 1 45%',
                    minWidth: '120px'
                }}>
                    <input
                        type="text"
                        placeholder={requiredPlaceholder(t('firstName'))}
                        value={firstName}
                        onChange={handleFirstNameChange}
                        dir={isRtl ? 'rtl' : 'ltr'}
                        className={styles.donorInput}
                        required
                        style={{
                            textAlign: isRtl ? 'right' : 'left'
                        }}
                    />
                </div>
                <div style={{ 
                    flex: '1 1 45%',
                    minWidth: '120px'
                }}>
                    <input
                        type="text"
                        placeholder={requiredPlaceholder(t('lastName'))}
                        value={lastName}
                        onChange={handleLastNameChange}
                        dir={isRtl ? 'rtl' : 'ltr'}
                        className={styles.donorInput}
                        required
                        style={{
                            textAlign: isRtl ? 'right' : 'left'
                        }}
                    />
                </div>
            </div>

            {/* Phone and Email row */}
            <div style={{ 
                display: 'flex', 
                width: '100%', 
                gap: '16px',
                flexWrap: 'wrap'
            }}>
                <div style={{ 
                    flex: '1 1 45%',
                    minWidth: '120px'
                }}>
                    <input
                        type="tel"
                        placeholder={`${t('phone')} *`}
                        value={phone}
                        onChange={handlePhoneChange}
                        dir="ltr"
                        className={styles.donorInput}
                        required
                        style={{
                            textAlign: isRtl ? 'right' : 'left'
                        }}
                    />
                </div>
                <div style={{ 
                    flex: '1 1 45%',
                    minWidth: '120px'
                }}>
                    <input
                        type="email"
                        placeholder={t('email')}
                        value={email}
                        onChange={handleEmailChange}
                        dir="ltr"
                        className={styles.donorInput}
                        style={{
                            textAlign: isRtl ? 'right' : 'left'
                        }}
                    />
                </div>
            </div>

            {/* Address details row (city / street / house number) - only when the
                campaign requires address collection; all fields are mandatory */}
            {showAddress && (
                <div style={{
                    display: 'flex',
                    width: '100%',
                    gap: '16px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{
                        flex: '2 1 30%',
                        minWidth: '120px'
                    }}>
                        <input
                            type="text"
                            placeholder={requiredPlaceholder(t('city'))}
                            value={city}
                            onChange={handleCityChange}
                            dir={isRtl ? 'rtl' : 'ltr'}
                            className={styles.donorInput}
                            required
                            style={{
                                textAlign: isRtl ? 'right' : 'left'
                            }}
                        />
                    </div>
                    <div style={{
                        flex: '2 1 30%',
                        minWidth: '120px'
                    }}>
                        <input
                            type="text"
                            placeholder={requiredPlaceholder(t('street'))}
                            value={street}
                            onChange={handleStreetChange}
                            dir={isRtl ? 'rtl' : 'ltr'}
                            className={styles.donorInput}
                            required
                            style={{
                                textAlign: isRtl ? 'right' : 'left'
                            }}
                        />
                    </div>
                    <div style={{
                        flex: '1 1 15%',
                        minWidth: '90px'
                    }}>
                        <input
                            type="text"
                            placeholder={requiredPlaceholder(t('houseNumber'))}
                            value={houseNumber}
                            onChange={handleHouseNumberChange}
                            dir={isRtl ? 'rtl' : 'ltr'}
                            className={styles.donorInput}
                            required
                            style={{
                                textAlign: isRtl ? 'right' : 'left'
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Display / receipt name box, with the anonymity toggle inside it.
                When anonymous is on, the field shows "בעילום שם" and is locked. */}
            {!hideDonorDetails && (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                width: '100%',
                padding: 'var(--Spacing-Spacing-4, 12px) var(--Spacing-Spacing-4, 16px)',
                borderRadius: 'var(--Border-Radius-m, 16px)',
                border: '1px solid var(--Border-Default, #6E99EC)',
                background: '#FFF',
                boxSizing: 'border-box'
            }}>
                <input
                    type="text"
                    placeholder={t('displayReceiptName')}
                    value={isAnonymous ? t('anonymousName') : displayName}
                    onChange={handleDisplayNameChange}
                    readOnly={isAnonymous}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className={styles.donorInput}
                    style={{
                        textAlign: isRtl ? 'right' : 'left',
                        color: isAnonymous ? '#94a3b8' : undefined,
                        cursor: isAnonymous ? 'default' : 'text'
                    }}
                />

                {/* Anonymous Toggle (inside the box) */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '12px',
                    width: '100%'
                }}>
                    <label style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '48px',
                        height: '24px',
                        cursor: 'pointer',
                        flexShrink: 0
                    }}>
                        <input
                            type="checkbox"
                            checked={isAnonymous}
                            onChange={(e) => onAnonymousChange?.(e.target.checked)}
                            style={{
                                opacity: 0,
                                width: 0,
                                height: 0
                            }}
                        />
                        <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: isAnonymous ? '#6E99EC' : '#cbd5e1',
                            transition: '0.3s',
                            borderRadius: '24px'
                        }}>
                            <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '18px',
                                width: '18px',
                                left: isAnonymous ? '27px' : '3px',
                                bottom: '3px',
                                backgroundColor: 'white',
                                transition: '0.3s',
                                borderRadius: '50%',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} />
                        </span>
                    </label>
                    <label style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#6E99EC',
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}>
                        {t('showAnonymous')}
                    </label>
                </div>
            </div>
            )}
        </div>
    );
};

export default DonorNameHeaderPublic;
