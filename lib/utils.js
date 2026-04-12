import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function groupPeopleByLastNameInitial(people) {
  return people.reduce((acc, person) => {
    const lastName = person.last_name || "";
    const firstLetter = lastName[0] || "";
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(person);
    return acc;
  }, {});
}