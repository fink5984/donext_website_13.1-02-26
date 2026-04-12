import { useState, useEffect, useRef, useLayoutEffect } from "react";
import styles from "./EmojiReactions.module.scss";
import PlusEmoji from "@/app/icons/plusEmoji.svg";
import ArrowIcon from "@/app/icons/navEmojiRight.svg";
import EmojiTooltipPortal from './EmojiTooltipPortal';
import fetchWithAuth from "@/app/utils/fetchWithAuth";

const emojiToGif = {
    "👏": "/emoji-gifs/clap.gif",
    "💪": "/emoji-gifs/muscle.gif",
    "🎉": "/emoji-gifs/party.gif",
    "🥁": "/emoji-gifs/drum.gif",
    "💯": "/emoji-gifs/100.gif",
    "💖": "/emoji-gifs/sparkle-heart.gif",
    "❤️": "/emoji-gifs/heart.gif",
    "💫": "/emoji-gifs/dizzy.gif",
    "💥": "/emoji-gifs/boom.gif",
    "🙏": "/emoji-gifs/pray.gif",
    "👍": "/emoji-gifs/thumbs-up.gif",
    "🚀": "/emoji-gifs/rocket.gif",
    "🛸": "/emoji-gifs/ufo.gif",
    "🍻": "/emoji-gifs/beer.gif",
    "🦚": "/emoji-gifs/peacock.gif",
    "💎": "/emoji-gifs/diamond.gif",
    "💸": "/emoji-gifs/money.gif",
};

