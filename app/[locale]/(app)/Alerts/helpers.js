export function getProgressBarClass(count, min, max) {
    if (count === 0) return 'empty';
    if (count < min - 4) return 'under';
    if (count < min) return 'below';
    if (count <= max) return 'nice';
    if (count < max + 3) return 'above';
    return 'max';
};

export function getProgressWidth(count, min, max) {
    if (count === 0) return '0%';
    if (count <= max) {
        return `${(count / max) * 100}%`;
    }
    return '100%';
};

export function sortPeople(people, sortOrder) {
    // Create a new array to avoid mutating the original one
    const sortedPeople = [...people];
    
    sortedPeople.sort((a, b) => {
        const aLast = a.last_name || '';
        const bLast = b.last_name || '';
        
        switch (sortOrder) {
            case 'fundraisers':
                if (a.isFundraiser === b.isFundraiser) {
                    return aLast.localeCompare(bLast, 'he');
                }
                return a.isFundraiser ? -1 : 1;
            case 'donors':
                if (a.isFundraiser === b.isFundraiser) {
                    return aLast.localeCompare(bLast, 'he');
                }
                return a.isFundraiser ? 1 : -1;
            case 'desc':
                return bLast.localeCompare(aLast, 'he');
            case 'asc':
            default:
                return aLast.localeCompare(bLast, 'he');
        }
    });
    
    return sortedPeople;
};
