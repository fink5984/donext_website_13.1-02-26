"use client";
import '../globals.scss'
import styles from './Input.module.scss'

import { useEffect, useRef, useState } from 'react';

const Input = ({
  placeholder,
  type = 'text',
  disabled = false,
  field = true,
  fullWidth = false,
  value = '',
  onChange = () => { },
  onClick = () => { },
  onBlur = () => { },
  onKeyDown = () => { },
  onFocus = () => { },
  icon,
  small = false,
  validationError = null,
  list,
  textAlign,
  dir,
  paddingLeft,
  ...rest
}) => {
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  const containerClass = `
    ${styles["input-container"]} 
    ${fullWidth ? styles["full-width"] : ''}
    ${!field ? styles["bottom-border"] : ''}
  `.trim();

  const inputClass = `
    ${styles["input-field"]} 
    ${disabled ? styles.disabled : ''} 
    ${value ? styles.filled : ''} 
    ${!field ? styles["bottom-border"] : ''}
    ${fullWidth ? styles["full-width"] : ''}
    ${icon && !isFocused && !value ? styles["has-icon"] : ''}
    ${small ? styles.small : ''} 
    ${validationError && isFocused ? styles["error"] : ''}  
  `.trim();

  const iconClass = `
    ${styles["input-icon"]}
    ${value || isFocused ? styles["icon-hidden"] : ''}
  `.trim();

  // יצירת אובייקט style מותאם אישית
  const customStyle = {};
  if (textAlign) customStyle.textAlign = textAlign;
  if (dir) customStyle.direction = dir;
  if (paddingLeft) customStyle.paddingLeft = paddingLeft;

  return (
    <div className={containerClass}>
      <div className={styles.inputIcon}>
        {icon && <div className={iconClass}>{icon}</div>}
        <input
          ref={inputRef}
          type={type}
          className={`${inputClass} ${field ? "button-1" : "small-button-1"} `}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onClick={onClick}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur(e);
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          list={list}
          {...rest}
        />
        <label className={`${styles["floating-label"]} text`}>{placeholder}</label>
      </div>
      {/* <label className={`${styles["floating-label"]} text`}>{placeholder}</label> */}
      {
        isFocused &&
        validationError && (
          <span className={`${styles["error-message"]} validation`}>{validationError}</span>
        )}
    </div>
  );
};

export default Input;