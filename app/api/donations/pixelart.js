// פונקציה לשליחת נתוני תרומה ל-PixelArt API
export async function sendToPixelArt(eventId, donationData) {
    try {
        const payload = {
            ...(donationData.title && { title: donationData.title }),
            ...(donationData.firstName && { first_name: donationData.firstName }),
            ...(donationData.lastName && { last_name: donationData.lastName }),
            ...(donationData.suffix && { suffix: donationData.suffix }),
            ...(donationData.tz && { tz: donationData.tz }),
            ...(donationData.extra && { extra: donationData.extra }),
            ...(donationData.gender && { gender: donationData.gender }),
            ...(donationData.address && { address: donationData.address }),
            ...(donationData.town && { town: donationData.town }),
            ...(donationData.phone && { phone: donationData.phone }),
            ...(donationData.email && { email: donationData.email }),
            ...(donationData.donation && { donation: donationData.donation })
        };

        const response = await fetch(`https://bsd1.app/api/e/${eventId}/donation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('PixelArt API error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error sending to PixelArt API:', error);
        return null;
    }
}
