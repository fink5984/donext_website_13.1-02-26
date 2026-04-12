/**
 * דוגמה מעשית לשימוש ב-API Key קבוע
 * האופציה הפשוטה והמומלצת למפתחים ומערכות חיצוניות
 */

const API_BASE_URL = 'http://localhost:3000'; // או https://your-domain.com

// ⭐ זה ה-API KEY של המערכת - נמצא בקובץ .env ⭐
// קבוע, משותף לכל המפתחים, לא פג לעולם
const API_KEY = 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

/**
 * הוספת תורם חדש עם API Key
 * פשוט וישיר - ללא צורך בהתחברות
 */
async function addDonor(campaignId, fundraiserIds, donorDetails) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/donors/add-with-associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY  // זה הכל! פשוט ומהיר
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
 * דוגמה 1: הוספה פשוטה של תורם
 */
async function example1_SimpleAdd() {
  console.log('\n=== דוגמה 1: הוספה פשוטה עם API Key ===\n');
  
  const result = await addDonor(
    123, // campaignId
    [45], // fundraiserIds
    {
      firstName: 'דוד',
      lastName: 'כהן',
      email: 'david@example.com',
      mainMobile: '0501234567',
      expected: 1000
    }
  );
  
  console.log('✅ הושלם!');
  return result;
}

/**
 * דוגמה 2: הוספה מרובה (batch) - אידיאלי לייבוא נתונים
 */
async function example2_BatchAdd() {
  console.log('\n=== דוגמה 2: הוספה מרובה עם API Key ===\n');
  
  const donors = [
    { firstName: 'אברהם', lastName: 'כהן', mainMobile: '0501111111', expected: 1500 },
    { firstName: 'שרה', lastName: 'לוי', mainMobile: '0502222222', expected: 2000 },
    { firstName: 'יעקב', lastName: 'ישראל', mainMobile: '0503333333', expected: 1000 }
  ];
  
  const results = [];
  for (const donorDetails of donors) {
    const result = await addDonor(123, [45], donorDetails);
    results.push(result);
    console.log(`✅ נוסף: ${donorDetails.firstName} ${donorDetails.lastName}`);
  }
  
  console.log(`\n✅ סה"כ נוספו ${results.length} תורמים!`);
  return results;
}

/**
 * דוגמה 3: שימוש מתוך webhook או מערכת חיצונית
 */
async function example3_WebhookIntegration(webhookData) {
  console.log('\n=== דוגמה 3: אינטגרציה עם Webhook ===\n');
  
  // נניח שקיבלנו webhook עם נתוני תורם חדש
  const { name, email, phone, amount, campaign_id } = webhookData;
  
  const [firstName, ...lastNameParts] = name.split(' ');
  const lastName = lastNameParts.join(' ');
  
  const result = await addDonor(
    campaign_id,
    [], // ללא מתרימים ספציפיים
    {
      firstName,
      lastName,
      email,
      mainMobile: phone,
      expected: amount
    }
  );
  
  console.log('✅ Webhook processed successfully!');
  return result;
}

/**
 * דוגמה 4: שרת Node.js שמאזין לבקשות חיצוניות
 */
