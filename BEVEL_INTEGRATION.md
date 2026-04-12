# Bevel Payment Integration

## Overview
This document describes the integration of Bevel (USAePay) payment processing into the DoNext donation system.

## Features
- **PCI Compliant**: Uses USAePay's pay.js to handle card data securely without touching your server
- **No Extended PCI Requirements**: Card data never passes through your servers
- **Sandbox & Production Support**: Test in sandbox before going live
- **RTL Support**: Fully compatible with Hebrew/RTL layouts

## Setup Instructions

### 1. Get Your API Key
1. Sign up for a Bevel/USAePay account at https://www.usaepay.com/
2. Navigate to Settings → API Keys in the merchant console
3. Click "Add API Key"
4. Add a PIN to your API Key (recommended and required for most functionality)
5. Copy your API key (starts with `_` for production or different prefix for sandbox)

### 2. Configure in DoNext

#### Admin Panel Configuration
1. Go to `/admin/payment-settings` in your campaign
2. Find "Bevel" in the payment methods list
3. Toggle it ON
4. Enter your API Key in the modal that appears
5. Click "Save"

#### Database Migration
Run the migration to add the Bevel API key field:
```bash
# Apply the migration
psql -U your_username -d your_database -f migration_add_bevel_api_key_to_campaigns.sql

# Or if using Prisma
npx prisma db push
```

### 3. Test the Integration

#### Sandbox Testing
- Use environment: `sandbox`
- Base URL: `https://sandbox.usaepay.com`
- Test card numbers: See USAePay documentation

#### Test Cards (Sandbox)
```
Approved: 4000100011112224
Declined: 4000300011112220
CVV Fail: 4000200011112221
```

## API Documentation

### Backend Endpoint
**POST** `/api/payments/bevel`

Request Body:
```json
{
  "token": "payment_token_from_pay_js",
  "amount": 100.00,
  "campaignId": 123,
  "donorName": "John Doe",
  "donorEmail": "john@example.com",
  "description": "Donation to Campaign"
}
```

Response (Success):
```json
{
  "success": true,
  "transactionId": "bnf17whjvqqpj2s",
  "refnum": "124444201",
  "authcode": "147598",
  "amount": "100.00",
  "message": "התשלום עבר בהצלחה"
}
```

Response (Error):
```json
{
  "error": "Transaction declined",
  "message": "התשלום נדחה על ידי חברת האשראי",
  "details": "Insufficient funds"
}
```

## Component Usage

### DonationForm Integration
The Bevel payment is automatically shown when:
1. User selects "Bevel" as payment method
2. Campaign has a valid Bevel API key configured

```jsx
{formData.paymentMethod === 'BEVEL' && bevelApiKey && (
    <BevelPayment
        amount={amount}
        onSuccess={handleBevelPaymentSuccess}
        onError={handleBevelPaymentError}
        apiKey={bevelApiKey}
        environment="sandbox"
    />
)}
```

## Security

### Authentication
The API uses USAePay's authentication mechanism:
1. Generate random seed (16 chars)
2. Create pre-hash: `apiKey + seed + apiPin`
3. Hash with SHA256
4. Create auth hash: `s2/{seed}/{sha256Hash}`
5. Base64 encode: `apiKey:authHash`
6. Send as: `Authorization: Basic {base64}`

### PCI Compliance
- **Card data never touches your server**
- USAePay's pay.js handles all card input
- Only tokens are sent to your server
- Tokens are one-time use only

## Payment Flow

```
1. User enters card details
   ↓
2. pay.js tokenizes card data
   ↓
3. Token sent to your backend
   ↓
4. Backend calls USAePay API with token
   ↓
5. USAePay processes payment
   ↓
6. Response returned to frontend
   ↓
7. Donation saved to database
```

## Troubleshooting

### Common Issues

#### "מפתח API חסר" (API Key Missing)
- Ensure API key is configured in `/admin/payment-settings`
- Check that campaign has `bevelApiKey` field populated

#### "שגיאה בטעינת מערכת התשלום" (Error Loading Payment System)
- Check browser console for script loading errors
- Verify pay.js script URL is correct for environment
- Check network connectivity

#### "התשלום נדחה" (Payment Declined)
- Card may be declined by issuer
- Check USAePay merchant console for detailed decline reason
- Verify test card details if in sandbox

#### Authentication Errors
- Verify API key format is correct
- Check that API PIN is configured if required
- Ensure seed generation is working properly

## Environment Variables

No environment variables needed - API key is stored per campaign in database.

## Files Modified/Created

### New Files
- `components/DonationForm/BevelPayment.js` - Payment component
- `components/DonationForm/BevelPayment.module.scss` - Styles
- `app/api/payments/bevel/route.js` - Backend API endpoint
- `migration_add_bevel_api_key_to_campaigns.sql` - Database migration

### Modified Files
- `prisma/schema.prisma` - Added bevelApiKey field
- `app/api/campaigns/[id]/payment-settings/route.js` - Handle Bevel settings
- `app/[locale]/(app)/admin/payment-settings/page.js` - UI for configuration
- `components/DonationForm/DonationForm.js` - Integration with payment form
- `components/DonationForm/PaymentMethodSelect.js` - Added Bevel option
- `app/components/PaymentMethodIcon.js` - Added Bevel label

## API Rate Limits

USAePay implements rate limits:
- Default: 45 requests/minute, 5000 requests/day
- Higher limits available by registering endpoint in Dev Portal
- Monitor `X-Rate-Limit` header in responses

## Support

For USAePay/Bevel support:
- Documentation: https://help.usaepay.info/
- Developer Portal: https://usaepay.com/developer/
- API Reference: https://help.usaepay.info/api/rest/

## Production Checklist

Before going live:
- [ ] Test thoroughly in sandbox environment
- [ ] Verify API key is for production (not sandbox)
- [ ] Update environment to 'production' in code
- [ ] Test with small real transaction
- [ ] Monitor first few transactions closely
- [ ] Set up webhook notifications (optional)
- [ ] Document API key securely
- [ ] Train staff on refund procedures
