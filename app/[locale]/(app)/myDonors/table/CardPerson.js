import styles from "./table.module.scss";
import Coins from "@/app/icons/coinsSmall.svg";
import classNames from "classnames";
import { useState } from "react";
import Phone from "@/app/icons/phoneSmall.svg"
import Home from "@/app/icons/homeSmall.svg"
import Email from "@/app/icons/mailSmall.svg"
import Button from "@/app/components/Button";
import { CurrencySymbol } from "@/app/components/CurrencySymbol";
import DonationForm from "@/components/DonationForm/DonationForm";
import { useTranslations } from 'next-intl';

export default function CardPerson({ donor, allDonors = [] }) {
    const t = useTranslations('myDonors');
    
    const [showTooltip, setShowTooltip] = useState(false);
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
    
    // Determine frame color by traffic_light_color
    const frameColor = 
        donor.traffic_light_color === 'red' ? styles.red :
        donor.traffic_light_color === 'orange' ? styles.orange :
        donor.traffic_light_color === 'green' ? styles.green :
        styles.gray;

    const handleOpenDonationForm = () => {
        setIsDonationFormOpen(true);
    };

    const handleCloseDonationForm = () => {
        setIsDonationFormOpen(false);
    };

    return (
        <>
        <div className={classNames(styles.cardPerson, frameColor)}>
            <div className={styles.header}>
                <span
                    className={`${styles.donorName} body-1`}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    {donor.firstName}
                    <span className={`body-2 ${styles.lastName}`}>{donor.lastName}</span>
                    <div className={`${styles.tooltip} ${showTooltip ? styles.tooltipVisible : ""}`}>
                        {donor.mobile && (<p><Phone />{donor.mobile}</p>)}
                        {(donor.address || donor.city) && (<p><Home />{donor.address} {donor.city}</p>)}
                        {donor.email && (<p><Email />{donor.email}</p>)}
                    </div>
                </span>
            </div>
            <div className={`${styles.donationInfo} small-button-1`}>
                {donor.expectedDonation && donor.expectedDonation > 0
                    ? (<>
                        <span>{t('expectedDonationLabel')}</span> <span className="h3-regular">{donor.expectedDonation.toLocaleString()} <CurrencySymbol /></span>
                      </>)
                    : t('noExpectedDonation')}
            </div>
            
            <Button
                icon={<Coins />}
            text={t('addDonation')}
            smallSmall
            donor
                onClick={handleOpenDonationForm}
            />
        </div>
        
        {isDonationFormOpen && (
            <DonationForm 
                donor={donor} 
                isOpen={isDonationFormOpen}
                onClose={handleCloseDonationForm}
                allDonors={allDonors}
            />
        )}
    </>
    );
} 