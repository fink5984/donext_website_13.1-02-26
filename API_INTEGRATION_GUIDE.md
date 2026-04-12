# API Integration Guide - DoNext System

## 🚀 Quick Start

### Option 1: Using API Key (Recommended for Developers)

The simplest way to integrate with the DoNext API is using the system's **API Key**.

**API Key Location:** Found in `.env` file
```
API_KEY="dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Example Usage:**
```javascript
fetch('https://your-domain.com/api/donors/add-with-associations', {
  method: 'POST',
  headers: {
    'x-api-key': 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    campaignId: 123,
    fundraiserIds: [45],
    donorDetails: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      mainMobile: '0501234567'
    }
  })
});
```

**Benefits:**
- ✅ No expiration
- ✅ No login required
- ✅ Perfect for external integrations
- ✅ One key for all developers

---

### Option 2: Using JWT Token (For App Users)

For authenticated users within the application.

```javascript
// 1. Login first
const loginRes = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token } = await loginRes.json();

// 2. Use the token
fetch('/api/donors/add-with-associations', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ /* ... */ })
});
```

---

## 📚 Documentation Files

- **API_DOCUMENTATION.md** - Complete API documentation (Hebrew)
- **API_EXAMPLE_ADD_DONOR.js** - Examples using JWT Token
- **API_EXAMPLE_WITH_API_KEY.js** - Examples using API Key (recommended)
- **API_INTEGRATION_GUIDE.md** - This file

---

## 🔐 Security Notes

1. **API Key** - Keep it secret! Store in `.env` file, never commit to Git
2. **Production** - Generate a new strong API Key for production
3. **HTTPS** - Always use HTTPS in production

---

## 📖 Available Endpoints

### Add Donor with Associations
`POST /api/donors/add-with-associations`

Add a new donor to the system with optional fundraiser associations.

**Required Headers:**
```
x-api-key: YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "campaignId": 123,
  "fundraiserIds": [45, 67],
  "donorDetails": {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "mainMobile": "string",
    "expected": number
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "תורם נוסף בהצלחה",
  "data": {
    "person": { /* person details */ },
    "donors": [ /* donor records */ ],
    "donorsCount": 2
  }
}
```

---

## 💻 Code Examples

### Node.js
```javascript
const API_KEY = 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

async function addDonor(campaignId, fundraiserIds, donorDetails) {
  const response = await fetch('https://api.donext.com/api/donors/add-with-associations', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ campaignId, fundraiserIds, donorDetails })
  });
  
  return await response.json();
}
```

### cURL
```bash
curl -X POST https://api.donext.com/api/donors/add-with-associations \
  -H "x-api-key: dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": 123,
    "fundraiserIds": [45],
    "donorDetails": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "mainMobile": "0501234567"
    }
  }'
```

### Python
```python
import requests

API_KEY = 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
API_URL = 'https://api.donext.com/api/donors/add-with-associations'

def add_donor(campaign_id, fundraiser_ids, donor_details):
    response = requests.post(
        API_URL,
        headers={
            'x-api-key': API_KEY,
            'Content-Type': 'application/json'
        },
        json={
            'campaignId': campaign_id,
            'fundraiserIds': fundraiser_ids,
            'donorDetails': donor_details
        }
    )
    return response.json()
```

---

## 🆘 Troubleshooting

### Error: "No token provided" or "Invalid API key"
**Solution:** Make sure you're sending the `x-api-key` header with the correct value from `.env`

### Error: "חסר campaignId"
**Solution:** Include `campaignId` in your request body

### Error: "קמפיין לא נמצא"
**Solution:** Verify the campaign ID exists in the database

---

## 📞 Support

For questions or issues, contact the development team.
