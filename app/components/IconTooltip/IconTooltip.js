import React, { useState } from 'react';
import styles from './IconTooltip.module.scss';
import Polygon from "@/app/icons/polygon.svg"

export default function IconTooltip({
    icon,
    text,
    up = false,
    // top = null,
    // bottom = null,
    // left = null,
    // right = null
}) {
    const [isHovered, setIsHovered] = useState(true);

    return (
        <div
            className={`${styles.tooltipContainer} ${up ? styles.up : styles.down}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        // style={{
        //     top: top !== null ? `${top}px` : "auto",
        //     bottom: bottom !== null ? `${bottom}px` : "auto",
        //     left: left !== null ? `${left}px` : "auto",
        //     right: right !== null ? `${right}px` : "auto",
        // }}
        >
            {icon}
            {/* {isHovered &&  */}
            <span className={`${styles.tooltip} ${up ? `tooltip-1` : `tooltip-2`}`}>
                {up ? <Polygon className={styles.arrowUp} /> : null}
                <span>{text}</span>
                {!up ? <Polygon className={styles.arrowDown} /> : null}
            </span>
            {/* } */}
        </div>
    );
}
