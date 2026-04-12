"use client";
import React, { useRef, useEffect, useState } from 'react';
import DoNextLoader from '../DoNextLoader';

export function Table({
    data,
    renderRow,
    headerContent,
    styles,
    getRowKey,
    noScroll = false,
    noScrollMaxHeight = 543,
    loading = false,
    loadingMessage = "טוען...",
    error = null,
    errorMessage = null,
    headerClassName = '',
}) {
    const tableBodyRef = useRef(null);
    const [shouldScroll, setShouldScroll] = useState(false);

    useEffect(() => {

        if (!tableBodyRef.current) return;

        const checkScroll = () => {
            const tableHeight = tableBodyRef.current.scrollHeight;
            const maxHeight = window.innerHeight - noScrollMaxHeight; // This should probably be a prop
            setShouldScroll(tableHeight > maxHeight);
        };

        checkScroll();
        const resizeObserver = new ResizeObserver(checkScroll);
        resizeObserver.observe(tableBodyRef.current);

        return () => {
            resizeObserver.disconnect();
        };

    }, [data, data.length]);

    return (
        <div className={styles.table}>
            <div className={`${styles.tableHeader} ${headerClassName} table-4`}>
                {headerContent}
            </div>
            <div
                ref={tableBodyRef}
                className={styles.tableBody}
                style={{ overflowY: shouldScroll && !noScroll ? "auto" : "visible", paddingRight: shouldScroll || noScroll ? "0" : "6px" }}
            >
                {loading ? (
                    <div className={styles.loadingState}>
                        <DoNextLoader />
                        <span className="table-3">{loadingMessage}</span>
                    </div>
                ) : error ? (
                    <div className={styles.errorState}>
                        <span className="table-3">{errorMessage}</span>
                    </div>
                ) : data.length === 0 ? (
                    <div className={styles.emptyState}>
                        <span className="table-3">אין נתונים להצגה</span>
                    </div>
                ) : (
                    data.map((row, index) => {
                        const key = typeof getRowKey === 'function'
                            ? getRowKey(row, index)
                            : `${(row && (row.id ?? row.key)) ?? 'item'}-${index}`;
                        return (
                            <React.Fragment key={key}>
                                {renderRow(row, index)}
                            </React.Fragment>
                        );
                    })
                )}
            </div>
        </div>
    );
} 