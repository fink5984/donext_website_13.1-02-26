export function getRankHeaderText({ rankIdx, totalRanks, ranked, t }) {
    const noRankedYet = ranked.flat().length === 0;
    if (rankIdx === 0) {
        return t('rankHeaderStart');
    }
    if (rankIdx === 1) {
        if (noRankedYet) {
            return t('rankHeaderContinue');
        } else {
            return t('rankHeaderContinueWithDonors');
        }
    }
    if (rankIdx === totalRanks - 1) {
        if (noRankedYet) {
            return t('rankHeaderLastNoDonors');
        } else {
            return t('rankHeaderLastWithDonors');
        }
    }
    if (rankIdx === 2) {
        if (noRankedYet) {
            return t('rankHeaderAdvanced');
        } else {
            return t('rankHeaderAdvancedWithDonors');
        }
    }
    if (rankIdx === totalRanks - 2) {
        return t('rankHeaderAlmostDone');
    }
    if (noRankedYet) {
        return t('rankHeaderAdvanced');
    } else {
        return t('rankHeaderAdvancedWithDonors');
    }
}

// פונקציה שמחזירה את הטקסט המתאים לכפתור ההמשך
export function getButtonText({ rankIdx, ranked, RANKS, donors, t }) {
    // אם כל התורמים נבחרו
    const allDonorsSelected = ranked.flat().length === donors.length;
    if (allDonorsSelected) {
        return t('buttonFinished');
    }

    // בדיקה אם יש תורמים שנבחרו בדרגות קודמות
    const hasSelectedInPreviousRanks = ranked.slice(0, rankIdx).some(r => r.length > 0);

    // דרגה ראשונה
    if (rankIdx === 0) {
        return ranked[rankIdx].length > 0 ? t('buttonNoMore') : t('buttonSeemLikeNone');
    }

    // דרגה שניה
    if (rankIdx === 1) {
        return ranked[rankIdx].length > 0 ? t('buttonNoOneElse') : t('buttonDontSeeAnyone');
    }

    // דרגה אחרונה
    if (rankIdx === RANKS.length - 1) {
        if (hasSelectedInPreviousRanks) {
            return t('buttonCompleted');
        }
        return ranked[rankIdx].length === donors.length - ranked.flat().length ?
            t('buttonFinished') : t('buttonCompletedHere');
    }

    // דרגה אחת לפני האחרונה (אם יש 5 דרגות ומעלה)
    if (RANKS.length >= 5 && rankIdx === RANKS.length - 2) {
        if (ranked.flat().length === 0) {
            return t('buttonSorryNoOne');
        }
        if (ranked[rankIdx].length === 0 && hasSelectedInPreviousRanks) {
            return t('buttonThinkNoOne');
        }
        return t('buttonRestDontFit');
    }

    // דרגה שלישית (או דרגות אמצע נוספות)
    if (ranked.flat().length === 0) {
        return t('buttonDontThinkHere');
    }
    if (ranked[rankIdx].length === 0 && hasSelectedInPreviousRanks) {
        return t('buttonDidntFindAnyone');
    }
    return t('buttonNoMoreAnyone');
}
