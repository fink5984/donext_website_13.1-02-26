const { PrismaClient } = require('@prisma/client');

async function testBevelCustomer() {
    const prisma = new PrismaClient();
    
    try {
        // Get campaign 137 with Bevel credentials
        const campaign = await prisma.campaign.findUnique({
            where: { id: 137 }
        });
        
        if (!campaign) {
            console.log('No campaign with Bevel API key found');
            return;
        }
        
        console.log('Campaign:', campaign.id, campaign.name);
        console.log('API Key (first 20 chars):', campaign.bevelApiKey?.substring(0, 20) + '...');
        console.log('API Pin:', campaign.bevelApiPin);
        
        // Generate auth - same as bevelScheduleService.js
        const crypto = require('crypto');
        const apiKey = campaign.bevelApiKey;
        const apiPin = campaign.bevelApiPin || '';
        
        // Generate random seed
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let seed = '';
        for (let i = 0; i < 16; i++) {
            seed += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const preHash = apiKey + seed + apiPin;
        const hash = crypto.createHash('sha256').update(preHash).digest('hex');
        const authString = `${apiKey}:s2/${seed}/${hash}`;
        const authKey = Buffer.from(authString).toString('base64');
        
        console.log('\n--- Testing Create Customer From Transaction ---');
        
        // The transaction key from the last test
        const transactionKey = 'gdb2k7q3rz0rr943';
        
        const baseUrl = 'https://usaepay.com/api/v2';
        
        // Test with company name
        const customerData = {
            transaction_key: transactionKey,
            company: 'Test Donor Name'
        };
        
        console.log('Request body:', JSON.stringify(customerData, null, 2));
        
        const response = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify(customerData)
        });
        
        const result = await response.json();
        console.log('\nResponse status:', response.status);
        console.log('Response:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testBevelCustomer();
