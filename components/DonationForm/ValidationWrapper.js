import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import styles from './DonationForm.module.scss';

const ValidationWrapper = ({
    selectedDonor,
    formData,
    campaign,
    onValidationStateChange
}) => {
    const t = useTranslations('donationForm');
    const [showValidation, setShowValidation] = useState(false);
    const [validationMessage, setValidationMessage] = useState("");
    const [validationKey, setValidationKey] = useState("");

    const getFirstValidationMessage = () => {
        if (!selectedDonor || !selectedDonor.id) return { key: "mustSelectDonor", message: t('mustSelectDonor') };

        const hasAmount = (formData.selectedAmount && formData.selectedAmount !== 'custom') ||
            (formData.selectedAmount === 'custom' && formData.customAmount && parseFloat(formData.customAmount) > 0);
        if (!hasAmount) return { key: "noAmountSelected", message: t('noAmountSelected') };

        const hasValidPayments = formData.numberOfPayments > 0 || formData.isUnlimited;
        if (!hasValidPayments) return { key: "noPeriodSelected", message: t('noPeriodSelected') };

        if (!formData.paymentMethod) return { key: "noPaymentMethodSelected", message: t('selectPaymentMethod') };

        // Check if commitment or checks payment method requires notes
        if ((formData.paymentMethod === 'COMMITMENT' || formData.paymentMethod === 'CHECKS') && (!formData.note || formData.note.trim() === '')) {
            return { key: "paymentRequiresNotes", message: t('paymentRequiresNotes') };
        }

        // Check if note exists but no follow-up date selected (or date is not in the future)
        if (formData.note && formData.note.trim() !== '') {
            if (!formData.followUpDate) {
                return { key: "noteRequiresFollowUpDate", message: t('noteRequiresFollowUpDate') };
            }
            // Check if follow-up date is in the future
            const followUpDate = new Date(formData.followUpDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (followUpDate <= today) {
                return { key: "followUpDateMustBeFuture", message: t('followUpDateMustBeFuture') };
            }
            // Check if assignee is selected
            if (!formData.noteAssignee) {
                return { key: "noteRequiresAssignee", message: t('noteRequiresAssignee') };
            }
        }

        return null;
    };

    const isFormValid = () => !getFirstValidationMessage();

    // Hide validation when the user fixes the specific issue
    useEffect(() => {
        if (showValidation && validationKey) {
            let currentErrorFixed = false;

            if (validationKey === "mustSelectDonor" && selectedDonor && selectedDonor.id) {
                currentErrorFixed = true;
            } else if (validationKey === "noAmountSelected") {
                const hasAmount = (formData.selectedAmount && formData.selectedAmount !== 'custom') ||
                    (formData.selectedAmount === 'custom' && formData.customAmount && parseFloat(formData.customAmount) > 0);
                currentErrorFixed = hasAmount;
            } else if (validationKey === "noPeriodSelected") {
                const hasValidPayments = formData.numberOfPayments > 0 || formData.isUnlimited;
                currentErrorFixed = hasValidPayments;
            } else if (validationKey === "noPaymentMethodSelected") {
                currentErrorFixed = !!formData.paymentMethod;
            } else if (validationKey === "paymentRequiresNotes") {
                currentErrorFixed = formData.note && formData.note.trim() !== '';
            } else if (validationKey === "noteRequiresFollowUpDate") {
                currentErrorFixed = !!formData.followUpDate;
            } else if (validationKey === "followUpDateMustBeFuture") {
                if (formData.followUpDate) {
                    const followUpDate = new Date(formData.followUpDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    currentErrorFixed = followUpDate > today;
                }
            } else if (validationKey === "noteRequiresAssignee") {
                currentErrorFixed = !!formData.noteAssignee;
            }

            if (currentErrorFixed) {
                setShowValidation(false);
                setValidationMessage("");
                setValidationKey("");
            }
        }
    }, [formData, selectedDonor, campaign, showValidation, validationKey]);

    // Update validation state to parent
    useEffect(() => {
        onValidationStateChange?.({
            isValid: isFormValid(),
            showValidation: () => {
                const result = getFirstValidationMessage();
                if (result) {
                    setValidationMessage(result.message);
                    setValidationKey(result.key);
                    setShowValidation(true);
                }
            }
        });
    }, [formData, selectedDonor, campaign]);

    return (
        <div className={styles.validationSection}>
            <div className={`${styles.validationMessage} validation`}>
                {validationMessage}
            </div>
        </div>
    );
};

export default ValidationWrapper; 