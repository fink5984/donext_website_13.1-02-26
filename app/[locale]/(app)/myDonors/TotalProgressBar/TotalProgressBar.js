import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./TotalProgressBar.module.scss";
import Fill from "@/app/icons/progressFill.svg";
import GreenFill from "@/app/icons/progressFillGreen.svg";
import { CurrencySymbol } from "@/app/components/CurrencySymbol";
import { useTranslations, useLocale } from 'next-intl';

function getProgressTextKey(percent) {
  if (percent === 0) return 'progress0';
  if (percent >= 1 && percent <= 9) return 'progress1to9';
  if (percent >= 10 && percent <= 24) return 'progress10to24';
  if (percent === 25) return 'progress25';
  if (percent >= 26 && percent <= 49) return 'progress26to49';
  if (percent >= 50 && percent <= 74) return 'progress50to74';
  if (percent >= 75 && percent <= 89) return 'progress75to89';
  if (percent >= 90 && percent <= 99) return 'progress90to99';
  if (percent === 100) return 'progress100';
  if (percent > 100) return 'progressAbove100';
  return '';
}

export default function TotalProgressBar({ expected, actual }) {
  const t = useTranslations('myDonors.progressBar');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const numberLocale = isRTL ? 'he-IL' : 'en-US';

  const [displayedPercent, setDisplayedPercent] = useState(0);
  const percent = expected === 0 ? 0 : Math.round((actual / expected) * 100);

  useEffect(() => {
    let start = 0;
    const step = () => {
      if (start < percent) {
        start += 1;
        setDisplayedPercent(start);
        setTimeout(step, 10);
      } else {
        setDisplayedPercent(percent);
      }
    };
    setDisplayedPercent(0);
    step();

  }, [expected, actual, percent]);

  return (
    <div className={styles.totalProgressBar}>
      <div className={`${styles.topRow} table-1`}>
        {expected > 0 && <div className={styles.percentText}>{displayedPercent}%</div>}
        <div className={styles.progressText}>
          {expected === 0 ? (
            <Link href="/donorForecast" className={styles.forecastLink}>
              {t('noForecastYet')}
            </Link>
          ) : t(getProgressTextKey(percent))}
        </div>
      </div>
      <div className={styles.barAndText}>
        <div className={styles.progressBarWrapper}>
          {expected > 0 && (<>
            <div
              className={`${styles.progressBar} ${displayedPercent >= 100 ? styles.above : ""} ${isRTL ? styles.rtl : styles.ltr}`}
              style={{
                width: `${Math.min(displayedPercent, 100)}%`,
                position: 'absolute',
                ...(isRTL ? { right: 0 } : { left: 0 }),
                top: 0,
              }}
            />

            <div className={styles.progressHover}>
              <div
                className={`${styles.progressTip} ${displayedPercent >= 100 ? styles.greenTip : styles.blueTip}`}
                style={isRTL ? {
                  left: `clamp(0%, calc(${100 - displayedPercent}%), calc(100% - 8px))`
                } : {
                  right: `clamp(0%, calc(${100 - displayedPercent}%), calc(100% - 8px))`
                }}
              >
                {displayedPercent < 100 ? <Fill /> : <GreenFill />}
              </div>
              <div className={`${styles.progressLabel} table-1`} style={isRTL ? { left: `clamp(35px, calc(${100 - displayedPercent}%), calc(100% - 35px))` } : { right: `clamp(35px, calc(${100 - displayedPercent}%), calc(100% - 35px))` }}>
                {Number(actual).toLocaleString(numberLocale, { maximumFractionDigits: 0 })}<span className={styles.nis}> <CurrencySymbol /></span>
              </div>
            </div>  </>)}
        </div>
        <div className={`${styles.bottomRow} ${isRTL ? '' : styles.ltrRow}`}>
          <div className={styles.amountBox}>
            <div className={`${styles.amountAmount} headline-4`}>
              {Number(actual).toLocaleString(numberLocale, { maximumFractionDigits: 0 })}<span className={styles.shekelSign}><CurrencySymbol /></span>
            </div>
          </div>
          <div className={styles.amountBox}>
            <div className={`${styles.amountAmount} headline-4`}>
              {Number(expected || 0).toLocaleString(numberLocale, { maximumFractionDigits: 0 })}<span className={styles.shekelSign}><CurrencySymbol /></span>
            </div>
            <div className={`${styles.amountLabel} table-2`}>{t('myTarget')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

