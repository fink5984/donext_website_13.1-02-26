import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import styles from './DonationForm.module.scss';

const DonorNameHeaderPublic = ({ donor, onDonorChange, isAnonymous, onAnonymousChange }) => {
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const isRtl = locale === 'he';
    
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    // Initialize with current donor
    useEffect(() => {
        setFirstName(donor?.firstName || '');
        setLastName(donor?.lastName || '');
        setPhone(donor?.phone || '');
        setEmail(donor?.email || '');
    }, [donor]);

    const updateDonor = (updates) => {
        onDonorChange?.({
            firstName: updates.firstName ?? firstName,
            lastName: updates.lastName ?? lastName,
            phone: updates.phone ?? phone,
            email: updates.email ?? email,
            first_name: updates.firstName ?? firstName,
            last_name: updates.lastName ?? lastName
        });
    };

    const handleFirstNameChange = (e) => {
        const newFirstName = e.target.value;
        setFirstName(newFirstName);
        updateDonor({ firstName: newFirstName });
    };

    const handleLastNameChange = (e) => {
        const newLastName = e.target.value;
        setLastName(newLastName);
        updateDonor({ lastName: newLastName });
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
                        placeholder={`${t('firstName')} *`}
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
                        placeholder={`${t('lastName')} *`}
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
            
            {/* Anonymous Toggle */}
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
    );
};

export default DonorNameHeaderPublic;
