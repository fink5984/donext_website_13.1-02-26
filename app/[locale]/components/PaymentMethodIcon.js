"use client"

import React from 'react';
import CreditIcon from '@/app/icons/credit.svg';
import CashIcon from '@/app/icons/cash.svg';
import ChecksIcon from '@/app/icons/checks.svg';
import BankTransferIcon from '@/app/icons/bank-transfer.svg';
import HokBankIcon from '@/app/icons/hok-bank.svg';
import HokNewIcon from '@/app/icons/hok-new.svg';
import PayboxIcon from '@/app/icons/paybox.svg';
import BitIcon from '@/app/icons/bit.svg';
import PaypalIcon from '@/app/icons/paypal.svg';
import ApplePayIcon from '@/app/icons/apple-pay.svg';
import GooglePayIcon from '@/app/icons/google-pay.svg';
import StripeIcon from '@/app/icons/stripe.svg';
// import OtherIcon from '@/app/icons/other.svg';

// מיפוי אמצעי התשלום לקומפוננטי SVG
const paymentMethodIcons = {
    'CREDIT': CreditIcon,
    'CASH': CashIcon,
    'CHECKS': ChecksIcon,
    'BANK_TRANSFER': BankTransferIcon,
    'HOK_BANK': HokBankIcon,
    'HOK_NEW': HokNewIcon,
    'PAYBOX': PayboxIcon,
    'BIT': BitIcon,
    'PAYPAL': PaypalIcon,
    'APPLE_PAY': ApplePayIcon,
    'GOOGLE_PAY': GooglePayIcon,
    'STRIPE': StripeIcon,
    // 'OTHER': OtherIcon
};

// מיפוי תרגום אמצעי התשלום
export const paymentMethodLabels = {
    'CREDIT': 'אשראי',
    'CASH': 'מזומן',
    'CHECKS': 'צ\'קים',
    'BANK_TRANSFER': 'העברה בנקאית',
    'HOK_BANK': 'הו"ק בנקאית',
    'HOK_NEW': 'הו"ק חדשה',
    'PAYBOX': 'PayBox',
    'BIT': 'bit',
    'PAYPAL': 'PayPal',
    'APPLE_PAY': 'ApplePay',
    'GOOGLE_PAY': 'Google Pay',
    'STRIPE': 'Stripe',
    'BEVEL': 'Bevel',
    'PLEDGER': 'Pledger Charitable',
    'MATBIA': 'Matbia',
    'OJC': 'OJC Charity Card',
    'NEDARIM_PLUS': 'נדרים פלוס',
    'COMMITMENT': 'התחייבות',
    'OTHER': 'אחר'
};

export function PaymentMethodIcon({ method, showLabel = false, className = '', size }) {
    if (!method || !paymentMethodIcons[method]) return null;

    const IconComponent = paymentMethodIcons[method];
    const label = paymentMethodLabels[method] || method;

    return (
        <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {method !== 'OTHER' && <IconComponent style={{ width: `${size}px`, height: `${size}px` }} />}
            {showLabel && <span>{label}</span>}
        </span>
    );
}

export function getPaymentMethodIcon(method) {
    return paymentMethodIcons[method] || OtherIcon;
}

export function getPaymentMethodLabel(method) {
    // STRIPE, BEVEL, NEDARIM_PLUS יוצגו כ"כרטיס אשראי"
    if (method === 'STRIPE' || method === 'BEVEL' || method === 'NEDARIM_PLUS') {
        return 'כרטיס אשראי';
    }
    return paymentMethodLabels[method] || method;
}
