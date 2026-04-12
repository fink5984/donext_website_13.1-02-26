# הגדרת Webhook של PixelArt

## מה לשלוח לתמיכת PixelArt

### 1. Webhook URL
```
https://your-domain.com/api/donations/webhook-pixelart
```
**החליפו `your-domain.com` בדומיין בפועל שלכם**

### 2. JSON Template
```json
{
  "campaign_id": {{ambassador_custom1}},
  "phone": "{{phone}}",
  "monthly_amount": {{monthly_amount}},
  "num_of_months": {{num_of_months}},
  "event": "{{event}}",
  "external_donation_id": {{donation_id}}
}
```

## חשוב לדעת

- **`campaign_id`** - צריך להגדיר ב-PixelArt שבשדה `ambassador_custom1` יהיה מזהה הקמפיין שלנו (כמספר)
- **התורם חייב להיות קיים** במערכת לפני שהוא תורם ב-PixelArt
- **הטלפון צריך להיות תואם** למה שבמערכת
- המערכת מחפשת טלפון בכל השדות: `mainMobile`, `secondaryMobile`, `phoneLandline`

## בדיקה מהירה
```bash
curl -X POST https://your-domain.com/api/donations/webhook-pixelart \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": 1,
    "phone": "0501234567",
    "monthly_amount": 100,
    "num_of_months": 12,
    "event": "created",
    "external_donation_id": 999
  }'
```

