"use client";
import styles from "./HeartIcon.module.scss";
import IconTooltip from "@/app/[locale]/components/IconTooltip/IconTooltip";

const HeartSvg = ({ filled }) => (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M11 19C11 19 1 13.1 1 6.5C1 3.46 3.46 1 6.5 1C8.24 1 9.79 1.81 11 3.09C12.21 1.81 13.76 1 15.5 1C18.54 1 21 3.46 21 6.5C21 13.1 11 19 11 19Z"
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
        />
    </svg>
);

/**
 * אייקון "לב" לטאב "כל הקהילה" (ראה סעיף 4 במסמך האפיון).
 * heartState: 'none' | 'others' | 'mine'
 * showNames: true רק בתצוגת מנהל - מציג טולטיפ עם שמות המתרימים המעוניינים (סעיף 4.2).
 */
export default function HeartIcon({ heartState = 'none', heartCount = 0, canToggle = true, showNames = false, names = [], onToggle }) {
    const filled = heartState !== 'none';
    const isMine = heartState === 'mine';

    const icon = (
        <button
            type="button"
            className={`${styles.heartButton} ${isMine ? styles.mine : filled ? styles.filled : styles.empty} ${!canToggle ? styles.disabled : ''}`}
            onClick={canToggle ? onToggle : undefined}
            disabled={!canToggle}
            aria-pressed={isMine}
        >
            <HeartSvg filled={filled} />
            {filled && heartCount > 0 && <span className={styles.count}>{heartCount}</span>}
        </button>
    );

    if (showNames && names.length > 0) {
        return <IconTooltip icon={icon} text={names.join(', ')} />;
    }
    return icon;
}
