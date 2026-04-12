"use client";
import React, { useEffect, useState } from "react";
import { ReactJewishDatePicker } from "react-jewish-datepicker";
import "react-jewish-datepicker/dist/index.css";
import "./Calendar.scss";

const HebrewCalendar = ({ selectedDate, onDateChange, range = false }) => {

  const formatSelectedDate = (date) => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (date.date instanceof Date) return date.date;
    return null;
  };

  const getInitialValue = () => {
    const value = range ? {
      startDate: selectedDate?.start ? formatSelectedDate(selectedDate.start) : null,
      endDate: selectedDate?.end ? formatSelectedDate(selectedDate.end) : null
    } : formatSelectedDate(selectedDate) || new Date();

    return value;
  };

  useEffect(() => {
    addOpenClass();
    updateRowClass();
    updateTodayClass();
    markPastDates();

    const monthSelect = document.querySelector('.monthYearSelection select:nth-child(1)');
    const yearSelect = document.querySelector('.monthYearSelection select:nth-child(2)');
    const leftArrow = document.querySelector('.arrowLeft span');
    const rightArrow = document.querySelector('.arrowRight span');

    const handleSelectChange = () => {
      setTimeout(() => {
        updateRowClass();
        updateTodayClass();
        markPastDates();
      }, 0);
    };

    const handleArrowClick = () => {
      setTimeout(() => {
        updateRowClass();
        updateTodayClass();
        markPastDates();
      }, 0);
    };

    if (monthSelect) {
      monthSelect.addEventListener('change', handleSelectChange);
    }
    if (yearSelect) {
      yearSelect.addEventListener('change', handleSelectChange);
    }
    if (leftArrow) {
      leftArrow.addEventListener('click', handleArrowClick);
    }
    if (rightArrow) {
      rightArrow.addEventListener('click', handleArrowClick);
    }

    return () => {
      if (monthSelect) {
        monthSelect.removeEventListener('change', handleSelectChange);
      }
      if (yearSelect) {
        yearSelect.removeEventListener('change', handleSelectChange);
      }
      if (leftArrow) {
        leftArrow.removeEventListener('click', handleArrowClick);
      }
      if (rightArrow) {
        rightArrow.removeEventListener('click', handleArrowClick);
      }
    };
  }, [selectedDate]);

  const addOpenClass = () => {
    const monthWrappers = document.querySelectorAll(".monthWrapper");
    monthWrappers.forEach((wrapper) => {
      wrapper.classList.add("open");
    });
  };

  const updateRowClass = () => {
    const days = document.querySelectorAll('.month .day');
    const rows = Math.ceil(days.length / 7);
    const monthElement = document.querySelector('.month');

    if (monthElement) {
      if (rows === 6) {
        monthElement.classList.add('six-rows');
      } else {
        monthElement.classList.remove('six-rows');
      }
    }
  };

  const updateTodayClass = () => {
    const today = new Date().toDateString();
    let days = document.querySelectorAll("[data-date]");
    days.forEach((day) => {
      if (day.getAttribute("data-date")?.startsWith(today)) {
        day.classList.add("today");
      } else {
        day.classList.remove("today");
      }
    });
  };

  // סימון תאריכים שעברו כחסומים
  const markPastDates = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = document.querySelectorAll("[data-date]");
    days.forEach((day) => {
      const dateStr = day.getAttribute("data-date");
      if (dateStr) {
        const dayDate = new Date(dateStr);
        if (!isNaN(dayDate.getTime())) {
          dayDate.setHours(0, 0, 0, 0);
          if (dayDate < today) {
            day.classList.add("noSelect");
          } else {
            day.classList.remove("noSelect");
          }
        }
      }
    });
  };

  // פונקציה לבדיקה שהתאריך לא בעבר
  const isDateValid = (date) => {
    if (!date || !date.date) return false;
    const clickedDate = new Date(date.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return clickedDate >= today;
  };

  // פונקציה לבדיקה אם תאריך יכול להיבחר (לא בעבר)
  const canSelectDate = (date) => {
    if (!date) return false;
    
    // טיפול במקרה שזה אובייקט אירוע
    let actualDate = date;
    if (date.date) {
      actualDate = date.date;
    }
    
    try {
      const clickedDate = new Date(actualDate);
      if (isNaN(clickedDate.getTime())) return false;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      clickedDate.setHours(0, 0, 0, 0);
      
      return clickedDate >= today;
    } catch (e) {
      return false;
    }
  };

  // פונקציה לטיפול בבחירת תאריך בודד
  const handleSingleDateClick = (day) => {
    if (isDateValid(day)) {
      onDateChange(day);
    }
  };

  // פונקציה לטיפול בבחירת טווח תאריכים
  const handleRangeDateClick = (start, end) => {
    if (isDateValid(start) && (!end || isDateValid(end))) {
      onDateChange({
        start: start,
        end: end
      });
    }
  };

  // תיקון בעיית onMouseOver
  useEffect(() => {
    const calendarElement = document.querySelector('.hebrew-calendar');
    if (!calendarElement) return;

    const handleMouseOver = (e) => {
      // עצירת האירוע מלהתפשט
      e.stopPropagation();
    };

    const handleMouseMove = (e) => {
      e.stopPropagation();
    };

    calendarElement.addEventListener('mouseover', handleMouseOver, true);
    calendarElement.addEventListener('mousemove', handleMouseMove, true);

    return () => {
      calendarElement.removeEventListener('mouseover', handleMouseOver, true);
      calendarElement.removeEventListener('mousemove', handleMouseMove, true);
    };
  }, []);

  return (
    <div className="hebrew-calendar">
      <ReactJewishDatePicker
        isHebrew
        value={getInitialValue()}
        onClick={!range
          ? handleSingleDateClick
          : handleRangeDateClick
        }
        isRange={range}
      />
    </div>
  );
};

export default HebrewCalendar;