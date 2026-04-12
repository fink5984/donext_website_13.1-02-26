import Rank1 from "@/app/icons/rank1.svg";
import Rank2 from "@/app/icons/rank2.svg";
import Rank3 from "@/app/icons/rank3.svg";
import Rank4 from "@/app/icons/rank4.svg";
import Rank5 from "@/app/icons/rank5.svg";
import Rank6 from "@/app/icons/rank6.svg";
import Rank7 from "@/app/icons/rank7.svg";
import Rank8 from "@/app/icons/rank8.svg";

export const RANK_ICONS = [Rank1, Rank2, Rank3, Rank4, Rank5, Rank6, Rank7, Rank8];
export const RANK_COLORS = [
  "#91BBD7", // 1
  "#2E4AAF", // 2
  "#D79E3C", // 3
  "#C0BEBC", // 4
  "#E5C6BB", // 5
  "#CC6C37", // 6
  "#DCD7C5", // 7
  "#7B786E", // 8
];

export const RANKS_MAP = {
  3: [2, 3, 5],
  4: [0, 2, 3, 5],
  5: [0, 2, 3, 5, 6],
  6: [0, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
  8: [0, 1, 2, 3, 4, 5, 6, 7],
};

export function getRankIconsAndColors(numRanks) {
  const idxs = RANKS_MAP[numRanks] || RANKS_MAP[8];
  return idxs.map(i => ({
    Icon: RANK_ICONS[i],
    color: RANK_COLORS[i],
  }));
}

export function buildRanks(amounts) {
    if (!Array.isArray(amounts)) return [];
    const ranks = getRankIconsAndColors(amounts.length);
    return amounts.map((amount, idx) => ({
        label: `דרגה ${idx + 1}`,
        amount,
        icon: ranks[idx].Icon,
        color: ranks[idx].color,
    }));
}