export default function EmojiReactions({
    personId, currentUserId,
    initialReactions = [],
    addButtonPositionStyle, barPositionStyle,
    onPickerOpen, maxBarWidth
}) {
    const emojiOptions = [
        "👏", "💪", "🎉", "🥁", "💯", "💖", "❤️", "💫", "💥", "🙏", "👍", "🚀", "🛸", "🍻", "🦚", "💎", "💸"
    ];

    // State declarations
    const [reactions, setReactions] = useState(initialReactions);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerStartIdx, setPickerStartIdx] = useState(0);
    const [animatedDirection, setAnimatedDirection] = useState({});
    const [newlyAddedEmoji, setNewlyAddedEmoji] = useState(null);
    const [hoveredEmoji, setHoveredEmoji] = useState(null);
    const hoverTimeoutRef = useRef(null);


    // לוג כל פעם שהטולטיפ משתנה

    const [isLoading, setIsLoading] = useState(false);

    const pickerRef = useRef(null);
    const pageSize = 6;

    // פונקציות לטיפול ב-hover עם delay
    const handleEmojiMouseEnter = (e, emoji, users) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setHoveredEmoji({ emoji, users, element: e.currentTarget });
    };

    const handleEmojiMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredEmoji(null);
        }, 100); // delay קטן למניעת סגירה מיידית
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    // Global click handler to close tooltip
    useEffect(() => {
        const handleGlobalClick = () => {
            setHoveredEmoji(null);
        };

        document.addEventListener('click', handleGlobalClick);
        return () => {
            document.removeEventListener('click', handleGlobalClick);
        };
    }, []);

    // Update reactions when initialReactions prop changes
    useEffect(() => {
        if (initialReactions && initialReactions.length >= 0) {
            setReactions(initialReactions);
        }
    }, [initialReactions]);

    // Add reaction to server with optimistic update
    async function addReaction(emoji) {
        // יצירת תגובה זמנית עם ID ייחודי זמני
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const tempReaction = {
            id: tempId,
            emoji,
            fromId: currentUserId,
            toId: personId,
            fromName: 'You',
            createdAt: new Date().toISOString()
        };

        // עדכון אופטימי - הוספה מיידית ל-UI
        setReactions(prev => [...prev, tempReaction]);

        try {
            const response = await fetchWithAuth('/api/emoji-reactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fromId: currentUserId,
                    toId: personId,
                    emoji
                })
            });

            const result = await response.json();

            if (result.success) {
                // החלפת התגובה הזמנית בתגובה האמיתית מהשרת
                setReactions(prev => prev.map(r => 
                    r.id === tempId ? result.data : r
                ));
                return true;
            } else {
                // במקרה של כשלון - הסרת התגובה הזמנית
                setReactions(prev => prev.filter(r => r.id !== tempId));
                console.error('Failed to add reaction:', result.error);
                return false;
            }
        } catch (error) {
            // במקרה של שגיאה - הסרת התגובה הזמנית
            setReactions(prev => prev.filter(r => r.id !== tempId));
            console.error('Error adding reaction:', error);
            return false;
        }
    }

    // Remove reaction from server with optimistic update
    async function removeReaction(emoji) {
        try {
            const reactionToRemove = reactions.find(r =>
                r.emoji === emoji &&
                r.fromId === currentUserId &&
                r.toId === personId
            );

            if (!reactionToRemove) return false;

            // עדכון אופטימי - הסרה מיידית מה-UI
            setReactions(prev => prev.filter(r => r.id !== reactionToRemove.id));

            const response = await fetchWithAuth(`/api/emoji-reactions/${reactionToRemove.id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                return true;
            } else {
                // במקרה של כשלון - החזרת התגובה
                setReactions(prev => [...prev, reactionToRemove]);
                console.error('Failed to remove reaction:', result.error);
                return false;
            }
        } catch (error) {
            // במקרה של שגיאה - החזרת התגובה
            const reactionToRemove = reactions.find(r =>
                r.emoji === emoji &&
                r.fromId === currentUserId &&
                r.toId === personId
            );
            if (reactionToRemove) {
                setReactions(prev => [...prev, reactionToRemove]);
            }
            console.error('Error removing reaction:', error);
            return false;
        }
    }

    // תגובות לאותו אדם
    const personReactions = reactions.filter(r => r.toId === personId);

    // קיבוץ לפי אימוג'י
    let grouped = emojiOptions.map(emoji => {
        const users = personReactions.filter(r => r.emoji === emoji).map(r => r.fromId);
        return { emoji, users };
    }).filter(g => g.users.length > 0);

    // איפוס האינדקס בכל פתיחה של הפופאפ
    useEffect(() => {
        if (showPicker) setPickerStartIdx(0);
    }, [showPicker]);
    useEffect(() => {
        if (!showPicker) return;

        function handleClickOutside(event) {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [showPicker]);

    useEffect(() => {
        if (onPickerOpen) onPickerOpen(showPicker);
    }, [showPicker]);

    function AnimatedNumber({ value, direction, isNew, onAnimationEnd }) {
        const [animDirection, setAnimDirection] = useState(null);

        useEffect(() => {
            if (direction) setAnimDirection(direction);
            if (isNew) setAnimDirection("fromRight");
        }, [direction, value, isNew]);

        function handleAnimationEnd() {
            setAnimDirection(null);
            if (onAnimationEnd) onAnimationEnd();
        }

        return (
            <span
                className={`${styles.animatedNumber} ${animDirection ? styles[animDirection] : ""}`}
                onAnimationEnd={handleAnimationEnd}
            >
                {value}
            </span>
        );
    }
    return (
        <>
            <div className={styles.emojiAddBtnWrap} style={addButtonPositionStyle}>
                <div className={styles.iconAndList}>
                    <button
                        className={styles.emojiAddBtnIcon}
                        onClick={() => {
                            setPickerStartIdx(0);
                            setShowPicker(v => !v);
                        }}
                    >
                        <PlusEmoji />
                    </button>
                    {showPicker && (
                        <div className={
                            `${styles.emojiPickerList} ${styles.emojiPickerListOpen}`
                        } ref={pickerRef}>
                            {pickerStartIdx + pageSize < emojiOptions.length && (
                                <button
                                    className={styles.emojiPickerNav}
                                    onClick={() => setPickerStartIdx(i => i + 1)}
                                >
                                    <ArrowIcon />
                                </button>
                            )}
                            <div className={styles.emojiPickerEmojisOuter}>
                                <div
                                    className={styles.emojiPickerEmojisInner}
                                    style={{
                                        transform: `translateX(${pickerStartIdx * 36}px)` // 28px רוחב + 8px רווח
                                    }}
                                >
                                    {emojiOptions.map((emoji, idx) => {
                                        // בדוק אם המשתמש כבר הגיב באימוג'י הזה לאותו אדם
                                        const alreadyReacted = reactions.some(r => r.emoji === emoji && r.toId === personId && r.fromId === currentUserId);
                                        return (
                                            <span
                                                key={emoji}
                                                className={`${styles.emojiPickerEmoji}`}
                                                style={{
                                                    marginRight: idx > 0 ? 8 : 0,
                                                    opacity: idx >= pickerStartIdx && idx < pickerStartIdx + pageSize ? 1 : 0.5,
                                                    pointerEvents: idx >= pickerStartIdx && idx < pickerStartIdx + pageSize ? 'auto' : 'none',
                                                }}
                                                onClick={async () => {
                                                    if (alreadyReacted) return;
                                                    if (idx >= pickerStartIdx && idx < pickerStartIdx + pageSize) {
                                                        // בדוק אם זה אימוג'י חדש (לא קיים ב-grouped)
                                                        const isNew = !grouped.some(g => g.emoji === emoji);
                                                        
                                                        // סגירת הפיקר והוספת אנימציה מיד
                                                        setShowPicker(false);
                                                        if (isNew) {
                                                            setNewlyAddedEmoji(emoji);
                                                        } else {
                                                            setAnimatedDirection(prev => ({ ...prev, [emoji]: "up" }));
                                                        }
                                                        
                                                        // הוספת התגובה (אופטימית)
                                                        await addReaction(emoji);
                                                    }
                                                }}
                                            >
                                                <span className={styles.emojiStatic}>{emoji}</span>
                                                <img
                                                    src={emojiToGif[emoji]}
                                                    alt={emoji}
                                                    className={styles.emojiGif}
                                                    draggable={false}
                                                />
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            {pickerStartIdx > 0 && (
                                <button
                                    className={styles.emojiPickerNav}
                                    onClick={() => setPickerStartIdx(i => Math.max(0, i - 1))}
                                >
                                    <ArrowIcon style={{ transform: "scaleX(-1)" }} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div
                style={{
                    ...barPositionStyle
                }}
                className={styles.emojiBarWrap}
            >
                <EmojiBarScrollable grouped={grouped} maxBarWidth={maxBarWidth} />
            </div>

            {/* Portal לטולטיפ מחוץ לקונטיינר */}
            {hoveredEmoji && (
                <EmojiTooltipPortal
                    show={true}
                    position={{
                        top: hoveredEmoji.element?.getBoundingClientRect().top - 48,
                        left: hoveredEmoji.element?.getBoundingClientRect().right,
                    }}
                >
                    <div 
                        className={styles.emojiTooltipWrapper}
                        onMouseEnter={() => {
                            if (hoverTimeoutRef.current) {
                                clearTimeout(hoverTimeoutRef.current);
                            }
                        }}
                        onMouseLeave={handleEmojiMouseLeave}
                    >
                        <div className={styles.emojiTooltip}>
                            <span className={`${styles.tooltipTitle} text`}>התגובה של:</span>
                            {(() => {
                                const { users } = hoveredEmoji;
                                const hasReacted = users.includes(currentUserId);
                                let orderedUsers = users;
                                if (hasReacted) {
                                    orderedUsers = [currentUserId, ...users.filter(uid => uid !== currentUserId)];
                                }
                                return orderedUsers.map((uid, idx) => {
                                    if (uid === currentUserId) {
                                        return (
                                            <span key={uid} className={`${styles.tooltipName} validation`}>
                                                התגובה שלך{idx < orderedUsers.length - 1 ? ", " : ""}
                                            </span>
                                        );
                                    }
                                    const reaction = reactions.find(r => r.fromId === uid && r.emoji === hoveredEmoji.emoji);
                                    const userName = reaction?.fromName || `User ${uid}`;
                                    return (
                                        <span key={uid} className={`${styles.tooltipName} validation`}>
                                            {userName}{idx < orderedUsers.length - 1 ? ", " : ""}
                                        </span>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </EmojiTooltipPortal>
            )}
        </>
    );

    function EmojiBarScrollable({ grouped, maxBarWidth }) {
        const barRef = useRef(null);
        const isDragging = useRef(false);
        const startX = useRef(0);
        const scrollLeft = useRef(0);
        const moved = useRef(false);




        // Mouse events
        function onMouseDown(e) {
            isDragging.current = true;
            startX.current = e.pageX - barRef.current.offsetLeft;
            scrollLeft.current = barRef.current.scrollLeft;
            moved.current = false;
        }
        function onMouseMove(e) {
            if (!isDragging.current) return;
            e.preventDefault();
            const x = e.pageX - barRef.current.offsetLeft;
            const walk = x - startX.current;
            if (Math.abs(walk) > 3) moved.current = true;
            barRef.current.scrollLeft = scrollLeft.current - walk;
        }
        function onMouseUp() {
            isDragging.current = false;
        }
        // Touch events
        function onTouchStart(e) {
            isDragging.current = true;
            startX.current = e.touches[0].pageX - barRef.current.offsetLeft;
            scrollLeft.current = barRef.current.scrollLeft;
            moved.current = false;
        }
        function onTouchMove(e) {
            if (!isDragging.current) return;
            const x = e.touches[0].pageX - barRef.current.offsetLeft;
            const walk = x - startX.current;
            if (Math.abs(walk) > 3) moved.current = true;
            barRef.current.scrollLeft = scrollLeft.current - walk;
        }
        function onTouchEnd() {
            isDragging.current = false;
        }

        // הוספת event listeners לסגירת הטולטיפ
        useEffect(() => {
            function handleScroll() {
                setHoveredEmoji(null);
            }

            function handleResize() {
                setHoveredEmoji(null);
            }

            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        }, []);
        async function handleEmojiClick(emoji, hasReacted) {
            if (moved.current) return; // Prevent click if dragged
            
            // אנימציה מיידית לפני הבקשה לשרת
            if (hasReacted) {
                setAnimatedDirection(prev => ({ ...prev, [emoji]: "down" }));
                await removeReaction(emoji);
            } else {
                setAnimatedDirection(prev => ({ ...prev, [emoji]: "up" }));
                await addReaction(emoji);
            }
        }


        return (
            <div
                ref={barRef}
                className={styles.emojiBar}
                style={{
                    maxWidth: maxBarWidth || '100%',
                    display: 'flex',
                    flexWrap: 'nowrap',
                    cursor: isDragging.current ? 'grabbing' : 'grab',
                    userSelect: 'none',
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {grouped.map(({ emoji, users }) => {
                    const hasReacted = users.includes(currentUserId);
                    // סדר את המשתמשים: קודם המשתמש הנוכחי (אם יש), ואז השאר (ללא כפילויות)
                    let orderedUsers = users;
                    if (hasReacted) {
                        orderedUsers = [currentUserId, ...users.filter(uid => uid !== currentUserId)];
                    }
                    return (
                        <div
                            className={
                                `${styles.emojiCount} ${hasReacted ? styles.emojiCountReacted : ""}`
                            }
                            key={emoji}
                            onClick={() => handleEmojiClick(emoji, hasReacted)}
                            onMouseEnter={(e) => handleEmojiMouseEnter(e, emoji, users)}
                            onMouseLeave={handleEmojiMouseLeave}
                        >
                            <span className={styles.emojiInCount}>
                                <span className={styles.emojiStatic}>{emoji}</span>
                                <img
                                    src={emojiToGif[emoji]}
                                    alt={emoji}
                                    className={styles.emojiGif}
                                    draggable={false}
                                />
                            </span>
                            <AnimatedNumber
                                value={users.length}
                                direction={animatedDirection[emoji]}
                                isNew={emoji === newlyAddedEmoji}
                                onAnimationEnd={() => {
                                    setAnimatedDirection(prev => ({ ...prev, [emoji]: false }));
                                    if (emoji === newlyAddedEmoji) setNewlyAddedEmoji(null);
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }
} 