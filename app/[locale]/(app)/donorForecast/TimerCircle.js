import React from "react";
import styles from "./donorForecast.module.scss";

export default function TimerCircle({ seconds, maxSeconds = 30, size = 34 }) {
  if (seconds > maxSeconds || seconds < 1) return null; // לא להציג אחרי 30

  const radius = size / 2 - 4; // 4px padding
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / maxSeconds;
  const offset = circumference * (1 - progress);

  const displayNumber = seconds; // 1 עד 30

  return (
    <div className={styles.timerCircleWrapper} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* קשת מתקדמת בלבד */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--Border-disable-field, #C5D7F8)"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s linear" }}
        />
      </svg>
      <span className={styles.timerCircleText}>{displayNumber}</span>
    </div>
  );
}
