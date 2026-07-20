"use client";
import { useTranslations } from 'next-intl';
import styles from "./CommunityTabSwitch.module.scss";

// טאב "הרשימה שלי" / "כל הקהילה" - מוצג צמוד לכותרת הטבלה (לא בראש העמוד), ראה סעיף 3 במסמך האפיון.
export default function CommunityTabSwitch({ activeTab, onChange }) {
    const t = useTranslations('myDonors.community');
    return (
        <div className={styles.communityTabs}>
            <button
                type="button"
                className={`${styles.communityTab} ${activeTab === 'mine' ? styles.communityTabActive : ''}`}
                onClick={() => onChange('mine')}
            >
                {t('tabMine')}
            </button>
            <button
                type="button"
                className={`${styles.communityTab} ${activeTab === 'community' ? styles.communityTabActive : ''}`}
                onClick={() => onChange('community')}
            >
                {t('tabCommunity')}
            </button>
        </div>
    );
}
