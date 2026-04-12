import { prisma } from '@/lib/prisma';

/**
 * אוסף את כל אפשרויות הקמפיינים + תפקידים עבור משתמש
 * @param {Object} user - אובייקט המשתמש עם id ו-role
 * @returns {Promise<Object>} - אובייקט עם campaignOptions ו-userName
 */
export async function getCampaignOptionsForUser(user) {
  const campaignOptions = [];
  let userName = "";

  // שאילתה מקבילה לכל התפקידים - במקום שאילתות סדרתיות
  const queries = [];
  
  // 1. אם המשתמש הוא fundraiser - למצוא את כל הקמפיינים שהוא מתרים/מפעיל בהם
  if (user.role.includes('fundraiser')) {
    queries.push(
      prisma.fundraiser.findMany({
        where: {
          userId: user.id,
          deleted_at: null
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              logo: true,
              startDate: true,
              endDate: true,
              hasOperators: true
            }
          },
          person: {
            select: {
              firstName: true,
            }
          }
        },
      })
    );
  } else {
    queries.push(Promise.resolve([]));
  }

  // 2. אם המשתמש הוא manager - למצוא את כל הקמפיינים שהוא מנהל
  if (user.role.includes('manager')) {
    queries.push(
      prisma.client.findFirst({
        where: { userId: user.id },
        include: {
          campaigns: {
            select: {
              id: true,
              name: true,
              logo: true,
              startDate: true,
              endDate: true
            }
          }
        }
      })
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  // 3. אם המשתמש הוא admin - להחזיר את כל הקמפיינים
  if (user.role.includes('admin')) {
    queries.push(
      prisma.campaign.findMany({
        select: { 
          id: true, 
          name: true, 
          clientId: true, 
          logo: true, 
          startDate: true, 
          endDate: true 
        }
      })
    );
  } else {
    queries.push(Promise.resolve([]));
  }

  // 4. שאילתה להיסטוריית התחברויות של המשתמש
  queries.push(
    prisma.loginHistory.findMany({
      where: {
        userId: user.id,
        campaignId: { not: null }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        campaignId: true,
        role: true,
        createdAt: true
      }
    })
  );

  // ביצוע כל השאילתות במקביל
  const [fundraisers, client, campaigns, loginHistory] = await Promise.all(queries);

  // יצירת מפת התחברויות אחרונות לפי campaignId + role
  const loginHistoryMap = new Map();
  if (loginHistory && loginHistory.length > 0) {
    loginHistory.forEach(login => {
      const key = `${login.campaignId}-${login.role}`;
      if (!loginHistoryMap.has(key)) {
        loginHistoryMap.set(key, login.createdAt);
      }
    });
  }

  // עיבוד תוצאות fundraisers - מפריד בין מתרימים למפעילים
  if (fundraisers && fundraisers.length > 0) {
    userName = fundraisers[0].person?.firstName || "";
    fundraisers.forEach(f => {
      // כל מתרים מקבל כרטיס מתרים
      const fundraiserKey = `${f.campaignId}-fundraiser`;
      const fundraiserLastLogin = loginHistoryMap.get(fundraiserKey);
      campaignOptions.push({
        role: 'fundraiser',
        campaign_id: f.campaignId,
        campaign_name: f.campaign.name,
        campaign_logo: f.campaign.logo,
        start_date: f.campaign.startDate,
        end_date: f.campaign.endDate,
        fundraiser_id: f.id,
        last_login_at: fundraiserLastLogin
      });

      // אם גם מפעיל - הוסף כרטיס מפעיל בנוסף
      if (f.isOperator && f.campaign?.hasOperators) {
        const operatorKey = `${f.campaignId}-operator`;
        const operatorLastLogin = loginHistoryMap.get(operatorKey);
        campaignOptions.push({
          role: 'operator',
          campaign_id: f.campaignId,
          campaign_name: f.campaign.name,
          campaign_logo: f.campaign.logo,
          start_date: f.campaign.startDate,
          end_date: f.campaign.endDate,
          fundraiser_id: f.id,
          operator_id: f.id,
          last_login_at: operatorLastLogin
        });
      }
    });
  }

  // עיבוד תוצאות client
  if (client) {
    if (!userName) {
      userName = client.name || "";
    }
    if (client.campaigns) {
      client.campaigns.forEach(c => {
        const key = `${c.id}-manager`;
        const lastLoginAt = loginHistoryMap.get(key);
        campaignOptions.push({
          role: 'manager',
          campaign_id: c.id,
          campaign_name: c.name,
          campaign_logo: c.logo,
          start_date: c.startDate,
          end_date: c.endDate,
          client_id: client.id,
          last_login_at: lastLoginAt
        });
      });
    }
  }

  // עיבוד תוצאות campaigns
  if (campaigns && campaigns.length > 0) {
    campaigns.forEach(c => {
      const key = `${c.id}-admin`;
      const lastLoginAt = loginHistoryMap.get(key);
      campaignOptions.push({
        role: 'admin',
        campaign_id: c.id,
        campaign_name: c.name,
        campaign_logo: c.logo,
        start_date: c.startDate,
        end_date: c.endDate,
        client_id: c.clientId,
        last_login_at: lastLoginAt
      });
    });
  }

  // fallback למייל אם לא מצאנו שם
  if (!userName && user.email) {
    userName = user.email.split('@')[0];
  }

  // חילוץ clientId עבור מנהלים/אדמינים
  let clientId = null;
  if (client && client.id) {
    clientId = client.id;
  } else if (campaignOptions.length > 0) {
    // fallback - חפש client_id מהאפשרויות
    const optionWithClient = campaignOptions.find(opt => opt.client_id);
    if (optionWithClient) {
      clientId = optionWithClient.client_id;
    }
  }

  return {
    campaignOptions,
    userName,
    clientId
  };
}

