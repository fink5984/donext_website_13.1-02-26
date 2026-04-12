"use client"; // הוסף שורה זו כדי להגדיר את הקובץ כ-Client Component

import Button from "@/app/components/Button";
import styles from './new.module.scss';
import Input from "@/app/components/Input";
import { useState, useRef, useEffect } from "react";
import Edit from "@/app/icons/edit2.svg"
import Delete from "@/app/icons/delete.svg"

export default function Page2({ onNext, campaignData, updateCampaignData }) {
    const [formData, setFormData] = useState({
        campaignName: "",
        campaignNameEnglish: "",
        logoFile: null,
        logoFileType: null // שמירת סוג הקובץ המקורי
    });
    const [showValidate, setShowValidate] = useState(false)
    const [isDragging, setIsDragging] = useState(false);
    const [showHebrewWarning, setShowHebrewWarning] = useState(false);
    const fileInputRef = useRef(null); // יצירת `ref` לשדה הקובץ
    const handleEditClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click(); // מפעיל את העלאת הקובץ מחדש
        }
    };
    const allowedTypes = ["image/png", "image/svg+xml", "image/jpeg", "application/pdf"];

    const validations = [
        {
            message: "*זה הכל? שם הקמפיין צריך להיות לפחות 2 אותיות או מספרים",
            check: () => formData.campaignName.length >= 2,
        },
        {
            message: "*בשם הקמפיין באנגלית צריך להיות לפחות 2 תווים",
            check: () => formData.campaignNameEnglish.length >= 2,
        },
        {
            message: "אפשר להעלות קבצי לוגו בפורמטים (סוגים): PDF, SVG, PNG, JPEG *בלבד",
            check: () => !formData.logoFile || (formData.logoFileType && allowedTypes.includes(formData.logoFileType)),
        },
    ];

    const [validationIndex, setValidationIndex] = useState(validations.length);
    const validateForm = () => {
        if (validationIndex < validations.length) return false; // אם יש עדיין שגיאה, לא נאפשר מעבר
        return true;
    };
    const handleInputChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
        updateCampaignData(field, value);
    };
    const handleFileChange = (file) => {
        const allowedTypes = ["image/png", "image/svg+xml", "image/jpeg", "application/pdf"];
        if (file && allowedTypes.includes(file.type)) {
            // המרת הקובץ ל-base64
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = e.target.result;
                // שמירת ה-base64 string במקום הקובץ
                handleInputChange("logoFile", base64String);
                handleInputChange("logoFileType", file.type);
                updateCampaignData("logoFile", base64String);
                updateCampaignData("logoFileType", file.type);
            };
            reader.readAsDataURL(file);
        }
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0]; // לוקח את הקובץ הראשון
        if (file) {
            handleFileChange(file);
        }
    };
    useEffect(() => {
        let newIndex = validations.length;
        // let newIndex = -1;
        for (let i = 0; i < validations.length; i++) {
            if (!validations[i].check()) {
                newIndex = i;
                break;
            }
        }
        setValidationIndex(newIndex);
    }, [formData]); // יפעל כל פעם שמשתנה אחד מהשדות בטופס
    useEffect(() => {
        setShowValidate(false)
    }, [validationIndex]);
    return (
        <div className={styles.modalContent}>
            {/* כותרת */}
            <span className={`headline-1-a`}>בואו <br />נכיר</span>
            <div className={`${styles.formContainer} ${styles.formContainerCompact}`}>

                <div
                    className={`${styles.fileUploadContainer} ${isDragging ? styles.dragOver : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {formData.logoFile ? (
                        <div className={styles.logoPreviewContainer}>
                            <img
                                src={formData.logoFile}
                                alt="Logo Preview"
                                className={styles.logoPreview}
                            />
                            <label className={styles.previewLabel}>
                                <div className={styles.icons}>
                                    <Delete onClick={() => {
                                        handleInputChange("logoFile", null);
                                        handleInputChange("logoFileType", null);
                                    }} />
                                    <Edit onClick={handleEditClick} />
                                </div>
                                <input
                                    type="file"
                                    accept=".png, .svg, .jpeg, .jpg, .pdf"
                                    onChange={(e) => handleFileChange(e.target.files[0])}
                                    style={{ display: 'none' }}
                                    ref={fileInputRef}
                                />
                            </label>
                        </div>
                    ) : (
                        <label className={styles.label}>
                            <span>+</span>
                            <div className={`${styles.labelText} button-1`}>
                                <p>לחצו להוספת לוגו הקמפיין</p>
                                <p className={styles.light}>עדיין אין? אפשר להתקדם ונזכיר לך בהמשך</p>
                            </div>
                            <input
                                type="file"
                                accept=".png, .svg, .jpeg, .jpg, .pdf"
                                onChange={(e) => handleFileChange(e.target.files[0])}
                            />
                        </label>
                    )}
                </div>

                <Input
                    type="text"
                    fullWidth={true}
                    placeholder="מה שם הקמפיין?"
                    value={formData.campaignName}
                    onChange={(e) => {
                        handleInputChange("campaignName", e.target.value);
                        updateCampaignData("campaignName", e.target.value);
                    }}
                />

                <Input
                    type="text"
                    fullWidth={true}
                    placeholder="איך כותבים אותו באנגלית?"
                    value={formData.campaignNameEnglish}
                    onChange={(e) => {
                        const value = e.target.value;
                        // בדיקה אם יש אותיות עבריות
                        const hasHebrew = /[\u0590-\u05FF]/.test(value);
                        
                        if (hasHebrew) {
                            setShowHebrewWarning(true);
                            setTimeout(() => setShowHebrewWarning(false), 3000);
                        } else {
                            handleInputChange("campaignNameEnglish", value);
                            updateCampaignData("campaignNameEnglish", value);
                        }
                    }}
                />
                {showHebrewWarning && (
                    <p className={styles.validationError}>
                        *אפשר לכתוב רק באנגלית (בלי אותיות עבריות)
                    </p>
                )}
                {showValidate && validationIndex < validations.length && validationIndex != -1 && !showHebrewWarning && (

                    <p className={styles.validationError}>
                        {validations[validationIndex].message}
                    </p>
                )}
            </div>
            {/* כפתור המשך */}
            <div className={styles.buttonContainer}>

                <Button text="מעולה, ממשיכים"
                    onClick={validateForm() ? onNext : () => setShowValidate(true)}
                    disabled={validationIndex < validations.length}
                    primary
                    disabledClick={validationIndex < validations.length}
                />
            </div>
        </div>
    );
}