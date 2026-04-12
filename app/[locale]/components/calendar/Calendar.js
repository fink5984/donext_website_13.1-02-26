"use client";
import React, { useState, useRef, useEffect } from "react";
import "./Calendar.scss";
import HebrewCalendar from "./HebrewCalendar";
import GregorianCalendar from "./GregorianCalendar";
import Input from '../Input';
import CalendarIcon from '@/app/icons/calendar.svg'

const Calendar = ({ onDateSelect, range = false }) => {
    const [isHebrew, setIsHebrew] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
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

    useEffect(() => {
        if (range && savedRange) {
            setStartDay(new Date(savedRange.start));
            setEndDay(new Date(savedRange.end));
            setGregorianDateInput(`${new Date(savedRange.start).toLocaleDateString('en-GB')} - ${new Date(savedRange.end).toLocaleDateString('en-GB')}`);
        }
    }, [isCalendarOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                if (range) {
                    if (startDay && endDay) {
                        setIsCalendarOpen(false);
                        const rangeData = {
                            start: startDay,
                            end: endDay
                        };
                        setSavedRange(rangeData);
                        onDateSelect?.(rangeData);
                    }
                } else {
                    setIsCalendarOpen(false);
                    onDateSelect?.(selectedDate);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isHebrew, hebrewDateInput, gregorianDateInput, onDateSelect, startDay, endDay, range, selectedDate]);

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
            const dateStr = date.toLocaleDateString('en-GB');
            setGregorianDateInput(dateStr);
            setHebrewDateInput(dateStr);
            console.log('📅 Gregorian Calendar - Single Day:', { date, calendarType: 'gregorian' });
            onDateSelect?.({ date, calendarType: 'gregorian' });
            setIsCalendarOpen(false);
        }
    };

    const handleInputClick = () => {
        if (!hebrewDateInput && !range)
            setHebrewDateInput(new Date().toLocaleDateString('en-GB'));
        if (!gregorianDateInput && !range)
            setGregorianDateInput(new Date().toLocaleDateString('en-GB'));
        setIsCalendarOpen((prev) => !prev);
    };

    return (
        <div className="calendar-container">
            <Input
                type="text"
                placeholder="בחר תאריך לאירוע"
                value={isHebrew ? hebrewDateInput : gregorianDateInput}
                icon={<CalendarIcon />}
                onClick={handleInputClick}
            />

            {isCalendarOpen && (
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
                                selectedDate={!range ? selectedDate : {
                                    start: startDay,
                                    end: endDay
                                }}
                                onDateChange={handleHebrewDateChange}
                                range={range}
                            />
                        ) : (
                            <GregorianCalendar
                                selectedDate={!range ? selectedDate : {
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
