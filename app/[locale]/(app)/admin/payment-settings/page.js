"use client";

import { useState, useEffect, useContext } from 'react';
import { AppContext } from '@/app/components/AppContext';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './payment-settings.module.scss';
import Button from '@/app/components/Button';

// System SVG icons
import CreditIcon from '@/app/icons/credit.svg';
import BitIcon from '@/app/icons/bit.svg';
import PaypalIcon from '@/app/icons/paypal.svg';
import BankTransferIcon from '@/app/icons/bank-transfer.svg';
import ChecksIcon from '@/app/icons/checks.svg';
import CashIcon from '@/app/icons/cash.svg';
import HokIcon from '@/app/icons/hok-new.svg';
import GooglePayIcon from '@/app/icons/google-pay.svg';
import ApplePayIcon from '@/app/icons/apple-pay.svg';
import PayboxIcon from '@/app/icons/paybox.svg';
import StripeIcon from '@/app/icons/stripe.svg';
import GiftIcon from '@/app/icons/gift.svg';
import WalletIcon from '@/app/icons/wallet.svg';
import NoteIcon from '@/app/icons/note.svg';
import SettingsIcon from '@/app/icons/settings.svg';
import LinkIcon from '@/app/icons/link.svg';

const METHOD_ICONS = {
    credit_card: CreditIcon,
    bit: BitIcon,
    paypal: PaypalIcon,
    bank_transfer: BankTransferIcon,
    check: ChecksIcon,
    cash: CashIcon,
    direct_debit: HokIcon,
    google_pay: GooglePayIcon,
    apple_pay: ApplePayIcon,
    paybox: PayboxIcon,
    stripe: StripeIcon,
    bevel: CreditIcon,
    pledger: GiftIcon,
    matbia: GiftIcon,
    ojc: WalletIcon,
    commitment: NoteIcon,
};

