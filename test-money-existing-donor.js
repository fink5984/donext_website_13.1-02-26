// בדיקה - שולחים תרומה בדיקה לתורם קיים ובודקים את התשובה

const MONEY_API_URL = 'https://money-app.co.il/api/donext';

async function testSendToExistingDonor() {
  // נשלח תרומת בדיקה לתורם קיים (לדוגמה אברהם שלום געללער - moneyDonorId: 175035)
  const payload = {
    campaign_id: 150,  // Money campaign ID
    donation_id: 99999, // ID בדיקה
    first_name: 'בדיקה',
    last_name: 'בדיקה',
    phone: '0501234567',
    amount: 1,
    number_of_payments: 1,
    has_payment_method: false,
    city_name: null,
    donor_id: 175035  // תורם קיים!
  };

  console.log('שולח תרומת בדיקה עם donor_id קיים:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await fetch(MONEY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status);
    
    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSendToExistingDonor();
