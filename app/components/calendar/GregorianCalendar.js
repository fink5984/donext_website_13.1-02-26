"use client";
import "./Calendar.scss";
import React, { useState, useEffect } from 'react';

const GregorianCalendar = ({ selectedDate, onDateChange, range = false }) => {
  const months = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  // פונקציה להשוואת תאריכים רק לפי יום, חודש ושנה (ללא שעות)
  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const getInitialDate = () => {
    if (range) {
      return selectedDate?.start instanceof Date ? selectedDate.start : new Date();
    }
    return selectedDate instanceof Date ? selectedDate : new Date();
  };

  const initialDate = getInitialDate();
  const years = Array.from({ length: 201 }, (_, i) => initialDate.getFullYear() - 100 + i);

  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [startDate, setStartDate] = useState(range && selectedDate?.start instanceof Date ? selectedDate.start : null);
  const [endDate, setEndDate] = useState(range && selectedDate?.end instanceof Date ? selectedDate.end : null);
  const [hoverDate, setHoverDate] = useState(null);

  useEffect(() => {
    // רק אם אנחנו מקבלים טווח חדש מבחוץ ולא באמצע בחירה
    if (range && selectedDate.start && selectedDate.end && !startDate) {
      setStartDate(selectedDate.start);
      setEndDate(selectedDate.end);
      setCurrentMonth(selectedDate.start.getMonth());
      setCurrentYear(selectedDate.start.getFullYear());
    } else if (!range && selectedDate instanceof Date) {
      setCurrentMonth(selectedDate.getMonth());
      setCurrentYear(selectedDate.getFullYear());
    }
  }, [selectedDate, range]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleDateClick = (day) => {
    const clickedDate = new Date(currentYear, currentMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // בדיקה שהתאריך שנבחר לא בעבר
    if (clickedDate < today) {
      return; // לא מאפשרים בחירת תאריכים בעבר
    }
    
    if (!range) {
      onDateChange(clickedDate);
      return;
    }

    // מצב טווח
    if (!startDate || (startDate && endDate)) {
      // מתחילים טווח חדש - תמיד מאפסים את תאריך הסיום
      setStartDate(clickedDate);
      setEndDate(null);
      onDateChange({
        start: clickedDate,
        end: null
      });
    } else if (!endDate) {
      // יש תאריך התחלה, בוחרים תאריך סיום
      if (clickedDate < startDate) {
        // אם התאריך שנבחר מוקדם יותר, הוא יהיה ההתחלה
        setEndDate(startDate);
        setStartDate(clickedDate);
        onDateChange({
          start: clickedDate,
          end: startDate
        });
      } else {
        // התאריך שנבחר מאוחר יותר, הוא יהיה הסיום
        setEndDate(clickedDate);
        onDateChange({
          start: startDate,
          end: clickedDate
        });
      }
    }
  };

  const isStartDay = (day) => {
    if (!range || !startDate) return false;
    const currentDate = new Date(currentYear, currentMonth, day);
    // אם עוברים עם העכבר על תאריך מוקדם יותר, אז תאריך ההתחלה המקורי הופך לסיום
    if (hoverDate) {
      const hoverDateObj = new Date(currentYear, currentMonth, hoverDate);
      if (hoverDateObj < startDate) {
        return isSameDay(currentDate, hoverDateObj);
      }
    }
    return isSameDay(currentDate, startDate);
  };

  const isEndDay = (day) => {
    if (!range || !endDate) {
      // אם יש הובר על תאריך מוקדם יותר, תאריך ההתחלה המקורי הופך לסיום
      if (startDate && hoverDate) {
        const currentDate = new Date(currentYear, currentMonth, day);
        const hoverDateObj = new Date(currentYear, currentMonth, hoverDate);
        if (hoverDateObj < startDate) {
          return isSameDay(currentDate, startDate);
        }
      }
      return false;
    }
    const currentDate = new Date(currentYear, currentMonth, day);
    return isSameDay(currentDate, endDate);
  };

  const isInRange = (day) => {
    if (!range || !startDate || !endDate) return false;
    const currentDate = new Date(currentYear, currentMonth, day);
    
    // נרמל את התאריכים לתחילת היום
    const normalizedCurrent = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    return normalizedCurrent > normalizedStart && normalizedCurrent < normalizedEnd;
  };

  // פונקציה חדשה לבדיקה אם תאריך נמצא בטווח של ההובר
  const isInHoverRange = (day) => {
    if (!range || !startDate || endDate || !hoverDate) return false;
    const currentDate = new Date(currentYear, currentMonth, day);
    const hoverDateObj = new Date(currentYear, currentMonth, hoverDate);
    
    if (hoverDateObj > startDate) {
      return currentDate > startDate && currentDate <= hoverDateObj;
    } else {
      return currentDate > hoverDateObj && currentDate < startDate;
    }
  };

  const handleDayHover = (day) => {
    if (range && startDate && !endDate) {
      setHoverDate(day);
    }
  };

  const handleDayLeave = () => {
    setHoverDate(null);
  };

  const handleMonthChange = (e) => {
    const monthIndex = months.indexOf(e.target.value);
    setCurrentMonth(monthIndex);
  };

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    setCurrentYear(newYear);
  };

  const changeMonth = (increment) => {
    const newMonth = (currentMonth + increment + 12) % 12;
    const newYear = currentYear + Math.floor((currentMonth + increment) / 12);
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const getDayClassName = (day) => {
    const classes = ['day'];
    const currentDate = new Date(currentYear, currentMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // תאריכים שעברו
    if (currentDate < today) {
      classes.push('noSelect');
    }

    if (isStartDay(day)) classes.push('startDay');
    if (isEndDay(day)) classes.push('endDay');
    if (isInRange(day)) classes.push('isInRange');
    if (isInHoverRange(day)) classes.push('isInRange');
    if (hoverDate === day && startDate && !endDate) classes.push('hoverEnd');

    if (!range && selectedDate instanceof Date && isSameDay(currentDate, selectedDate)) {
      classes.push('selectedDay');
    }

    if (isSameDay(today, currentDate)) {
      classes.push('today');
    }
    return classes.join(' ');
  };

  return (
    <div className="english-calendar">
      <div className="selectedDate">
        {!range && selectedDate instanceof Date ?
          selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : ''}
      </div>
      <div className="monthWrapper open">
        <div className="navigation">
          <div className="arrowLeft" onClick={() => changeMonth(-1)}>
            <span></span>
          </div>
          <div className="monthYearSelection">
            <select value={months[currentMonth]} onChange={handleMonthChange}>
              {months.map((month, index) => (
                <option key={index} value={month}>{month}</option>
              ))}
            </select>
            <select value={currentYear} onChange={handleYearChange}>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="arrowRight" onClick={() => changeMonth(1)}>
            <span></span>
          </div>
        </div>
        <div className="weekdayWrapper">
          <div className="weekday">S</div>
          <div className="weekday">M</div>
          <div className="weekday">T</div>
          <div className="weekday">W</div>
          <div className="weekday">T</div>
          <div className="weekday">F</div>
          <div className="weekday">SH</div>
        </div>
        <div className="month">
          {Array.from({ length: startDay }, (_, i) => (
            <div key={`otherMonth-${i}`} className="day otherMonth"></div>
          ))}
          {daysArray.map((day) => (
            <div
              key={day}
              className={getDayClassName(day)}
              onClick={() => handleDateClick(day)}
              onMouseEnter={() => handleDayHover(day)}
              onMouseLeave={() => handleDayLeave()}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GregorianCalendar;