function example4_NodeServer() {
  console.log('\n=== דוגמה 4: Node.js Server ===\n');
  
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  // נקודת קצה שמקבלת נתוני תורם ומעבירה למערכת
  app.post('/webhook/new-donor', async (req, res) => {
    try {
      const result = await addDonor(
        req.body.campaignId,
        req.body.fundraiserIds || [],
        req.body.donorDetails
      );
      
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.listen(3001, () => {
    console.log('🚀 Webhook server running on port 3001');
    console.log('📡 Send POST to: http://localhost:3001/webhook/new-donor');
  });
}

// ============================================
// הוראות שימוש
// ============================================

console.log(`
╔════════════════════════════════════════════════════════════╗
║          שימוש ב-API Key - מדריך מהיר                     ║
╚════════════════════════════════════════════════════════════╝

🔑 API Key של המערכת:
   dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

📍 איפה למצוא? בקובץ .env:
   API_KEY="dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

✅ זהו! פשוט העתק והשתמש בו בכל הקריאות API

💡 דוגמאות:
    await example1_SimpleAdd();
    await example2_BatchAdd();
    
🚀 המערכת מוכנה לשימוש - אין צורך בהתחברות!
`);

// הרצה אוטומטית של דוגמה 1 (הסר את הסימון // להפעלה)
// example1_SimpleAdd().catch(console.error);

// ייצוא לשימוש במודולים אחרים
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addDonor,
    example1_SimpleAdd,
    example2_BatchAdd,
    example3_WebhookIntegration
  };
}


/**
 * הוספת תורם חדש עם API Key
 * פשוט וישיר - ללא צורך בהתחברות
 */
async function addDonor(campaignId, fundraiserIds, donorDetails) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/donors/add-with-associations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': YOUR_API_KEY  // זה הכל! קל ופשוט
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
 * דוגמה 1: הוספה פשוטה של תורם
 */
async function example1_SimpleAdd() {
  console.log('\n=== דוגמה 1: הוספה פשוטה עם API Key ===\n');
  
  const result = await addDonor(
    123, // campaignId
    [45], // fundraiserIds
    {
      firstName: 'דוד',
      lastName: 'כהן',
      email: 'david@example.com',
      mainMobile: '0501234567',
      expected: 1000
    }
  );
  
  console.log('✅ הושלם!');
  return result;
}

/**
 * דוגמה 2: הוספה מרובה (batch) - אידיאלי לייבוא נתונים
 */
async function example2_BatchAdd() {
  console.log('\n=== דוגמה 2: הוספה מרובה עם API Key ===\n');
  
  const donors = [
    { firstName: 'אברהם', lastName: 'כהן', mainMobile: '0501111111', expected: 1500 },
    { firstName: 'שרה', lastName: 'לוי', mainMobile: '0502222222', expected: 2000 },
    { firstName: 'יעקב', lastName: 'ישראל', mainMobile: '0503333333', expected: 1000 }
  ];
  
  const results = [];
  for (const donorDetails of donors) {
    const result = await addDonor(123, [45], donorDetails);
    results.push(result);
    console.log(`✅ נוסף: ${donorDetails.firstName} ${donorDetails.lastName}`);
  }
  
  console.log(`\n✅ סה"כ נוספו ${results.length} תורמים!`);
  return results;
}

/**
 * דוגמה 3: שימוש מתוך webhook או מערכת חיצונית
 */
async function example3_WebhookIntegration(webhookData) {
  console.log('\n=== דוגמה 3: אינטגרציה עם Webhook ===\n');
  
  // נניח שקיבלנו webhook עם נתוני תורם חדש
  const { name, email, phone, amount, campaign_id } = webhookData;
  
  const [firstName, ...lastNameParts] = name.split(' ');
  const lastName = lastNameParts.join(' ');
  
  const result = await addDonor(
    campaign_id,
    [], // ללא מתרימים ספציפיים
    {
      firstName,
      lastName,
      email,
      mainMobile: phone,
      expected: amount
    }
  );
  
  console.log('✅ Webhook processed successfully!');
  return result;
}

/**
 * דוגמה 4: שרת Node.js שמאזין לבקשות חיצוניות
 */
function example4_NodeServer() {
  console.log('\n=== דוגמה 4: Node.js Server ===\n');
  
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  // נקודת קצה שמקבלת נתוני תורם ומעבירה למערכת
  app.post('/webhook/new-donor', async (req, res) => {
    try {
      const result = await addDonor(
        req.body.campaignId,
        req.body.fundraiserIds || [],
        req.body.donorDetails
      );
      
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.listen(3001, () => {
    console.log('🚀 Webhook server running on port 3001');
    console.log('📡 Send POST to: http://localhost:3001/webhook/new-donor');
  });
}

/**
 * איך לקבל את ה-API Key בפעם הראשונה?
 */
async function getYourApiKey(email, password) {
  console.log('\n=== קבלת API Key חדש ===\n');
  
  try {
    // שלב 1: התחברות רגילה (פעם אחת בלבד!)
    const loginRes = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!loginRes.ok) {
      throw new Error('Login failed');
    }
    
    const { token } = await loginRes.json();
    console.log('✅ התחברת בהצלחה');
    
    // שלב 2: יצירת API Key
    const apiKeyRes = await fetch(`${API_BASE_URL}/api/users/api-key`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!apiKeyRes.ok) {
      throw new Error('Failed to create API key');
    }
    
    const { apiKey } = await apiKeyRes.json();
    
    console.log('\n🎉 ה-API Key שלך:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(apiKey);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💾 שמור אותו במקום בטוח!');
    console.log('🔐 זה המפתח הקבוע שלך - לא יפוג אף פעם');
    console.log('⚡ השתמש בו בכל הקריאות API שלך');
    
    return apiKey;
    
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
    throw error;
  }
}

// ============================================
// הוראות שימוש
// ============================================

console.log(`
╔════════════════════════════════════════════════════════════╗
║          שימוש ב-API Key - מדריך מהיר                     ║
╚════════════════════════════════════════════════════════════╝

📝 שלבים:

1️⃣  הפעל את הפונקציה getYourApiKey() פעם אחת:
    const apiKey = await getYourApiKey('your@email.com', 'password');

2️⃣  העתק את ה-API Key שקיבלת

3️⃣  הדבק אותו בתחילת הקובץ הזה במשתנה YOUR_API_KEY

4️⃣  עכשיו אפשר להשתמש בכל הפונקציות ללא צורך בהתחברות!

💡 דוגמאות:
    await example1_SimpleAdd();
    await example2_BatchAdd();
    
🚀 זהו! המערכת מוכנה לשימוש
`);

// ייצוא לשימוש במודולים אחרים
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addDonor,
    getYourApiKey,
    example1_SimpleAdd,
    example2_BatchAdd,
    example3_WebhookIntegration
  };
}
