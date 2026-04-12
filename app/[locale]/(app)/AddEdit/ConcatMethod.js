import { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';
import X from "@/app/icons/xBig.svg"
import V from "@/app/icons/vBig.svg"
import Mail from "@/app/icons/mailBig.svg"
import Phone from "@/app/icons/mobileBig.svg"
import styles from "./AddEdit.module.scss";

export default function ConcatMethod({ preferredContact, setPreferredContact, hasEmail }) {
    const t = useTranslations('addEdit');
    const [isHovered, setIsHovered] = useState({ phone: false, email: false });

    useEffect(() => {
        if (!hasEmail) {
            setPreferredContact((prev) => prev === 'email' ? null : prev)
        }
    }, [hasEmail])

    return (
        <div className={styles.contactMethodWrapper}>
            <span className={`${styles.contactMethodTitle} text`}>{t('preferredContactMethod')}</span>
            <div className={`${styles.contactButtons} small-button-1`}>
                <button
                    type="button"
                    className={`${styles.contactButton} ${preferredContact === 'phone' ? styles.selected : ''}`}
                    onClick={() => setPreferredContact((prev) => prev === 'phone' ? null : 'phone')}
                    onMouseEnter={() => setIsHovered((prev) => ({ ...prev, phone: true }))}
                    onMouseLeave={() => setIsHovered((prev) => ({ ...prev, phone: false }))}
                >
                    {preferredContact === 'phone' ? (
                        isHovered.phone ? <X className={styles.icon} /> : <V className={styles.icon} />
                    ) : <Phone className={styles.icon} />}
                    <span>{t('mobileContact')}</span>
                </button>

                <button
                    type="button"
                    className={`
                ${styles.contactButton}
                ${!hasEmail ? styles.disabled : ''}
                ${preferredContact === 'email' ? styles.selected : ''}
                `}
                    onClick={() => hasEmail && setPreferredContact((prev) => prev == 'email' ? null : 'email')}
                    disabled={!hasEmail}
                    onMouseEnter={() => setIsHovered((prev) => ({ ...prev, email: true }))}
                    onMouseLeave={() => setIsHovered((prev) => ({ ...prev, email: false }))}
                >
                    {preferredContact === 'email' ? (
                        isHovered.email ? <X className={styles.icon} /> : <V className={styles.icon} />
                    ) : <Mail className={styles.icon} />}
                    <span>{t('emailContact')}</span>
                </button>
            </div>
        </div>)
}