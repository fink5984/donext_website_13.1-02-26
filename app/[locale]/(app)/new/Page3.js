"use client";

import Button from "@/app/components/Button";
import styles from './new.module.scss';
import { useState, useEffect } from "react";
import { currencies, getDefaultCurrency } from '@/lib/currencies';
import Edit from '@/app/icons/edit.svg'
import CalendarIcon from '@/app/icons/calendar2.svg'
import Lamp from '@/app/icons/lamp.svg'
import IconTooltip from "@/app/components/IconTooltip/IconTooltip";
import Tooltip from "@/app/icons/tooltip.svg"

// משתמש במערך המטבעות המרכזי
const CURRENCIES = currencies.map(currency => ({
    symbol: currency.symbol,
    name: currency.name,
    icon: currency.symbol
}));

export default function Page3({ onNext, campaignData, updateCampaignData }) {
    const [selectedCurrency, setSelectedCurrency] = useState(campaignData.currency || getDefaultCurrency().symbol);
    const [amount, setAmount] = useState('');
    const [selectedType, setSelectedType] = useState('monthly');
    const [sliderValue, setSliderValue] = useState(1);
    const [sliderMax, setSliderMax] = useState(10000000);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const slider = document.querySelector(`.${styles.slider}`);
        if (slider) {
            slider.setAttribute('data-value', '1');
            slider.style.background = `linear-gradient(to left, 
                #0C4AD5 0%,
                #0C4AD5 0.005%,
                #EDF5FD 0.005%
            )`;
        }
    }, []);

    // useEffect(() => {
    //     const sliderContainer = document.querySelector(`.${styles.sliderContainer}`);
    //     if (sliderContainer) {
    //         sliderContainer.style.setProperty('--max-value', `'${selectedCurrency}10,000,000'`);
    //         sliderContainer.style.setProperty('--min-value', `'${selectedCurrency}1'`);
    //     }
    // }, [selectedCurrency]);

    const handleSliderChange = (e) => {
        const value = e.target.value;
        setSliderValue(value);
        setAmount(value);
        updateCampaignData("targetAmount", value);

        const width = (value / sliderMax) * 100;
        e.target.style.background = `linear-gradient(to left, 
            #0C4AD5 0%,
            #0C4AD5 ${width}%,
            #EDF5FD ${width}%
        )`;

        e.target.setAttribute('data-value', value);
    };

    const handleInputChange = (e) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        setAmount(value);
        updateCampaignData("targetAmount", value);

        const numericValue = Number(value);
        const slider = document.querySelector(`.${styles.slider}`);

        if (value === '') {
            setSliderMax(10000000);
            const sliderContainer = document.querySelector(`.${styles.sliderContainer}`);
            if (sliderContainer) {
                sliderContainer.style.setProperty('--max-value', `'${selectedCurrency}10,000,000'`);
            }
        } else if (numericValue > sliderMax) {
            const roundedMax = Math.ceil(numericValue / 100000) * 100000;
            setSliderMax(roundedMax);

            const sliderContainer = document.querySelector(`.${styles.sliderContainer}`);
            if (sliderContainer) {
                sliderContainer.style.setProperty('--max-value', `'${selectedCurrency}${roundedMax.toLocaleString()}'`);
            }
        }

        setSliderValue(numericValue);

        if (slider) {
            slider.value = numericValue;

            const width = (numericValue / (numericValue > sliderMax ? Math.ceil(numericValue / 100000) * 100000 : sliderMax)) * 100;
            slider.style.background = `linear-gradient(to left, 
                #0C4AD5 0%,
                #0C4AD5 ${width}%,
                #EDF5FD ${width}%
            )`;
            slider.setAttribute('data-value', numericValue);
        }
    };

    const handleBlur = () => {
        if (!amount) setAmount(sliderValue);
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
    };

    return (
        <div className={styles.modalContent}>
            <span className="headline-1-a">שנדבר <br />ביזנ&apos;ס?</span>
            <div className={styles.formContainer}>
                <div className={styles.frameFormContainer}>
                    <span className="body-2">מה מטרת הקמפיין?</span>
                    <div className={styles.switchWrapper}>
                        <div
                            className={styles.switchBackground}
                            style={{ transform: selectedType === "project" ? "translateX(100%)" : "translateX(0%)" }}
                        />
                        <div
                            className={`${styles.switchOption} ${selectedType === 'project' ? styles.selected : ''}`}
                            onClick={() => {
                                setSelectedType('project');
                                updateCampaignData("donationType", "project");
                            }}
                        >
                            <Lamp />
                            <div className={styles.absolute}>
                                <IconTooltip icon={<Tooltip />} up text="התרומות יחושבו ויופיעו כברירת מחדל לפי סכום התרומות הכולל" />
                            </div>
                            <div className={styles.textContent}>
                                <span className="body-2">תרומות לפרויקט</span>
                                <p className="text">מתאים לקמפיינים להקמת מבנה או מימון פעילות חד&quot;פ</p>
                            </div>
                        </div>

                        <div
                            className={`${styles.switchOption} ${selectedType === 'monthly' ? styles.selected : ''}`}
                            onClick={() => {
                                setSelectedType('monthly');
                                updateCampaignData("donationType", "monthly");
                            }}
                        >
                            <CalendarIcon />
                            <div className={styles.absolute}>
                                <IconTooltip icon={<Tooltip />} up text="התרומות יחושבו ויופיעו כברירת מחדל לפי סכום התרומות החודשי" />

                            </div>
                            <div className={styles.textContent}>
                                <span className="body-2">תרומות חודשיות</span>
                                <p className="text">מתאים לקמפיינים להו&quot;ק ותרומות קבועות לטווח ארוך</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.frameFormContainer}>
                    <span className="body-2">כמה כסף תכננת לגייס בקמפיין?</span>
                    <div className={styles.amountSection}>
                        <div className={styles.sliderContainer}>
                            <input
                                type="range"
                                min="1"
                                max={sliderMax}
                                step="1"
                                value={sliderValue}
                                onChange={handleSliderChange}
                                className={styles.slider}
                                dir="rtl"
                            />
                            <div className={styles.sliderValues}>
                                <div className={styles.sliderMin}>
                                    <span className="button-1">{Number(1).toLocaleString()}</span>
                                    <span className="tooltip-2"> {selectedCurrency}</span>
                                </div>
                                <div className={styles.sliderMax}>
                                    <span className="button-1">{Number(sliderMax).toLocaleString()}</span>
                                    <span className="tooltip-2"> {selectedCurrency}</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.selectedAmountContainer}>
                            {/* <div className={`${styles.selectedAmount} ${amount ? styles.amountWithInput : ''}`}>
                            {selectedCurrency}
                            {amount ? Number(amount).toLocaleString() : Number(sliderValue).toLocaleString()}
                        </div>
                        <div className={`${styles.customInput} ${amount ? styles.filled : ''}`}>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="text"
                                    placeholder=" "
                                    onChange={handleInputChange}
                                    value={amount}
                                />
                                <label className="small-button-1">סכום אחר</label>
                                <Edit className={styles.editIcon} />
                                <span className={styles.currencySymbol}>{selectedCurrency}</span>
                            </div>
                        </div> */}

                            {isEditing ? (
                                <div className={styles.amountInputWrapper}>
                                    <input
                                        type="text"
                                        className={`${styles.amountInputField} body-2`}
                                        value={amount}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        onKeyDown={handleKeyDown}
                                        autoFocus
                                    />
                                    <span className="button-2">{selectedCurrency}</span>
                                </div>
                            ) : (
                                <div className={styles.displayAmount} onClick={() => setIsEditing(true)}>
                                    <span>
                                        <span className="tooltip-2">{selectedCurrency}</span>
                                        <span className="body-2">{Number(amount || sliderValue).toLocaleString()}</span>
                                    </span>

                                    <Edit className={styles.editIcon} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className={styles.frameFormContainer}>
                    <span className="body-2">באיזה מטבע תרצה לראות את הסכומים במערכת?</span>
                    <div className={styles.currencySection}>
                        <div className={styles.currencyOptions}>
                            {CURRENCIES.map((currency) => (
                                <button
                                    key={currency.symbol}
                                    className={selectedCurrency === currency.symbol ? styles.selected : ''}
                                    onClick={() => {
                                        setSelectedCurrency(currency.symbol);
                                        updateCampaignData("currency", currency.symbol);
                                    }}
                                >
                                    <span className={styles.currencyIcon}>{currency.icon}</span>
                                    <span className={`button-2 ${styles.currencyName}`}>{currency.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className={styles.buttonContainer}>
                <Button
                    text="מצוין, מתקדמים"
                    primary
                    disabled={!amount}
                    onClick={onNext} />
            </div>
        </div>

    );
}