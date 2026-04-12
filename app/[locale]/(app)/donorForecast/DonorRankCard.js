import React, { useState, useRef } from "react";
import styles from "./donorForecast.module.scss";
import Phone from "@/app/icons/phoneSmall.svg"
import Home from "@/app/icons/homeSmall.svg"
import Email from "@/app/icons/mailSmall.svg"
import Return from "@/app/icons/diselectButton.svg"
import { getRankIconsAndColors } from "./rankUtils";
import DefaultAvatar from "@/app/icons/defaultAvatar.svg";

export default function DonorRankCard({ donor, status, onClick, onMouseDown, onMouseUp, draggable, onDragStart, onDragEnd, isSelected, rankIcon, className, numRanks, rankIdx, medalIcon }) {
    // status: "regular" | "hover" | "drag" | "selected" | "disabled" | "left-regular" | "left-hover"
    const [showReturnBtn, setShowReturnBtn] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const hoverTimeout = useRef();

    // הצג טול־טיפ אחרי 500ms
    const handleMouseEnter = () => {
        if (isSelected) setShowReturnBtn(true);
        hoverTimeout.current = setTimeout(() => setShowTooltip(true), 500);
    };

    const handleMouseLeave = () => {
        if (isSelected) setShowReturnBtn(false);
        clearTimeout(hoverTimeout.current);
        setShowTooltip(false);
    };

    // הצגת אייקון וצבע לפי הדרגה
    let rankIconNode = null;
    if (typeof numRanks === "number" && typeof rankIdx === "number") {
        const ranks = getRankIconsAndColors(numRanks);
        const { Icon, color } = ranks[rankIdx] || {};
        if (Icon) {
            rankIconNode = <Icon className={styles.rankIcon} style={{ color }} />;
        }
    } else if (rankIcon) {
        rankIconNode = <span className={styles.rankIcon}>{typeof rankIcon === 'function' ? React.createElement(rankIcon, {className: styles.rankIcon}) : rankIcon}</span>;
    }

    return (
        <div
            className={[
                styles.donorRankCard,
                styles[status],
                isSelected ? styles.selected : "",
                className || ""
            ].join(" ")}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ position: "relative" }}
        >
            {!showReturnBtn && (
                rankIcon ? (
                    <span className={styles.rankIcon}>{typeof rankIcon === 'function' ? React.createElement(rankIcon, {className: styles.rankIcon}) : rankIcon}</span>
                ) : (
                    <div className={styles.avatarWrapper}>
                        {medalIcon && (
                            <span className={styles.medalIconWrapper}>
                                {React.createElement(medalIcon, { className: styles.medalSvg })}
                            </span>
                        )}
                        <DefaultAvatar className={styles.avatarIcon} />
                    </div>
                )
            )}
            {showReturnBtn && isSelected && (
                <button
                    tabIndex={0}
                    onClick={onClick}
                   type="button"
                >
                  <Return/>
                </button>
            )}
            <div className={styles.donorName}>
                <p className="table-2">{donor.firstName}</p>
                <p className="table-1">{donor.lastName}</p>
            </div>
            {/* טול־טיפ */}
            <div className={`${styles.tooltip} ${showTooltip ? styles.tooltipVisible : ""}`}>
                {donor.phone && (<p><Phone />{donor.phone}</p>)}
                {(donor.address || donor.city) && (<p><Home />{donor.address} {donor.city}</p>)}
                {donor.email && (<p><Email />{donor.email}</p>)}
            </div>
        </div>
    );
} 