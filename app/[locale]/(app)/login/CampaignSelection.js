import { useState, useMemo, useEffect } from 'react';
import Button from '@/app/components/Button';
import Search from "@/app/components/Search";
import { CampaignCard } from './CampaignCard';
import Left from "@/app/icons/left.svg";
import Right from "@/app/icons/right.svg";
import styles from './login.module.scss';
import { useTranslations, useLocale } from 'next-intl';

export function CampaignSelection({ campaignOptions, onSelectCampaign, userName }) {
  const t = useTranslations('campaignSelection');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(false);
  const [messageCampaign, setMessageCampaign] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const cardsPerView = 5;

  // פונקציה לקביעת סטטוס קמפיין (כמו בכרטיס)
  const getCampaignStatusType = (campaign) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (!campaign?.end_date) {
      return 'active';
    }

    const end = new Date(campaign.end_date);
    end.setHours(0, 0, 0, 0);

    if (end < now) {
      return 'finished';
    }

    if (end.getTime() === now.getTime()) {
      return 'today';
    }

    if (campaign?.start_date) {
      const start = new Date(campaign.start_date);
      start.setHours(0, 0, 0, 0);

      if (start.getTime() === now.getTime()) {
        return 'today';
      }

      if (start < now && now < end) {
        return 'today';
      }
    }

    return 'active';
  };

  // סינון לפי חיפוש
  const displayedCampaigns = useMemo(() => {
    if (!Array.isArray(campaignOptions)) return [];
    if (!searchQuery.trim()) return campaignOptions;
    const q = searchQuery.trim().toLowerCase();
    return campaignOptions.filter((o) => {
      const name = (o?.name ?? '').toLowerCase();
      const campaignName = (o?.campaign_name ?? '').toLowerCase();
      const label = (o?.label ?? '').toLowerCase();
      return name.includes(q) || campaignName.includes(q) || label.includes(q);
    });
  }, [campaignOptions, searchQuery]);

  const filteredCampaigns = useMemo(() => {
    let result = [...displayedCampaigns];

    // מיון לפי selectedFilter
    if (selectedFilter === 'recent') {
      // מיון לפי תאריך ההתחברות האחרונה מהיסטוריית ההתחברויות
      result.sort((a, b) => {
        const lastLoginA = a?.last_login_at ? new Date(a.last_login_at).getTime() : 0;
        const lastLoginB = b?.last_login_at ? new Date(b.last_login_at).getTime() : 0;
        
        // מי שהתחבר לאחרונה יופיע ראשון
        return lastLoginB - lastLoginA;
      });
    } else if (selectedFilter === 'date') {
      // מיון לפי תאריך הקמפיין (end_date או start_date)
      result.sort((a, b) => {
        const dateA = new Date(a?.end_date || 0);
        const dateB = new Date(b?.end_date || 0);
        return dateB - dateA;
      });
    } else if (selectedFilter === 'active') {
      // מיון: קמפיינים פעילים קודם
      result.sort((a, b) => {
        const statusA = getCampaignStatusType(a);
        const statusB = getCampaignStatusType(b);
        const isActiveA = statusA === 'active' || statusA === 'today';
        const isActiveB = statusB === 'active' || statusB === 'today';

        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;
        return 0;
      });
    } else if (selectedFilter === 'finished') {
      // מיון: קמפיינים שהסתיימו קודם
      result.sort((a, b) => {
        const statusA = getCampaignStatusType(a);
        const statusB = getCampaignStatusType(b);
        const isFinishedA = statusA === 'finished';
        const isFinishedB = statusB === 'finished';

        if (isFinishedA && !isFinishedB) return -1;
        if (!isFinishedA && isFinishedB) return 1;
        return 0;
      });
    }

    return result;
  }, [displayedCampaigns, selectedFilter]);

  useEffect(() => {
    setCarouselIndex(0);
  }, [searchQuery, selectedFilter]);

  // פונקציה פשוטה לבחירת קמפיין בלחיצה אחת
  async function handleCampaignClick(option) {
    if (isLoadingCampaign || !option) return;

    setSelectedCampaign(option);
    setIsLoadingCampaign(true);
    setMessageCampaign('');

    try {
      await onSelectCampaign(option);
    } catch (err) {
      setMessageCampaign(t('errorSelectingCampaign'));
    } finally {
      setIsLoadingCampaign(false);
    }
  }

  function handlePrevCarousel() {
    setCarouselIndex(prev => Math.max(0, prev - 1));
  }

  function handleNextCarousel() {
    setCarouselIndex(prev => Math.min(filteredCampaigns.length - cardsPerView, prev + 1));
  }

  return (
    <div className={styles.campaignContainer}>
      <h1 className={`${styles.campaignTitle} headline-2`}>
        <span>
        {t('greeting', { name: userName || "" })}        </span>
        <span style={{ fontWeight: '400' }}>{t('whichCampaign')}</span>
      </h1>

      {messageCampaign && (
        <div className={`${styles.message} ${styles.error}`} style={{ marginBottom: 20 }}>
          {messageCampaign}
        </div>
      )}

      <div className={styles.selectCampaignContainer}>
        <div className={styles.filterButtons}>
          <span className='button-1'>{t('sortBy')}</span>
          <Button
            text={t('myRecent')}
            small
            smallSmall
            smallHug
            primary={selectedFilter === 'recent'}
            onClick={() => setSelectedFilter(selectedFilter === 'recent' ? null : 'recent')}
          />
          <Button
            text={t('byDate')}
            small
            smallSmall
            smallHug
            primary={selectedFilter === 'date'}
            onClick={() => setSelectedFilter(selectedFilter === 'date' ? null : 'date')}
          />
          <Button
            text={t('active')}
            small
            smallSmall
            smallHug
            primary={selectedFilter === 'active'}
            onClick={() => setSelectedFilter(selectedFilter === 'active' ? null : 'active')}
          />
          <Button
            text={t('finished')}
            small
            smallSmall
            smallHug
            primary={selectedFilter === 'finished'}
            onClick={() => setSelectedFilter(selectedFilter === 'finished' ? null : 'finished')}
          />
        </div>

        {filteredCampaigns.length > 0 ? (
          <div className={styles.carouselWrapper} style={{ padding: campaignOptions?.length > 1 ? '0 var(--Spacing-Spacing-10, 40px)' : '0' }}>
            {filteredCampaigns.length > cardsPerView && (
              <button
                className={styles.carouselArrow}
                onClick={handlePrevCarousel}
                disabled={carouselIndex === 0}
                aria-label={t('previousCard')}
              >
                {isRTL ? <Right /> : <Left />}
              </button>
            )}

            <div className={styles.campaignGridContainer}>
              <div
                className={styles.campaignGrid}
                style={{
                  transform: `translateX(${isRTL ? carouselIndex * (153 + 16) : -carouselIndex * (153 + 16)}px)`
                }}
              >
                {filteredCampaigns.map((option, index) => (
                  <CampaignCard
                    key={`${option.campaign_id}-${option.role}-${index}`}
                    option={option}
                    isSelected={selectedCampaign?.campaign_id === option.campaign_id && selectedCampaign?.role === option.role}
                    onClick={() => handleCampaignClick(option)}
                    disabled={isLoadingCampaign}
                  />
                ))}
              </div>
            </div>

            {filteredCampaigns.length > cardsPerView && (
              <button
                className={styles.carouselArrow}
                onClick={handleNextCarousel}
                disabled={carouselIndex >= filteredCampaigns.length - cardsPerView}
                aria-label={t('nextCard')}
              >
                {isRTL ? <Left /> : <Right />}
              </button>
            )}
          </div>
        ) : (
          <div className={`${styles.noResultsContainer} headline-4`}>
            {searchQuery.trim() ? (
              <>
                {t('sureAboutSearch', { query: searchQuery })}
                <br />
                {t('noCampaignFound')}
              </>
            ) : (
              <div className={styles.noResults}>
                {t('noCampaignsAvailable')}
              </div>
            )}
          </div>
        )}
      </div>

      {campaignOptions?.length > 1 && (
        <div className={styles.searchWrapper}>
          <Search
            long
            value={searchQuery}
            onSearch={setSearchQuery}
            placeholder={t('searchPlaceholder')}
            suggestions={filteredCampaigns}
            getLabel={(o) => (o?.name || o?.campaign_name || o?.label || "").toString()}
            onSelect={(opt) => {
              const name = opt?.name || opt?.campaign_name || opt?.label || "";
              setSearchQuery(name);
            }}
            big
          />
        </div>
      )}
    </div>
  );
}

