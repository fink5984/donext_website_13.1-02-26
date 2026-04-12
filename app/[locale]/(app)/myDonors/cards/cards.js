import React from "react";
import Card1 from "./card1"
import Card2 from "./card2"
import Card3 from "./card3"
import styles from "./cards.module.scss"
import { useRouter, useParams } from "next/navigation";
import { useAppContext } from "@/app/components/AppContext";

export default function Cards({ fundraiserStatus, donors = [], openDonationForm, isCrowdfunding = false, onAddDonor }) {
    const { fundraiserId, setFundraiserId } = useAppContext();
    const params = useParams();
    const locale = params?.locale || 'he';
    
    // צבעים תקינים - מעידים שהשאלון הושלם
    const validColors = ['green', 'orange', 'red'];
    
    // בדיקה אם יש תורמים פעילים שלא הושלם עליהם השאלון
    // תורם נחשב שהשאלון הושלם עליו רק אם:
    // 1. lastQuestionnaireByFundraiserId = fundraiserId הנוכחי
    // 2. יש לו צבע תקין (green/orange/red) - לא null ולא gray
    const donorsWithoutQuestionnaire = donors.filter(donor => {
        if (donor.isActive === false) return false; // מתעלמים מתורמים לא פעילים
        
        const hasAnsweredByCurrentFundraiser = donor.lastQuestionnaireByFundraiserId === parseInt(fundraiserId);
        // בדיקת צבע - תומך בשני השמות (trafficLightColor או traffic_light_color)
        const donorColor = donor.trafficLightColor || donor.traffic_light_color;
        const hasValidColor = validColors.includes(donorColor);
        
        // תורם צריך למלא שאלון אם לא ענה המתרים הנוכחי או שאין לו צבע תקין
        return !hasAnsweredByCurrentFundraiser || !hasValidColor;
    });
    
    // בדיקה אם יש תורמים פעילים שלא מילא עליהם צפי
    const donorsWithoutForecast = donors.filter(donor => 
        donor.lastForecastByFundraiserId !== parseInt(fundraiserId) && donor.isActive !== false
    );
    
    console.log('🎴 Cards - Checking status:', {
        fundraiserId: parseInt(fundraiserId),
        totalDonors: donors.length,
        activeDonors: donors.filter(donor => donor.isActive !== false).length,
        status_questionnaire: fundraiserStatus?.status_questionnaire,
        status_forecast: fundraiserStatus?.status_forecast,
        donorsWithoutQuestionnaire: donorsWithoutQuestionnaire.length,
        donorsWithoutForecast: donorsWithoutForecast.length,
        donorsDetails: donors.map(d => ({
            id: d.id,
            name: `${d.firstName} ${d.lastName}`,
            active: d.isActive,
            lastQuestionnaireByFundraiserId: d.lastQuestionnaireByFundraiserId,
            lastForecastByFundraiserId: d.lastForecastByFundraiserId,
            trafficLightColor: d.trafficLightColor || d.traffic_light_color
        }))
    });
    
    // לוגיקה מדויקת:
    // 1. אם יש תורמים ללא צפי -> expectationStatus = false
    // 2. אם מילא צפי לכולם -> expectationStatus = true
    // 3. אם יש תורמים ללא שאלון (אבל יש להם צפי) -> surveyStatus = false
    // 4. אם מילא גם צפי וגם שאלון לכולם -> שניהם true
    const userStatus = {
        expectationStatus: donorsWithoutForecast.length === 0 && donors.length > 0,  // מילא צפי לכולם
        surveyStatus: donorsWithoutQuestionnaire.length === 0 && donorsWithoutForecast.length === 0 && donors.length > 0,  // מילא צפי ושאלון לכולם
        donationStatus: (fundraiserStatus?.actual_donation_sum || 0) > 0,    // האם יש תרומות
        profileStatus: true,     // האם סיים פרופיל
        isUserActive: true,      // האם המשתמש פעיל
        isFirstTimeUser: true,    // האם זו כניסה ראשונה
    };

    // חישוב אחוזים אמיתיים מהנתונים של המגייס הספציפי
    const totalDonors = fundraiserStatus ? parseInt(fundraiserStatus.donors_count || 0) : 0;

    const greenPercentage = totalDonors > 0 ? Math.round((parseInt(fundraiserStatus?.green_count || 0)) / totalDonors * 100) : 0;
    const redPercentage = totalDonors > 0 ? Math.round((parseInt(fundraiserStatus?.red_count || 0)) / totalDonors * 100) : 0;
    const orangePercentage = totalDonors > 0 ? Math.round((parseInt(fundraiserStatus?.orange_count || 0)) / totalDonors * 100) : 0;

    // נתונים להישגים - מחושבים מנתונים אמיתיים של המגייס
    const achievements = {
        isFirstUserEver: false,          // האם המשתמש הראשון במערכת
        isFirstToFinishSurvey: false,    // האם סיים ראשון את השאלון
        isFastestSurvey: false,           // האם מילא הכי מהר את השאלון
        hasHighestExpectation: false,     // האם הציב צפי הכי גבוה
        isFirstToFinishAll: false,        // האם סיים ראשון הכל
        greenPercentage: greenPercentage,              // אחוז הירוקים - מחושב מנתונים אמיתיים
        redPercentage: redPercentage,                // אחוז האדומים - מחושב מנתונים אמיתיים
        orangePercentage: orangePercentage,          // אחוז הכתומים - מחושב מנתונים אמיתיים
        taskCompletionTime: 20,           // זמן השלמת משימה בשעות
        lastLoginHour: 23,                // שעת כניסה אחרונה
        specialCondition: true,           // תנאי מיוחד ל-noOnYou
        aboveTargetPercentage: 37,        // כמה אחוזים מעל היעד
        specificDonor: {                  // נתונים על תורם ספציפי
            name: "",
            aboveTargetPercentage: 22
        }
    };
    const router = useRouter();
    const handleGoToSurvey = () => {
        router.push(`/${locale}/Questionnaire/`);
    };
    const handleGoToForecast = () => {
        router.push(`/${locale}/donorForecast/`);
    };
    return (
        <div className={styles.cards}>
            <Card1
                userStatus={userStatus}
                achievements={achievements}
                onSurvey={handleGoToSurvey}
                onExpectation={handleGoToForecast}
                onProfile={() => { console.log("מעבר לפרופיל אישי") }}
            />
            <Card2
                {...userStatus}
                donorsWithoutForecast={donorsWithoutForecast.length}
                donorsWithoutQuestionnaire={donorsWithoutQuestionnaire.length}
                totalActiveDonors={donors.filter(d => d.isActive !== false).length}
                isCrowdfunding={isCrowdfunding}
                onSurvey={handleGoToSurvey}
                onExpectation={handleGoToForecast}
                onDonation={() => openDonationForm()}
                onAddDonor={onAddDonor}
                finishTasks={() => { console.log("מעבר להשלמת משימות") }}
            />
            <Card3 />
        </div>
    )
}