"use client";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export function InvitationDoughnut({ invitationSentCount, arrivalConfirmedCount, totalDonors }) {
    // חישוב אחוזים
    const invitationSentPercentage = totalDonors > 0 ? (invitationSentCount / totalDonors) * 100 : 0;
    const arrivalConfirmedPercentage = totalDonors > 0 ? (arrivalConfirmedCount / totalDonors) * 100 : 0;
    const remainingPercentage = 100 - invitationSentPercentage;

    const data = {
        datasets: [{
            data: totalDonors === 0 ? [100] : [
                arrivalConfirmedPercentage, // כחול כהה - אישורי הגעה
                invitationSentPercentage - arrivalConfirmedPercentage, // כחול בהיר - מסירות הזמנה (ללא אישורי הגעה)
                remainingPercentage // אפור - ללא
            ],
            backgroundColor: totalDonors === 0 ? ['#E5E5E8'] : [
                '#0C4AD5', // כחול כהה - אישורי הגעה
                '#6E99EC', // כחול בהיר - מסירות הזמנה
                '#E5E5E8'  // אפור - ללא
            ],
            borderWidth: 0,
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: false
            }
        }
    };

    return (
        <div style={{ width: '32px', height: '32px' }}>
            <Pie data={data} options={options} />
        </div>
    );
}
