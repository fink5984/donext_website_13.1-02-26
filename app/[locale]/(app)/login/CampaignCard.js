import { useState } from 'react';
import styles from './CampaignCard.module.scss';
import Fund from '@/app/icons/fundLabel.svg';
import Manager from '@/app/icons/managLabel.svg';
import OperatorIcon from '@/app/icons/managLabel.svg';
const roleLabels = {
    'fundraiser': 'מתרים',
    'manager': 'מנהל',
    'admin': 'אדמין',
    'operator': 'מפעיל'
};
const roleIcons = {
    'fundraiser': Fund,
    'manager': Manager,
    'admin': Manager,
    'operator': OperatorIcon
};
function formatDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatHebrewDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);

    const hebrewDate = date.toLocaleDateString('he-IL-u-ca-hebrew', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // המרה לפורמט עם גרשיים
    // למשל: "14 באב 5785" -> "י״ד אב תשפ״ה"
    const parts = hebrewDate.split(' ');
    if (parts.length >= 3) {
        const day = convertToHebrewNumber(parseInt(parts[0]));
        const month = parts[1].replace('ב', ''); // הסרת "ב" מ"באב"
        const year = convertHebrewYear(parts[2]);
        return `${day} ${month} ${year}`;
    }

    return hebrewDate;
}

function convertToHebrewNumber(num) {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];

    if (num === 15) return 'ט״ו';
    if (num === 16) return 'ט״ז';

    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;

    let result = hundreds[h] + tens[t] + ones[o];

    if (result.length > 1) {
        result = result.slice(0, -1) + '״' + result.slice(-1);
    } else if (result.length === 1) {
        result = result + '׳';
    }

    return result;
}

function convertHebrewYear(yearStr) {
    const year = parseInt(yearStr);
    const shortYear = year % 1000;

    const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

    const h = Math.floor(shortYear / 100);
    const t = Math.floor((shortYear % 100) / 10);
    const o = shortYear % 10;

    let result = hundreds[h];

    if (t === 1 && o === 5) {
        result += 'ט״ו';
    } else if (t === 1 && o === 6) {
        result += 'ט״ז';
    } else {
        const remainder = tens[t] + ones[o];
        if (remainder) {
            if (remainder.length > 1) {
                result += remainder.slice(0, -1) + '״' + remainder.slice(-1);
            } else {
                result += remainder + '׳';
            }
        } else if (result) {
            result = result.slice(0, -1) + '׳' + result.slice(-1);
        }
    }

    return result;
}

/**
 * מחזיר סטטוס קמפיין עם טקסט לתצוגה וקלאס עיצוב
 * @param {string} startDate - תאריך התחלה
 * @param {string} endDate - תאריך סיום
 * @returns {Object} - { text: string, className: string }
 */
function getCampaignStatus(startDate, endDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (!endDate) {
        return { text: 'פעיל', className: 'statusActive' };
    }

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // אם הסתיים
    if (end < now) {
        return { text: 'הסתיים', className: 'statusFinished' };
    }

    // אם תאריך הסיום הוא היום
    if (end.getTime() === now.getTime()) {
        return { text: 'היום', className: 'statusToday' };
    }

    // אם יש תאריך התחלה
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        // אם תאריך ההתחלה הוא היום
        if (start.getTime() === now.getTime()) {
            return { text: 'היום', className: 'statusToday' };
        }

        // אם היום נמצא בין תאריך ההתחלה לתאריך הסיום
        if (start < now && now < end) {
            return { text: 'היום', className: 'statusToday' };
        }
    }

    return { text: 'פעיל', className: 'statusActive' };
}

export function CampaignCard({ option, isSelected, onClick, disabled }) {
    const [imageError, setImageError] = useState(false);
    
    if (!option) return null;
    const roleLabel = roleLabels[option.role] || option.role;
    const RoleIcon = roleIcons[option.role];
    const formattedStartDate = formatDate(option.start_date);
    const formattedEndDate = formatDate(option.end_date);
    const campaignStatus = getCampaignStatus(option.start_date, option.end_date);
    const hebrewDate = formatHebrewDate(option.start_date || option.end_date);

    const handleImageError = () => {
        setImageError(true);
    };

    return (
        <div
            className={`${styles.card} ${isSelected ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
            onClick={!disabled ? onClick : undefined}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onClick?.();
                }
            }}
        >
            <div className={styles.header}>
                <div className={`${styles.headerHeader} xs-button-1`}>
                    <span className={styles.role}>
                        {RoleIcon && <span className={styles.roleIcon}> <RoleIcon /></span>}
                        <span>{roleLabel}</span>
                    </span>
                    <span className={`${styles.status} ${styles[campaignStatus.className]}`}>{campaignStatus.text}</span>
                </div>
                {option.campaign_logo && !imageError && (
                    <div className={styles.imageContainer}>
                        <img
                            src={option.campaign_logo}
                            alt={option.campaign_name}
                            className={styles.image}
                            onError={handleImageError}
                        />
                    </div>
                )}
            </div>

            <div className={styles.content}>
                <div className={styles.titles}>
                    <h3 className="table-1">{option.campaign_name}</h3>
                    <p className={` small-button-1`}>{hebrewDate}</p>
                </div>
                {/* {formattedStartDate && ( */}
                <p className={`${styles.date} xs-button-1`}>נפתח: {formattedStartDate}</p>
                {/* )} */}
            </div>
        </div>
    );
}