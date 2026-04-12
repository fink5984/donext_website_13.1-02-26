import { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';
import styles from "./ProgressTabs.module.scss";
import Folder from "@/app/icons/folder.svg";
import Form from "@/app/icons/form.svg";
import Envelope from "@/app/icons/envelope.svg";
import Success from "@/app/icons/success.svg";
import Bulb from "@/app/icons/bulb.svg";
import Target from "@/app/icons/target.svg";
import Gift from "@/app/icons/gift.svg";
import SuccessExcepted from "@/app/icons/successExcepted.svg";
import Button from "@/app/components/Button";

const getSHALON_STEPS = (t) => [
    { icon: Folder, label: t('notYetSent'), key: "לא_נשלח" },
    { icon: Form, label: t('received'), key: "התקבל" },
    { icon: Envelope, label: t('opened'), key: "נפתח" },
    { icon: Success, label: t('completedSuccessfully'), key: "הסתיים_בהצלחה" },
];

const getEXPECTED_STEPS = (t) => [
    { icon: Bulb, label: t('notYetSent'), key: "לא_נשלח" },
    { icon: Target, label: t('received'), key: "התקבל" },
    { icon: Gift, label: t('opened'), key: "נפתח" },
    { icon: SuccessExcepted, label: t('completedSuccessfully'), key: "הסתיים_בהצלחה" },
];

export default function ProgressTabs({ mode = "shalon", statusKey = { shalon: "התקבל", expected: "הסתיים_בהצלחה" }, hasDonors = true, onStartAssign }) {
    const t = useTranslations('fundraiserManagement');
    const [activeTab, setActiveTab] = useState(mode);

    const getSteps = () => (activeTab === "shalon" ? getSHALON_STEPS(t) : getEXPECTED_STEPS(t));

    const steps = getSteps();

    const currentIndex = steps.findIndex(
        step => step.key === (typeof statusKey === "string" ? statusKey : statusKey[activeTab])
    );
    const getButtonProps = () => {
        const key = typeof statusKey === "string" ? statusKey : statusKey[activeTab];

        if (key === "לא_נשלח") {
            return {
                text: t('sendQuestionnaireLink'),
                onClick: () => {
                    // Action to send link
                    console.log("Sent questionnaire link", activeTab);
                }
            };
        }

        if (key === "התקבל" || key === "נפתח") {
            return {
                text: t('sendReminder'),
                onClick: () => {
                    // Action to send reminder
                    console.log("Sent reminder", activeTab);
                }
            };
        }

        // If completed successfully - don't show button
        return null;
    };

    const buttonProps = getButtonProps();

    return (
        <div className={styles.wrapper}>
            <div className={styles.tabBar}>
                <button
                    className={`${styles.tab} ${activeTab === "shalon" ? `${styles.active} table-1` : "table-2"}`}
                    onClick={() => setActiveTab("shalon")}
                >
                    {t('questionnaireStatus')}
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "expected" ? `${styles.active} table-1` : "table-2"}`}
                    onClick={() => setActiveTab("expected")}
                >
                    {t('expectedDonationStatus')}
                </button>
                <div className={styles.background} />
            </div>

            <div className={styles.content}>
                {!hasDonors ? (
                    <div className={styles.empty}>
                        <Button
                            small
                            text={t('noDonorsAssignedYet')}
                            type="button"
                            onClick={onStartAssign} />
                    </div>
                ) : (
                    <>
                        <div className={styles.timeline}>
                            {steps.map((step, index) => {
                                const Icon = step.icon;
                                const isDone = index <= currentIndex;
                                const isCurrent = index === currentIndex;

                                return (
                                    <div key={step.key} className={styles.step}>
                                        {/* <div className={`${styles.line} ${isDone ? styles.lineActive : ""}`} /> */}
                                        <div className={styles.visual}>
                                            <Icon className={`${styles.icon} ${isDone ? styles.iconActive : ""}`} />
                                            <div className={`${styles.circle} ${isDone ? styles.done : ""}`}>
                                            </div>
                                            {index < steps.length - 1 &&
                                                <div className={`${styles.connector} ${index < currentIndex ? styles.lineActive : ""}`} />
                                            }
                                        </div>
                                        <span className={`button-1 ${styles.label} ${isDone ? styles.labelActive : ""}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className={buttonProps == null ? styles.hidden : ""}>
                            <Button
                                small
                                text={buttonProps?.text}
                                onClick={buttonProps?.onClick}
                                type="button"
                            />
                        </div>
                    </>
                )}
            </div>
        </div >
    );
}