"use client";

import { useAppContext } from "./AppContext";
import { getCampaignCurrencySymbol } from "@/lib/currencies";
import { useLocale } from "next-intl";

export function useCurrencySymbol() {
  const { campaign } = useAppContext();
  return getCampaignCurrencySymbol(campaign);
}

export function CurrencySymbol({ className }) {
  const symbol = useCurrencySymbol();
  return <span className={className}>{symbol}</span>;
}

// Format amount with currency symbol based on locale
export function useFormatCurrency() {
  const symbol = useCurrencySymbol();
  const locale = useLocale();
  
  return (amount) => {
    if (amount === null || amount === undefined) return '';
    const formattedAmount = typeof amount === 'number' ? amount.toLocaleString() : amount;
    // In English (LTR), symbol comes before: $ 100
    // In Hebrew (RTL), symbol comes after: 100 ₪
    if (locale === 'he') {
      return `${formattedAmount} ${symbol}`;
    }
    return `${symbol} ${formattedAmount}`;
  };
}

// Component version
export function FormattedCurrency({ amount, className }) {
  const formatCurrency = useFormatCurrency();
  return <span className={className}>{formatCurrency(amount)}</span>;
}