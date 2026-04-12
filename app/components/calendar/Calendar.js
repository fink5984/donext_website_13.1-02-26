"use client";
import React, { useState, useRef, useEffect } from "react";
import "./Calendar.scss";
import HebrewCalendar from "./HebrewCalendar";
import GregorianCalendar from "./GregorianCalendar";
import Input from '../Input';
import CalendarIcon from '@/app/icons/calendar.svg'

const Calendar = ({ onDateSelect, range = false, placeholder = 'בחר תאריך לאירוע', iconOnly = false }) => {
    const [isHebrew, setIsHebrew] = useState(true);
    const [selectedDate, setSelectedDate] = useState(iconOnly ? null : new Date());
    const [userHasSelected, setUserHasSelected] = useState(false);
    const [startDay, setStartDay] = useState(() => {
        const initialStartDate = new Date();
        return initialStartDate;
    });
    const [endDay, setEndDay] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
    });
    const [hebrewDateInput, setHebrewDateInput] = useState('');
    const [gregorianDateInput, setGregorianDateInput] = useState('');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [savedRange, setSavedRange] = useState(null);

    const calendarRef = useRef(null);
    const iconBtnRef = useRef(null);

    useEffect(() => {
        if (range && savedRange) {
            setStartDay(new Date(savedRange.start));
            setEndDay(new Date(savedRange.end));
            setGregorianDateInput(`${new Date(savedRange.start).toLocaleDateString('en-GB')} - ${new Date(savedRange.end).toLocaleDateString('en-GB')}`);
        }
    }, [isCalendarOpen]);

    useEffect(() => {
        if (!isCalendarOpen) return;

        const handleClickOutside = (event) => {
            if (iconBtnRef.current && iconBtnRef.current.contains(event.target)) {
                return;
            }
            if (calendarRef.current && calendarRef.current.contains(event.target)) {
                return;
            }
            // For portal: also check if click is within the calendar wrapper bounds
            if (calendarRef.current) {
                const rect = calendarRef.current.getBoundingClientRect();
                if (
                    event.clientX >= rect.left &&
                    event.clientX <= rect.right &&
                    event.clientY >= rect.top &&
                    event.clientY <= rect.bottom
                ) {
                    return;
                }
            }
            // Click is truly outside
            setIsCalendarOpen(false);
            if (!range && userHasSelected && selectedDate) {
                onDateSelect?.(selectedDate);
            }
            if (range && startDay && endDay) {
                const rangeData = { start: startDay, end: endDay };
                setSavedRange(rangeData);
                onDateSelect?.(rangeData);
            }
        };

        // Use setTimeout to avoid capturing the same click that opened the calendar
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCalendarOpen, isHebrew, hebrewDateInput, gregorianDateInput, onDateSelect, startDay, endDay, range, selectedDate, userHasSelected]);

    const toggleCalendar = () => {
        setIsHebrew((prev) => !prev);
    };

    const handleHebrewDateChange = (date) => {
        if (range) {
            if (date.start && date.end) {
                setStartDay(date.start.date);
                setEndDay(date.end.date);
                setHebrewDateInput(`${date.start.jewishDateStrHebrew} - ${date.end.jewishDateStrHebrew}`);
                setGregorianDateInput(`${date.start.date.toLocaleDateString('en-GB')} - ${date.end.date.toLocaleDateString('en-GB')}`);
                onDateSelect?.({ start: date.start.date, end: date.end.date, calendarType: 'hebrew' });
            }
        } else {
            setSelectedDate(date.date);
            setUserHasSelected(true);
            setHebrewDateInput(date.jewishDateStrHebrew);
            setGregorianDateInput(date.date.toLocaleDateString('en-GB'));
            console.log('📅 Hebrew Calendar - Single Day:', { date: date.date, calendarType: 'hebrew' });
            onDateSelect?.({ ...date, date: date.date, calendarType: 'hebrew' });
        }
        setIsCalendarOpen(false);
    };

    const handleGregorianDateChange = (date) => {
        if (range) {
            if (date.start) {
                setStartDay(date.start);
                if (date.end) {
                    setEndDay(date.end);
                    const rangeStr = `${date.start.toLocaleDateString('en-GB')} - ${date.end.toLocaleDateString('en-GB')}`;
                    setGregorianDateInput(rangeStr);
                    setHebrewDateInput(rangeStr);
                    onDateSelect?.({ start: date.start, end: date.end, calendarType: 'gregorian' });
                    setIsCalendarOpen(false);
                }
            }
        } else {
            setSelectedDate(date);
            setUserHasSelected(true);
            const dateStr = date.toLocaleDateString('en-GB');
            setGregorianDateInput(dateStr);
            setHebrewDateInput(dateStr);
            console.log('📅 Gregorian Calendar - Single Day:', { date, calendarType: 'gregorian' });
            onDateSelect?.({ date, calendarType: 'gregorian' });
            setIsCalendarOpen(false);
        }
    };

    const handleInputClick = () => {
        if (!iconOnly) {
            if (!hebrewDateInput && !range)
                setHebrewDateInput(new Date().toLocaleDateString('en-GB'));
            if (!gregorianDateInput && !range)
                setGregorianDateInput(new Date().toLocaleDateString('en-GB'));
        }
        setIsCalendarOpen((prev) => !prev);
    };

    return (
        <div className={`calendar-container${iconOnly ? ' calendar-icon-only' : ''}`}>
            {iconOnly ? (
                <div className="calendar-icon-with-date" ref={iconBtnRef}>
                    <button type="button" className="calendar-icon-btn" onClick={handleInputClick}>
                        <CalendarIcon />
                    </button>
                    {userHasSelected && selectedDate && (
                        <span className="calendar-selected-date-label">
                            {selectedDate.toLocaleDateString('he-IL')}
                        </span>
                    )}
                    {isCalendarOpen && (() => {
                        const isRtl = typeof document !== 'undefined' && (document.documentElement.dir === 'rtl' || document.body.dir === 'rtl');
                        return (
                        <div className="calendar-wrapper calendar-wrapper-inline" ref={calendarRef} style={isRtl ? { left: 0, right: 'auto' } : { right: 0, left: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
                            <div className="calendar-switch">
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={isHebrew}
                                        onChange={toggleCalendar}
                                    />
                                    <div className="slider">
                                        <span className="text">עברי</span>
                                        <span className="text">לועזי</span>
                                    </div>
                                </label>
                            </div>

                            <div className="calendar-content">
                                {isHebrew ? (
                                    <HebrewCalendar
                                        selectedDate={!range ? (selectedDate || new Date()) : {
                                            start: startDay,
                                            end: endDay
                                        }}
                                        onDateChange={handleHebrewDateChange}
                                        range={range}
                                    />
                                ) : (
                                    <GregorianCalendar
                                        selectedDate={!range ? (selectedDate || new Date()) : {
                                            start: startDay,
                                            end: endDay
                                        }}
                                        onDateChange={handleGregorianDateChange}
                                        range={range}
                                    />
                                )}
                            </div>
                        </div>
                        );
                    })()}
                </div>
            ) : (
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={isHebrew ? hebrewDateInput : gregorianDateInput}
                    icon={<CalendarIcon />}
                    onClick={handleInputClick}
                />
            )}

            {isCalendarOpen && !iconOnly && (
                <div className="calendar-wrapper" ref={calendarRef}>
                    <div className="calendar-switch">
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isHebrew}
                                onChange={toggleCalendar}
                            />
                            <div className="slider">
                                <span className="text">עברי</span>
                                <span className="text">לועזי</span>
                            </div>
                        </label>
                    </div>

                    <div className="calendar-content">
                        {isHebrew ? (
                            <HebrewCalendar
                                selectedDate={!range ? (selectedDate || new Date()) : {
                                    start: startDay,
                                    end: endDay
                                }}
                                onDateChange={handleHebrewDateChange}
                                range={range}
                            />
                        ) : (
                            <GregorianCalendar
                                selectedDate={!range ? (selectedDate || new Date()) : {
                                    start: startDay,
                                    end: endDay
                                }}
                                onDateChange={handleGregorianDateChange}
                                range={range}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendar;
