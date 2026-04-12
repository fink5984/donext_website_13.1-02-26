// Function to get appropriate text - accepts translation function
export const getCardText = (count, min, max, t) => {
    if (count === 0) return t('summaryCards.noFundraisersSelected');
    if (count < min) return t('summaryCards.recommendAddMore', { count: min - count });
    if (count < max) return t('summaryCards.perfectCanAddMore', { count: max - count });
    if (count == max) return t('summaryCards.perfectMaxRecommended');
    if (count < max * 2) return t('summaryCards.aboveRecommended');
    return t('summaryCards.wayTooMany');
};

export const getButtonText = (count, min, max, t) => {
    if (count < min) return t('summaryCards.addFundraisers');
    if (count <= max) return t('summaryCards.manageFundraisers');
    return t('summaryCards.manageAndDelete');
};

export const getButtonQuestionnaireText = (completed, notSent, totalFundraisers, t) => {
    if (totalFundraisers === 0 || notSent === totalFundraisers) {
        return t('summaryCards.sendQuestionnaires');
    }
    if (completed < totalFundraisers) {
        return t('summaryCards.sendReminder');
    }
    return t('summaryCards.toQuestionnaireAnalysis');
};

export const getQuestionnaireCardText = (completed, notSent, totalFundraisers, t) => {
    if (totalFundraisers === 0) {
        return t('summaryCards.noFundraisersYet');
    }
    if (notSent === totalFundraisers) {
        return t('summaryCards.noQuestionnaireSent');
    }
    if (completed === 0) {
        return t('summaryCards.noOneAnswered');
    }
    if (completed < totalFundraisers) {
        return t('summaryCards.fundraisersAnswered');
    }
    return t('summaryCards.allAnswered');
};

export const getCard3Text = (totalExpectedDonations, target, t) => {
    if (totalExpectedDonations === 0) return t('summaryCards.forecastAfterQuestionnaire');
    if (totalExpectedDonations < target * 0.25) return t('summaryCards.greatStart');
    if (totalExpectedDonations < target * 0.5) return t('summaryCards.over25Percent');
    if (totalExpectedDonations < target * 0.75) return t('summaryCards.passedHalf');
    if (totalExpectedDonations < target) return t('summaryCards.closeToTarget');
    if (totalExpectedDonations === target) return t('summaryCards.exactlyTarget');
    return t('summaryCards.passedTarget');
}; 