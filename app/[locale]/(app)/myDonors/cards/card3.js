import styles from "./cards.module.scss";
import ArrowDownIcon from "@/app/icons/arrowDown.svg";
import ArrowUpIcon from "@/app/icons/arrowUp.svg";
import { useState, useRef, useEffect, useContext, useCallback } from "react";
import CompetitionList from "./CompetitionList";
import EmojiReactions from "./EmojiReactions";
import Button from "@/app/components/Button";
import AnimatedCard3Background from "./AnimatedCard3Background";
import fetchWithAuth from "@/app/utils/fetchWithAuth";
import { useAppContext } from "@/app/components/AppContext";
import { useTranslations, useLocale } from 'next-intl';


const mockCompetitions = [
    {
        id: 1,
        icon: "🏆",
        title: "המובילים עם הצפי הכולל הגבוה ביותר",
        donationsTitle: "המובילים עם סכום התרומות הגבוה ביותר",
        date: { day: "היום", time: "12:58" },
        participants: [1, 2, 3, 1, 4, 3, 5],
    },
    {
        id: 2,
        icon: "🚀",
        title: "מי התחבר ראשון למערכת",
        donationsTitle: "מי התחבר ראשון למערכת",
        date: { day: "היום", time: "12:58" },
        participants: [4, 5, 6, 1, 2, 3],
    },
    {
        id: 3,
        icon: "💡",
        title: "מי התחבר ראשון למערכת",
        donationsTitle: "מי התחבר ראשון למערכת",
        date: { day: "היום", time: "12:58" },
        participants: [1, 2, 3],
    },
    {
        id: 4,
        icon: "🎯",
        title: "מי התחבר ראשון למערכת",
        donationsTitle: "מי התחבר ראשון למערכת",
        date: { day: "היום", time: "12:58" },
        participants: [1, 2, 3],
    },
    {
        id: 5,
        icon: "🔥",
        title: "מי התחבר ראשון למערכת",
        donationsTitle: "מי התחבר ראשון למערכת",
        date: { day: "היום", time: "12:58" },
        participants: [1, 2, 3],
    },
    {
        id: 6,
        icon: "🌟",
        title: "מי התחבר ראשון למערכת",
        donationsTitle: "מי התחבר ראשון למערכת",
        date: { day: "היום", time: "12:58" },
        participants: [1, 2, 3],
    },
];

// currentUserId יילקח מ-AppContext

