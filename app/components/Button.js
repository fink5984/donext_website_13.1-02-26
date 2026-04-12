"use client";
import '../globals.scss'
import styles from './Button.module.scss'
import Phone from "@/app/icons/phoneSmall.svg"
import Home from "@/app/icons/homeSmall.svg"
import Email from "@/app/icons/mailSmall.svg"
import DoNextLoader from './DoNextLoader'
const Button = ({ text, icon, leftIcon, onClick, selected=false, disabled = false, primary = false, small = false, smallHug = false, smallSmall = false, textOnly = false, select = false, className = '', details = null, fullWidth = false, disabledClick = false, type = null, donor = false, faded = false, loading = false, red = false, ...props }) => {

    const buttonClass = [
        // צבע ומצב בסיסי
        selected && styles.selected,
        faded
            ? primary
                ? styles["primary-faded"]
                : textOnly
                    ? styles["default-faded"]
                    : styles["default"]
            : textOnly
                ? disabled
                    ? styles["disable-text"]
                    : styles["default-text"]
                : disabled
                    ? styles.disable
                    : primary
                        ? styles.primary
                        : styles.default,

        // תמיכה ב-donor במקביל לפריימרי/דיסייבל וכו'
        donor && styles.donor,

        // תמיכה ב-red
        red && styles.red,

        // גודל הכפתור
        styles.button,
        small || smallSmall || textOnly || smallHug
            ? styles["small-button"]
            : select
                ? styles.select
                : styles["normal-button"],

        smallSmall && styles["small-small"],
        smallHug && styles["small-hug"],
        // רוחב מלא
        fullWidth && styles["full-width"],

        // קלאסים חיצוניים
        className
    ].filter(Boolean).join(" ");


    return (
        <div
            className={`${styles.buttonContainer} ${fullWidth ? styles["full-width"] : ''}`}
        >
            <>
                <button
                    onClick={onClick}
                    className={buttonClass}
                    disabled={!disabledClick && (disabled || loading)}
                    type={type}
                >
                    <span className={styles.content}>
                        {loading ? (
                            <>
                                <DoNextLoader small />
                                <span className={small ? "small-button-1" : select ? "table-3" : "button-1"}>{text}</span>
                            </>
                        ) : (
                            <>
                                {icon && <span className={styles.icon}>{icon}</span>}
                                <span className={small ? "small-button-1" : select ? "table-3" :selected?"button-2": "button-1"}>{text}</span>
                                {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
                            </>
                        )}
                    </span>
                </button>
                {details && (
                    <div className={styles.detailsBox}>
                        {details.phone && (<p> <Phone />{details.phone}</p>)}
                        {(details.address || details.city) && (<p><Home />{details.address} {details.city}</p>)}
                        {details.email && (<p><Email />{details.email}</p>)}
                    </div>
                )}
            </>
        </div>
    );
};

export default Button;