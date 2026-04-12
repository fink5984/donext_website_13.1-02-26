import { useState } from 'react';
import { FiEye, FiEyeOff } from "react-icons/fi";
import {  useGoogleLogin } from '@react-oauth/google';
import { useTranslations } from 'next-intl';
import Button from '@/app/components/Button';
import Input from '@/app/components/Input';
import styles from './login.module.scss';
import PhoneIcon from '@/app/icons/mobile.svg';
import EmailIcon from '@/app/icons/mailMini.svg';
import GoogleIcon from '@/app/icons/google.svg';
// פונקציות וולידציה
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhoneNumber(phone) {
  // טלפון בישראל: 9-10 ספרות, עשוי להתחיל ב-0, +972, או רק ספרות
  const phoneRegex = /^(?:(?:\+972|0)\d{1,2}\d{6,8}|\d{9,10})$/;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 9 && digitsOnly.length <= 10 && phoneRegex.test(phone);
}

export function LoginForm({ onLoginSuccess, onForgotPassword }) {
  const t = useTranslations('login');
  const [activeTab, setActiveTab] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // OTP states
  const [otpMethod, setOtpMethod] = useState("email");
  const [otpContact, setOtpContact] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", ""]);
  const [verifiedFields, setVerifiedFields] = useState([false, false, false, false]);
  const [isVerifying, setIsVerifying] = useState(false);

  // Validation states
  const [showValidation, setShowValidation] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  function handleGoogleCredential(credential) {
    setIsGoogleLoading(true);
    setMessage('');
    fetch("/api/login/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }), // <-- זה בדיוק מה שהשרת שלך מצפה לו
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          onLoginSuccess(data);
        } else {
          setValidationError(data.error || '*שגיאה בהתחברות עם Google');
          setShowValidation(true);
        }
      })
      .catch(() => {
        setValidationError('*שגיאה בהתחברות עם Google');
        setShowValidation(true);
      })
      .finally(() => setIsGoogleLoading(false));
  }

  // פונקציה להתחברות עם מייל וסיסמה
  async function handleLogin(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!email || !isValidEmail(email)) {
      setValidationError('*המייל הזה לא תקין');
      setShowValidation(true);
      return;
    }
    if (!password) {
      setValidationError('*הסיסמה לא נכונה');
      setShowValidation(true);
      return;
    }
    setIsLoading(true);
    setMessage('');

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        onLoginSuccess(data);
      } else {
        const errorMsg = data.error?.message || data.error || t('loginError');
        if (errorMsg.includes('משתמש לא נמצא') || errorMsg.includes('לא קיים') || errorMsg.includes('not found')) {
          setValidationError(t('invalidEmail'));
        } else if (errorMsg.includes('סיסמה') || errorMsg.includes('שגויים') || errorMsg.includes('password')) {
          setValidationError(t('incorrectPassword'));
        } else {
          setValidationError('*' + errorMsg);
        }
        setShowValidation(true);
      }
    } catch (error) {
      setValidationError(t('loginError'));
      setShowValidation(true);
    } finally {
      setIsLoading(false);
    }
  }

  // פונקציה לשליחת קוד OTP
  async function handleSendOtp(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!otpContact) {
      setValidationError(otpMethod === "phone" ? t('invalidPhone') : t('invalidEmail'));
      setShowValidation(true);
      return;
    }

    // וולידציה של פורמט
    if (otpMethod === "phone") {
      if (!isValidPhoneNumber(otpContact)) {
        setValidationError(t('invalidPhone'));
        setShowValidation(true);
        return;
      }
    } else {
      if (!isValidEmail(otpContact)) {
        setValidationError(t('invalidEmail'));
        setShowValidation(true);
        return;
      }
    }

    setShowValidation(false);
    setIsLoading(true);

    try {
      const res = await fetch("/api/login/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: otpContact, method: otpMethod }),
      });
      const data = await res.json();

      if (data.success) {
        setOtpSent(true);
      } else {
        const errorMsg = data.error?.message || data.error || t('loginError');
        if (errorMsg.includes('משתמש לא נמצא') || errorMsg.includes('לא קיים') || errorMsg.includes('not found')) {
          setValidationError(otpMethod === "phone" ? t('invalidPhone') : t('invalidEmail'));
        } else if (errorMsg.includes('SMS') || errorMsg.includes('לא מיושמת')) {
          setValidationError('*SMS not available yet, please use email');
        } else {
          setValidationError('*' + errorMsg);
        }
        setShowValidation(true);
      }
    } catch (error) {
      setValidationError(t('loginError'));
      setShowValidation(true);
    } finally {
      setIsLoading(false);
    }
  }

  // פונקציה לטיפול בשינוי בתיבות הקוד
  function handleOtpChange(index, value) {
    setShowValidation(false);
    if (index > 0 && !otpCode[index - 1]) {
      return;
    }

    if (value.length > 1) {
      value = value.slice(-1);
    }

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }

    if (value && index === 3 && newOtp.every(digit => digit !== "")) {
      handleAutoVerifyOtp(newOtp.join(""));
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 4);
    
    if (digits.length > 0) {
      const newOtp = [...otpCode];
      for (let i = 0; i < digits.length && i < 4; i++) {
        newOtp[i] = digits[i];
      }
      setOtpCode(newOtp);
      
      if (digits.length === 4) {
        const lastInput = document.getElementById(`otp-3`);
        if (lastInput) lastInput.focus();
        handleAutoVerifyOtp(digits);
      } else if (digits.length > 0) {
        const nextInput = document.getElementById(`otp-${Math.min(digits.length, 3)}`);
        if (nextInput) nextInput.focus();
      }
    }
  }

  async function handleAutoVerifyOtp(code) {
    if (isVerifying) return;

    setIsVerifying(true);

    try {
      const res = await fetch("/api/login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: otpContact, code, method: otpMethod }),
      });
      const data = await res.json();

      if (data.success) {
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 300));
          setVerifiedFields(prev => {
            const newVerified = [...prev];
            newVerified[i] = true;
            return newVerified;
          });
        }

        await new Promise(resolve => setTimeout(resolve, 700));
        onLoginSuccess(data.data);
      } else {
        setValidationError(t('codeNotRecognized'));
        setShowValidation(true);
        setOtpCode(["", "", "", ""]);
        setVerifiedFields([false, false, false, false]);
        document.getElementById("otp-0")?.focus();
      }
    } catch (error) {
      setValidationError(t('codeNotRecognized'));
      setShowValidation(true);
      setOtpCode(["", "", "", ""]);
      setVerifiedFields([false, false, false, false]);
      document.getElementById("otp-0")?.focus();
    } finally {
      setIsVerifying(false);
    }
  }

  function toggleOtpMethod() {
    setOtpMethod(prev => prev === "phone" ? "email" : "phone");
    setOtpContact("");
    setShowValidation(false);
  }

  function handleBackToContact() {
    setOtpSent(false);
    setOtpCode(["", "", "", ""]);
    setVerifiedFields([false, false, false, false]);
    setIsVerifying(false);
    setShowValidation(false);
  }

  const handleEmailKeyDown = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      document.getElementById('password').focus();
    }
  };

  const handlePasswordKeyDown = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleLogin(e);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    flow: 'implicit', // מחזיר access_token בצד לקוח
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      setShowValidation(false);
      try {
        const res = await fetch('/api/login/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });
        const data = await res.json();
        if (data.success) {
          onLoginSuccess(data);
        } else {
          setValidationError(data.error || t('googleLoginError'));
          setShowValidation(true);
        }
      } catch {
        setValidationError(t('googleLoginError'));
        setShowValidation(true);
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      setValidationError(t('googleLoginError'));
      setShowValidation(true);
    },
    scope: 'openid email profile', // כדי לקבל אימייל/פרופיל בשרת
  });

  return (
    <div className={styles.loginCard}>
      <div className={styles.loginCardContent}>
        <h1 className={`${styles.title} headline-1`}>{t('welcome')}<br />{t('welcomeSubtitle')}</h1>
        <div className={styles.tabsContainer}>
          <div className={`${styles.tabs} button-1`}>
            <button
              className={`${styles.tab} ${activeTab === "password" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("password")}
              type="button"
            >
              {t('passwordLogin')}
            </button>
            <button
              className={`${styles.tab} ${activeTab === "otp" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("otp")}
              type="button"
            >
              {t('otpLogin')}
            </button>
          </div>

          {activeTab === "password" ? (
            <form className={styles.formPasswordContainer} onSubmit={handleLogin}>
              <div className={styles.fieldsPasswordContainer}>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setShowValidation(false);
                  }}
                  onKeyDown={handleEmailKeyDown}
                  disabled={isLoading}
                  fullWidth
                />
                <div className={styles.passwordGroup}>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      setShowValidation(false);
                    }}
                    onKeyDown={handlePasswordKeyDown}
                    disabled={isLoading}
                    fullWidth
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    onClick={() => setShowPassword(v => !v)}
                    disabled={isLoading}
                    className={styles.passwordToggle}
                  >
                    {showPassword ? <FiEye size={22} /> : <FiEyeOff size={22} />}
                  </button>
                  <Button type="button" text={t('forgotPassword')} textOnly onClick={() => onForgotPassword(email)} />
                </div>
                {showValidation && validationError && (
                  <p className={`${styles.validationError} validation`}>
                    {validationError}
                  </p>
                )}
              </div>
              <div className={styles.buttonsContainer}>
                <Button type="submit" disabled={isLoading} text={t('loginButton')} primary fullWidth loading={isLoading} />
                {message && (
                  <div className={`${styles.message} ${message.includes('בהצלחה') ? styles.success : styles.error}`}>
                    {message}
                  </div>
                )}
                <button type="button" className={`${styles.registerLink} button-1`}>
                  {t('noAccount')} <span> &nbsp;{t('register')}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.formOtpContainer}>
              {!otpSent ? (
                <>
                  <div className={styles.fieldsOtpContainer}>
                    <Input
                      id="otpContact"
                      type={otpMethod === "phone" ? "tel" : "email"}
                      name="otpContact"
                      placeholder={otpMethod === "phone" ? t('phonePlaceholder') : t('emailOtpPlaceholder')}
                      value={otpContact}
                      onChange={e => {
                        setOtpContact(e.target.value);
                        setShowValidation(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isLoading) {
                          e.preventDefault();
                          handleSendOtp();
                        }
                      }}
                      disabled={isLoading}
                      fullWidth
                    />
                    {/* <Button
                      text={`שלחו לי קוד ל${otpMethod === "phone" ? "מייל" : "נייד"}`}
                      onClick={toggleOtpMethod}
                      disabled={isLoading}
                      textOnly
                      fullWidth
                      icon={otpMethod === "phone" ? <EmailIcon /> : <PhoneIcon />}
                    /> */}
                    {showValidation && validationError && (
                      <p className={`${styles.validationError} validation`}>
                        {validationError}
                      </p>
                    )}
                  </div>
                  <div className={styles.buttonsContainer}>
                    <Button
                      onClick={handleSendOtp}
                      disabled={isLoading}
                      text={t('sendCode')}
                      primary
                      fullWidth
                      loading={isLoading}
                    />
                    <button className={`${styles.registerLink} button-1`}>
                      {t('noAccount')} <span> &nbsp;{t('register')}</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.otpVerificationContainer}>
                    <div className={styles.otpVerificationTitle}>
                      <h3 className="body-2">{t('codeWasSent', { method: otpMethod === "phone" ? t('phone') : t('email') })}</h3>
                      <p className="button-1">{t('enterCode')}</p>
                    </div>
                    <div className={styles.otpInputsContainer}>
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className={styles.otpInputWrapper}>
                          <input
                            id={`otp-${index}`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]"
                            maxLength="1"
                            value={otpCode[index]}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            onPaste={handleOtpPaste}
                            disabled={isVerifying}
                            className={`${styles.otpInput} ${verifiedFields[index] ? styles.otpInputVerified : ''} ${index > 0 && !otpCode[index - 1] ? styles.otpInputLocked : ''} body-1`}
                            autoFocus={index === 0}
                            style={{ color: verifiedFields[index] ? 'transparent' : undefined }}
                          />
                          {verifiedFields[index] && (
                            <div className={styles.checkmark}>✓</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className={styles.otpActions}>
                      <Button text={t('resendCode')} textOnly onClick={handleSendOtp} disabled={isVerifying || isLoading} />
                      <Button text={t('sendToAlternative', { method: otpMethod === "phone" ? t('email') : t('phone') })} textOnly onClick={() => {
                        toggleOtpMethod();
                        handleBackToContact();
                      }} disabled={isVerifying || isLoading} />
                    </div>
                    {showValidation && validationError && (
                      <p className={`${styles.validationError} validation`}>
                        {validationError}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <Button
        onClick={() => loginWithGoogle()}
        text={t('googleLogin')}
        // primary
        fullWidth
        loading={isGoogleLoading}
        icon={<GoogleIcon />}
      // אפשר להוסיף גם אייקון שמאלי אם יש לך SVG של Google:
      // leftIcon={<GoogleSvgIcon />}
      />
    </div>
  );
}

