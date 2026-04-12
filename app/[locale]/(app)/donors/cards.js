"use client";
import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/components/AppContext';
import Button from '@/app/components/Button';
import styles from "./donors.module.scss"
import BellNew from "@/app/icons/bellNew.svg"
import Bell from "@/app/icons/bell.svg"
import Lamp from "@/app/icons/lampSmall.svg"
import Arrow from "@/app/icons/arrow.svg"
import Money from "@/app/icons/money.svg"
import { Doughnut } from "react-chartjs-2";
import { CurrencySymbol } from '@/app/components/CurrencySymbol';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { useTranslations } from 'next-intl';

export default function DonorsCards({ summary, fundraisersLength, setShowAssign, setIsExcelOpen, setShowAdd }) {
    const { campaign } = useAppContext();
    const t = useTranslations('donorsCards');
    ChartJS.register(ArcElement, Tooltip, Legend);
    const deadline = campaign?.end_date ? new Date(campaign.end_date) : null;

    // משתני עזר ברורים מה-summary
    const totalActiveDonors = Number(summary?.active_count ?? 0);
    const donorsWithDonations = Number(summary?.donors_with_donations ?? 0);
    const assigned = Number(summary?.assigned_count ?? 0);
    const unassigned = totalActiveDonors - assigned;
    const totalExpected = Number(summary?.total_expected ?? 0);
    const totalActual = Math.floor(Number(summary?.total_actual ?? 0));
    const counts = {
        red: Number(summary?.red_count ?? 0),
        orange: Number(summary?.orange_count ?? 0),
        green: Number(summary?.green_count ?? 0),
        gray: Number(summary?.gray_count ?? 0),
    };
    const totalTarget = campaign?.target_amount || 0; // Use campaign from context
    
    // נתוני הזמנות
    const invitationSentCount = Number(summary?.invitation_sent_count ?? 0);
    const arrivalConfirmedCount = Number(summary?.arrival_confirmed_count ?? 0);
    const showInvitationColumn = campaign?.showInvitationColumn ?? false;
    
    // State לניהול החלפת קוביות
    const [showInvitationCard, setShowInvitationCard] = useState(false);
    const [isHoveringCard, setIsHoveringCard] = useState(false);
    
    // החלפת קוביות כל 10 שניות רק אם showInvitationColumn מופעל והעכבר לא על הקוביה
    useEffect(() => {
        if (!showInvitationColumn || isHoveringCard) return;
        
        const interval = setInterval(() => {
            setShowInvitationCard(prev => !prev);
        }, 10000); // 10 שניות
        
        return () => clearInterval(interval);
    }, [showInvitationColumn, isHoveringCard]);
    
    const [warningsState, setWarningsState] = useState({
        card1: { hasNewWarning: true, hasHovered: false },
        card2: { hasNewWarning: true, hasHovered: false },
        card3: { hasNewWarning: true, hasHovered: false },
    });
    const handleMouseEnter = (cardKey) => {
        setWarningsState((prev) => ({
            ...prev,
            [cardKey]: {
                ...prev[cardKey],
                hasHovered: true,
            },
        }));
    };
    // חישוב סקאלה: היעד נמצא ב-75% מהבר, הכל ביחס אליו
    const targetPosition = 75; // היעד תמיד ב-75% מימין
    const getPercentage = (amount) => {
        if (!totalTarget || totalTarget === 0) return 0;
        const raw = (amount / totalTarget) * targetPosition;
        // כשעוברים את היעד, מבטיחים מינימום 4% הבדל כדי שיהיה נראה ויזואלית
        if (amount > totalTarget && raw < targetPosition + 4) {
            return targetPosition + 4;
        }
        return Math.min(raw, 100);
    };

    useEffect(() => {
        const currentText = getAssignWarningText()?.props?.children?.toString() || '';

        if (currentText !== assignWarningKey) {
            setAssignWarningKey(currentText);

            setWarningsState((prev) => ({
                ...prev,
                card1: {
                    ...prev.card1,
                    hasNewWarning: true,
                    hasHovered: false
                }
            }));
        }
    }, [fundraisersLength]);
    useEffect(() => {
        const currentElement = getDonorWarningText();
        const currentText = currentElement?.props?.children?.toString() || '';

        if (currentText !== donorWarningKey) {

            setDonorWarningKey(currentText);

            setWarningsState((prev) => ({
                ...prev,
                card2: {
                    ...prev.card2,
                    hasNewWarning: true,
                    hasHovered: false
                }
            }));
        }
    }, [counts.gray]);
    useEffect(() => {
        const currentText = getDonationsWarningText()?.props?.children?.toString() || '';

        if (currentText !== donationsWarningKey) {
            setDonationsWarningKey(currentText);

            setWarningsState((prev) => ({
                ...prev,
                card3: {
                    ...prev.card3,
                    hasNewWarning: true,
                    hasHovered: false
                }
            }));
        }
    }, [totalActual, totalExpected, totalTarget]);

    const isCrowdfunding = campaign?.campaign_type === 'crowdfunding';

    const getAssignButtonProps = () => {
        if (totalActiveDonors === 0) {
            if (isCrowdfunding) {
                return {
                    text: t('selectFundraisersNow'),
                    onClick: () => setShowAdd(true)
                };
            }
            return {
                text: t('uploadExcelAndStart'),
                onClick: () => setIsExcelOpen(true)
            };
        }

        if (fundraisersLength === 0) {
            return {
                text: t('selectFundraisersNow'),
                onClick: () => setShowAdd(true)
            };
        }

        if (assigned === 0) {
            return {
                text: t('startAssigning'),
                onClick: () => setShowAssign(true)
            };
        }

        if (unassigned === 0) {
            return {
                text: t('sendQuestionnaireToFundraisers'),
                onClick: () => console.log("שליחת שאלון")
            };
        }

        return {
            text: t('continueAssigning'),
            onClick: () => setShowAssign(true)
        };
    };
    const assignProps = getAssignButtonProps();

    const handleMouseLeave = (cardKey) => {
        setWarningsState((prev) => ({
            ...prev,
            [cardKey]: {
                ...prev[cardKey],
                hasNewWarning: false,
            },
        }));
    };

    const getDifficultyCardText = () => {

        if (totalActiveDonors == 0)
            return t('noInfoOnDonorsYet')
        if (counts.gray > 0)
            return t('donorsNotRatedInQuestionnaire')
        return t('allDonorsRatedInQuestionnaire')
    };

    const getAssignCardText = () => {
        if (totalActiveDonors === 0)
            return t('noInfoOnDonorsAndFundraisers')
        if (fundraisersLength == 0)
            return t('noFundraisersSelected')
        if (unassigned == 0)
            return t('allDonorsAssigned')
        return t('donorsAssignedToFundraiser')
    };

    //א של הכרטיס האמצעי נטרלנו את זה בינתיים שמנו במקום את הפונקציה למטה בשביל שיכול לעלות אקסלהפונקציה הזאת הי
    /*    const getButtonDifficultyProps = () => {
            if (donorsLength == 0)
                return {
                    text: "שנעלה את קובץ אנשי הקהילה?",
                    onClick: () => setIsExcelOpen(true)
                };
            if (counts.gray > 0)
                return {
                    text: "רוצה לכתוב תזכורת למתרימים שלהם?",
                    onClick: () => {/!* כאן אפשר להוסיף פעולה מתאימה בעתיד *!/}
                };
            return {
                text: "איך מתקדמים מכאן?",
                onClick: () => {/!* כאן אפשר להוסיף פעולה מתאימה בעתיד *!/}
            };
        };*/
    //יהיה כפתור לאקסל ואז להחזיר את הפונקציה מעל זהפונקציה זמנית למחיקה אחרי ש
    const getButtonDifficultyProps = () => {
        if (isCrowdfunding) {
            return {
                text: t('selectFundraisersNow'),
                onClick: () => setShowAdd(true)
            };
        }
        return {
            text: t('uploadCommunityFile'),
            onClick: () => setIsExcelOpen(true)
        };
    };


    const getDonorWarningText = () => {
        if (totalActiveDonors === 0) {
            return t('warningAfterUploadCommunity');
        }

        if (counts.gray > 0) {
            if (deadline) {
                const now = new Date();
                const daysLeft = (deadline - now) / (1000 * 60 * 60 * 24);

                if (daysLeft <= 4) {
                    return t('warningDeadlineApproaching');
                }
            }

            return t('warningMustRateAll');
        }

        return null; // אין אזהרה
    };
    const [donorWarningKey, setDonorWarningKey] = useState('');

    const getAssignWarningText = () => {
        if (totalActiveDonors === 0) {
            return t('warningAfterUploadAssign');
        }
        if (fundraisersLength === 0) {
            return t('warningExcelUploaded');
        }
        if (fundraisersLength < totalActiveDonors / 15 - 3) {
            return t('warningFewFundraisers');
        }

        return null; // אין אזהרה
    }

    const [assignWarningKey, setAssignWarningKey] = useState('');
    const [activeTab, setActiveTab] = useState("target");

    useEffect(() => {
        if (totalActual > 0) {
            setActiveTab("actual");
        } else if (totalExpected > 0) {
            setActiveTab("expected");
        } else {
            setActiveTab("target");
        }
    }, [totalActual, totalExpected]);

    const getDonationsWarningText = () => {
        if (totalExpected > totalTarget) {
            return t('warningExpectedHigherThanTarget');
        }
        if (totalActual < totalTarget || totalActual < totalExpected) {
            if (deadline) {
                const now = new Date();
                const daysLeft = (deadline - now) / (1000 * 60 * 60 * 24);

                if (daysLeft <= 4) {
                    return t('warningNeedMoreDonations');
                }
            }

            return null;
        }

        return null; // אין אזהרה
    };
    const [donationsWarningKey, setDonationsWarningKey] = useState('');

    return (
        <div className={styles.cards}>
            <div className={`${styles.card} ${totalActiveDonors > 0 && unassigned == 0 ? styles.good : fundraisersLength < totalActiveDonors / 15 - 3 ? styles.lots : ''}`}>
                {getAssignWarningText() && (
                    <div
                        key={assignWarningKey} // כדי לאלץ רנדר מחדש
                        className={styles.warningIconWrapper}
                        onMouseEnter={() => handleMouseEnter('card1')}
                        onMouseLeave={() => handleMouseLeave('card1')}
                    >
                        {(warningsState.card1.hasNewWarning || !warningsState.card1.hasHovered) ? (
                            <BellNew className={styles.warningIcon} />
                        ) : (
                            <Bell className={styles.warningIcon} />
                        )}
                        <div className={`${styles.tooltip} tooltip-1`}>
                            {getAssignWarningText()}
                        </div>
                    </div>
                )}
                <div className={styles.card1Wrapper}
                    onMouseEnter={() => setIsHoveringCard(true)}
                    onMouseLeave={() => setIsHoveringCard(false)}
                >
                    <div className={styles.content1Wrapper}>
                        <div className={styles.cardContent}>
                            <h2 className={`table-1 ${styles.h2Title}`}>{showInvitationColumn && showInvitationCard ? t('invitationsAndConfirmations') : t('donorAssignment')}</h2>
                            {showInvitationColumn && showInvitationCard ? (
                                <div className={styles.invitationStats}>
                                    <div className={styles.statRow}>
                                        <span>{t('allCommunity')} <span style={{ color: '#A5A6C6', fontWeight: 700 }}>{totalActiveDonors.toLocaleString()}</span></span>
                                    </div>
                                    <div className={styles.statRow}>
                                        <span>{t('invitationDelivered')} <span style={{ color: '#6E99EC', fontWeight: 700 }}>{invitationSentCount.toLocaleString()}</span></span>
                                    </div>
                                    <div className={styles.statRow}>
                                        <span>{t('confirmedParticipation')} <span style={{ color: '#0C4AD5', fontWeight: 700 }}>{arrivalConfirmedCount.toLocaleString()}</span></span>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h1 className={`card`}>
                                        {assigned === totalActiveDonors && totalActiveDonors > 0 ? (
                                            '100%'
                                        ) : (
                                            <>
                                                {assigned.toLocaleString()}
                                                <span className='table-1' style={{ margin: '0 5px' }}>/</span>
                                                <span className='table-1'>{totalActiveDonors.toLocaleString()}</span>
                                            </>
                                        )}
                                    </h1>
                                    <p className={`table-3 ${styles.pTitle}`}>{getAssignCardText()}</p>
                                </div>
                            )}
                        </div>
                        <Button
                            text={showInvitationColumn && showInvitationCard ? t('whoToRush') : assignProps.text}
                            onClick={assignProps.onClick}
                            smallSmall
                            fullWidth
                        />
                    </div>
                    <div className={styles.doughnut}>
                        <Doughnut
                            data={showInvitationColumn && showInvitationCard ? {
                                labels: [
                                    `${arrivalConfirmedCount} ${t('confirmedParticipation').replace(':', '')}`,
                                    `${invitationSentCount - arrivalConfirmedCount} ${t('invitationDelivered').replace(':', '')}`,
                                    `${totalActiveDonors - invitationSentCount} ${t('noInvitation')}`
                                ],
                                datasets: [{
                                    data: totalActiveDonors === 0 ? [100] : [
                                        arrivalConfirmedCount,
                                        invitationSentCount - arrivalConfirmedCount,
                                        totalActiveDonors - invitationSentCount
                                    ],
                                    backgroundColor: totalActiveDonors === 0 ? ['#E5E5E8'] : [
                                        '#0C4AD5',
                                        '#6E99EC',
                                        '#E5E5E8'
                                    ],
                                    hoverBackgroundColor: totalActiveDonors === 0 ? ['#E5E5E8'] : [
                                        '#0942B8',
                                        '#5685D9',
                                        '#D5D6E0'
                                    ],
                                    borderWidth: 0,
                                }]
                            } : {
                                labels: [
                                    `${assigned} ${t('donorsAssigned')}`,
                                    assigned == 0 ? t('nothingToSeeHere') : `${unassigned} ${t('donorsNotAssigned')}`
                                ],
                                datasets: [{
                                    data: [assigned, assigned == 0 && unassigned == 0 ? 100 : unassigned],
                                    backgroundColor: ['rgba(185, 122, 0, 1)', 'rgba(237, 245, 253, 1)'],
                                    hoverBackgroundColor: ['#75460E', 'rgba(237, 245, 253, 0.6)'],
                                    borderWidth: 0,
                                }]
                            }}
                            options={{
                                cutout: '85%',
                                responsive: false,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        display: false
                                    },
                                    tooltip: {
                                        backgroundColor: 'rgba(255, 255, 255, 0.65)',
                                        padding: 4,
                                        cornerRadius: 2,
                                        titleFont: {
                                            size: 10,
                                            weight: '700',
                                            family: 'pingFont',
                                        },
                                        bodyFont: {
                                            size: 10,
                                            weight: '700',
                                            // family: {var(--font-ping)},
                                        },
                                        width: 50,
                                        titleColor: '#283680',
                                        bodyColor: '#283680',
                                        boxPadding: 0,
                                        boxWidth: 0, // מבטל את הריבוע צבע
                                        boxHeight: 0,
                                        usePointStyle: false,
                                        displayColors: false, // 💡 זה מסיר את ריבוע הצבע
                                        callbacks: {
                                            label: function (tooltipItem) {
                                                return tooltipItem.label; // רק הטקסט עצמו
                                            },
                                            title: () => null // הסרה של כותרת נפרדת
                                        },
                                        boxShadow: '0px 0px 4px 0px rgba(205, 206, 225, 0.25)',
                                    }
                                }
                            }}
                            width={164}
                            height={164}
                        />
                        <div className={styles.doughnutText}>
                            {showInvitationColumn && showInvitationCard ? (
                                totalActiveDonors === 0 ? (
                                    <div className='small-button-1'>{t('noDonors')}</div>
                                ) : (
                                    <>
                                        <div className={`body-2 ${styles.percent}`}>
                                            {totalActiveDonors > 0 ? Math.round((arrivalConfirmedCount / totalActiveDonors) * 100) : 0}%
                                        </div>
                                        <div className='small-button-1'>{t('confirmedArrival')}</div>
                                    </>
                                )
                            ) : assigned === 0
                                ? <div className='small-button-1'>{t('noDonorsAssignedYet')}</div>
                                :
                                <>
                                    <div className={`body-2 ${styles.percent}`}>
                                        {(() => {
                                            const percentage = Math.round((assigned / totalActiveDonors) * 100);
                                            return assigned === totalActiveDonors ? percentage : (percentage === 100 ? 99 : percentage);
                                        })()}%
                                    </div>
                                    <div className='small-button-1'>{t('donorsAssignedToFundraisers')}</div>
                                </>
                            }
                        </div>
                    </div>
                </div>
            </div>
            <div className={`${styles.card} ${totalActiveDonors > 0 && counts.gray == 0 ? styles.good : ''}`}>
                {getDonorWarningText() && (
                    <div
                        key={donorWarningKey} // כדי לאלץ רנדר מחדש
                        className={styles.warningIconWrapper}
                        onMouseEnter={() => handleMouseEnter('card2')}
                        onMouseLeave={() => handleMouseLeave('card2')}
                    >
                        {(warningsState.card2.hasNewWarning || !warningsState.card2.hasHovered) ? (
                            <BellNew className={styles.warningIcon} />
                        ) : (
                            <Bell className={styles.warningIcon} />
                        )}
                        <div className={`${styles.tooltip} tooltip-1`}>
                            {getDonorWarningText()}
                        </div>
                    </div>
                )}
                <div className={styles.cardContent}>
                    <div className={styles.contentCard2}>
                        <h2 className={`table-1 ${styles.h2Title}`}>{t('donorPotentialRating')}</h2>
                        <div>
                            <h1 className={`card ${totalActiveDonors == 0 ? styles.noDonorsCard : ''}`}>
                                {counts.gray === 0 && totalActiveDonors > 0 ? (
                                    '100%'
                                ) : (
                                    <> {counts.gray.toLocaleString()}
                                        <span className='table-1' style={{ margin: '0 5px' }}>/</span>
                                        <span className='table-1'>{totalActiveDonors.toLocaleString()}</span>
                                    </>
                                )}
                            </h1>
                            <p className={`table-3 ${styles.pTitle}`}>{getDifficultyCardText()}</p>
                        </div>
                    </div>
                    <div className={`${styles.chart} ${totalActiveDonors == 0 ? styles.opacity : ''} tooltip-2`}>
                        <div className={`${styles.barDiagram} ${styles.redDiagram}`} style={{ height: `${counts.red / totalActiveDonors * 200}%` }}>
                            <div className={styles.diagramTooltip}><span>{counts.red} {t('donorsAssigned').split(' ')[0]}</span><br />{t('lowPotentialForDonation')}</div>
                        </div>
                        <div className={`${styles.barDiagram} ${styles.orangeDiagram}`} style={{ height: `${counts.orange / totalActiveDonors * 200}%` }}>
                            <div className={styles.diagramTooltip}><span>{counts.orange} {t('donorsAssigned').split(' ')[0]}</span><br />{t('mediumPotentialForDonation')}</div>
                        </div>
                        <div className={`${styles.barDiagram} ${styles.greenDiagram}`} style={{ height: `${counts.green / totalActiveDonors * 200}%` }}>
                            <div className={styles.diagramTooltip}><span>{counts.green} {t('donorsAssigned').split(' ')[0]}</span><br />{t('highPotentialForDonation')}</div>
                        </div>
                        <div className={`${styles.barDiagram} ${styles.grayDiagram}`} style={{ height: `${counts.gray / totalActiveDonors * 200}%` }}>
                            <div className={styles.diagramTooltip}><span>{counts.gray} {t('donorsAssigned').split(' ')[0]}</span><br />{t('noInfoYet')}</div>
                        </div>
                        {/* <div className={`${styles.barDiagram} ${styles.blueDiagram}`} style={{ height: `${counts.blue /activeDonors.length* 200}%` }}>
                                        <div className={styles.diagramTooltip}><span>{counts.blue} תורמים</span><br />עוד לא שויכו למתרימים</div>
                                    </div> */}
                    </div>
                </div>
                <Button
                    text={getButtonDifficultyProps().text}
                    onClick={getButtonDifficultyProps().onClick}
                    smallSmall fullWidth />
            </div>
            <div className={`${styles.card} ${styles.donationCard}
                       ${totalActual >= totalTarget ? styles.good : ''} `}>
                {getDonationsWarningText() && (
                    <div
                        key={donationsWarningKey} // כדי לאלץ רנדר מחדש
                        className={styles.warningIconWrapper}
                        onMouseEnter={() => handleMouseEnter('card3')}
                        onMouseLeave={() => handleMouseLeave('card3')}
                    >
                        {(warningsState.card3.hasNewWarning || !warningsState.card3.hasHovered) ? (
                            <BellNew className={styles.warningIcon} />
                        ) : (
                            <Bell className={styles.warningIcon} />
                        )}
                        <div className={`${styles.tooltip} tooltip-1`}>
                            {getDonationsWarningText()}
                        </div>
                    </div>
                )}
                <div className={styles.cardContent}>
                    <h2 className={`table-1 ${styles.h2Title}`}>{t('donationRatio')}</h2>
                    <div className={`${styles.cardGraphContent} ${totalActual > totalTarget ? styles.veryGood : ''}`}>
                        <div className={styles.cardHeader} style={{ color: activeTab === 'target' ? 'var(--Gray-Blue-200, #C5D7F8)' : activeTab === 'expected' ? 'var(--Text-Fundraiser-able, #009FC0)' : 'var(--Text-donor-Select, #B97A00)' }}>
                            <div className={`${styles.cardTitle} table-1`}>
                                {activeTab === 'target' && (
                                    <span style={{ color: 'var(--Text-Default, #6E99EC)' }}><Arrow /> {t('campaignTarget')}</span>
                                )}
                                {activeTab === 'expected' && (
                                    <span><Lamp /> {t('expectedDonations')}</span>
                                )}
                                {activeTab === 'actual' && (
                                    <span><Money /> {t('actualDonations')}</span>
                                )}
                            </div>
                            <div className={`${activeTab === 'actual' ? styles.cardAmount : ''} card-2`}>
                                {activeTab === 'target' && (
                                    <>
                                        {Math.round(totalTarget).toLocaleString()} <span className="tooltip-2"><CurrencySymbol /></span>
                                    </>
                                )}
                                {activeTab === 'expected' && (
                                    <>
                                        {totalExpected.toLocaleString()} <span className="tooltip-2"><CurrencySymbol /></span>
                                    </>
                                )}
                                {activeTab === 'actual' && (
                                    <>
                                        {totalActual.toLocaleString()} <span className="tooltip-2"><CurrencySymbol /></span>
                                    </>
                                )}
                            </div>

                            <div className={`${styles.cardSubText} table-3`}>
                                {activeTab === 'target' && t('createdByYou')}
                                {activeTab === 'expected' && totalExpected > 0 && t('createdByFundraisers', { count: summary?.fundraisers_with_completed_forecast || 0 })}
                                {activeTab === 'actual' && totalActual > 0 && t('donatedByDonors', { count: donorsWithDonations })}
                            </div>
                        </div>
                        <div className={styles.barLegend}>
                            <div className={styles.graphBar}>
                                <div className={styles.targetMarker} style={{ right: `${getPercentage(totalTarget)}%` }} />
                                {totalExpected > 0 && <div className={styles.expectedBar} style={{ right: `${getPercentage(totalExpected)}%` }} />}
                                <div className={styles.actualBar} style={{ width: `${getPercentage(totalActual)}%` }} />
                            </div>

                            <div className={styles.legend}>
                                <button
                                    onClick={() => setActiveTab('actual')}
                                    className={activeTab === 'actual' ? styles.active : ''}
                                >
                                    <span></span>
                                    {t('actualDonations')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('expected')}
                                    className={activeTab === 'expected' ? styles.active : ''}
                                >
                                    <span></span>
                                    {t('donationForecast')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('target')}
                                    className={activeTab === 'target' ? styles.active : ''}
                                >
                                    <span></span>
                                    {t('campaignTarget')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <Button onClick={() => { }}
                    text={t('howToProgress')}
                    smallSmall />
            </div>
        </div>
    );
}