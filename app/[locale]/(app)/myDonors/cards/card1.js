import Button from "@/app/components/Button";
import styles from "./cards.module.scss";
import React from "react";
import { useTranslations } from 'next-intl';

export default function Card1({
    userStatus = {
        expectationStatus: true,  // האם מילא צפי
        surveyStatus: true,      // האם מילא שאלון
        donationStatus: false,    // האם יש תרומות
        profileStatus: false,     // האם סיים פרופיל
        isUserActive: false,      // האם המשתמש פעיל
    },
    achievements = {
        isFirstUserEver: false,          // האם המשתמש הראשון במערכת
        isFirstToFinishSurvey: false,    // האם סיים ראשון את השאלון
        isFastestSurvey: true,           // האם מילא הכי מהר את השאלון
        hasHighestExpectation: false,     // האם הציב צפי הכי גבוה
        isFirstToFinishAll: false,        // האם סיים ראשון הכל
        greenPercentage: 25,              // אחוז הירוקים
        redPercentage: 15,                // אחוז האדומים
        taskCompletionTime: 20,           // זמן השלמת משימה בשעות
        lastLoginHour: 23,                // שעת כניסה אחרונה
        specialCondition: true,           // תנאי מיוחד ל-noOnYou
        aboveTargetPercentage: 37,        // כמה אחוזים מעל היעד
        specificDonor: {                  // נתונים על תורם ספציפי
            name: "",
            aboveTargetPercentage: 22
        }
    },
    onSurvey,
    onExpectation,
    onProfile
}) {
    const t = useTranslations('myDonors.card1');
    
    // אם אין צפי או אין שאלון - Card2 יוצג במקום, אז לא להציג Card1
    if (!userStatus.expectationStatus || !userStatus.surveyStatus) {
        return null;
    }
    
    // פונקציה שמחזירה את הכפתור המתאים לפי המצב
    const getButtonConfig = () => {
        // Check if all tasks are completed and campaign is finished
        if (userStatus.donationStatus && userStatus.expectationStatus && userStatus.surveyStatus && userStatus.profileStatus) {
            return {
                text: t('goToProfile'),
                onClick: onProfile
            };
        }
        if (!userStatus.expectationStatus) {
            return {
                text: t('goToForecast'),
                onClick: onExpectation
            };
        }
        if (!userStatus.surveyStatus) {
            return {
                text: t('startQuestionnaire'),
                onClick: onSurvey
            };
        }
        return {
            text: "",
            onClick: () => { }
        };
    };

    // פונקציה שקובעת את המצב של הכרטיסייה
    const getCardType = () => {
        if (achievements.isFirstUserEver) {
            return "firstToEnter";
        }
        // בדיקת כניסה ראשונה וסטטוס מילוי
        if (!userStatus.expectationStatus && !userStatus.surveyStatus) {
            return "firstLogin";
        }

        // בדיקת הישגים ראשונים
        if (userStatus.surveyStatus) {
            if (achievements.isFirstToFinishSurvey) return "firstToFinishSurvey";
            if (achievements.isFastestSurvey) return "fastestSurvey";
            if (achievements.greenPercentage > 20) return "complimentGreen";
            if (achievements.redPercentage < 20) return "complimentRed";
        }
        if (userStatus.expectationStatus) {
            if (achievements.hasHighestExpectation) return "highestExpectation";
        }
        if (achievements.isFirstToFinishAll) return "firstToFinishAll";

        // בדיקת הישגים כלליים
        if (userStatus.expectationStatus) return "complimentExpectation";

        if (achievements.taskCompletionTime < 24) return "complimentTasks";
        if (achievements.lastLoginHour >= 22) return "noWords";
        if (achievements.specialCondition) return "noOnYou";
        if (achievements.aboveTargetPercentage > 0) return "aboveTarget";
        if (achievements.specificDonor.aboveTargetPercentage > 0) return "abovePersonalTarget";

        return "firstLogin"; // ברירת מחדל
    };

    const type = getCardType();
    const buttonConfig = getButtonConfig();
    let content = {};
    let gifSrc = "";
    let animationClass = "";

    switch (type) {
        case "firstLogin":
            content = {
                top: t('justWantedToSay'),
                title: t('champion'),
                text: t('gladYoureWithUs'),
            };
            gifSrc = "";
            animationClass = "";
            break;
        case "firstToEnter":
            content = {
                top: (
                    <>
                        {t('firstToEnterTitle1')}
                        <br />
                        {t('firstToEnterTitle2')}
                    </>
                ),
                title: t('youTitle'),
                text: t('firstToEnterText'),
            };
            gifSrc = "";
            animationClass = "";
            break;
        case "firstToFinishSurvey":
            content = {
                top: (
                    <>
                        {t('firstToFinishSurveyTitle1')}
                        <br />
                        {t('firstToFinishSurveyTitle2')}
                    </>
                ),
                title: t('youTitle'),
                text: t('firstToFinishSurveyText'),
            };
            gifSrc = "/gifs/clap.gif";
            animationClass = styles.clapAnimation;
            break;
        case "fastestSurvey":
            content = {
                top: (
                    <>
                        {t('fastestSurveyTitle1')}
                        <br />
                        {t('fastestSurveyTitle2')}
                    </>
                ),
                title: t('youTitle'),
                text: t('fastestSurveyText'),
            };
            gifSrc = "/gifs/clap.gif";
            animationClass = styles.clapAnimation;
            break;
        case "highestExpectation":
            content = {
                top: (
                    <>
                        {t('highestExpectationTitle1')}
                        <br />
                        {t('highestExpectationTitle2')}
                    </>
                ),
                title: t('youTitle'),
                text: t('highestExpectationText'),
            };
            gifSrc = "/gifs/clap.gif";
            animationClass = styles.clapAnimation;
            break;
        case "firstToFinishAll":
            content = {
                top: (
                    <>
                        {t('firstToFinishAllTitle1')}
                        <br />
                        {t('firstToFinishAllTitle2')}
                    </>
                ),
                title: t('youTitle'),
                text: t('firstToFinishAllText'),
            };
            gifSrc = "/gifs/clap.gif";
            animationClass = styles.clapAnimation;
            break;
        case "complimentExpectation":
            content = {
                top: t('justWantedToSay'),
                title: t('rockstar'),
                text: t('complimentExpectationText'),
            };
            gifSrc = "/gifs/party.gif";
            animationClass = styles.partyAnimation;
            break;
        case "complimentGreen":
            content = {
                top: t('justWantedToSay'),
                title: t('amazing'),
                text: t('complimentGreenText', { percentage: achievements.greenPercentage }),
            };
            gifSrc = "/gifs/party.gif";
            animationClass = styles.partyAnimation;
            break;
        case "complimentRed":
            content = {
                top: t('justWantedToSay'),
                title: t('wellDone'),
                text: t('complimentRedText'),
            };
            gifSrc = "/gifs/party.gif";
            animationClass = styles.partyAnimation;
            break;
        case "complimentTasks":
            content = {
                top: t('justWantedToSay'),
                title: t('wow'),
                text: t('complimentTasksText'),
            };
            gifSrc = "/gifs/party.gif";
            animationClass = styles.partyAnimation;
            break;
        case "aboveTarget":
            content = {
                top: t('aboveTargetTop'),
                title: (<>{achievements.aboveTargetPercentage}% <span className={styles.plusGreen}>+</span></>),
                text: t('aboveTargetText'),
            };
            gifSrc = "/gifs/money.gif";
            animationClass = styles.moneyAnimation;
            break;
        case "abovePersonalTarget":
            content = {
                top: t('abovePersonalTargetTop'),
                title: (<>{achievements.specificDonor.aboveTargetPercentage}% <span className={styles.plusGreen}>+</span></>),
                text: (<>
                    {t('raisedFrom')}
                    <br />
                    {t('from')}<span className={styles.underlinedName}>{achievements.specificDonor.name}</span><br />{t('moreThanExpected')}
                </>),
            };
            gifSrc = "/gifs/money.gif";
            animationClass = styles.moneyAnimation;
            break;
        case "noWords":
            content = {
                top: t('justWantedToSay'),
                title: t('noWordsTitle'),
                text: t('noWordsText'),
            };
            gifSrc = "/gifs/star.gif";
            animationClass = styles.starAnimation;
            break;
        case "noOnYou":
            content = {
                top: t('justWantedToSay'),
                title: t('noOnYouTitle'),
                text: t('noOnYouText'),
            };
            gifSrc = "/gifs/dizzy.gif";
            animationClass = styles.dizzyAnimation;
            break;
        default:
            content = {
                top: "",
                title: "",
                text: "",
            };
            gifSrc = "";
            animationClass = "";
    }

    return (
        <div className={`${styles.card} ${styles.card1}`} style={{ position: "relative" }}>
            {gifSrc && (
                <div className={`${styles.gifOverlay} ${animationClass}`}>
                    <img src={gifSrc} alt="animation" className={styles.gifImage} />
                </div>
            )}
            <div className={styles.information}>
                {content.top && <div className={`${styles.cardTop} table-1`}>{content.top}</div>}
                <div className={styles.content}>
                    {content.title && <div className={`${styles.cardTitle} headline-2`}>{content.title}</div>}
                    {content.text && <div className={`${styles.cardText} table-3`}>{content.text}</div>}
                </div>
            </div>
            <Button
                text={buttonConfig.text}
                onClick={buttonConfig.onClick}
                smallSmall
                fullWidth
                className={`${buttonConfig.text ? "" : styles.hidden}`}
            />
        </div>
    );
}