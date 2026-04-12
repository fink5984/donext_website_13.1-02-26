import { useRef } from "react";
import Button from "@/app/components/Button";
import CompetitionCard from "./CompetitionCard";
import styles from "./cards.module.scss";
import { useTranslations } from 'next-intl';

export default function CompetitionList({ competitions, people }) {
    const t = useTranslations('common');
    const listRef = useRef(null);

    const handleShowMore = () => {
        if (listRef.current) {
            listRef.current.scrollBy({ top: 300, behavior: "smooth" });
        }
    };

    return (
        <div className={styles.competitionListWrapOuter} ref={listRef}>
            <div className={styles.competitionListWrap}>
                {competitions.map((comp) => (
                    <CompetitionCard key={comp.id} competition={comp} people={people} />
                ))}
            </div>
            <div className={styles.showMoreBtnWrapper}>
                <Button text={t('showMore')} primary small onClick={handleShowMore} />
            </div>
        </div>
    );
}
