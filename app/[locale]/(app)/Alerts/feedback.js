"use client";
import React, { useRef, useState } from 'react';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import styles from './alerts.module.scss';
import Button from '@/app/components/Button';
import Person from '@/app/components/Person';
import { useTranslations } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

const Feedback = ({ fundRaisers, allPeople, min, max, onButtonClick, isOpen, onOpenChange, onFundraiserToggle, onClose }) => {
    const t = useTranslations('alerts.feedback');
    const popupRef = useRef(null);
    const [isSending, setIsSending] = useState(false);

    const handleClose = async () => {
        // שליחת מיילי ברוכים הבאים למתרימים שנבחרו
        if (fundRaisers.length > 0) {
            setIsSending(true);
            try {
                const fundraiserIds = fundRaisers.map(f => f.fundraiser_id || f.id);
                await fetchWithAuth('/api/fundraisers/send-welcome-emails', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fundraiserIds })
                });
            } catch (error) {
                console.error('Error sending welcome emails:', error);
            } finally {
                setIsSending(false);
            }
        }
        
        onClose();
        onOpenChange(false);
    };

    const namesCount = {};
    fundRaisers.forEach(person => {
        const fullName = `${person.first_name} ${person.last_name}`;
        namesCount[fullName] = (namesCount[fullName] || 0) + 1;
    });

    const numFundraisers = fundRaisers.length;

    const getMessage = () => {
        if (numFundraisers < min - 2) {
            return t.rich('tooFewExtreme', {
                count: numFundraisers,
                highlight: (chunks) => <span className="headline-5">{chunks}</span>
            });
        } else if (numFundraisers < min) {
            return t.rich('tooFew', {
                count: numFundraisers,
                highlight: (chunks) => <span className="headline-5">{chunks}</span>
            });
        } else if (numFundraisers <= max) {
            return t.rich('perfect', {
                count: numFundraisers,
                highlight: (chunks) => <span className="headline-5">{chunks}</span>
            });
        } else if (numFundraisers <= max + 2) {
            return t.rich('tooMany', {
                count: numFundraisers,
                highlight: (chunks) => <span className="headline-5">{chunks}</span>
            });
        } else {
            return t.rich('tooManyExtreme', {
                count: numFundraisers,
                highlight: (chunks) => <span className="headline-5">{chunks}</span>
            });
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogTrigger>Open</AlertDialogTrigger>
            <AlertDialogPortal>
                <AlertDialogContent hasOverlay={false} className={`${styles.feedbackModal}
                w-[684px] max-w-[none] m-[0] rounded-[16px] shadow-lg p-[0]`}>
                    <div ref={popupRef} className={styles.feedbackModalContent}>
                        <div className={styles.feedbackHeader}>
                            <h2 className="headline-4">{getMessage()}</h2>
                            <p className={`table-2 ${numFundraisers >= min && numFundraisers <= max ? styles.good : ""}`}>
                                {numFundraisers >= min && numFundraisers <= max ?
                                    t('perfectMessage')
                                    :
                                    t('recommendationMessage', { min, max })
                                }
                            </p>
                        </div>
                        <div className={styles.wrapper}>
                            <div className={styles.feedbackContainer}>
                                {fundRaisers.map((fundraiser) => {
                                    const person = allPeople.find(
                                        p => p.person_id === fundraiser.person_id
                                    );
                                    if (!person) {
                                        console.warn("Could not find full details for fundraiser:", fundraiser);
                                        return null;
                                    };
                                    const fullName = `${person.first_name} ${person.last_name}`;
                                    const isDuplicateName = namesCount[fullName] > 1;
                                    return (
                                        <Person
                                            popupRef={popupRef}
                                            fundRaiser
                                            key={person.id}
                                            firstName={person.first_name}
                                            lastName={person.last_name}
                                            details={{
                                                phone: person.main_mobile,
                                                email: person.email,
                                                address: person.house_number,
                                                city: person.city_name
                                            }}
                                            sameName={isDuplicateName}
                                            onClick={() => onFundraiserToggle(person)}
                                            noEmail={!person.email}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                        <div className={styles.bottomButtons}>
                            <Button
                                onClick={handleClose}
                                text={isSending ? t('sending') : (numFundraisers >= min && numFundraisers <= max ? t('continueGood') : t('continueAnyway'))}
                                primary
                                disabled={isSending}
                            />
                            <Button
                                textOnly
                                text={t('backToSelection')}
                                onClick={() => onOpenChange(false)}
                                disabled={isSending}
                            />
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog >);
};

export default Feedback;