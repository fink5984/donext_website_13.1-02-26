import React from 'react';
import styles from '../donorForecast.module.scss';
import Wallet from '../Wallet';
import DonorRankCard from '../DonorRankCard';
import EmptyStateMessage from './EmptyStateMessage';
import Button from '@/app/components/Button';
import IconTooltip from '../../../components/IconTooltip/IconTooltip';
import TimerCircle from '../TimerCircle';
import Sticker from './Sticker';
import Arrow from '@/app/icons/arrowScroll.svg';
import { getRankIconsAndColors } from "../rankUtils";
import { CurrencySymbol } from "@/app/components/CurrencySymbol";
import { useTranslations } from 'next-intl';


export function RankStep({
    screenRef,
    donorListRef,
    rankIdx,
    RANKS,
    fundraiser,
    coins,
    availableDonors,
    assignedDonorIds,
    ranked,
    draggedDonorRef,
    isDragging,
    mousePos,
    isDragOver,
    hasScroll,
    hasEverScrolledToBottom,
    showScrollValidation,
    canProceed,
    nextRank,
    getButtonText,
    addToRank,
    returnDonor,
    handleMouseDown,
    handleMouseUpShort,
    skipPopupsUntilRank,
    showSticker,
    TIMER_SECONDS,
    getRankHeaderText,
    setShowScrollValidation,
    hasSelectedInCurrentRank,
    timer,
    donationType
}) {
    const t = useTranslations('donorForecast');
    
    return (
        <div className={styles.donorForecastScreen} ref={screenRef}>
            <div className={styles.rankPage}>
                <div className={styles.progressBarWrapper}>
                    <div
                        className={styles.progressBarFill}
                        style={{
                            width: `${((rankIdx + 1) / (RANKS.length + 1)) * 100}%`,
                            background: "var(--Icon-able-Icon, #0C4AD5)"
                        }}
                    />
                </div>

                <div className={styles.rankContent}>
                    <div className={styles.rankWalletHeader}>
                        <div className={styles.wheaderWalletWrapper}>
                            <Wallet coins={coins} numRanks={RANKS.length} />
                        </div>
                        <div className={styles.rankHeader}>
                            {rankIdx === 0 && (
                                <div className="headline-5">{t('heyGreeting', { name: fundraiser.firstName })}<span className="headline-4"> {t('greatToHaveYou')}</span></div>
                            )}
                            <div className="headline-5">{getRankHeaderText({ rankIdx, totalRanks: RANKS.length, ranked, t })}</div>
                            <div className="headline-4">
                                {donationType !== 'project' ? t('chooseDonorsMonthly') : t('chooseDonorsWithAbility')}
                            </div>
                        </div>
                    </div>
                    <div className={styles.amountRow}>
                        <span className="card">{RANKS[rankIdx].amount.toLocaleString()}</span>
                        <span className="table-3"><CurrencySymbol /></span>
                    </div>
                    <div className={styles.rankMain}>
                        <div className={styles.donorListWrapper} >
                            <div className={styles.donorList} ref={donorListRef}>
                                {availableDonors.map(donor => {
                                    const isAssigned = assignedDonorIds.includes(donor.originalIndex);
                                    const isDraggingThis = draggedDonorRef.current && draggedDonorRef.current.originalIndex === donor.originalIndex && isDragging;
                                    let medalIcon = null;
                                    if (isAssigned) {
                                        const assignedRankIdx = ranked.findIndex(arr => arr.some(d => d.originalIndex === donor.originalIndex));
                                        if (assignedRankIdx !== -1) {
                                            const ranks = getRankIconsAndColors(RANKS.length);
                                            medalIcon = ranks[assignedRankIdx].Icon;
                                        }
                                    }
                                    return (
                                        <DonorRankCard
                                            key={donor.originalIndex}
                                            donor={donor}
                                            status={
                                                isDraggingThis ? "dragSource" :
                                                    isAssigned ? "disabled" : "unassigned"
                                            }
                                            onClick={isAssigned ? undefined : () => addToRank(donor)}
                                            onMouseDown={isAssigned ? undefined : (e) => handleMouseDown(donor, e)}
                                            onMouseUp={isAssigned ? undefined : () => handleMouseUpShort(donor)}
                                            isSelected={false}
                                            numRanks={RANKS.length}
                                            rankIdx={rankIdx}
                                            medalIcon={medalIcon}
                                            className={
                                                isDraggingThis
                                                    ? styles.dragSource
                                                    : ""
                                            }
                                        />
                                    );
                                })}
                                {isDragging && draggedDonorRef.current && (
                                    <div
                                        className={styles.dragPreview}
                                        style={{
                                            position: "absolute",
                                            left: mousePos.x + 10,
                                            top: mousePos.y + 10,
                                            pointerEvents: "none",
                                            zIndex: 9999,
                                        }}
                                    >
                                        <DonorRankCard donor={draggedDonorRef.current} status="dragPreview" isSelected={false} rankIcon="😉" />
                                    </div>
                                )}
                            </div>
                            {rankIdx === 0 && hasScroll && !hasEverScrolledToBottom && (
                                <button
                                    className={styles.scrollArrow}
                                    onClick={() => {
                                        donorListRef.current.scrollBy({ top: 120, behavior: 'smooth' });
                                    }}
                                    type="button"
                                    tabIndex={0}
                                >
                                    <Arrow />
                                </button>
                            )}
                            {showScrollValidation && !hasEverScrolledToBottom && (
                                <div className={`${styles.scrollValidation} validation`}>
                                    {t('scrollValidation')}
                                </div>
                            )}
                        </div>
                        <div id="selectedListPanel" className={`${styles.selectedListWrapper} ${isDragOver ? styles.dragOver : ""}`} >
                            {ranked[rankIdx].length > 0 ? (
                                <div className={styles.selectedList}>
                                    {ranked[rankIdx].map(donor => (
                                        <DonorRankCard
                                            key={donor.originalIndex}
                                            donor={donor}
                                            isSelected={true}
                                            numRanks={RANKS.length}
                                            rankIdx={rankIdx}
                                            onClick={() => returnDonor(donor)}
                                            rankIcon={RANKS[rankIdx].icon}
                                            medalIcon={null}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <EmptyStateMessage
                                    stage={rankIdx + 1}
                                    hasExistingDonors={ranked.slice(0, rankIdx).some(arr => arr.length > 0)}
                                    totalStages={RANKS.length}
                                    hasRemovedDonors={hasSelectedInCurrentRank}
                                />
                            )}
                        </div>
                    </div>
                </div>
                <div className={styles.buttonWrapper}>
                    {!canProceed ? (
                        <IconTooltip
                            text={<>
                                {rankIdx === RANKS.length - 1 ? (
                                    <p style={{ fontWeight: 400 }}>{t('finishChoosingNames')}</p>
                                ) : (
                                    <>
                                        <p style={{ fontWeight: 700 }}>{t('cantContinueYet')}</p>
                                        <p style={{ fontWeight: 400 }}>{t('whileTimerRunning')}</p>
                                    </>
                                )}
                            </>}
                            up
                            icon={
                                <Button
                                    text={getButtonText({ rankIdx, ranked, RANKS, donors: availableDonors, t })}
                                    onClick={nextRank}
                                    disabled={true}
                                    small
                                />
                            }
                        />
                    ) : (
                        <Button
                            text={getButtonText({ rankIdx, ranked, RANKS, donors: availableDonors, t })}
                            onClick={() => {
                                if (rankIdx === 0 && hasScroll && !hasEverScrolledToBottom) {
                                    setShowScrollValidation(true);
                                } else {
                                    nextRank();
                                }
                            }}
                            disabled={rankIdx === 0 && hasScroll && !hasEverScrolledToBottom}
                            disabledClick={true}
                            small
                        />
                    )}
                </div>
                {rankIdx > skipPopupsUntilRank && (
                    <div className={styles.timerBarWrapper}>
                        <TimerCircle seconds={timer} maxSeconds={TIMER_SECONDS} size={64} />
                    </div>
                )}
                <Sticker
                    show={showSticker}
                />
            </div>
        </div>
    );
}
