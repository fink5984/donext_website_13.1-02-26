"use client";
import { useTranslations } from 'next-intl';
import { useAppContext } from '@/app/components/AppContext';
import ContactsCashFlow from '../contacts/ContactsCashFlow';
import contactsStyles from '../contacts/contacts.module.scss';
import styles from './cashFlow.module.scss';

export default function CashFlowPage() {
    const t = useTranslations('contactsPage');
    const { clientId } = useAppContext();

    return (
        <div className={contactsStyles.contactsLayout}>
            <div className={contactsStyles.contactsMainContent}>
                <div className={contactsStyles.contactsHeader}>
                    <div className={contactsStyles.headerActions} />
                    <div className={contactsStyles.contactsHeaderTitle}>
                        <h1>{t('cashFlow')}</h1>
                        <span className={contactsStyles.contactsSubtitle}>{t('cashFlowSubtitle')}</span>
                    </div>
                </div>
                <div className={styles.contentWrapper}>
                    <ContactsCashFlow clientId={clientId} />
                </div>
            </div>
        </div>
    );
}
