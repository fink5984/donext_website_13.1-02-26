import React, { useCallback, useEffect, useState, useRef } from "react";
import classnames from "classnames";
import PropTypes from "prop-types";
import "./multiRangeSlider.scss";
import { CurrencySymbol } from "@/app/components/CurrencySymbol";

const MultiRangeSlider = ({ min, max, currentMin, currentMax, onChange, type }) => {
    const [minVal, setMinVal] = useState(min);
    const [maxVal, setMaxVal] = useState(max);
    const [displayMinVal, setDisplayMinVal] = useState(min);
    const [displayMaxVal, setDisplayMaxVal] = useState(max);
    const minValRef = useRef(null);
    const maxValRef = useRef(null);
    const range = useRef(null);

    useEffect(() => {
        setMinVal(currentMin);
        setDisplayMinVal(currentMin);
    }, [currentMin]);

    useEffect(() => {
        setMaxVal(currentMax);
        setDisplayMaxVal(currentMax);
    }, [currentMax]);

    // Convert to percentage
    const getPercent = useCallback(
        (value) => Math.round(((value - min) / (max - min)) * 100),
        [min, max]
    );

    // Set width of the range to decrease from the left side
    useEffect(() => {
        if (maxValRef.current) {
            const minPercent = getPercent(minVal);
            const maxPercent = getPercent(+maxValRef.current.value); // Preceding with '+' converts the value from type string to type number

            if (range.current) {
                range.current.style.left = `${minPercent}%`;
                range.current.style.width = `${maxPercent - minPercent}%`;
            }
        }
    }, [minVal, getPercent]);

    // Set width of the range to decrease from the right side
    useEffect(() => {
        if (minValRef.current) {
            const minPercent = getPercent(+minValRef.current.value);
            const maxPercent = getPercent(maxVal);

            if (range.current) {
                range.current.style.width = `${maxPercent - minPercent}%`;
            }
        }
    }, [maxVal, getPercent]);
    useEffect(() => {
        if (range.current) {
            const minPercent = ((minVal - min) / (max - min)) * 100;
            const maxPercent = ((maxVal - min) / (max - min)) * 100;
            range.current.style.left = `${minPercent}%`;
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [minVal, maxVal, min, max]);
    // Get min and max values when their state changes
    // useEffect(() => {
    //     if (currentMin !== minVal || currentMax !== maxVal) {
    //         onChange({ min: minVal, max: maxVal });
    //     }
    // }, [minVal, maxVal, onChange]);
    const handleMinInputChange = (e) => {
        setDisplayMinVal(parseNumber(e.target.value));
    };

    const handleMaxInputChange = (e) => {
        setDisplayMaxVal(parseNumber(e.target.value));
    };

    const handleMinInputBlur = (e) => {
        let value = Number(parseNumber(e.target.value));
        if (isNaN(value)) {
            setDisplayMinVal(minVal);
            return;
        }

        // Ensure minVal is within valid range
        value = Math.max(min, Math.min(value, maxVal - 1));
        setMinVal(value);
        setDisplayMinVal(value);
        onChange({ min: value, max: maxVal });
    };

    const handleMaxInputBlur = (e) => {
        let value = Number(parseNumber(e.target.value));
        if (isNaN(value)) {
            setDisplayMaxVal(maxVal);
            return;
        }

        // Ensure maxVal is within valid range
        value = Math.min(max, Math.max(value, minVal + 1));
        setMaxVal(value);
        setDisplayMaxVal(value);
        onChange({ min: minVal, max: value });
    };

    const handleMinInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleMinInputBlur(e);
            e.target.blur();
        }
    };

    const handleMaxInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleMaxInputBlur(e);
            e.target.blur();
        }
    };
    const formatNumber = (value) =>
        value?.toLocaleString("he-IL") || "";

    const parseNumber = (value) =>
        Number(String(value).replace(/,/g, ""));

    return (
        <div
            className={`rangeContainer ${type}`}
        >
            <h2 className="table-2">
                {type === "expected" ? "צפי תרומה" : "תרומה בפועל"}
            </h2>

            <div className={`inputContainer validation`}>
                <div className="inputField">
                    <span><CurrencySymbol /></span>
                    <input
                        inputMode="numeric"
                        value={formatNumber(displayMaxVal)}
                        onChange={handleMaxInputChange}
                        onBlur={handleMaxInputBlur}
                        onKeyDown={handleMaxInputKeyDown}
                    />

                </div>
                <span>-</span>
                <div className="inputField">
                    <span><CurrencySymbol /></span>
                    <input
                        inputMode="numeric"
                        value={formatNumber(displayMinVal)}
                        onChange={handleMinInputChange}
                        onBlur={handleMinInputBlur}
                        onKeyDown={handleMinInputKeyDown}
                    />

                </div>
            </div>
            <div className="container">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={minVal}
                    ref={minValRef}
                    onChange={(e) => {
                        const value = Math.min(+e.target.value, maxVal - 1);
                        setMinVal(value);
                        onChange({ min: value, max: maxVal });
                    }}
                    className={classnames("thumb thumb--zindex-3", {
                        "thumb--zindex-5": minVal > max - 100
                    })}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={maxVal}
                    ref={maxValRef}
                    onChange={(e) => {
                        const value = Math.max(+e.target.value, minVal + 1);
                        setMaxVal(value);
                        onChange({ min: minVal, max: value });
                    }}
                    className="thumb thumb--zindex-4"
                />

                <div className="slider">
                    <div className="slider__track" />
                    <div ref={range} className="slider__range" />
                </div>
            </div >
        </div>
    );
};

MultiRangeSlider.propTypes = {
    min: PropTypes.number.isRequired,
    max: PropTypes.number.isRequired,
    currentMin: PropTypes.number.isRequired,
    currentMax: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired,
};

export default MultiRangeSlider;
