"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '@/app/components/Button';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './AddUserForm.module.scss';

export default function AddUserForm({ onClose, onSuccess }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm();


    const onSubmit = async (data) => {
        setIsLoading(true);
        setError('');
        setSuccessMessage('');

        // ולידציה ידנית
        const formData = watch();
        if (!formData.clientName || !formData.email || !formData.password || !formData.confirmPassword) {
            setError('יש למלא את כל השדות החובה');
            setIsLoading(false);
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('הסיסמאות אינן תואמות');
            setIsLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('סיסמה חייבת להיות לפחות 6 תווים');
            setIsLoading(false);
            return;
        }

        // בדיקת אימייל
        const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
        if (!emailRegex.test(formData.email)) {
            setError('אימייל לא תקין');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetchWithAuth('/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clientName: formData.clientName,
                    email: formData.email,
                    password: formData.password,
                    phone: formData.phone || null
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Success result:', result);
                reset();
                setSuccessMessage('לקוח נוסף בהצלחה!');
                try {
                    onSuccess(result);
                } catch (successError) {
                    console.error('Error in onSuccess:', successError);
                }
                onClose();
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'שגיאה ביצירת הלקוח');
            }
        } catch (err) {
            setError('שגיאת תקשורת');
            console.error('Error creating client:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>הוספת לקוח חדש</h2>
                    <button 
                        className={styles.closeButton}
                        onClick={onClose}
                        type="button"
                    >
                        ✕
                    </button>
                </div>

                {successMessage && (
                    <div className={styles.successMessage}>
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.field}>
                        <label>שם הלקוח *</label>
                        <input
                            type="text"
                            placeholder="הכנס את שם הלקוח"
                            value={watch('clientName') || ''}
                            onChange={(e) => setValue('clientName', e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>אימייל *</label>
                        <input
                            type="email"
                            placeholder="הכנס אימייל"
                            value={watch('email') || ''}
                            onChange={(e) => setValue('email', e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>טלפון</label>
                        <input
                            type="tel"
                            placeholder="הכנס מספר טלפון (אופציונלי)"
                            value={watch('phone') || ''}
                            onChange={(e) => setValue('phone', e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>סיסמה *</label>
                        <div className={styles.passwordContainer}>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="הכנס סיסמה (לפחות 6 תווים)"
                                value={watch('password') || ''}
                                onChange={(e) => setValue('password', e.target.value)}
                                className={styles.input}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={styles.eyeButton}
                            >
                                {showPassword ? "👁️" : "👁️‍🗨️"}
                            </button>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label>אימות סיסמה *</label>
                        <div className={styles.passwordContainer}>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="הכנס שוב את הסיסמה"
                                value={watch('confirmPassword') || ''}
                                onChange={(e) => setValue('confirmPassword', e.target.value)}
                                className={styles.input}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className={styles.eyeButton}
                            >
                                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                            </button>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" onClick={onClose} className={styles.cancelButton}>
                            ביטול
                        </button>
                        <button type="submit" disabled={isLoading} className={styles.submitButton}>
                            {isLoading ? 'יוצר לקוח...' : 'צור לקוח'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
