import styles from "./cards.module.scss";
import { useState } from "react";
import EmojiReactions from "./EmojiReactions";

export default function CompetitionCard({ competition, people }) {
    const [hovered, setHovered] = useState(null);
    const [emojiPickerOpenFor, setEmojiPickerOpenFor] = useState(null);
    const currentUserId = 1; // Assuming a default currentUserId

    return (
        <div className={styles.competitionCard}>
            <div className={styles.competitionCardHeader}>
                <div className={styles.competitionCardTitleRow}>
                    <span className={styles.competitionIcon}>{competition.icon}</span>
                    <span className={`${styles.competitionTitle} table-1`}>{competition.title}</span>
                </div>
                <div className={`${styles.competitionCardDateRow} tooltip-2`}>
                    <span className={styles.competitionDay}>{competition.date.day}</span>
                    <span className={styles.competitionTime}>{competition.date.time}</span>
                </div>
            </div>
            <div className={styles.competitionParticipantsWrapper}>
                <div className={styles.competitionParticipants}>
                    {competition.participants
                        .map((id, i) => {
                            const p = people.find((x) => x.id === id);
                            return p ? { id, i, person: p } : null;
                        })
                        .filter(Boolean)
                        .map(({ id, i, person: p }) => {
                            let imgSrc = null;
                            if (i === 0) imgSrc = "/first.png";
                            else if (i === 1) imgSrc = "/second.png";
                            else if (i === 2) imgSrc = "/third.png";

                            return (
                                <div className={styles.competitionParticipantWrapper} key={id}
                                    onMouseEnter={() => setHovered(id)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{ position: "relative" }}
                                >
                                    <div className={styles.competitionParticipant}>
                                        {imgSrc && i < 3 ? (
                                            <img
                                                src={imgSrc}
                                                alt={p.firstName + ' ' + p.lastName}
                                                className={styles.participantImg}
                                            />
                                        ) : i >= 3 ? (
                                            <span className={`${styles.participantPlaceNumber} table-2`}>{i + 1}</span>
                                        ) : null}
                                        {i < 3 ? (
                                            <div className={
                                                i === 0
                                                    ? `body-2 ${styles.participantName}`
                                                    : `body-1 ${styles.participantName}`
                                            }>
                                                <span className={styles.participantFirstName}>{p.firstName}</span>
                                                <span className={styles.participantLastName}>{p.lastName}</span>
                                            </div>
                                        ) : (
                                            <div className={`${styles.participantName} table-2`}>{p.firstName} {p.lastName}</div>
                                        )}
                                        <div className={styles.addEmojiOnHover}>
                                            <EmojiReactions
                                                personId={id}
                                                people={people}
                                                currentUserId={currentUserId}
                                                addButtonPositionStyle={{
                                                    top: "50%",
                                                    left: 0,
                                                    transform: "translate(-50%, -50%)",
                                                    display: hovered === id || emojiPickerOpenFor === id ? "block" : "none"
                                                }}
                                                barPositionStyle={{ marginTop: 3 }}
                                                onPickerOpen={open => setEmojiPickerOpenFor(open ? id : null)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}
