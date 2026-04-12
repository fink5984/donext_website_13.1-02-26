import React from 'react';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import Search from '@/app/components/Search';
import styles from '../donations.module.scss';
import { useTranslations } from 'next-intl';

const DonationsFilters = observer(() => {
    const { donationsStore, campaignId } = useAppContext();
    const [searchValue, setSearchValue] = React.useState(donationsStore.searchTerm);
    const t = useTranslations('common');

    const handleSearch = (e) => {
        e.preventDefault();
        donationsStore.setSearchTerm(searchValue.trim(), campaignId);
    };

    const handleReset = () => {
        setSearchValue('');
        donationsStore.resetFilters(campaignId);
    };

    return (
        <div className={styles.filtersSection}>
            <div className={styles.filtersRow}>
                <Search
                    value={searchValue}
                    onChange={setSearchValue}
                    onSearch={handleSearch}
                    placeholder={t('searchPlaceholder')}
                />
                <button 
                    type="button" 
                    onClick={handleReset}
                    className={styles.resetButton}
                >
                    {t('resetFilter')}
                </button>
            </div>
        </div>
    );
});

export default DonationsFilters; 