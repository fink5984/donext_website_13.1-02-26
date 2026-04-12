import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import styles from './DonationForm.module.scss';

const ValidationWrapperPublic = ({
    selectedDonor,
    formData,
    campaign,
    onValidationStateChange
}) => {
    const t = useTranslations('donationForm');
    const [showValidation, setShowValidation] = useState(false);
    const [validationMessage, setValidationMessage] = useState("");

    const getFirstValidationMessage = () => {
        // Check if donor has first name
        if (!selectedDonor || (!selectedDonor.firstName && !selectedDonor.first_name)) {
            return t('firstNameRequired');
        }

        // Check if donor has last name
        if (!selectedDonor.lastName && !selectedDonor.last_name) {
            return t('lastNameRequired');
        }

        // Check if donor has phone
        if (!selectedDonor.phone) {
            return t('phoneRequired');
        }

        const hasAmount = (formData.selectedAmount && formData.selectedAmount !== 'custom') ||
            (formData.selectedAmount === 'custom' && formData.customAmount && parseFloat(formData.customAmount) > 0);
        if (!hasAmount) return t('noAmountSelected');

        const hasValidPayments = formData.numberOfPayments > 0 || formData.isUnlimited;
        if (!hasValidPayments) return t('noPeriodSelected');

        return null;
    };

    const isFormValid = () => !getFirstValidationMessage();

    // Hide validation when user fixes the specific issue
    useEffect(() => {
        if (showValidation && validationMessage) {
            let currentErrorFixed = false;

            if (validationMessage === t('firstNameRequired') && selectedDonor && (selectedDonor.firstName || selectedDonor.first_name)) {
                currentErrorFixed = true;
            } else if (validationMessage === t('lastNameRequired') && selectedDonor && (selectedDonor.lastName || selectedDonor.last_name)) {
                currentErrorFixed = true;
            } else if (validationMessage === t('phoneRequired') && selectedDonor && selectedDonor.phone) {
                currentErrorFixed = true;
            } else if (validationMessage === t('noAmountSelected')) {
                const hasAmount = (formData.selectedAmount && formData.selectedAmount !== 'custom') ||
                    (formData.selectedAmount === 'custom' && formData.customAmount && parseFloat(formData.customAmount) > 0);
                currentErrorFixed = hasAmount;
            } else if (validationMessage === t('noPeriodSelected')) {
                const hasValidPayments = formData.numberOfPayments > 0 || formData.isUnlimited;
                currentErrorFixed = hasValidPayments;
            }

            if (currentErrorFixed) {
                setShowValidation(false);
                setValidationMessage("");
            }
        }
    }, [formData, selectedDonor, campaign, showValidation, validationMessage, t]);

    // Update validation state
    useEffect(() => {
        const newMessage = getFirstValidationMessage();
        setValidationMessage(newMessage || "");

        const isValid = isFormValid();
        
        onValidationStateChange({
            isValid,
            showValidation: () => {
                setShowValidation(true);
                const message = getFirstValidationMessage();
                setValidationMessage(message || "");
            }
        });
    }, [formData, selectedDonor, campaign]);

    return (
        <>
            {showValidation && validationMessage && (
                <div className={styles.validationMessage}>
                    {validationMessage}
                </div>
            )}
        </>
    );
};

export default ValidationWrapperPublic;
