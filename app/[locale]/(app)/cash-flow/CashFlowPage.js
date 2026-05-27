"use client";
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useAppContext } from '@/app/components/AppContext';
import contactsStyles from '../contacts/contacts.module.scss';
import styles from './cashFlow.module.scss';

// Chart.js needs a browser `canvas`, which doesn't exist in the SSR step.
// Load the cash-flow component dynamically with ssr: false to avoid runtime errors.
const ContactsCashFlow = dynamic(() => import('../contacts/ContactsCashFlow'), { ssr: false });

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
