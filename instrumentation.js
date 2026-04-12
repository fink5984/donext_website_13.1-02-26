/**
 * Next.js Instrumentation
 * רץ פעם אחת כאשר השרת עולה (server-side only)
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // רק בצד השרת (לא ב-edge)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startCronJobs } = await import('./lib/cron.js');
        startCronJobs();
    }
}
