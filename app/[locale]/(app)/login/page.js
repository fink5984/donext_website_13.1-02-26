'use client';
import { useState, useContext, useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { sessionStore } from '@/stores/SessionStore';
import { getRedirectPathByRole, getRoleFromToken } from '@/lib/authService';
import { AppContext } from '@/app/components/AppContext';
import { LoginForm } from './LoginForm';
import { ResetPassword } from './ResetPassword';
import { CampaignSelection } from './CampaignSelection';
import { CampaignSelectionSidebar } from './CampaignSelectionSidebar';
import LanguageFloatingButton from '@/app/components/LanguageFloatingButton/LanguageFloatingButton';
import Logo from "@/app/icons/donext.svg";
import styles from './login.module.scss';
import rootStore from '@/stores/RootStore';

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = params?.locale || 'he';
  const { setGlobalLoading } = useContext(AppContext);
  const [step, setStep] = useState("loading"); // loading | login | selectCampaign | resetPassword
  const [campaignOptions, setCampaignOptions] = useState([]);
  const [emailForReset, setEmailForReset] = useState("");
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);
  const [campaignIdFromUrl, setCampaignIdFromUrl] = useState(null);
  const [userName, setUserName] = useState("");
  const [activeSection, setActiveSection] = useState("campaigns"); // campaigns | contacts
  const [userRole, setUserRole] = useState(null); // track user role

  // בדיקת פרמטרים מה-URL
  useEffect(() => {
    const redirect = searchParams.get('redirect');
    const campaignId = searchParams.get('campaignId');
    const showCampaigns = searchParams.get('showCampaigns');
    
    if (redirect) {
      setRedirectAfterLogin(redirect);
    }
    
    if (campaignId) {
      setCampaignIdFromUrl(parseInt(campaignId, 10));
    }

    // אם יש showCampaigns=true ויש טוקן - הבא את הקמפיינים
    if (showCampaigns === 'true' && sessionStore.token) {
      fetchCampaignsForLoggedInUser();
    } else {
      // אם אין showCampaigns או אין טוקן - הצג לוגין
      setStep("login");
    }
  }, [searchParams]);

  // פונקציה לשליפת קמפיינים למשתמש מחובר
  async function fetchCampaignsForLoggedInUser() {
    // הצג מיד מ-cache אם קיים - ואחר כך רענן ברקע
    try {
      const cached = localStorage.getItem('campaignOptionsCache');
      if (cached) {
        const { options, userName: cachedName, role: cachedRole } = JSON.parse(cached);
        if (options && options.length > 0) {
          setCampaignOptions(options);
          setUserName(cachedName || '');
          setUserRole(cachedRole || getRoleFromToken(sessionStore.token));
          setStep('selectCampaign');
          // רענן ברקע בלי loading
          fetchCampaignsBackground();
          return;
        }
      }
    } catch (_) { /* ignore */ }

    // אין cache - טען עם loading
    try {
      setGlobalLoading(true);
      const data = await fetchCampaignsFromServer();
      if (data) {
        setStep('selectCampaign');
      } else {
        setStep('login');
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setStep('login');
    } finally {
      setGlobalLoading(false);
    }
  }

  // רענון שקט ברקע (כשיש cache)
  async function fetchCampaignsBackground() {
    try {
      const data = await fetchCampaignsFromServer();
      // עדכן state רק אם השתנה משהו
      if (data) {
        setCampaignOptions(prev => {
          const newStr = JSON.stringify(data.options);
          const oldStr = JSON.stringify(prev);
          return newStr !== oldStr ? data.options : prev;
        });
      }
    } catch (_) { /* ignore silent refresh errors */ }
  }

  // שליפה מהשרת + שמירה ל-cache
  async function fetchCampaignsFromServer() {
    const res = await fetch('/api/login/get-campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionStore.token })
    });
    const data = await res.json();

    if (data.success && data.campaignOptions) {
      const role = getRoleFromToken(sessionStore.token);
      setCampaignOptions(data.campaignOptions);
      setUserName(data.userName || '');
      setUserRole(role);

      // שמירה ל-cache
      try {
        localStorage.setItem('campaignOptionsCache', JSON.stringify({
          options: data.campaignOptions,
          userName: data.userName || '',
          role
        }));
      } catch (_) { /* ignore storage errors */ }

      if (data.clientId && !sessionStore.clientId) {
        sessionStore.setClientId(data.clientId);
      }
      return { options: data.campaignOptions };
    }
    return null;
  }

  function redirectByRole(campaignsOverride = []) {
    // בדיקה אם יש redirect מה-URL
    if (redirectAfterLogin) {
      router.push(redirectAfterLogin);
      setGlobalLoading(true);
      return;
    }
    
    const currentRole = userRole || getRoleFromToken(sessionStore.token);
    const hasCampaigns = campaignsOverride.length > 0;
    const next = getRedirectPathByRole(currentRole, { hasCampaigns });
    if (next) router.push(next);
    setGlobalLoading(true);
  }

  function updateToken(token, data) {
    sessionStore.setToken(token);
    sessionStore.setClientId(data.clientId || data.client_id);
    sessionStore.setCampaignId(data.campaignId || data.campaign_id);
    sessionStore.setFundraiserId(data.fundraiserId || data.fundraiser_id);
    const parsedRole = getRoleFromToken(token);
    setUserRole(parsedRole || 'fundraiser');
  }

  async function handleLoginSuccess(data) {
        console.log('🔐 handleLoginSuccess - data received:', data);
        
        // ניקוי מלא של כל הסטורים לפני התחברות חדשה
        sessionStore.logout();
        
        // שמירת הטוקן החדש
        if (data.token) {
          sessionStore.setToken(data.token);
          console.log('✅ Token saved, sessionStore.clientId:', sessionStore.clientId);
          
          // Set user role immediately from token
          const parsedRole = getRoleFromToken(data.token);
          setUserRole(parsedRole);
          console.log('✅ UserRole set:', parsedRole);
        }

        // שמירת נתוני המשתמש (client_id, campaign_id, fundraiser_id) אם קיימים
        if (data.clientId || data.client_id) {
          sessionStore.setClientId(data.clientId || data.client_id);
          console.log('✅ ClientId saved from data:', data.clientId || data.client_id);
        }
        if (data.campaignId || data.campaign_id) {
          sessionStore.setCampaignId(data.campaignId || data.campaign_id);
        }
        if (data.fundraiserId || data.fundraiser_id) {
          sessionStore.setFundraiserId(data.fundraiserId || data.fundraiser_id);
        }
        
        console.log('📊 Final sessionStore state:', {
          clientId: sessionStore.clientId,
          campaignId: sessionStore.campaignId,
          fundraiserId: sessionStore.fundraiserId
        });

    // שמירת clientId מהתשובה (אם קיים) - חשוב לפתיחת קמפיין חדש
    if (data.clientId || data.client_id) {
      const cid = data.clientId || data.client_id;
      if (!sessionStore.clientId) {
        sessionStore.setClientId(cid);
        console.log('✅ ClientId saved from response data:', cid);
      }
    }

    // אם יש campaignId מה-URL - נבחר אותו אוטומטית
    if (campaignIdFromUrl && data.campaignOptions) {

      const selectedOption = data.campaignOptions.find(
        opt => {
          return opt.campaignId === campaignIdFromUrl || opt.campaign_id === campaignIdFromUrl;
        }
      );

      if (selectedOption) {
        handleSelectCampaign(selectedOption);
        return;
      }
    }

    // בדיקה אם אין קמפיינים - נעביר לפי תפקיד
    if (!data.campaignOptions || data.campaignOptions.length === 0) {
      const role = data.role || getRoleFromToken(data.token);
      const redirectPath = getRedirectPathByRole(role, { hasCampaigns: false });
      if (redirectPath) {
        // המתנה קצרה כדי לוודא ש-localStorage מעודכן לפני הניווט
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push(`/${locale}${redirectPath}`);
        setGlobalLoading(true);
      }
      return;
    }

    setCampaignOptions(data.campaignOptions);
    setUserName(data.userName || "");
    // Role already set when token was saved
    setStep("selectCampaign");
  }

  async function handleSelectCampaign(option) {
      const authToken = sessionStore.token;

      const res = await fetch("/api/login/select-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: authToken, selectedOption: option }),
      });
      const data = await res.json();

      if (data.success) {
        // איפוס סטורים למניעת הצגת מידע ישן מתפקיד/קמפיין קודם
        rootStore.resetAllStores();
        
        sessionStore.setToken(data.token);
        if (data.data.campaign_id) {
          sessionStore.setCampaignId(data.data.campaign_id);
        }
        if (data.data.client_id) {
          sessionStore.setClientId(data.data.client_id);
        }
        if (data.data.fundraiser_id) {
          sessionStore.setFundraiserId(data.data.fundraiser_id);
        }
        if (data.data.operator_id) {
          sessionStore.setOperatorId(data.data.operator_id);
        }

        // המתנה קצרה כדי לוודא ש-localStorage מעודכן לפני הניווט
        await new Promise(resolve => setTimeout(resolve, 100));

        const redirectPath = getRedirectPathByRole(data.selectedRole, { hasCampaigns: true });        
        // אם יש redirect מה-URL - השתמש בו במקום
        if (redirectAfterLogin) {
          // redirect כבר מכיל את ה-locale prefix (למשל /he/donations?openDonation=123)
          const hasLocale = redirectAfterLogin.startsWith(`/${locale}/`) || redirectAfterLogin.startsWith(`/he/`) || redirectAfterLogin.startsWith(`/en/`);
          router.push(hasLocale ? redirectAfterLogin : `/${locale}${redirectAfterLogin}`);
        } else if (redirectPath) {
          router.push(`/${locale}${redirectPath}`);
        }
        
        setGlobalLoading(true);
      } else {
      throw new Error(data.error || "שגיאה בבחירת קמפיין");
    }
  }

  function handleForgotPassword(email) {
    setEmailForReset(email);
    setStep("resetPassword");
  }

  function handleBackToLogin() {
    setStep("login");
  }

  // פונקציה להתנתקות
  const handleLogout = () => {
    rootStore.resetAllStores();
    sessionStore.logout();
    try { localStorage.removeItem('campaignOptionsCache'); } catch (_) {}
    setStep("login");
    setCampaignOptions([]);
    setUserName("");
  };

  const isRTL = locale === 'he';

  // Loading state - show nothing while checking
  if (step === "loading") {
    return (
      <div className={styles.container}>
        <div className={styles.logo}><Logo /></div>
      </div>
    );
  }

  // If in campaign selection step, show layout with sidebar
  if (step === "selectCampaign") {
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';
    const isOperatorRole = userRole === 'operator';
    const showSidebar = isAdmin || isManager;
    
    // For fundraisers and operators - show campaign selection without sidebar
    if (!showSidebar) {
      return (
        <div className={styles.container} style={{ minHeight: '100vh', margin: 0, maxWidth: 'none', width: '100%', borderRadius: 0 }}>
          <LanguageFloatingButton />
          <div className={styles.logo}><Logo /></div>
          <CampaignSelection
            campaignOptions={campaignOptions}
            onSelectCampaign={handleSelectCampaign}
            userName={userName}
          />
        </div>
      );
    }
    
    // For admin/manager - show layout with sidebar
    return (
      <div className={`${styles.selectionLayoutWrapper} ${isRTL ? styles.rtl : ''}`}>
        <CampaignSelectionSidebar 
          onLogout={handleLogout}
          activeSection={activeSection}
          onSectionChange={(section) => setActiveSection(section)}
          isAdmin={isAdmin}
          isAdminOrManager={isAdmin || isManager}
        />
        <div className={styles.selectionMainContent}>
            <div className={styles.container} style={{ minHeight: '100vh', margin: 0, maxWidth: 'none', width: '100%', borderRadius: 0 }}>
              <LanguageFloatingButton />
              <div className={styles.logo}><Logo /></div>
              <CampaignSelection
                campaignOptions={campaignOptions}
                onSelectCampaign={handleSelectCampaign}
                userName={userName}
              />
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <LanguageFloatingButton />
      <div className={styles.logo}><Logo /></div>
      {step === "login" && (
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onForgotPassword={handleForgotPassword}
        />
      )}
      {step === "resetPassword" && (
        <ResetPassword
          onBack={handleBackToLogin}
          onSuccess={handleLoginSuccess}
          email={emailForReset}
        />
      )}
    </div>
  );
}
