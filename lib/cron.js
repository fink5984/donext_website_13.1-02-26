import cron from 'node-cron';

let isScheduled = false;

/**
 * מפעיל את כל משימות ה-Cron של המערכת
 * נקרא פעם אחת כשהשרת עולה דרך instrumentation.js
 */
export function startCronJobs() {
    // מניעת הפעלה כפולה (hot reload ב-development)
    if (isScheduled) {
        console.log('[CRON] Cron jobs already scheduled, skipping...');
        return;
    }
    isScheduled = true;

    console.log('[CRON] Starting cron jobs scheduler...');

    // כל יום בשעה 07:00 בזמן ישראל (04:00 UTC בחורף, 04:00 UTC בקיץ)
    // שעון ישראל UTC+2 (חורף) / UTC+3 (קיץ)
    // נשתמש ב-05:00 UTC כפשרה שמכסה את שני המצבים (07:00/08:00 ישראל)
    cron.schedule('0 5 * * *', async () => {
        console.log('[CRON] Running daily tasks email job at', new Date().toISOString());
        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const url = `${baseUrl}/api/cron/daily-tasks`;

            const headers = {};
            if (process.env.CRON_SECRET) {
                headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`;
            }

            const response = await fetch(url, { headers });
            const result = await response.json();

            if (result.success) {
                console.log(`[CRON] Daily tasks completed: ${result.emailsSent} emails sent, ${result.taskCount} tasks found`);
            } else {
                console.error('[CRON] Daily tasks failed:', result.error);
            }
        } catch (error) {
            console.error('[CRON] Error running daily tasks:', error.message);
        }
    }, {
        timezone: 'Asia/Jerusalem'
    });

    console.log('[CRON] ✅ Daily tasks email scheduled for 05:00 UTC (07:00-08:00 Israel time) every day');
}
