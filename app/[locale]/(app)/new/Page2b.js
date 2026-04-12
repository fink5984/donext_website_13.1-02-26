"use client";

import Button from "@/app/components/Button";
import styles from './new.module.scss';
import { useState, useEffect } from "react";
import Calendar from "@/app/components/calendar/Calendar";

export default function Page2b({ onNext, campaignData, updateCampaignData }) {
    const [formData, setFormData] = useState({
        campaignType: campaignData.campaignType || "",
        hasOperators: campaignData.hasOperators || false,
        isEvent: campaignData.isEvent || false,
        duration: campaignData.duration || "oneDay",
        eventDateStart: campaignData.eventDateStart || "",
        eventDateEnd: campaignData.eventDateEnd || "",
        eventDate: campaignData.eventDate || "",
    });
    const [showValidate, setShowValidate] = useState(false);

    const validations = [
        {
            message: "*יש לבחור סוג קמפיין",
            check: () => !!formData.campaignType,
        },
        {
            message: "*חייבים לקבוע תאריך כדי לתכנן את הקמפיין",
            check: () =>
                (formData.duration === "oneDay" && !!formData.eventDate) ||
                (formData.duration === "multipleDays" && !!formData.eventDateStart && !!formData.eventDateEnd),
        },
    ];

    const [validationIndex, setValidationIndex] = useState(validations.length);

    const validateForm = () => {
        if (validationIndex < validations.length) return false;
        return true;
    };

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
        updateCampaignData(field, value);
    };

    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const handleDateSelect = (date) => {
        if (formData.duration === "multipleDays") {
            setFormData((prev) => ({
                ...prev,
                eventDateStart: date?.start ?? "",
                eventDateEnd: date?.end ?? "",
                eventDate: "",
                calendarType: date?.calendarType || 'gregorian',
            }));
            updateCampaignData("eventDateStart", date?.start ?? "");
            updateCampaignData("eventDateEnd", date?.end ?? "");
            updateCampaignData("eventDate", "");
            updateCampaignData("calendarType", date?.calendarType || 'gregorian');
        } else {
            const actualDate = date?.date || date;
            const calendarType = date?.calendarType || 'gregorian';
            setFormData((prev) => ({
                ...prev,
                eventDate: actualDate,
                eventDateStart: "",
                eventDateEnd: "",
                calendarType: calendarType,
            }));
            updateCampaignData("eventDate", actualDate);
            updateCampaignData("eventDateStart", "");
            updateCampaignData("eventDateEnd", "");
            updateCampaignData("calendarType", calendarType);
        }
    };

    useEffect(() => {
        let newIndex = validations.length;
        for (let i = 0; i < validations.length; i++) {
            if (!validations[i].check()) {
                newIndex = i;
                break;
            }
        }
        setValidationIndex(newIndex);
    }, [formData]);

    useEffect(() => {
        setShowValidate(false);
    }, [validationIndex]);

    const campaignTypes = [
        {
            id: "community",
            title: "גיוס קהילתי",
            description: "המתרימים והתורמים מתוך חברי הקהילה",
        },
        {
            id: "crowdfunding",
            title: "גיוס המונים",
            description: "חברי הקהילה הם המתרימים והתורמים יגיעו דרך המתרימים",
        },
    ];

    const additionalOptions = [
        {
            id: "hasOperators",
            field: "hasOperators",
            title: "קמפיין עם מפעילים",
            description: "מפעיל אחראי לכל קבוצה מחברי הקהילה המתרימים",
        },
        {
            id: "isEvent",
            field: "isEvent",
            title: "אירוע גיוס",
            description: "אירוע (דינר/גאלה) של מספר שעות מרוכז בו מגייסים את התרומות",
        },
    ];

    return (
        <div className={styles.modalContent}>
            <span>
                <span className="headline-1-a">סוג <br />הקמפיין</span>
                <p className="body-1" style={{ marginTop: '12px' }}>
                    בחרו את סוג הקמפיין המתאים לכם
                </p>
            </span>
            <div className={styles.formContainer}>
                {/* Campaign Type Selection */}
                <div className={styles.frameFormContainer}>
                    <span className="body-2">איזה סוג קמפיין אתם רוצים?</span>
                    <div className={styles.campaignTypeWrapper}>
                        {campaignTypes.map((type) => (
                            <div
                                key={type.id}
                                className={`${styles.campaignTypeCard} ${formData.campaignType === type.id ? styles.selected : ''}`}
                                onClick={() => handleInputChange("campaignType", type.id)}
                            >
                                <div className={styles.campaignTypeRadio}>
                                    <div className={styles.radioOuter}>
                                        {formData.campaignType === type.id && <div className={styles.radioInner} />}
                                    </div>
                                </div>
                                <div className={styles.campaignTypeContent}>
                                    <span className="button-1">{type.title}</span>
                                    <p className="text">{type.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Additional Options */}
                <div className={styles.frameFormContainer}>
                    <span className="body-2">הגדרות נוספות</span>
                    <div className={styles.additionalOptionsWrapper}>
                        {additionalOptions.map((option) => (
                            <div
                                key={option.id}
                                className={`${styles.additionalOptionCard} ${formData[option.field] ? styles.selected : ''}`}
                                onClick={() => handleInputChange(option.field, !formData[option.field])}
                            >
                                <div className={styles.checkboxWrapper}>
                                    <div className={`${styles.checkbox} ${formData[option.field] ? styles.checked : ''}`}>
                                        {formData[option.field] && (
                                            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                                                <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <div className={styles.additionalOptionContent}>
                                    <span className="button-1">{option.title}</span>
                                    <p className="text">{option.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Date Selection - moved from Page2 */}
                <div className={styles.frameFormContainer}>
                    <span className="body-2">תאריך ההתרמה בפועל</span>
                <div className={styles.dateSelectionContainer}>
                    <div className={`${styles.radioGroupContainer} button-1`}>
                        <label>יום התרמה אחד או יותר?</label>
                        <div className={styles.radioGroup}>
                            <input
                                type="radio"
                                id="oneDay"
                                name="duration"
                                value="oneDay"
                                onChange={(e) => handleInputChange("duration", e.target.value)}
                                checked={formData.duration === "oneDay"}
                            />
                            <label
                                htmlFor="oneDay"
                                className={formData.duration === "oneDay" ? "button-2" : ""}
                            >
                                יום אחד
                            </label>
                            <input
                                type="radio"
                                id="multipleDays"
                                name="duration"
                                value="multipleDays"
                                onChange={(e) => handleInputChange("duration", e.target.value)}
                                checked={formData.duration === "multipleDays"}
                            />
                            <label
                                className={formData.duration === "multipleDays" ? "button-2" : ""}
                                htmlFor="multipleDays"
                            >
                                כמה ימים
                            </label>
                        </div>
                    </div>
                    <Calendar onDateSelect={handleDateSelect} range={formData.duration === "multipleDays"} />
                </div>
                </div>

                {showValidate && validationIndex < validations.length && validationIndex !== -1 && (
                    <p className={styles.validationError}>
                        {validations[validationIndex].message}
                    </p>
                )}
            </div>
            <div className={styles.buttonContainer}>
                <Button
                    text="מעולה, ממשיכים"
                    onClick={onNext}
                    disabled={validationIndex < validations.length}
                    primary
                />
            </div>
        </div>
    );
}
