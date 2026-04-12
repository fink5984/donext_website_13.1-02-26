import Button from "@/app/components/Button";
import styles from "./cards.module.scss";
import { useTranslations } from 'next-intl';

export default function Card2({
    expectationStatus,
    surveyStatus,
    donationStatus,
    profileStatus,
    isUserActive,
    isFirstTimeUser,
    donorsWithoutForecast = 0,
    donorsWithoutQuestionnaire = 0,
    totalActiveDonors = 0,
    isCrowdfunding = false,
    onSurvey,
    onExpectation,
    onDonation,
    onAddDonor,
    finishTasks,
}) {
    const t = useTranslations('myDonors.card2');

    if (expectationStatus && surveyStatus && profileStatus && donationStatus && isUserActive) {
        return null;
    }

    let content = {};
    let buttonHandler = () => { };

    const getCardState = () => {
        // בקמפיין גיוס המונים - אם אין תורמים בכלל, צריך קודם להוסיף תורמים
        if (isCrowdfunding && totalActiveDonors === 0) {
            return "noDonors";
        }
        // אם יש תורמים ללא צפי - קודם צריך למלא צפי
        if (donorsWithoutForecast > 0) {
            return "noExpectation";
        }
        // אם מילא צפי אבל יש תורמים ללא שאלון - צריך למלא שאלון
        if (donorsWithoutQuestionnaire > 0) {
            return "noSurveyAnswers";
        }
        // אם אין תורמים חדשים, נשאר עם הלוגיקה הישנה
        if (!expectationStatus) {
            return "noExpectation";
        }
        if (!surveyStatus) {
            return "noSurveyAnswers";
        }
        if (!donationStatus) {
            return "noDonations";
        }
        if (!profileStatus) {
            return "notFinished";
        }
        if (!isUserActive) {
            return "barelyActive";
        }

        return null;
    };

    switch (getCardState()) {
        case "noDonors":
            content = {
                title: t('noDonorsTitle'),
                text: t('noDonorsText'),
                button: t('noDonorsButton'),
            };
            buttonHandler = onAddDonor;
            break;
        case "noSurveyAnswers":
            const questionnaireText = donorsWithoutQuestionnaire > 0 
                ? t('noSurveyTextNew', { count: donorsWithoutQuestionnaire, plural: donorsWithoutQuestionnaire > 1 ? t('donorsPlural') : t('donorsSingular') })
                : t('noSurveyText');
            content = {
                title:
                    <>
                        {t('noSurveyTitle1')}
                        <br />
                        {t('noSurveyTitle2')}
                    </>,
                text: questionnaireText,
                button: t('noSurveyButton'),
            };
            buttonHandler = onSurvey;
            break;
        case "noExpectation":
            const forecastText = donorsWithoutForecast > 0
                ? t('noExpectationTextNew', { count: donorsWithoutForecast, plural: donorsWithoutForecast > 1 ? t('donorsPlural') : t('donorsSingular') })
                : t('noExpectationText');
            content = {
                title:
                    <>
                        {t('noExpectationTitle1')}
                        <br />
                        {t('noExpectationTitle2')}
                    </>,
                text: forecastText,
                button: t('noExpectationButton'),
            };
            buttonHandler = onExpectation;
            break;
        case "noDonations":
            content = {
                title: t('noDonationsTitle'),
                text: t('noDonationsText'),
                button: t('noDonationsButton'),
            };
            buttonHandler = onDonation;
            break;
        case "notFinished":
            content = {
                title:
                    <>
                        {t('notFinishedTitle1')}
                        <br />
                        {t('notFinishedTitle2')}
                    </>,
                text: t('notFinishedText'),
                button: t('notFinishedButton'),
            };
            buttonHandler = finishTasks;
            break;
        case "barelyActive":
            content = {
                title:
                    <>
                        {t('barelyActiveTitle1')}
                        <br />
                        {t('barelyActiveTitle2')}
                    </>,
                text: t('barelyActiveText'),
                button: t('barelyActiveButton'),
            };
            buttonHandler = finishTasks;
            break;
        default:
            content = {
                title: "",
                text: "",
                button: "",
            };
    }

    return (
        <div className={`${styles.card} ${styles.card2}`}>
            <div className={styles.information}>
                <div className={`${styles.cardTop} table-1`}>{t('payAttention')}</div>
                <div className={styles.content}>
                    {content.title && <div className={`${styles.cardTitle} headline-5-b`}>{content.title}</div>}
                    {content.text && <div className={`${styles.cardText} table-3`}>{content.text}</div>}
                </div>
            </div>
            <Button
                text={content.button}
                onClick={buttonHandler}
                smallSmall
                fullWidth
                className={`${content.button ? "" : styles.hidden}`}
            />
        </div>
    );
} 