export default function PaymentSettingsPage() {
    const { campaignId } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
    // Payment methods with Hebrew names
    const paymentMethods = [
        { id: 'credit_card', name: 'כרטיס אשראי', description: 'בחר ספק לעיבוד תשלומי כרטיס אשראי' },
        { id: 'bit', name: 'Bit', description: 'תשלומים מהירים דרך אפליקציית Bit' },
        { id: 'paypal', name: 'PayPal', description: 'תשלומים בינלאומיים דרך PayPal' },
        { id: 'bank_transfer', name: 'העברה בנקאית', description: 'העברה ישירה לחשבון הבנק' },
        { id: 'check', name: 'צ\'ק', description: 'תשלום באמצעות צ\'ק בנקאי' },
        { id: 'cash', name: 'מזומן', description: 'תשלום במזומן' },
        { id: 'direct_debit', name: 'הוראת קבע', description: 'חיוב חודשי אוטומטי' },
        { id: 'google_pay', name: 'Google Pay', description: 'תשלומים דרך Google Pay' },
        { id: 'apple_pay', name: 'Apple Pay', description: 'תשלומים דרך Apple Pay' },
        { id: 'paybox', name: 'PayBox', description: 'מערכת תשלומים PayBox' },
        { id: 'stripe', name: 'Stripe', description: 'מעבד תשלומים Stripe' },
        { id: 'bevel', name: 'Bevel', description: 'מעבד תשלומים Bevel/USAePay' },
        { id: 'pledger', name: 'Pledger Charitable', description: 'מערכת תשלומים לעמותות ומוסדות' },
        { id: 'matbia', name: 'Matbia', description: 'מערכת תשלומים דיגיטלית לעמותות' },
        { id: 'ojc', name: 'OJC Charity Card', description: 'כרטיס צדקה דיגיטלי' },
        { id: 'commitment', name: 'התחייבות', description: 'רישום התחייבות לתרומה עתידית' },
    ];

    const [enabledMethods, setEnabledMethods] = useState({});
    const [creditCardProvider, setCreditCardProvider] = useState(''); // 'stripe' or 'bevel'
    const [stripeKeys, setStripeKeys] = useState({ publicKey: '', secretKey: '' });
    const [showStripeModal, setShowStripeModal] = useState(false);
    const [bevelKeys, setBevelKeys] = useState({ publicKey: '', apiKey: '', apiPin: '' });
    const [showBevelModal, setShowBevelModal] = useState(false);
    const [pledgerKeys, setPledgerKeys] = useState({ taxId: '', charityName: '' });
    const [showPledgerModal, setShowPledgerModal] = useState(false);
    const [matbiaKeys, setMatbiaKeys] = useState({ orgUserHandle: '', orgTaxId: '', orgName: '', orgEmail: '' });
    const [showMatbiaModal, setShowMatbiaModal] = useState(false);
    const [ojcKeys, setOjcKeys] = useState({ orgId: '' });
    const [showOjcModal, setShowOjcModal] = useState(false);
    const [nedarimPlusKeys, setNedarimPlusKeys] = useState({ mosad: '', apiValid: '', paymentType: 'Ragil', hkDay: 1 });
    const [showNedarimPlusModal, setShowNedarimPlusModal] = useState(false);
    
    // Donary Integration State
    const [donarySettings, setDonarySettings] = useState({
        enabled: false,
        apiKey: '',
        orgGuid: '',
        lastSyncAt: null
    });
    const [showDonaryModal, setShowDonaryModal] = useState(false);
    const [donaryTestStatus, setDonaryTestStatus] = useState(null); // null, 'testing', 'success', 'error'
    const [donarySyncStatus, setDonarySyncStatus] = useState(null); // null, 'syncing', 'success', 'error'
    const [donarySyncResults, setDonarySyncResults] = useState(null);
    const [donorCount, setDonorCount] = useState(0);

    useEffect(() => {
        if (campaignId) {
            fetchPaymentSettings();
        }
    }, [campaignId]);

    const fetchPaymentSettings = async () => {
        try {
            setIsLoading(true);
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/payment-settings`);
            if (response.ok) {
                const data = await response.json();
                // Initialize all methods as disabled by default
                const methods = {};
                paymentMethods.forEach(method => {
                    methods[method.id] = data.payment_methods?.[method.id] || false;
                });
                setEnabledMethods(methods);
                
                // Load credit card provider
                if (data.credit_card_provider) {
                    setCreditCardProvider(data.credit_card_provider);
                }
                
                // Load Stripe keys if they exist
                if (data.stripe_keys) {
                    setStripeKeys({
                        publicKey: data.stripe_keys.publicKey || '',
                        secretKey: data.stripe_keys.secretKey || ''
                    });
                }
                
                // Load Bevel keys if they exist
                if (data.bevel_public_key || data.bevel_api_key) {
                    setBevelKeys({
                        publicKey: data.bevel_public_key || '',
                        apiKey: data.bevel_api_key || '',
                        apiPin: data.bevel_api_pin || ''
                    });
                }
                
                // Load Pledger keys if they exist
                if (data.pledger_tax_id || data.pledger_charity_name) {
                    setPledgerKeys({
                        taxId: data.pledger_tax_id || '',
                        charityName: data.pledger_charity_name || ''
                    });
                }
                
                // Load Matbia keys if they exist
                if (data.matbia_org_user_handle || data.matbia_org_tax_id) {
                    setMatbiaKeys({
                        orgUserHandle: data.matbia_org_user_handle || '',
                        orgTaxId: data.matbia_org_tax_id || '',
                        orgName: data.matbia_org_name || '',
                        orgEmail: data.matbia_org_email || ''
                    });
                }
                
                // Load OJC keys if they exist
                if (data.ojc_org_id) {
                    setOjcKeys({
                        orgId: data.ojc_org_id || ''
                    });
                }
                
                // Load Nedarim Plus keys if they exist
                if (data.nedarim_plus_mosad || data.nedarim_plus_api_valid) {
                    setNedarimPlusKeys({
                        mosad: data.nedarim_plus_mosad || '',
                        apiValid: data.nedarim_plus_api_valid || '',
                        paymentType: data.nedarim_plus_payment_type || 'Ragil',
                        hkDay: data.nedarim_plus_hk_day || 1
                    });
                }
                
                // Load Donary settings if they exist
                if (data.donary_enabled || data.donary_api_key || data.donary_org_guid) {
                    setDonarySettings({
                        enabled: data.donary_enabled || false,
                        apiKey: data.donary_api_key || '',
                        orgGuid: data.donary_org_guid || '',
                        lastSyncAt: data.donary_last_sync_at || null
                    });
                    setDonorCount(data.donor_count || 0);
                }
            }
        } catch (error) {
            console.error('Error fetching payment settings:', error);
            setErrorMessage('שגיאה בטעינת הגדרות תשלום');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = (methodId) => {
        // כרטיס אשראי - לא מאפשרים toggle ישיר, צריך לבחור ספק
        if (methodId === 'credit_card') {
            return; // נטפל בזה בנפרד
        }
        
        if (methodId === 'stripe') {
            // If enabling Stripe, show modal for keys
            if (!enabledMethods[methodId]) {
                setShowStripeModal(true);
                return;
            } else {
                // If disabling, clear keys
                setStripeKeys({ publicKey: '', secretKey: '' });
            }
        }
        
        if (methodId === 'bevel') {
            // If enabling Bevel, show modal for keys
            if (!enabledMethods[methodId]) {
                setShowBevelModal(true);
                return;
            } else {
                // If disabling, clear keys
                setBevelKeys({ publicKey: '', apiKey: '', apiPin: '' });
            }
        }
        
        if (methodId === 'pledger') {
            // If enabling Pledger, show modal for keys
            if (!enabledMethods[methodId]) {
                setShowPledgerModal(true);
                return;
            } else {
                // If disabling, clear keys
                setPledgerKeys({ taxId: '', charityName: '' });
            }
        }
        
        if (methodId === 'matbia') {
            // If enabling Matbia, show modal for keys
            if (!enabledMethods[methodId]) {
                setShowMatbiaModal(true);
                return;
            } else {
                // If disabling, clear keys
                setMatbiaKeys({ orgUserHandle: '', orgTaxId: '', orgName: '', orgEmail: '' });
            }
        }
        
        if (methodId === 'ojc') {
            // If enabling OJC, show modal for keys
            if (!enabledMethods[methodId]) {
                setShowOjcModal(true);
                return;
            } else {
                // If disabling, clear keys
                setOjcKeys({ orgId: '', apiKey: '' });
            }
        }
        
        if (methodId === 'nedarim_plus') {
            // If enabling Nedarim Plus, show modal for keys
            if (!enabledMethods[methodId]) {
                setShowNedarimPlusModal(true);
                return;
            } else {
                // If disabling, clear keys
                setNedarimPlusKeys({ mosad: '', apiValid: '' });
            }
        }
        
        setEnabledMethods(prev => ({
            ...prev,
            [methodId]: !prev[methodId]
        }));
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            setErrorMessage('');
            setSuccessMessage('');

            const requestBody = {
                payment_methods: enabledMethods,
                credit_card_provider: creditCardProvider
            };
            
            // Include Stripe keys if Stripe is the credit card provider
            if (creditCardProvider === 'stripe' && stripeKeys.publicKey && stripeKeys.secretKey) {
                requestBody.stripe_keys = stripeKeys;
            }
            
            // Include Bevel keys if Bevel is the credit card provider
            if (creditCardProvider === 'bevel' && bevelKeys.publicKey && bevelKeys.apiKey) {
                requestBody.bevel_public_key = bevelKeys.publicKey;
                requestBody.bevel_api_key = bevelKeys.apiKey;
                requestBody.bevel_api_pin = bevelKeys.apiPin || '';
            }
            
            // Include Nedarim Plus keys if Nedarim Plus is the credit card provider
            if (creditCardProvider === 'nedarim_plus' && nedarimPlusKeys.mosad) {
                requestBody.nedarim_plus_mosad = nedarimPlusKeys.mosad || '';
                requestBody.nedarim_plus_api_valid = nedarimPlusKeys.apiValid || '';
                requestBody.nedarim_plus_payment_type = nedarimPlusKeys.paymentType || 'Ragil';
                requestBody.nedarim_plus_hk_day = nedarimPlusKeys.hkDay || 1;
            }
            
            // Include Pledger keys if Pledger is enabled
            if (enabledMethods.pledger && pledgerKeys.taxId && pledgerKeys.charityName) {
                requestBody.pledger_tax_id = pledgerKeys.taxId;
                requestBody.pledger_charity_name = pledgerKeys.charityName;
            }
            
            // Include Matbia keys if Matbia is enabled
            if (enabledMethods.matbia) {
                requestBody.matbia_org_user_handle = matbiaKeys.orgUserHandle || '';
                requestBody.matbia_org_tax_id = matbiaKeys.orgTaxId || '';
                requestBody.matbia_org_name = matbiaKeys.orgName || '';
                requestBody.matbia_org_email = matbiaKeys.orgEmail || '';
            }
            
            // Include OJC keys if OJC is enabled
            if (enabledMethods.ojc) {
                requestBody.ojc_org_id = ojcKeys.orgId || '';
            }
            
            // Include Donary settings
            requestBody.donary_enabled = donarySettings.enabled;
            if (donarySettings.apiKey) {
                requestBody.donary_api_key = donarySettings.apiKey;
            }
            if (donarySettings.orgGuid) {
                requestBody.donary_org_guid = donarySettings.orgGuid;
            }
            
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/payment-settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (response.ok) {
                setSuccessMessage('הגדרות התשלום נשמרו בהצלחה!');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                throw new Error('Failed to save payment settings');
            }
        } catch (error) {
            console.error('Error saving payment settings:', error);
            setErrorMessage('שגיאה בשמירת הגדרות תשלום');
        } finally {
            setIsSaving(false);
        }
    };

    const handleStripeKeySave = () => {
        if (stripeKeys.publicKey.trim() && stripeKeys.secretKey.trim()) {
            setEnabledMethods(prev => ({
                ...prev,
                stripe: true
            }));
            setShowStripeModal(false);
        } else {
            setErrorMessage('יש למלא את שני המפתחות של Stripe');
        }
    };

    const handleStripeModalCancel = () => {
        setShowStripeModal(false);
        setStripeKeys({ publicKey: '', secretKey: '' });
    };

    const handleBevelKeySave = () => {
        if (bevelKeys.publicKey.trim() && bevelKeys.apiKey.trim()) {
            setEnabledMethods(prev => ({
                ...prev,
                bevel: true
            }));
            setShowBevelModal(false);
        } else {
            setErrorMessage('יש למלא את שני המפתחות של Bevel');
        }
    };

    const handleBevelModalCancel = () => {
        setShowBevelModal(false);
        setBevelKeys({ publicKey: '', apiKey: '' });
    };

    // Donary functions
    const handleDonaryTest = async () => {
        if (!donarySettings.apiKey || !donarySettings.orgGuid) {
            setErrorMessage('יש להזין API Key ו-Org GUID לפני בדיקת החיבור');
            return;
        }
        
        setDonaryTestStatus('testing');
        try {
            const response = await fetchWithAuth('/api/donary/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: donarySettings.apiKey,
                    orgGuid: donarySettings.orgGuid
                })
            });
            
            const data = await response.json();
            if (data.success) {
                setDonaryTestStatus('success');
                setSuccessMessage('החיבור ל-Donary הצליח!');
                setTimeout(() => setDonaryTestStatus(null), 3000);
            } else {
                setDonaryTestStatus('error');
                setErrorMessage(data.message || 'החיבור ל-Donary נכשל');
            }
        } catch (error) {
            setDonaryTestStatus('error');
            setErrorMessage('שגיאה בבדיקת החיבור ל-Donary');
        }
    };

    const handleDonarySync = async () => {
        if (!donarySettings.apiKey || !donarySettings.orgGuid) {
            setErrorMessage('יש להגדיר את Donary לפני סנכרון');
            return;
        }
        
        if (!confirm(`האם לסנכרן ${donorCount} תורמים ל-Donary? פעולה זו עשויה לקחת מספר דקות.`)) {
            return;
        }
        
        setDonarySyncStatus('syncing');
        setDonarySyncResults(null);
        
        try {
            const response = await fetchWithAuth('/api/donary/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            if (data.success) {
                setDonarySyncStatus('success');
                setDonarySyncResults(data.results);
                setSuccessMessage(`הסנכרון הושלם! ${data.results.success} תורמים סונכרנו בהצלחה`);
                setDonarySettings(prev => ({ ...prev, lastSyncAt: new Date().toISOString() }));
            } else {
                setDonarySyncStatus('error');
                setErrorMessage(data.message || 'הסנכרון נכשל');
            }
        } catch (error) {
            setDonarySyncStatus('error');
            setErrorMessage('שגיאה בסנכרון ל-Donary');
        }
    };

    const handleDonarySave = () => {
        if (donarySettings.apiKey && donarySettings.orgGuid) {
            setDonarySettings(prev => ({ ...prev, enabled: true }));
            setShowDonaryModal(false);
            setSuccessMessage('הגדרות Donary נשמרו. לחץ על "שמור הגדרות" כדי לשמור את השינויים.');
        } else {
            setErrorMessage('יש להזין API Key ו-Org GUID');
        }
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>טוען...</div>
            </div>
        );
    }

    if (!campaignId) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>יש לבחור קמפיין כדי לנהל הגדרות תשלום</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <h1>הגדרות תשלום</h1>
                <p className={styles.subtitle}>בחר את אמצעי התשלום הזמינים עבור הקמפיין</p>

                {successMessage && (
                    <div className={styles.successMessage}>
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div className={styles.errorMessage}>
                        {errorMessage}
                    </div>
                )}
                <div className={styles.paymentMethodsList}>
                    {paymentMethods.map(method => {
                        // כרטיס אשראי - תצוגה מיוחדת עם בחירת ספק
                        if (method.id === 'credit_card') {
                            return (
                                <div key={method.id} className={styles.paymentMethodItem}>
                                    <div className={styles.methodHeader}>
                                        <div className={styles.methodInfo}>
                                            {(() => { const Icon = METHOD_ICONS[method.id] || WalletIcon; return <span className={styles.methodIconWrapper}><Icon /></span>; })()}
                                            <div className={styles.methodDetails}>
                                                <h3>{method.name}</h3>
                                                <p>בחר ספק לעיבוד תשלומי כרטיס אשראי</p>
                                            </div>
                                        </div>
                                        <div className={styles.methodControl}>
                                            {creditCardProvider && (
                                                <button
                                                    className={styles.inlineSettingsBtn}
                                                    title="הגדרות"
                                                    onClick={() => {
                                                        if (creditCardProvider === 'stripe') setShowStripeModal(true);
                                                        else if (creditCardProvider === 'bevel') setShowBevelModal(true);
                                                        else if (creditCardProvider === 'nedarim_plus') setShowNedarimPlusModal(true);
                                                    }}
                                                >
                                                    <SettingsIcon className={styles.inlineSettingsIcon} style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }} />
                                                </button>
                                            )}
                                            <select
                                                value={creditCardProvider}
                                                onChange={(e) => {
                                                    const provider = e.target.value;
                                                    setCreditCardProvider(provider);
                                                    if (provider) {
                                                        setEnabledMethods(prev => ({ ...prev, credit_card: true }));
                                                        if (provider === 'stripe' && !stripeKeys.publicKey) {
                                                            setShowStripeModal(true);
                                                        } else if (provider === 'bevel' && !bevelKeys.publicKey) {
                                                            setShowBevelModal(true);
                                                        } else if (provider === 'nedarim_plus' && !nedarimPlusKeys.mosad) {
                                                            setShowNedarimPlusModal(true);
                                                        }
                                                    } else {
                                                        setEnabledMethods(prev => ({ ...prev, credit_card: false }));
                                                    }
                                                }}
                                                className={styles.providerDropdown}
                                            >
                                                <option value="">כבוי - לא מופעל</option>
                                                <option value="stripe">Stripe</option>
                                                <option value="bevel">Bevel / USAePay</option>
                                                <option value="nedarim_plus">נדרים פלוס</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        
                        // שאר אמצעי התשלום - הצגה רגילה אבל מסתירים Stripe, Bevel ונדרים פלוס
                        if (method.id === 'stripe' || method.id === 'bevel' || method.id === 'nedarim_plus') {
                            return null; // מוסתרים כי מוצגים בתוך כרטיס אשראי
                        }
                        
                        // Pledger - תצוגה מיוחדת עם כפתור הגדרות
                        if (method.id === 'pledger') {
                            return (
                                <div key={method.id} className={styles.paymentMethodItem}>
                                    <div className={styles.methodHeader}>
                                        <div className={styles.methodInfo}>
                                            {(() => { const Icon = METHOD_ICONS[method.id] || WalletIcon; return <span className={styles.methodIconWrapper}><Icon /></span>; })()}
                                            <div className={styles.methodDetails}>
                                                <h3>{method.name}</h3>
                                                <p>מערכת תשלומים לעמותות ומוסדות</p>
                                            </div>
                                        </div>
                                        <div className={styles.methodControl}>
                                            {enabledMethods[method.id] && (
                                                <button
                                                    className={styles.inlineSettingsBtn}
                                                    onClick={() => setShowPledgerModal(true)}
                                                    title="הגדרות"
                                                >
                                                    <SettingsIcon className={styles.inlineSettingsIcon} style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }} />
                                                </button>
                                            )}
                                            <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={enabledMethods[method.id] || false}
                                                    onChange={() => handleToggle(method.id)}
                                                />
                                                <span className={styles.slider}></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        
                        // Matbia - תצוגה מיוחדת עם כפתור הגדרות
                        if (method.id === 'matbia') {
                            return (
                                <div key={method.id} className={styles.paymentMethodItem}>
                                    <div className={styles.methodHeader}>
                                        <div className={styles.methodInfo}>
                                            {(() => { const Icon = METHOD_ICONS[method.id] || WalletIcon; return <span className={styles.methodIconWrapper}><Icon /></span>; })()}
                                            <div className={styles.methodDetails}>
                                                <h3>{method.name}</h3>
                                                <p>מערכת תשלומים דיגיטלית לעמותות</p>
                                            </div>
                                        </div>
                                        <div className={styles.methodControl}>
                                            {enabledMethods[method.id] && (
                                                <button
                                                    className={styles.inlineSettingsBtn}
                                                    onClick={() => setShowMatbiaModal(true)}
                                                    title="הגדרות"
                                                >
                                                    <SettingsIcon className={styles.inlineSettingsIcon} style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }} />
                                                </button>
                                            )}
                                            <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={enabledMethods[method.id] || false}
                                                    onChange={() => handleToggle(method.id)}
                                                />
                                                <span className={styles.slider}></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        
                        // OJC - תצוגה מיוחדת עם כפתור הגדרות
                        if (method.id === 'ojc') {
                            return (
                                <div key={method.id} className={styles.paymentMethodItem}>
                                    <div className={styles.methodHeader}>
                                        <div className={styles.methodInfo}>
                                            {(() => { const Icon = METHOD_ICONS[method.id] || WalletIcon; return <span className={styles.methodIconWrapper}><Icon /></span>; })()}
                                            <div className={styles.methodDetails}>
                                                <h3>{method.name}</h3>
                                                <p>כרטיס צדקה דיגיטלי</p>
                                            </div>
                                        </div>
                                        <div className={styles.methodControl}>
                                            {enabledMethods[method.id] && (
                                                <button
                                                    className={styles.inlineSettingsBtn}
                                                    onClick={() => setShowOjcModal(true)}
                                                    title="הגדרות"
                                                >
                                                    <SettingsIcon className={styles.inlineSettingsIcon} style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }} />
                                                </button>
                                            )}
                                            <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={enabledMethods[method.id] || false}
                                                    onChange={() => handleToggle(method.id)}
                                                />
                                                <span className={styles.slider}></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        
                        return (
                            <div key={method.id} className={styles.paymentMethodItem}>
                                <div className={styles.methodHeader}>
                                    <div className={styles.methodInfo}>
                                        {(() => { const Icon = METHOD_ICONS[method.id] || WalletIcon; return <span className={styles.methodIconWrapper}><Icon /></span>; })()}
                                        <div className={styles.methodDetails}>
                                            <h3>{method.name}</h3>
                                            {method.description && <p>{method.description}</p>}
                                        </div>
                                    </div>
                                    <div className={styles.methodControl}>
                                        <label className={styles.switch}>
                                            <input
                                                type="checkbox"
                                                checked={enabledMethods[method.id] || false}
                                                onChange={() => handleToggle(method.id)}
                                            />
                                            <span className={styles.slider}></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={styles.actions}>
                    <Button
                        text={isSaving ? 'שומר...' : 'שמור הגדרות'}
                        onClick={handleSave}
                        disabled={isSaving}
                        primary
                    />
                </div>

                <div className={styles.note}>
                    <strong>שים לב:</strong> רק אמצעי תשלום מופעלים יוצגו למשתמשים בדף התרומות
                </div>
                
                {/* Donary Integration Section */}
                <div className={styles.donarySection}>
                    <div className={styles.donaryHeader}>
                        <div className={styles.donaryTitle}>
                            <LinkIcon className={styles.donaryIcon} />
                            <div>
                                <h3>Donary</h3>
                                <span className={donarySettings.enabled ? styles.statusBadgeActive : styles.statusBadgeInactive}>
                                    {donarySettings.enabled ? 'מחובר' : 'לא פעיל'}
                                </span>
                            </div>
                        </div>
                        <button
                            className={styles.donarySettingsBtn}
                            onClick={() => setShowDonaryModal(true)}
                            title="הגדרות Donary"
                        >
                            <SettingsIcon style={{ width: '16px', height: '16px' }} />
                        </button>
                    </div>
                    
                    {donarySettings.enabled && (
                        <div className={styles.donaryContent}>
                            <div className={styles.donaryQuickActions}>
                                {donarySettings.apiKey && donarySettings.orgGuid && (
                                    <>
                                        <button
                                            className={`${styles.donaryBtn} ${donaryTestStatus === 'success' ? styles.success : donaryTestStatus === 'error' ? styles.error : ''}`}
                                            onClick={handleDonaryTest}
                                            disabled={donaryTestStatus === 'testing'}
                                        >
                                            {donaryTestStatus === 'testing' ? 'בודק...' :
                                             donaryTestStatus === 'success' ? 'בדיקה הצליחה' :
                                             donaryTestStatus === 'error' ? 'בדיקה נכשלה' : 'בדיקת חיבור'}
                                        </button>
                                        
                                        <button
                                            className={styles.donaryBtn}
                                            onClick={handleDonarySync}
                                            disabled={donarySyncStatus === 'syncing'}
                                        >
                                            {donarySyncStatus === 'syncing' ? 'מסנכרן...' : `סנכרון (${donorCount})`}
                                        </button>
                                        
                                        <button
                                            className={styles.donaryBtn}
                                            onClick={async () => {
                                                try {
                                                    const response = await fetchWithAuth(`/api/campaigns/${campaignId}/donary/export-donors`);
                                                    const blob = await response.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `donary-donors-campaign-${campaignId}.csv`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    window.URL.revokeObjectURL(url);
                                                    document.body.removeChild(a);
                                                } catch (error) {
                                                    console.error('Export error:', error);
                                                    alert('שגיאה בהורדת הקובץ');
                                                }
                                            }}
                                            title="הורד Excel בפורמט Donary עם person.id"
                                        >
                                            ייצוא Excel
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            {donarySyncResults && (
                                <div className={styles.syncResultsCompact}>
                                    הצלחה: {donarySyncResults.success} | כישלון: {donarySyncResults.failed}
                                </div>
                            )}
                            
                            <details className={styles.webhookDetails}>
                                <summary>Webhook URLs</summary>
                                <div className={styles.webhookUrlsCompact}>
                                    <code>charge/{campaignId}</code>
                                    <code>schedule/{campaignId}</code>
                                    <button 
                                        className={styles.copyBtn}
                                        onClick={() => {
                                            const baseUrl = window.location.origin;
                                            const urls = `Payment: ${baseUrl}/api/webhooks/donary/charge/${campaignId}\nSchedule: ${baseUrl}/api/webhooks/donary/schedule/${campaignId}`;
                                            navigator.clipboard.writeText(urls);
                                        }}
                                        title="העתק"
                                    >
                                        העתק
                                    </button>
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            </div>

            {/* Stripe Modal */}
            {showStripeModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>הגדרת מפתחות Stripe</h3>
                        <p>כדי להפעיל את Stripe, יש להזין את המפתחות מחשבון Stripe שלכם:</p>
                        
                        <div className={styles.formGroup}>
                            <label>מפתח ציבורי (Publishable Key):</label>
                            <input
                                type="text"
                                value={stripeKeys.publicKey}
                                onChange={(e) => setStripeKeys(prev => ({ ...prev, publicKey: e.target.value }))}
                                placeholder="pk_live_..."
                                className={styles.input}
                            />
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>מפתח סודי (Secret Key):</label>
                            <input
                                type="password"
                                value={stripeKeys.secretKey}
                                onChange={(e) => setStripeKeys(prev => ({ ...prev, secretKey: e.target.value }))}
                                placeholder="sk_live_..."
                                className={styles.input}
                            />
                        </div>
                        
                        <div className={styles.modalActions}>
                            <button onClick={handleStripeKeySave} className={styles.saveButton}>
                                שמור והפעל
                            </button>
                            <button onClick={handleStripeModalCancel} className={styles.cancelButton}>
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Bevel Modal */}
            {showBevelModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>הגדרת מפתחות Bevel</h3>
                        <p>כדי להפעיל את Bevel, יש להזין את שני המפתחות מחשבון Bevel/USAePay שלכם:</p>
                        
                        <div className={styles.formGroup}>
                            <label>Public API Key (מתחיל ב-_P או _M):</label>
                            <input
                                type="text"
                                value={bevelKeys.publicKey}
                                onChange={(e) => setBevelKeys(prev => ({ ...prev, publicKey: e.target.value }))}
                                placeholder="_P..."
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                משמש ליצירת טוקן בצד הלקוח (tokenization)
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>Regular API Key:</label>
                            <input
                                type="text"
                                value={bevelKeys.apiKey}
                                onChange={(e) => setBevelKeys(prev => ({ ...prev, apiKey: e.target.value }))}
                                placeholder="הזן את מפתח ה-API הרגיל"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                משמש לעיבוד התשלום בצד השרת
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>PIN (אופציונלי):</label>
                            <input
                                type="text"
                                value={bevelKeys.apiPin}
                                onChange={(e) => setBevelKeys(prev => ({ ...prev, apiPin: e.target.value }))}
                                placeholder="הזן PIN אם נדרש"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                נדרש רק אם הגדרת PIN ב-USAePay Dashboard
                            </small>
                        </div>
                        
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={handleBevelModalCancel}
                            >
                                ביטול
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={handleBevelKeySave}
                            >
                                שמור
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Pledger Modal */}
            {showPledgerModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>הגדרת Pledger Charitable</h3>
                        <p>כדי להפעיל את Pledger, יש להזין את פרטי החשבון מ-Pledger Charitable:</p>
                        
                        <div className={styles.formGroup}>
                            <label>Tax ID:</label>
                            <input
                                type="text"
                                value={pledgerKeys.taxId}
                                onChange={(e) => setPledgerKeys(prev => ({ ...prev, taxId: e.target.value }))}
                                placeholder="113456789"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                מספר תעודת ההכר של העמותה
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>Charity Name:</label>
                            <input
                                type="text"
                                value={pledgerKeys.charityName}
                                onChange={(e) => setPledgerKeys(prev => ({ ...prev, charityName: e.target.value }))}
                                placeholder="ABC Charity"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                שם העמותה כפי שמופיע ב-Pledger
                            </small>
                        </div>
                        
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => {
                                    setShowPledgerModal(false);
                                    if (!pledgerKeys.taxId || !pledgerKeys.charityName) {
                                        setEnabledMethods(prev => ({ ...prev, pledger: false }));
                                    }
                                }}
                            >
                                ביטול
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={() => {
                                    if (pledgerKeys.taxId && pledgerKeys.charityName) {
                                        setEnabledMethods(prev => ({ ...prev, pledger: true }));
                                        setShowPledgerModal(false);
                                    } else {
                                        alert('נא להזין את כל השדות הנדרשים');
                                    }
                                }}
                            >
                                שמור
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Matbia Modal */}
            {showMatbiaModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>הגדרת Matbia</h3>
                        <p>כדי להפעיל את Matbia, יש להזין את פרטי הארגון:</p>
                        
                        <div className={styles.formGroup}>
                            <label>Org User Handle (API Key):</label>
                            <input
                                type="text"
                                value={matbiaKeys.orgUserHandle}
                                onChange={(e) => setMatbiaKeys(prev => ({ ...prev, orgUserHandle: e.target.value }))}
                                placeholder="e542199755e04395b6a5c5bafb7c40be"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                ה-API Key מעמוד הפרופיל של הארגון ב-Matbia
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>Organization Tax ID:</label>
                            <input
                                type="text"
                                value={matbiaKeys.orgTaxId}
                                onChange={(e) => setMatbiaKeys(prev => ({ ...prev, orgTaxId: e.target.value }))}
                                placeholder="112233448"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                מספר מזהה מס של הארגון
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>Organization Name:</label>
                            <input
                                type="text"
                                value={matbiaKeys.orgName}
                                onChange={(e) => setMatbiaKeys(prev => ({ ...prev, orgName: e.target.value }))}
                                placeholder="ABC Charity"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                שם הארגון כפי שמופיע ב-Matbia
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>Organization Email:</label>
                            <input
                                type="email"
                                value={matbiaKeys.orgEmail}
                                onChange={(e) => setMatbiaKeys(prev => ({ ...prev, orgEmail: e.target.value }))}
                                placeholder="org@example.com"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                כתובת האימייל של הארגון
                            </small>
                        </div>
                        
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => {
                                    setShowMatbiaModal(false);
                                    const hasOrgUserHandle = !!matbiaKeys.orgUserHandle;
                                    const hasOrgDetails = matbiaKeys.orgTaxId && matbiaKeys.orgName && matbiaKeys.orgEmail;
                                    if (!hasOrgUserHandle && !hasOrgDetails) {
                                        setEnabledMethods(prev => ({ ...prev, matbia: false }));
                                    }
                                }}
                            >
                                ביטול
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={() => {
                                    const hasOrgUserHandle = !!matbiaKeys.orgUserHandle;
                                    const hasOrgDetails = matbiaKeys.orgTaxId && matbiaKeys.orgName && matbiaKeys.orgEmail;
                                    if (hasOrgUserHandle || hasOrgDetails) {
                                        setEnabledMethods(prev => ({ ...prev, matbia: true }));
                                        setShowMatbiaModal(false);
                                    } else {
                                        alert('יש למלא את orgUserHandle או את כל פרטי הארגון (Tax ID, Name, Email)');
                                    }
                                }}
                            >
                                שמור
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* OJC Modal */}
            {showOjcModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>הגדרת OJC Charity Card</h3>
                        <p>כדי להפעיל את OJC Charity Card, יש להזין את מזהה הארגון:</p>
                        
                        <div className={styles.formGroup}>
                            <label>Organization ID:</label>
                            <input
                                type="text"
                                value={ojcKeys.orgId}
                                onChange={(e) => setOjcKeys(prev => ({ ...prev, orgId: e.target.value }))}
                                placeholder="2182"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                מזהה הארגון שלכם במערכת OJC Fund (ניתן לקבל מ-OJC)
                            </small>
                        </div>
                        
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => {
                                    setShowOjcModal(false);
                                    if (!ojcKeys.orgId) {
                                        setEnabledMethods(prev => ({ ...prev, ojc: false }));
                                    }
                                }}
                            >
                                ביטול
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={() => {
                                    if (ojcKeys.orgId) {
                                        setEnabledMethods(prev => ({ ...prev, ojc: true }));
                                        setShowOjcModal(false);
                                    } else {
                                        alert('יש למלא את Organization ID');
                                    }
                                }}
                            >
                                שמור
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Nedarim Plus Modal */}
            {showNedarimPlusModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>הגדרת נדרים פלוס</h3>
                        <p>כדי להפעיל את נדרים פלוס, יש להזין את פרטי המוסד:</p>
                        
                        <div className={styles.formGroup}>
                            <label>מזהה מוסד (Mosad):</label>
                            <input
                                type="text"
                                value={nedarimPlusKeys.mosad}
                                onChange={(e) => setNedarimPlusKeys(prev => ({ ...prev, mosad: e.target.value }))}
                                placeholder="1234567"
                                className={styles.input}
                                maxLength={7}
                            />
                            <small className={styles.helpText}>
                                מזהה מוסד בנדרים פלוס (7 ספרות)
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>טקסט אימות (ApiValid):</label>
                            <input
                                type="text"
                                value={nedarimPlusKeys.apiValid}
                                onChange={(e) => setNedarimPlusKeys(prev => ({ ...prev, apiValid: e.target.value }))}
                                placeholder="הזן את טקסט האימות שקיבלת מנדרים פלוס"
                                className={styles.input}
                                maxLength={10}
                            />
                            <small className={styles.helpText}>
                                טקסט אימות (עד 10 תווים) - ניתן לבקש מהמשרד של נדרים פלוס
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>סוג תשלום:</label>
                            <select
                                value={nedarimPlusKeys.paymentType}
                                onChange={(e) => setNedarimPlusKeys(prev => ({ ...prev, paymentType: e.target.value }))}
                                className={styles.input}
                            >
                                <option value="Ragil">רגיל - תשלומים (סכום כולל מחולק לתשלומים)</option>
                                <option value="HK">הו"ק - הוראת קבע (חיוב חודשי קבוע)</option>
                            </select>
                            <small className={styles.helpText}>
                                רגיל: חיוב הסכום הכולל וחלוקתו לתשלומים | הו"ק: חיוב חודשי קבוע
                            </small>
                        </div>
                        
                        {nedarimPlusKeys.paymentType === 'HK' && (
                            <div className={styles.formGroup}>
                                <label>יום חיוב בחודש:</label>
                                <select
                                    value={nedarimPlusKeys.hkDay}
                                    onChange={(e) => setNedarimPlusKeys(prev => ({ ...prev, hkDay: parseInt(e.target.value) }))}
                                    className={styles.input}
                                >
                                    {[...Array(28)].map((_, i) => (
                                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                                    ))}
                                </select>
                                <small className={styles.helpText}>
                                    באיזה יום בחודש לחייב את הכרטיס (1-28)
                                </small>
                            </div>
                        )}
                        
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => {
                                    setShowNedarimPlusModal(false);
                                    if (!nedarimPlusKeys.mosad || !nedarimPlusKeys.apiValid) {
                                        setEnabledMethods(prev => ({ ...prev, nedarim_plus: false }));
                                    }
                                }}
                            >
                                ביטול
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={() => {
                                    if (nedarimPlusKeys.mosad && nedarimPlusKeys.apiValid) {
                                        setEnabledMethods(prev => ({ ...prev, nedarim_plus: true }));
                                        setShowNedarimPlusModal(false);
                                    } else {
                                        alert('יש למלא את מזהה המוסד וטקסט האימות');
                                    }
                                }}
                            >
                                שמור
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Donary Modal */}
            {showDonaryModal && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>הגדרת Donary</h3>
                        <p>כדי לחבר את הקמפיין ל-Donary, יש להזין את פרטי החיבור:</p>
                        
                        <div className={styles.formGroup}>
                            <label>API Key:</label>
                            <input
                                type="text"
                                value={donarySettings.apiKey}
                                onChange={(e) => setDonarySettings(prev => ({ ...prev, apiKey: e.target.value }))}
                                placeholder="הזן את ה-API Key שקיבלת מ-Donary"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                ניתן לקבל מצוות האינטגרציות של Donary: integrations@donary.com
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label>Organization GUID:</label>
                            <input
                                type="text"
                                value={donarySettings.orgGuid}
                                onChange={(e) => setDonarySettings(prev => ({ ...prev, orgGuid: e.target.value }))}
                                placeholder="115e9d3d-baf2-4089-b896-9b2621ffcf1b"
                                className={styles.input}
                            />
                            <small className={styles.helpText}>
                                מזהה הארגון הייחודי שלכם ב-Donary (GUID)
                            </small>
                        </div>
                        
                        <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={donarySettings.enabled}
                                    onChange={(e) => setDonarySettings(prev => ({ ...prev, enabled: e.target.checked }))}
                                />
                                <span>הפעל סנכרון אוטומטי</span>
                            </label>
                            <small className={styles.helpText}>
                                כאשר מופעל, תורמים חדשים יסונכרנו אוטומטית ל-Donary
                            </small>
                        </div>
                        
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => setShowDonaryModal(false)}
                            >
                                ביטול
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={handleDonarySave}
                            >
                                שמור
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

