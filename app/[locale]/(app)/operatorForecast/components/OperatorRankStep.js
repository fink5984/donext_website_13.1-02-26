import React from 'react';
import styles from '../../donorForecast/donorForecast.module.scss';
import Wallet from '../../donorForecast/Wallet';
import DonorRankCard from '../../donorForecast/DonorRankCard';
import EmptyStateMessage from '../../donorForecast/components/EmptyStateMessage';
import Button from '@/app/components/Button';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import TimerCircle from '../../donorForecast/TimerCircle';
import Arrow from '@/app/icons/arrowScroll.svg';
import { getRankIconsAndColors } from "../../donorForecast/rankUtils";
import { CurrencySymbol } from "@/app/components/CurrencySymbol";

export function OperatorRankStep({
    screenRef,
    listRef,
    rankIdx,
    RANKS,
    operator,
    coins,
    availableFundraisers,
    assignedIds,
    ranked,
    draggedFundraiserRef,
    isDragging,
    mousePos,
    isDragOver,
    hasScroll,
    hasEverScrolledToBottom,
    showScrollValidation,
    canProceed,
    nextRank,
    addToRank,
    returnFundraiser,
    handleMouseDown,
    handleMouseUpShort,
    setShowScrollValidation,
    hasSelectedInCurrentRank,
    timer,
    TIMER_SECONDS,
    t
}) {
    const getButtonText = () => {
        const allRanked = ranked.flat().length;
        if (allRanked === availableFundraisers.length) return t('finish');
        if (rankIdx === RANKS.length - 1) return t('finish');
        return t('nextRank');
    };

    const getRankHeaderText = () => {
        if (rankIdx === 0) {
            return t('rankHeaderFirst');
        }
        if (rankIdx === RANKS.length - 1) {
            return t('rankHeaderLast');
        }
        return t('rankHeaderMiddle');
    };

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
                            {rankIdx === 0 && operator && (
                                <div className="headline-5">
                                    {t('heyGreeting', { name: operator.first_name || '' })}
                                    <span className="headline-4"> {t('greatToHaveYou')}</span>
                                </div>
                            )}
                            <div className="headline-5">{getRankHeaderText()}</div>
                            <div className="headline-4">{t('chooseFundraisersWithAbility')}</div>
                        </div>
                    </div>
                    <div className={styles.amountRow}>
                        <span className="card">{RANKS[rankIdx].amount.toLocaleString()}</span>
                        <span className="table-3"><CurrencySymbol /></span>
                    </div>
                    <div className={styles.rankMain}>
                        <div className={styles.donorListWrapper}>
                            <div className={styles.donorList} ref={listRef}>
                                {availableFundraisers.map(fundraiser => {
                                    const isAssigned = assignedIds.includes(fundraiser.originalIndex);
                                    const isDraggingThis = draggedFundraiserRef.current && draggedFundraiserRef.current.originalIndex === fundraiser.originalIndex && isDragging;
                                    let medalIcon = null;
                                    if (isAssigned) {
                                        const assignedRankIdx = ranked.findIndex(arr => arr.some(f => f.originalIndex === fundraiser.originalIndex));
                                        if (assignedRankIdx !== -1) {
                                            const ranks = getRankIconsAndColors(RANKS.length);
                                            medalIcon = ranks[assignedRankIdx].Icon;
                                        }
                                    }
                                    return (
                                        <DonorRankCard
                                            key={fundraiser.originalIndex}
                                            donor={fundraiser}
                                            status={
                                                isDraggingThis ? "dragSource" :
                                                    isAssigned ? "disabled" : "unassigned"
                                            }
                                            onClick={isAssigned ? undefined : () => addToRank(fundraiser)}
                                            onMouseDown={isAssigned ? undefined : (e) => handleMouseDown(fundraiser, e)}
                                            onMouseUp={isAssigned ? undefined : () => handleMouseUpShort(fundraiser)}
                                            isSelected={false}
                                            numRanks={RANKS.length}
                                            rankIdx={rankIdx}
                                            medalIcon={medalIcon}
                                            className={isDraggingThis ? styles.dragSource : ""}
                                        />
                                    );
                                })}
                                {isDragging && draggedFundraiserRef.current && (
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
                                        <DonorRankCard donor={draggedFundraiserRef.current} status="dragPreview" isSelected={false} rankIcon="😉" />
                                    </div>
                                )}
                            </div>
                            {rankIdx === 0 && hasScroll && !hasEverScrolledToBottom && (
                                <button
                                    className={styles.scrollArrow}
                                    onClick={() => {
                                        listRef.current.scrollBy({ top: 120, behavior: 'smooth' });
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
                        <div id="selectedListPanel" className={`${styles.selectedListWrapper} ${isDragOver ? styles.dragOver : ""}`}>
                            {ranked[rankIdx].length > 0 ? (
                                <div className={styles.selectedList}>
                                    {ranked[rankIdx].map(fundraiser => (
                                        <DonorRankCard
                                            key={fundraiser.originalIndex}
                                            donor={fundraiser}
                                            isSelected={true}
                                            numRanks={RANKS.length}
                                            rankIdx={rankIdx}
                                            onClick={() => returnFundraiser(fundraiser)}
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
                                    text={getButtonText()}
                                    onClick={nextRank}
                                    disabled={true}
                                    small
                                />
                            }
                        />
                    ) : (
                        <Button
                            text={getButtonText()}
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
                <div className={styles.timerBarWrapper}>
                    <TimerCircle seconds={timer} maxSeconds={TIMER_SECONDS} size={64} />
                </div>
            </div>
        </div>
    );
}
