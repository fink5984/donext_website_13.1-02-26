import React, { useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import styles from './DonationForm.module.scss';
import { getCampaignCurrencySymbol } from '@/lib/currencies';

const AmountSelection = ({
    isMonthlyCampaign,
    donationRanks,
    selectedAmount,
    customAmount,
    onAmountSelect,
    onCustomAmountChange,
    campaign,
    readOnly,
    unitMode = false,
    unitPrice = 0,
    unitLabelSingular = '',
    unitLabelPlural = ''
}) => {
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const isRTL = locale === 'he';
    const currencySymbol = getCampaignCurrencySymbol(campaign);

    // Unit-donation mode: show amounts as units (e.g. meters) and let the donor enter a
    // quantity. The value pushed up via onCustomAmountChange stays in money (units × price).
    const unitActive = unitMode && unitPrice > 0;
    const labelFor = (count) => (count === 1 ? unitLabelSingular : (unitLabelPlural || unitLabelSingular));
    const moneyToUnits = (money) => {
        const units = (Number(money) || 0) / unitPrice;
        const rounded = Math.round(units * 100) / 100; // up to 2 decimals, trimmed
        return Number.isFinite(rounded) ? rounded : 0;
    };
    const formatUnitLabel = (money) => {
        const units = moneyToUnits(money);
        const num = units.toLocaleString();
        const lbl = labelFor(units);
        return lbl ? `${num} ${lbl}` : num;
    };

    // Local string for the unit-quantity input so typing (e.g. "3.") stays smooth while we
    // keep the parent's customAmount in money.
    const [unitInput, setUnitInput] = React.useState('');
    useEffect(() => {
        // Reset the quantity field when the custom amount is cleared externally (e.g. a rank was picked)
        if (unitActive && (customAmount === '' || customAmount == null)) {
            setUnitInput('');
        }
    }, [customAmount, unitActive]);

    const handleUnitInputChange = (e) => {
        let value = e.target.value.replace(/[^0-9.]/g, '');
        const parts = value.split('.');
        if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
        setUnitInput(value);
        const units = parseFloat(value);
        onCustomAmountChange(value === '' || isNaN(units) ? '' : String(units * unitPrice));
    };

    const baseTitle = isMonthlyCampaign ? t('howMuchMonthly') : t('howMuchTotal');
    const title = unitActive
        ? (isRTL
            ? `כמה ${unitLabelPlural || unitLabelSingular || 'יחידות'} תרצה לתרום?`
            : `How many ${unitLabelPlural || unitLabelSingular || 'units'} would you like to donate?`)
        : baseTitle;

    // The custom field placeholder. In unit mode it asks for a quantity; the unit word is
    // shown here (not as an overlay symbol) so the long label doesn't collide with the text.
    const unitWord = unitLabelPlural || unitLabelSingular || (isRTL ? 'יחידות' : 'units');
    const customPlaceholder = unitActive
        ? (isRTL ? `כמות ${unitWord}` : `Quantity (${unitWord})`)
        : t('otherAmount');

    // Truncate to 2 decimal places when receiving value from outside (e.g., in edit mode)
    useEffect(() => {
        if (customAmount && typeof customAmount === 'string') {
            const parts = customAmount.split('.');
            if (parts.length === 2 && parts[1].length > 2) {
                const truncatedValue = parts[0] + '.' + parts[1].slice(0, 2);
                if (truncatedValue !== customAmount) {
                    onCustomAmountChange(truncatedValue);
                }
            }
        }
    }, [customAmount, onCustomAmountChange]);

    const handleCustomAmountChange = (e) => {
        let value = e.target.value;
        
        // Allow only digits and decimal point
        value = value.replace(/[^0-9.]/g, '');
        
        // Allow only one decimal point
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // Limit to 2 decimal places
        if (parts.length === 2 && parts[1].length > 2) {
            value = parts[0] + '.' + parts[1].slice(0, 2);
        }
        
        onCustomAmountChange(value);
    };

    return (
        <div className={`${styles.amountSelection} ${readOnly ? styles.readOnly : ''}`}>
            <h3 className={`${styles.sectionTitle} headline-3`}>{title}</h3>

            <div className={styles.amountButtons}>
                {donationRanks.map((rank, index) => (
                    <button
                        key={rank.id}
                        className={`${styles.amountButton} ${selectedAmount === rank.amount ? styles.selected : ''
                            }`}
                        onClick={() => !readOnly && onAmountSelect(rank.amount)}
                        disabled={readOnly}
                        style={readOnly ? { cursor: 'default' } : undefined}
                    >
                        <div className={styles.starIcon}>
                            {index === 0 && <span className={styles.star}>⭐</span>}
                            {index === 1 && <span className={styles.star}>⭐</span>}
                            {index === 2 && <span className={styles.star}>⭐</span>}
                            {index === 3 && <span className={styles.star}>⭐</span>}
                            {index === 4 && <span className={styles.star}>⭐</span>}
                        </div>
                        <span className={`${styles.amountText} headline-4`}>
                            {unitActive ? (
                                formatUnitLabel(rank.amount)
                            ) : isRTL ? (
                                <>{Number(rank.amount).toLocaleString()} {currencySymbol}</>
                            ) : (
                                <>{currencySymbol} {Number(rank.amount).toLocaleString()}</>
                            )}
                        </span>
                    </button>
                ))}
                
                <div 
                    key="custom-amount"
                    className={`${styles.customAmountContainer} headline-4 ${readOnly && selectedAmount === 'custom' ? styles.selected : ''} ${readOnly && selectedAmount !== 'custom' ? styles.dimmed : ''}`}
                    onClick={() => {
                        if (!readOnly && selectedAmount !== 'custom') {
                            onAmountSelect('custom');
                            setTimeout(() => {
                                document.querySelector(`.${styles.customAmountField}`)?.focus();
                            }, 100);
                        }
                    }}
                    onMouseEnter={() => {
                        if (!readOnly && selectedAmount !== 'custom' && !customAmount) {
                            const input = document.querySelector(`.${styles.customAmountField}`);
                            if (input) {
                                input.placeholder = customPlaceholder;
                            }
                        }
                    }}
                    onMouseLeave={() => {
                        if (!readOnly && selectedAmount !== 'custom' && !customAmount) {
                            const input = document.querySelector(`.${styles.customAmountField}`);
                            if (input) {
                                input.placeholder = '';
                            }
                        }
                    }}
                >
                    <input
                        type="text"
                        className={styles.customAmountField}
                        placeholder={unitActive ? (isRTL ? 'כמות אחרת' : 'Other quantity') : t('otherAmount')}
                        value={unitActive ? unitInput : customAmount}
                        onChange={unitActive ? handleUnitInputChange : handleCustomAmountChange}
                        onFocus={() => !readOnly && onAmountSelect('custom')}
                        readOnly={readOnly}
                        style={readOnly ? { cursor: 'default' } : undefined}
                    />
                    {selectedAmount === 'custom' ? (
                        // In unit mode the unit word is conveyed via the placeholder, so we skip the
                        // overlay symbol (the long label would collide with the centered input text).
                        unitActive ? null : <div className={styles.currencySymbol}>{currencySymbol}</div>
                    ) : (
                        <div className={styles.editIcon}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M18.5 2.50023C18.8978 2.10244 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10244 21.5 2.50023C21.8978 2.89801 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10244 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AmountSelection; 