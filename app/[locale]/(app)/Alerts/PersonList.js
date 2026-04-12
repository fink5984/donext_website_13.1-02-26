"use client";
import React from 'react';
import Person from '@/app/components/Person';
import styles from './alerts.module.scss';

const PersonList = ({
    sortOrder,
    sortedData,
    groupedData,
    namesCount,
    handleFundraiserToggle,
    loadingStates,
}) => {
    const renderPerson = (person) => (
        <Person
            key={person.id || person.person_id}
            firstName={person.first_name}
            lastName={person.last_name}
            details={{
                phone: person.main_mobile,
                email: person.email,
                address: person.house_number,
                city: person.city_name,
                street: person.street_name
            }}
            sameName={namesCount[`${person.first_name} ${person.last_name}`] > 1}
            fundRaiser={person.isFundraiser}
            onClick={() => handleFundraiserToggle(person)}
            selectFundRaiser
            noEmail={!person.email}
            loading={loadingStates[person.person_id]}
        />
    );

    if (sortOrder === 'fundraisers' || sortOrder === 'donors') {
        const selectedGroupTitle = sortOrder === "fundraisers" ? "מתרימים שנבחרו" : "שמות שלא נבחרו";
        const unselectedGroupTitle = sortOrder === "fundraisers" ? "שמות שלא נבחרו" : "מתרימים שנבחרו";

        const selectedPeople = sortedData.filter(person => (sortOrder === "fundraisers" ? person.isFundraiser : !person.isFundraiser));
        const unselectedPeople = sortedData.filter(person => (sortOrder === "fundraisers" ? !person.isFundraiser : person.isFundraiser));

        return (
            <div className={styles.peopleGrid}>
                <div className={styles.sortedWrapper}>
                    <span className="button-1">{selectedGroupTitle}</span>
                    <div className={styles.peopleInLetter}>
                        {selectedPeople.map(renderPerson)}
                    </div>
                </div>
                <div className={styles.groupSpacing}></div>
                <div className={styles.sortedWrapper}>
                    <span className="button-1">{unselectedGroupTitle}</span>
                    <div className={styles.peopleInLetter}>
                        {unselectedPeople.map(renderPerson)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.peopleGrid}>
            {Object.keys(groupedData).map(group => (
                <div key={group} className={styles.letterGroup}>
                    <h3 className={`button-1 ${styles.letter}`}>{group}</h3>
                    <div className={styles.peopleInLetter}>
                        {groupedData[group].map(renderPerson)}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PersonList;
