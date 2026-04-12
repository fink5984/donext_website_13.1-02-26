/**
 * דוגמה מעשית לשימוש באנדפוינט הוספת תורם
 * POST /api/donors/add-with-associations
 * 
 * דוגמה זו מראה את כל השלבים הנדרשים:
 * 1. התחברות למערכת וקבלת JWT Token
 * 2. שימוש בטוקן להוספת תורם חדש
 */

const API_BASE_URL = 'http://localhost:3000'; // או https://your-domain.com

/**
 * שלב 1: התחברות למערכת
 */
async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ התחברות הצליחה');
    return data.token;
  } catch (error) {
    console.error('❌ שגיאה בהתחברות:', error.message);
    throw error;
  }
}

/**
 * שלב 2: הוספת תורם חדש למערכת
 */
async function addDonor(token, campaignId, fundraiserIds, donorDetails) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/donors/add-with-associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // חובה!
      },
      body: JSON.stringify({
        campaignId,
        fundraiserIds,
        donorDetails
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ תורם נוסף בהצלחה:', result.message);
    console.log('📊 נתונים:', {
      personId: result.data.person?.id,
      donorsCreated: result.data.donorsCount,
      donorIds: result.data.donors.map(d => d.id)
    });
    
    return result.data;
  } catch (error) {
    console.error('❌ שגיאה בהוספת תורם:', error.message);
    throw error;
  }
}

/**
 * דוגמה 1: הוספת תורם עם שיוך לשני מתרימים
 */
async function example1_AddDonorWithMultipleFundraisers() {
  console.log('\n=== דוגמה 1: הוספת תורם עם שיוך לשני מתרימים ===\n');
  
  try {
    // התחברות
    const token = await login('admin@example.com', 'yourpassword');
    
    // הוספת תורם
    const result = await addDonor(
      token,
      123, // campaignId
      [45, 67], // fundraiserIds - שני מתרימים
      {
        firstName: 'דוד',
        lastName: 'כהן',
        email: 'david.cohen@example.com',
        mainMobile: '0501234567',
        cityId: 1,
        streetId: 5,
        houseNumber: '10',
        expected: 1000,
        trafficLightColor: 'green'
      }
    );
    
    console.log('✅ תהליך הושלם בהצלחה!');
    return result;
  } catch (error) {
    console.error('❌ תהליך נכשל:', error.message);
  }
}

/**
 * דוגמה 2: הוספת תורם ללא שיוך למתרימים
 */
async function example2_AddDonorWithoutFundraisers() {
  console.log('\n=== דוגמה 2: הוספת תורם ללא שיוך למתרימים ===\n');
  
  try {
    const token = await login('admin@example.com', 'yourpassword');
    
    const result = await addDonor(
      token,
      123, // campaignId
      [], // fundraiserIds - ריק
      {
        firstName: 'רחל',
        lastName: 'לוי',
        email: 'rachel.levi@example.com',
        mainMobile: '0507654321',
        expected: 500
      }
    );
    
    console.log('✅ תהליך הושלם בהצלחה!');
    return result;
  } catch (error) {
    console.error('❌ תהליך נכשל:', error.message);
  }
}

/**
 * דוגמה 3: הוספת תורם עם כל הפרטים
 */
async function example3_AddDonorWithFullDetails() {
  console.log('\n=== דוגמה 3: הוספת תורם עם כל הפרטים ===\n');
  
  try {
    const token = await login('admin@example.com', 'yourpassword');
    
    const result = await addDonor(
      token,
      123, // campaignId
      [45], // fundraiserIds
      {
        firstName: 'משה',
        lastName: 'ישראלי',
        titleBefore: 'רב',
        titleAfter: 'שליט"א',
        email: 'moshe@example.com',
        mainMobile: '0501111111',
        secondaryMobile: '0502222222',
        phoneLandline: '02-6543210',
        cityId: 2,
        streetId: 10,
        countryId: 1,
        houseNumber: '25',
        synagogue: 'בית כנסת המרכזי',
        status: 'active',
        hasExistingHok: true,
        clientSystemId: 'EXT-12345',
        expected: 5000,
        trafficLightColor: 'green'
      }
    );
    
    console.log('✅ תהליך הושלם בהצלחה!');
    return result;
  } catch (error) {
    console.error('❌ תהליך נכשל:', error.message);
  }
}

