-- Migration: הוספת שדות סטטוס לטבלת fundraisers
-- תאריך: $(date)

-- יצירת ENUM type לסטטוסים
CREATE TYPE status_enum AS ENUM (
    'לא נשלח',
    'התקבל',
    'נפתח',
    'הסתיים_בהצלחה'
);

-- הוספת שדות סטטוס לטבלת fundraisers
ALTER TABLE fundraisers 
ADD COLUMN status_forecast status_enum DEFAULT 'לא נשלח',
ADD COLUMN status_questionnaire status_enum DEFAULT 'לא נשלח';

-- יצירת אינדקסים לביצועים טובים
CREATE INDEX idx_fundraisers_status_forecast ON fundraisers(status_forecast);
CREATE INDEX idx_fundraisers_status_questionnaire ON fundraisers(status_questionnaire);

-- הוספת הערות לתיעוד
COMMENT ON TYPE status_enum IS 'סטטוס צפי/שאלון: לא נשלח, התקבל, נפתח, הסתיים_בהצלחה';
COMMENT ON COLUMN fundraisers.status_forecast IS 'סטטוס צפי';
COMMENT ON COLUMN fundraisers.status_questionnaire IS 'סטטוס שאלון';

-- הודעת סיום
SELECT 'Migration completed successfully - Status fields added to fundraisers table' AS result; 