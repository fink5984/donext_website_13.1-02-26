import { useState } from 'react';
import { FiEye, FiEyeOff } from "react-icons/fi";
import Button from '@/app/components/Button';
import Input from '@/app/components/Input';
import styles from './login.module.scss';

export function ResetPassword({ onBack, onSuccess, email = "" }) {
  const [resetStep, setResetStep] = useState("enter-email"); // "enter-email" | "enter-otp" | "enter-new-password"
  const [resetEmail, setResetEmail] = useState(email);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Validation states
  const [showValidation, setShowValidation] = useState(false);
  const [validationError, setValidationError] = useState("");

  // פונקציה לשליחת קוד OTP למייל
  async function handleSendResetEmail(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!resetEmail) {
      setValidationError('*המייל הזה לא תקין');
      setShowValidation(true);
      return;
    }

    // בדיקה של תבנית מייל
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      setValidationError('*המייל הזה לא תקין');
      setShowValidation(true);
      return;
    }

    setShowValidation(false);
    setIsResetLoading(true);
    setResetMessage('');

    try {
      const res = await fetch("/api/login/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();

      if (data.success && data.emailExists) {
        setResetMessage(data.message || 'קוד אימות נשלח למייל');
        setResetStep("enter-otp");
      } else if (!data.emailExists) {
        setValidationError('*זה לא המייל שנרשמת איתו');
        setShowValidation(true);
      } else {
        setResetMessage(data.error || 'אין מישהו עם כזה מייל במערכת');
        setShowValidation(false);
      }
    } catch (error) {
      setResetMessage('שגיאה בשרת, אנא נסה שוב מאוחר יותר');
      setShowValidation(false);
    } finally {
      setIsResetLoading(false);
    }
  }

  // פונקציה לאימות קוד OTP והזנת סיסמה חדשה
  async function handleVerifyOtpAndSetPassword(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    
    if (!otpCode) {
      setValidationError('*יש להקליד את הקוד');
      setShowValidation(true);
      return;
    }

    if (!/^\d{4}$/.test(otpCode)) {
      setValidationError('*הקוד צריך להיות 4 ספרות');
      setShowValidation(true);
      return;
    }

    setShowValidation(false);
    setIsResetLoading(true);

    try {
      const res = await fetch("/api/login/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, otp: otpCode }),
      });
      const data = await res.json();

      if (data.success) {
        // הקוד נכון - עבור לשלב הזנת סיסמה חדשה
        setResetStep("enter-new-password");
      } else {
        setValidationError(data.error || '*קוד שגוי או פג תוקף');
        setShowValidation(true);
      }
    } catch (error) {
      setValidationError('שגיאה בתקשורת עם השרת');
      setShowValidation(true);
    } finally {
      setIsResetLoading(false);
    }
  }

  // פונקציה לעדכון סיסמה חדשה
  async function handleSetNewPassword(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    
    if (!newPassword) {
      setValidationError('*יש להקליד סיסמה חדשה');
      setShowValidation(true);
      return;
    }

    if (newPassword.length < 6) {
      setValidationError('*הסיסמה חייבת להיות לפחות 6 תווים');
      setShowValidation(true);
      return;
    }

    setShowValidation(false);
    setIsResetLoading(true);
    setResetMessage('');

    try {
      const res = await fetch("/api/login/reset-password-with-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: resetEmail, 
          otp: otpCode, 
          newPassword: newPassword 
        }),
      });
      const data = await res.json();

      if (data.success) {
        // עדכון הסיסמה הצליח - עכשיו מתחברים
        const loginRes = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resetEmail, password: newPassword }),
        });
        const loginData = await loginRes.json();

        if (loginData.success) {
          onSuccess(loginData);
        } else {
          setValidationError('הסיסמה עודכנה אבל יש בעיה בהתחברות, נסה שוב');
          setShowValidation(true);
        }
      } else {
        setValidationError(data.error || '*קוד שגוי או פג תוקף');
        setShowValidation(true);
      }
    } catch (error) {
      setValidationError('שגיאה בתקשורת עם השרת, אנא נסה שוב');
      setShowValidation(true);
    } finally {
      setIsResetLoading(false);
    }
  }

  return (
    <div className={styles.resetPasswordContainer}>
      {resetStep === "enter-email" && (
        <>
          <h1 className={`${styles.title} headline-1`}>איפוס סיסמה</h1>
          <div className={styles.fieldsPasswordContainer}>
            <p className={`${styles.subtitle} body-1`}>תמיד כיף להתחדש!<br />גם אם זו רק סיסמה חדשה :)</p>
            <Input
              id="resetEmail"
              type="email"
              name="resetEmail"
              placeholder="מה המייל שנרשמת איתו?"
              value={resetEmail}
              onChange={e => {
                setResetEmail(e.target.value);
                setShowValidation(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isResetLoading) {
                  e.preventDefault();
                  handleSendResetEmail();
                }
              }}
              disabled={isResetLoading}
              fullWidth
            />
            {showValidation && validationError && (
              <p className={`${styles.validationError} validation`}>
                {validationError}
              </p>
            )}
          </div>
          <Button
            onClick={handleSendResetEmail}
            disabled={isResetLoading}
            text="שלח קוד אימות"
            primary
            fullWidth
            loading={isResetLoading}
          />
          {resetMessage && (
            <div className={`${styles.message} ${resetMessage.includes('נשלח') ? styles.success : styles.error}`}>
              {resetMessage}
            </div>
          )}
          <Button
            onClick={onBack}
            text="חזרה להתחברות"
            textOnly
            fullWidth
          />
        </>
      )}

      {resetStep === "enter-otp" && (
        <>
          <h1 className={`${styles.title} headline-1`}>מעולה!</h1>
          <div className={styles.fieldsPasswordContainer}>
            <p className={`${styles.subtitle} body-1`}>שלחנו לך קוד למייל<br />{resetEmail}</p>
            <Input
              id="otpCode"
              type="text"
              name="otpCode"
              placeholder="הקלד את הקוד בן 4 הספרות"
              value={otpCode}
              onChange={e => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setOtpCode(value);
                setShowValidation(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isResetLoading) {
                  e.preventDefault();
                  handleVerifyOtpAndSetPassword();
                }
              }}
              disabled={isResetLoading}
              fullWidth
              maxLength={4}
            />
            {showValidation && validationError && (
              <p className={`${styles.validationError} validation`}>
                {validationError}
              </p>
            )}
          </div>
          <Button
            onClick={handleVerifyOtpAndSetPassword}
            disabled={isResetLoading || otpCode.length !== 4}
            text="המשך"
            primary
            fullWidth
            loading={isResetLoading}
          />
          <Button
            onClick={() => setResetStep("enter-email")}
            text="שלח קוד מחדש"
            textOnly
            fullWidth
          />
        </>
      )}

      {resetStep === "enter-new-password" && (
        <>
          <h1 className={`${styles.title} headline-1`}>כמעט סיימנו!</h1>
          <div className={styles.fieldsPasswordContainer}>
            <p className={`${styles.subtitle} body-1`}>הגדר סיסמה חדשה:</p>
            <div className={styles.passwordGroup}>
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                name="newPassword"
                placeholder="סיסמה חדשה (לפחות 6 תווים)"
                value={newPassword}
                onChange={e => {
                  setNewPassword(e.target.value);
                  setShowValidation(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isResetLoading) {
                    e.preventDefault();
                    handleSetNewPassword();
                  }
                }}
                disabled={isResetLoading}
                fullWidth
              />
              <button
                type="button"
                aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                onClick={() => setShowPassword(v => !v)}
                disabled={isResetLoading}
                className={styles.newPasswordToggle}
              >
                {showPassword ? <FiEye size={22} /> : <FiEyeOff size={22} />}
              </button>
            </div>
            {showValidation && validationError && (
              <p className={`${styles.validationError} validation`}>
                {validationError}
              </p>
            )}
          </div>
          <Button
            onClick={handleSetNewPassword}
            disabled={isResetLoading}
            text="עדכן סיסמה והתחבר"
            primary
            fullWidth
            loading={isResetLoading}
          />
        </>
      )}
    </div>
  );
}