/**
 * דוגמה 4: הוספה מרובה של תורמים (batch)
 */
async function example4_AddMultipleDonors() {
  console.log('\n=== דוגמה 4: הוספה מרובה של תורמים ===\n');
  
  try {
    const token = await login('admin@example.com', 'yourpassword');
    
    const donors = [
      {
        firstName: 'אברהם',
        lastName: 'כהן',
        email: 'abraham@example.com',
        mainMobile: '0501111111',
        expected: 1500
      },
      {
        firstName: 'שרה',
        lastName: 'לוי',
        email: 'sarah@example.com',
        mainMobile: '0502222222',
        expected: 2000
      },
      {
        firstName: 'יעקב',
        lastName: 'ישראל',
        email: 'yaakov@example.com',
        mainMobile: '0503333333',
        expected: 1000
      }
    ];
    
    const results = [];
    for (const donorDetails of donors) {
      const result = await addDonor(
        token,
        123, // campaignId
        [45], // כולם לאותו מתרים
        donorDetails
      );
      results.push(result);
      console.log(`✅ נוסף תורם: ${donorDetails.firstName} ${donorDetails.lastName}`);
    }
    
    console.log(`\n✅ סה"כ נוספו ${results.length} תורמים!`);
    return results;
  } catch (error) {
    console.error('❌ תהליך נכשל:', error.message);
  }
}

/**
 * טיפול בשגיאות נפוצות
 */
async function example5_ErrorHandling() {
  console.log('\n=== דוגמה 5: טיפול בשגיאות ===\n');
  
  try {
    const token = await login('admin@example.com', 'yourpassword');
    
    // ניסיון להוסיף תורם עם פרטים חסרים
    const result = await addDonor(
      token,
      null, // campaignId חסר - יגרום לשגיאה
      [],
      { firstName: 'שם' }
    );
  } catch (error) {
    console.log('✅ השגיאה נתפסה כצפוי:', error.message);
    // כאן ניתן לטפל בשגיאה - להציג הודעה למשתמש, לנסות שוב, וכו'
  }
  
  // ניסיון עם מתרים שלא קיימים
  try {
    const token = await login('admin@example.com', 'yourpassword');
    
    const result = await addDonor(
      token,
      123,
      [99999, 88888], // מתרימים שלא קיימים
      { firstName: 'שם', lastName: 'משפחה' }
    );
  } catch (error) {
    console.log('✅ השגיאה נתפסה כצפוי:', error.message);
  }
}

// הפעלת הדוגמאות
// הסר את הסימון // מהדוגמה שברצונך להריץ:

// example1_AddDonorWithMultipleFundraisers();
// example2_AddDonorWithoutFundraisers();
// example3_AddDonorWithFullDetails();
// example4_AddMultipleDonors();
// example5_ErrorHandling();

// או הרץ את כולן:
async function runAllExamples() {
  await example1_AddDonorWithMultipleFundraisers();
  await example2_AddDonorWithoutFundraisers();
  await example3_AddDonorWithFullDetails();
  await example4_AddMultipleDonors();
  await example5_ErrorHandling();
}

// runAllExamples();

// ייצוא לשימוש במקומות אחרים
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    login,
    addDonor,
    example1_AddDonorWithMultipleFundraisers,
    example2_AddDonorWithoutFundraisers,
    example3_AddDonorWithFullDetails,
    example4_AddMultipleDonors,
    example5_ErrorHandling
  };
}
