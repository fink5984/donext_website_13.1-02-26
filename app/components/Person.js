"use client";
import { useState, useRef, useEffect } from 'react';
import '../globals.scss'
import styles from './Person.module.scss'
import Phone from "@/app/icons/phoneSmall.svg"
import Home from "@/app/icons/homeSmall.svg"
import Email from "@/app/icons/mailSmall.svg"
import Tag from "@/app/icons/tag.svg"
import V from "@/app/icons/v.svg"
import Exit from "@/app/icons/exit.svg"
import IconTooltip from './IconTooltip/IconTooltip';
import Link from "@/app/icons/donorLink.svg"
import LinkSmall from "@/app/icons/linkSmallSmall.svg"
import { Portal } from './Portal';
import DoNextLoader from './DoNextLoader';

const Person = ({ firstName, lastName, icon, onClick, disabled = false, sameName = false, selectFundRaiser = false, fundRaiser = false, className = '', details = null, noEmail = false, donor = false, donorSelected = false, fundraiserName = null, onCancelFund, donorSelectedBold = false, loading = false }) => {

    const [isHovered, setIsHovered] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [detailsPosition, setDetailsPosition] = useState({ top: 0, left: 0 });
    const [showNoEmailMessage, setShowNoEmailMessage] = useState(false);
    const timerRef = useRef(null);
    const messageTimerRef = useRef(null);
    const buttonRef = useRef(null);

    const handleClick = (e) => {
        if (!disabled && !loading) {
            if (noEmail) {
                if (messageTimerRef.current) {
                    clearTimeout(messageTimerRef.current);
                }

                setShowNoEmailMessage(true);

                messageTimerRef.current = setTimeout(() => {
                    setShowNoEmailMessage(false);
                }, 1500);

                if (onClick) onClick(e);
                return;
            }
            if (onClick) onClick(e);
        }
    };

    const handleMouseEnter = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setIsHovered(true);
        timerRef.current = setTimeout(() => {
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setDetailsPosition({
                    top: rect.bottom + window.scrollY + 5, // 5px offset from the button
                    left: rect.left + window.scrollX,
                });
                setShowDetails(true);
            }
        }, 300);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setIsHovered(false);
        setShowDetails(false);
    };

    useEffect(() => {
        return () => {
            if (messageTimerRef.current) {
                clearTimeout(messageTimerRef.current);
            }
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const buttonClass = `
        ${disabled || loading ? styles.disable : ''} 
        ${styles.person} 
        ${fundRaiser ? styles.fundRaiser : ''}
        ${fundRaiser && selectFundRaiser ? styles.selected : ''}
        ${donorSelected ? styles.donorSelected : ''}
        ${isHovered ? styles.hovered : ''}
        ${noEmail ? styles.noEmail : ''}
        ${donor ? styles.donor : ''}
        ${donorSelectedBold ? styles.donorSelectedBold : ''}
        ${loading ? styles.loading : ''}
        ${className}
    `.trim();

    return (
        <div
            className={styles.buttonContainer}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                onClick={handleClick}
                className={buttonClass}
                disabled={disabled || loading}
                ref={buttonRef}
            >
                <span className={styles.content}>
                    <span className={`${styles.icon} ${styles.rightIcon}`}>
                        {loading ? (
                            <DoNextLoader small />
                        ) : (
                            <>
                                {fundRaiser || donorSelected ? (
                                    isHovered ? (
                                        <Exit
                                            style={{
                                                color: fundRaiser ? 'var(--Brand-Turquoise-600, #009FC0)' : undefined,
                                            }}
                                        />
                                    ) : selectFundRaiser || donorSelectedBold ? (
                                        <V />
                                    ) : donorSelected ? (
                                        icon == null ? (
                                            <Link />
                                        ) : icon
                                    ) : null
                                ) : (
                                    icon
                                )}
                            </>
                        )}
                    </span>
                    <span className="button-1">{lastName} {firstName}</span>
                    <span className={`${styles.icon} ${!sameName && styles.hidden}`}>
                        <IconTooltip icon={<Tag />} up text="יש שם זהה" />
                    </span>
                </span>
            </button>
            {
                showNoEmailMessage &&
                noEmail && (
                    <div className={`${styles.noEmailMessage} tooltip-1`}>
                        לא ניתן לבחור מתרימים שאין להם כתובת מייל במערכת
                    </div>
                )}
            {showDetails && (details || fundraiserName) && (
                <Portal>
                    <div
                        className={styles.detailsBox}
                        style={{ top: detailsPosition.top, left: detailsPosition.left }}
                    >
                        {details.phone && (<p><Phone />{details.phone}</p>)}
                        {(details.address || details.city) && (<p><Home />{details.address} {details.city}</p>)}
                        {details.email && (<p><Email />{details.email}</p>)}
                        {fundraiserName &&
                            <p className={styles.fundName}>
                                <span className={styles.fundraiserWrapper}>
                                    <span className={styles.fundIcon}><LinkSmall /></span>
                                    <span className={styles.fundraiserText}>{fundraiserName} </span>
                                </span>
                                <button onClick={onCancelFund}>בטל שיוך</button>
                            </p>
                        }
                    </div>
                </Portal>
            )}
        </div>
    );
};

export default Person;