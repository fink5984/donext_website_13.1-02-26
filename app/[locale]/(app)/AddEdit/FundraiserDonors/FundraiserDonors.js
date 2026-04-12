import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './FundraiserDonors.module.scss';
import Button from '@/app/components/Button';
import Person from '@/app/components/Person';
import Circle from "@/app/icons/circle24.svg";
import Plus from "@/app/icons/plusBig.svg";
import { useAppContext } from "@/app/components/AppContext";
import { observer } from "mobx-react-lite";

export default observer(function FundraiserDonors({ fundraiser = null, popupRef = null, onStartAssign }) {
    const t = useTranslations('fundraiserManagement');
    const { stores } = useAppContext();
    const { donorsStore } = stores;
    
    const [assignedDonors, setAssignedDonors] = useState([]);
    
    useEffect(() => {
        // Wait until data is loaded and there's a fundraiser_id
        if (fundraiser?.fundraiser_id && !donorsStore.loadingAssignableDonors && donorsStore.assignableDonors.length > 0) {
            const donors = donorsStore.getDonorsForFundraiser(fundraiser.fundraiser_id);
            setAssignedDonors(donors);
        } else {
            // If no fundraiser_id or data is still loading, clear the list
            if (!fundraiser?.fundraiser_id) {
                setAssignedDonors([]);
            }
            // If still loading, don't touch assignedDonors to avoid flickering
        }
    }, [fundraiser, donorsStore.assignableDonors, donorsStore.loadingAssignableDonors]);

    const removeDonor = (donorId) => {
        donorsStore.cancelDonorAssignment(donorId);
    };

    return (
        <div className={styles.wrapper}>
            <p className={`${styles.title} table-1`}>{t('donorsUnderResponsibility')}</p>
            <div className={styles.content}>
                {assignedDonors.length === 0 ? (
                    <div className={styles.empty}>
                        <Button
                            small
                            text={t('noDonorsAssignedYet')}
                            onClick={onStartAssign}
                            type="button"
                            primary
                        />
                    </div>
                ) : (
                    <>
                        <div className={styles.donors}>
                            {assignedDonors.map((donor) => {
                                const sameName = assignedDonors.filter(
                                    (d) =>
                                        d.firstName === donor.firstName &&
                                        d.lastName === donor.lastName &&
                                        d.id !== donor.id
                                ).length > 0;

                                return (
                                    <Person
                                        fundraiserName={`${fundraiser?.first_name} ${fundraiser?.last_name}`}
                                        popupRef={popupRef}
                                        donorSelected
                                        key={donor.id}
                                        onClick={() => removeDonor(donor.id)}
                                        onCancelFund={() => removeDonor(donor.id)}
                                        firstName={donor.firstName}
                                        lastName={donor.lastName}
                                        details={{
                                            phone: donor.phone,
                                            city: donor.city,
                                            address: donor.address,
                                            email: donor.email
                                        }}
                                        icon={
                                            <Circle
                                                className={`${donor.traffic_light_color === 'red'
                                                    ? styles.levelHard
                                                    : donor.traffic_light_color === 'orange'
                                                        ? styles.levelMedium
                                                        : donor.traffic_light_color === 'green' ?
                                                            styles.levelEasy :
                                                            styles.noLevel
                                                    }`}
                                            />
                                        }
                                        sameName={sameName}
                                    />
                                );
                            })}
                        </div>
                        <Button
                            small
                            text={t('assignAnotherDonor')}
                            onClick={onStartAssign}
                            icon={<Plus />}
                        />
                    </>
                )}
            </div>
        </div>
    );
});