function NameWithEllipsis({ children, className, smallClass, ...props }) {
    const ref = useRef();
    const [isSmall, setIsSmall] = useState(false);
    const [isEllipsis, setIsEllipsis] = useState(false);

    useEffect(() => {
        if (!ref.current) return;

        const measure = () => {
            const isOverflow = ref.current.scrollWidth > ref.current.clientWidth;
            if (isOverflow) {
                setIsSmall(true);
            } else {
                setIsSmall(false);
                setIsEllipsis(false);
            }
        };

        // מדוד מיד אחרי רינדור
        measure();

        // מאזין לשינויים בגודל האלמנט
        const observer = new window.ResizeObserver(measure);
        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [children]);

    useEffect(() => {
        if (!ref.current) return;
        if (!isSmall) return;

        const measureSmall = () => {
            const isOverflowSmall = ref.current.scrollWidth > ref.current.clientWidth;
            if (isOverflowSmall) {
                setIsEllipsis(true);
            } else {
                setIsEllipsis(false);
            }
        };

        // מדוד מיד אחרי רינדור
        measureSmall();

        // מאזין לשינויים בגודל האלמנט
        const observer = new window.ResizeObserver(measureSmall);
        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [isSmall, children]);

    return (
        <span
            ref={ref}
            className={`${className} ${isSmall ? smallClass : ""}`}
            style={isEllipsis ? { cursor: "pointer" } : {}}
            title={isEllipsis ? children : undefined}
            {...props}
        >
            {children}
        </span>
    );
}

export default function Card3() {
    const t = useTranslations('myDonors.card3');
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const [competitions, setCompetitions] = useState([]);
    const [currentCompetitionIndex, setCurrentCompetitionIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [allReactions, setAllReactions] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const { fundraiserId, campaignId } = useAppContext();
    const hasFetched = useRef(false);

    // Mobile carousel state - cycles through participants one at a time
    const [mobileParticipantIndex, setMobileParticipantIndex] = useState(0);
    const [isMobileTransitioning, setIsMobileTransitioning] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const currentCompetition = competitions[currentCompetitionIndex] || null;
    const participantsCount = currentCompetition?.participants?.slice(0, 3).length || 0;

    // Mobile carousel auto-rotate every 5 seconds
    useEffect(() => {
        if (!isMobile || participantsCount <= 1 || open) return;

        const interval = setInterval(() => {
            setIsMobileTransitioning(true);
            setTimeout(() => {
                setMobileParticipantIndex((prev) => (prev + 1) % participantsCount);
                setIsMobileTransitioning(false);
            }, 300);
        }, 5000);

        return () => clearInterval(interval);
    }, [isMobile, participantsCount, open]);

    // Reset mobile index when competition changes
    useEffect(() => {
        setMobileParticipantIndex(0);
    }, [currentCompetitionIndex]);

    const fetchCompetitions = useCallback(async () => {
        try {
            if (!campaignId || !fundraiserId || hasFetched.current) return;

            hasFetched.current = true;
            setIsLoading(true);

            const response = await fetchWithAuth(`/api/competitions?campaignId=${campaignId}&fundraiserId=${fundraiserId}&locale=${locale}`);
            const result = await response.json();

            if (result.success && result.data.competitions) {
                // Create a map of participantId -> reactions from the API response
                const reactionsMap = {};
                result.data.competitions.forEach(competition => {
                    competition.participants.forEach(participant => {
                        if (participant.reactions) {
                            reactionsMap[participant.id] = participant.reactions;
                        }
                    });
                });
                setAllReactions(reactionsMap);

                // Map all competitions with their participants
                const mappedCompetitions = result.data.competitions.map(competition => ({
                    id: competition.type,
                    icon: competition.icon,
                    title: competition.title,
                    participants: competition.participants.map((fundraiser, index) => ({
                        id: fundraiser.id,
                        firstName: fundraiser.firstName,
                        lastName: fundraiser.lastName,
                        img: index === 0 ? "/first.png" : index === 1 ? "/second.png" : "/third.png"
                    }))
                }));
                setCompetitions(mappedCompetitions);
            }
        } catch (err) {
            console.error('Error fetching competitions:', err);
        } finally {
            setIsLoading(false);
        }
    }, [campaignId, fundraiserId, locale]);

    useEffect(() => {
        fetchCompetitions();
    }, [fetchCompetitions]);

    // Auto-rotate competitions disabled - only manual navigation or participant carousel
    // useEffect(() => {
    //     if (competitions.length === 0 || open) return;
    //     const interval = setInterval(() => {
    //         setIsTransitioning(true);
    //         setTimeout(() => {
    //             setCurrentCompetitionIndex((prev) => (prev + 1) % competitions.length);
    //             setIsTransitioning(false);
    //         }, 600);
    //     }, 10000);
    //     return () => clearInterval(interval);
    // }, [competitions.length, open]);


    return (
        <div className={`${styles.card} ${styles.card3} ${open ? styles.open : ""}`}>
            {isLoading && (
                <div className={styles.card3LoadingState}>
                    <div className="table-1">{t('loadingCompetitions')}</div>
                </div>
            )}
            {!isLoading && currentCompetition && (
                <>
                    {open && <AnimatedCard3Background />}
                    {/* עוטף את התוכן ב-wrapper שונה לכל מצב */}
                    {!open ? (
                        <div className={`${styles.card3Content} ${isTransitioning ? styles.fadeOut : styles.fadeIn}`}>
                            <div className={`${styles.card3Title} table-1`}>{currentCompetition.title}</div>
                            {currentCompetition.subtitle && (
                                <div className={`${styles.card3Subtitle} body-2`}>{currentCompetition.subtitle}</div>
                            )}

                            {/* Desktop: show all 3 participants */}
                            <div className={styles.card3Top3}>
                                {currentCompetition.participants.slice(0, 3).map((p, i) => {
                                    return (
                                        <div
                                            key={p.id}
                                            className={`${styles.card3Participant} ${i === 0 ? styles.card3First : i === 1 ? styles.card3Second : styles.card3Third}`}
                                            style={{ position: "relative" }}
                                        >
                                            <img src={p.img} alt={p.firstName + ' ' + p.lastName} />
                                            <div className={`${styles.card3NameWrapper} ${i === 0 ? 'card-4' : 'body-2'}`}>
                                                <div className={styles.card3FirstName}>
                                                    <NameWithEllipsis
                                                        className={i === 0 ? 'card-4' : 'body-2'}
                                                        smallClass={i === 0 ? styles.participantNameBig : styles.participantNameMedium}
                                                    >
                                                        {p.firstName}
                                                    </NameWithEllipsis>
                                                </div>
                                                <div className={styles.card3LastName}>
                                                    <NameWithEllipsis
                                                        className={i === 0 ? 'card-4' : 'body-2'}
                                                        smallClass="participantNameSmall"
                                                    >
                                                        {p.lastName}
                                                    </NameWithEllipsis>
                                                </div>
                                            </div>
                                            <EmojiReactions
                                                personId={p.id}
                                                people={currentCompetition.participants}
                                                currentUserId={fundraiserId}
                                                initialReactions={allReactions[p.id] || []}
                                                addButtonPositionStyle={{ top: 4.103, left: 3.763 }}
                                                barPositionStyle={{ marginTop: 4 }}
                                                maxBarWidth={i === 0 ? 260 : undefined}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Mobile: carousel - one participant at a time */}
                            <div className={styles.mobileCarousel}>
                                {(() => {
                                    const participants = currentCompetition.participants.slice(0, 3);
                                    const p = participants[mobileParticipantIndex];
                                    if (!p) return null;
                                    const rank = mobileParticipantIndex;
                                    const medalLabels = [t('firstPlace'), t('secondPlace'), t('thirdPlace')];
                                    return (
                                        <div className={`${styles.mobileCarouselCard} ${isMobileTransitioning ? styles.mobileSlideOut : styles.mobileSlideIn}`}>
                                            <div className={styles.mobileCarouselMedal}>
                                                <img src={p.img} alt={medalLabels[rank]} className={styles.mobileCarouselMedalImg} />
                                                <span className={styles.mobileCarouselRank}>{medalLabels[rank]}</span>
                                            </div>
                                            <div className={styles.mobileCarouselName}>
                                                <span className="table-1">{p.firstName} {p.lastName}</span>
                                            </div>
                                            <EmojiReactions
                                                personId={p.id}
                                                people={currentCompetition.participants}
                                                currentUserId={fundraiserId}
                                                initialReactions={allReactions[p.id] || []}
                                                addButtonPositionStyle={{ top: 4.103, left: 3.763 }}
                                                barPositionStyle={{ marginTop: 4 }}
                                            />
                                        </div>
                                    );
                                })()}
                                <div className={styles.mobileCarouselDots}>
                                    {currentCompetition.participants.slice(0, 3).map((_, i) => (
                                        <button
                                            key={i}
                                            className={`${styles.mobileCarouselDot} ${i === mobileParticipantIndex ? styles.activeDot : ''}`}
                                            onClick={() => {
                                                setIsMobileTransitioning(true);
                                                setTimeout(() => {
                                                    setMobileParticipantIndex(i);
                                                    setIsMobileTransitioning(false);
                                                }, 300);
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className={styles.bbbbb}>
                                <Button
                                    text={t('howToBeNext')}
                                    smallSmall
                                />
                            </div>
                        </div>
                    ) : (
                        <div className={styles.currentCompetitionCardWrapper}>
                            <div className={styles.currentCompetitionCard}>
                                <div className={styles.currentCompetitionTitleBar}>
                                    <span className="table-1">{currentCompetition.title}</span>
                                </div>
                                {currentCompetition.subtitle && (
                                    <div className={`${styles.currentCompetitionSubtitle} body-2`}>{currentCompetition.subtitle}</div>
                                )}
                                <div className={styles.card3Top3}>
                                    {currentCompetition.participants.slice(0, 3).map((p, i) => {
                                        return (
                                            <div
                                                key={p.id}
                                                className={`${styles.card3Participant} ${i === 0 ? styles.card3First : i === 1 ? styles.card3Second : styles.card3Third}`}
                                                style={{ position: "relative" }}
                                            >
                                                <img src={p.img} alt={p.firstName + ' ' + p.lastName} />
                                                <div className={`${styles.card3NameWrapper} ${i === 0 ? 'card-4' : 'body-2'}`}>
                                                    <div className={styles.card3FirstName}>
                                                        <NameWithEllipsis
                                                            className={i === 0 ? 'card-4' : 'body-2'}
                                                            smallClass={i === 0 ? styles.participantNameBig : styles.participantNameMedium}
                                                        >
                                                            {p.firstName}
                                                        </NameWithEllipsis>
                                                    </div>
                                                    <div className={styles.card3LastName}>
                                                        <NameWithEllipsis
                                                            className={i === 0 ? 'card-4' : 'body-2'}
                                                            smallClass="participantNameSmall"
                                                        >
                                                            {p.lastName}
                                                        </NameWithEllipsis>
                                                    </div>
                                                </div>
                                                <EmojiReactions
                                                    personId={p.id}
                                                    people={currentCompetition.participants}
                                                    currentUserId={fundraiserId}
                                                    initialReactions={allReactions[p.id] || []}
                                                    addButtonPositionStyle={{ top: 4.103, left: 3.763 }}
                                                    barPositionStyle={{ marginTop: 4 }}
                                                    maxBarWidth={i === 0 ? 260 : undefined}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {/* {open && (
                <CompetitionList competitions={mockCompetitions}
                    //  people={realPeople} 
                    people={currentCompetition.participants}
                />
            )}
            <button
                className={`${styles.card3ArrowBtn} ${open ? styles.open : ""}`}
                onClick={() => setOpen((v) => !v)}
            >
                {open ? <ArrowUpIcon /> : <ArrowDownIcon />}
            </button> */}
        </div>
    );
} 