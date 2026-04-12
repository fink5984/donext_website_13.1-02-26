/**
 * Donary Integration Service
 * 
 * This service handles all communication with the Donary API.
 * Documentation: https://developers.donary.com/docs/enterprise
 * 
 * Base URL: https://webapi.donary.com
 * Authentication: APIKey header
 */

import { sendDonationToMoney } from '@/lib/services/moneyApiService';

const DONARY_BASE_URL = 'https://webapi.donary.com';
const DONARY_SANDBOX_URL = 'https://sandbox-api.donary.com';

/**
 * Make a request to the Donary API
 * @param {string} endpoint - API endpoint
 * @param {string} apiKey - Donary API key
 * @param {Object} data - Request body data
 * @param {boolean} useSandbox - Use sandbox environment
 * @returns {Promise<Object>} - Response data
 */
async function donaryRequest(endpoint, apiKey, data, useSandbox = false) {
    const baseUrl = useSandbox ? DONARY_SANDBOX_URL : DONARY_BASE_URL;
    const url = `${baseUrl}${endpoint}`;
    
    console.log(`[Donary] ${endpoint}:`, JSON.stringify(data, null, 2));
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'APIKey': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            console.error(`[Donary] Error response:`, responseData);
            throw new Error(responseData.message || `Donary API error: ${response.status}`);
        }
        
        console.log(`[Donary] Success:`, responseData);
        return responseData;
    } catch (error) {
        console.error(`[Donary] Request failed:`, error);
        throw error;
    }
}

/**
 * Save/Update a donor in Donary
 * Uses the person's ID as the donorId for easy matching
 * 
 * @param {Object} params
 * @param {string} params.apiKey - Donary API key
 * @param {string} params.orgGuid - Organization GUID
 * @param {Object} params.person - Person object from our database
 * @param {boolean} params.useSandbox - Use sandbox environment
 * @returns {Promise<Object>} - Donary response with donorId
 */
async function saveDonor({ apiKey, orgGuid, person, useSandbox = false }) {
    // Build phone array
    const donorPhones = [];
    if (person.mainMobile) {
        donorPhones.push({
            phoneLabel: 'Mobile',
            phoneNumber: person.mainMobile.replace(/\D/g, ''), // Remove non-digits
            countryCode: 'USA' // Default, can be made dynamic
        });
    }
    if (person.phoneLandline) {
        donorPhones.push({
            phoneLabel: 'Home',
            phoneNumber: person.phoneLandline.replace(/\D/g, ''),
            countryCode: 'USA'
        });
    }
    if (person.secondaryMobile) {
        donorPhones.push({
            phoneLabel: 'Work',
            phoneNumber: person.secondaryMobile.replace(/\D/g, ''),
            countryCode: 'USA'
        });
    }
    
    // Build email array
    const donorEmails = [];
    if (person.email) {
        donorEmails.push({
            emailLabel: 'Personal',
            emailAddress: person.email
        });
    }
    
    // Build address array
    const donorAddresses = [];
    // We could add address info here if needed from city/street relations
    
    const data = {
        orgGuid,
        donorId: String(person.id), // Use our person ID as the Donary donor ID
        title: person.titleBefore || '',
        firstName: person.firstName || '',
        lastName: person.lastName || '',
        titleHebrew: person.titleBefore || '', // Hebrew title same as titleBefore
        firstNameHebrew: person.firstName || '', // For Hebrew names
        lastNameHebrew: person.lastName || '',
        suffixHebrew: person.titleAfter || '',
        donorPhones: donorPhones.length > 0 ? donorPhones : null,
        donorEmails: donorEmails.length > 0 ? donorEmails : null,
        donorAddresses: donorAddresses.length > 0 ? donorAddresses : null
    };
    
    return await donaryRequest('/V1/External/SaveDonor', apiKey, data, useSandbox);
}

/**
 * Save/Update a campaign in Donary
 * 
 * @param {Object} params
 * @param {string} params.apiKey - Donary API key
 * @param {string} params.orgGuid - Organization GUID
 * @param {Object} params.campaign - Campaign object from our database
 * @param {boolean} params.useSandbox - Use sandbox environment
 * @returns {Promise<Object>} - Donary response with campaignNumber
 */
async function saveCampaign({ apiKey, orgGuid, campaign, useSandbox = false }) {
    const data = {
        orgGuid,
        campaignNumber: campaign.id, // Use our campaign ID
        campaignName: campaign.name,
        campaignFriendlyName: campaign.nameEn || campaign.name
    };
    
    return await donaryRequest('/V1/External/SaveCampaign', apiKey, data, useSandbox);
}

/**
 * Save/Update a collector (fundraiser) in Donary
 * 
 * @param {Object} params
 * @param {string} params.apiKey - Donary API key
 * @param {string} params.orgGuid - Organization GUID
 * @param {Object} params.fundraiser - Fundraiser object with person relation
 * @param {boolean} params.useSandbox - Use sandbox environment
 * @returns {Promise<Object>} - Donary response with collectorNumber
 */
async function saveCollector({ apiKey, orgGuid, fundraiser, useSandbox = false }) {
    const person = fundraiser.person;
    
    const data = {
        orgGuid,
        collectorNumber: fundraiser.id, // Use our fundraiser ID
        collectorName: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
        collectorFriendlyName: `${person.firstName || ''} ${person.lastName || ''}`.trim()
    };
    
    return await donaryRequest('/V1/External/SaveCollector', apiKey, data, useSandbox);
}

/**
 * Sync all donors from a campaign to Donary
 * 
 * @param {Object} params
 * @param {string} params.apiKey - Donary API key
 * @param {string} params.orgGuid - Organization GUID
 * @param {Array} params.donors - Array of donor objects with person relation
 * @param {boolean} params.useSandbox - Use sandbox environment
 * @param {Function} params.onProgress - Callback for progress updates
 * @returns {Promise<Object>} - Summary of sync results
 */
async function syncAllDonors({ apiKey, orgGuid, donors, useSandbox = false, onProgress }) {
    const results = {
        total: donors.length,
        success: 0,
        failed: 0,
        errors: []
    };
    
    for (let i = 0; i < donors.length; i++) {
        const donor = donors[i];
        
        try {
            if (donor.person) {
                await saveDonor({
                    apiKey,
                    orgGuid,
                    person: donor.person,
                    useSandbox
                });
                results.success++;
            } else {
                results.failed++;
                results.errors.push({
                    donorId: donor.id,
                    error: 'No person data'
                });
            }
        } catch (error) {
            results.failed++;
            results.errors.push({
                donorId: donor.id,
                personId: donor.personId,
                error: error.message
            });
        }
        
        // Report progress
        if (onProgress) {
            onProgress({
                current: i + 1,
                total: donors.length,
                success: results.success,
                failed: results.failed
            });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
}

/**
 * Test connection to Donary API
 * 
 * @param {Object} params
 * @param {string} params.apiKey - Donary API key
 * @param {string} params.orgGuid - Organization GUID
 * @param {boolean} params.useSandbox - Use sandbox environment
 * @returns {Promise<boolean>} - True if connection successful
 */
async function testConnection({ apiKey, orgGuid, useSandbox = false }) {
    try {
        // Try to save a test campaign (will update if exists, create if not)
        await saveCampaign({
            apiKey,
            orgGuid,
            campaign: {
                id: 0, // Donary will assign a new number or use 0 as test
                name: 'DoNext Connection Test',
                nameEn: 'DoNext Connection Test'
            },
            useSandbox
        });
        return true;
    } catch (error) {
        console.error('[Donary] Connection test failed:', error);
        return false;
    }
}

/**
 * Process a charge webhook from Donary
 * Creates a single-payment donation record in our system
 * 
 * @param {Object} webhookData - Webhook payload from Donary (real format, not docs)
 * @param {Object} prisma - Prisma client
 * @param {number} campaignId - Campaign ID from URL
 * @returns {Promise<Object>} - Created donation or null
 */
async function processChargeWebhook(webhookData, prisma, campaignId) {
    const {
        donorInfo,
        amount,
        paymentNumber,
        paymentMethod,
        gatewayRefNum
    } = webhookData;
    
    // Extract donor info - real webhook format
    if (!donorInfo) {
        console.error('[Donary Webhook] Missing donorInfo');
        return null;
    }
    
    const donor = donorInfo.donor;
    if (!donor) {
        console.error('[Donary Webhook] Missing donor object in donorInfo');
        return null;
    }
    
    // The donorID from Donary is our person.id (we synced it that way)
    const donorID = donor.donorID;
    if (!donorID) {
        console.error('[Donary Webhook] Missing donorID');
        return null;
    }
    
    // Find the donor in our campaign by the donorID (which is person.id)
    const personId = parseInt(donorID);
    let donorRecord = await prisma.donor.findFirst({
        where: {
            personId: personId,
            campaignId: campaignId
        },
        include: {
            person: true
        }
    });
    
    if (!donorRecord) {
        console.error('[Donary Webhook] Donor not found in campaign:', { personId, campaignId, donorID });
        return null;
    }
    
    // Check if donation already exists (by payment number)
    const existingDonation = await prisma.donation.findFirst({
        where: {
            donorId: donorRecord.id,
            note: { contains: `Donary #${paymentNumber}` }
        }
    });
    
    if (existingDonation) {
        console.log('[Donary Webhook] Donation already exists:', existingDonation.id);
        return existingDonation;
    }
    
    // Create single-payment donation
    const donation = await prisma.donation.create({
        data: {
            donorId: donorRecord.id,
            monthlyAmount: parseFloat(amount) || 0,
            numberOfPayments: 1,
            hasPaymentMethod: true,
            donateApproval: true,
            paymentMethod: mapDonaryPaymentMethod(paymentMethod),
            createdInSystem: 'DONARY',
            note: `Donary #${paymentNumber} | Ref: ${gatewayRefNum || 'N/A'} | ${donorRecord.person.firstName} ${donorRecord.person.lastName}`
        }
    });

    // שליחה ל-Money API
    await sendDonationToMoney({
        campaignId: campaignId,
        donationId: donation.id,
        firstName: donorRecord.person?.firstName,
        lastName: donorRecord.person?.lastName,
        phone: donorRecord.id.toString(),
        amount: parseFloat(amount) || 0,
        numberOfPayments: 1,
        hasPaymentMethod: true,
        cityName: donorRecord.person?.city?.name
    });
    
    console.log('[Donary Webhook] Created charge donation:', donation.id);
    return donation;
}

/**
 * Process a schedule webhook from Donary
 * Creates a multi-payment donation record in our system
 * 
 * @param {Object} webhookData - Webhook payload from Donary
 * @param {Object} prisma - Prisma client
 * @param {number} campaignId - Campaign ID from URL
 * @returns {Promise<Object>} - Created donation or null
 */
async function processScheduleWebhook(webhookData, prisma, campaignId) {
    const {
        scheduleUniqueID,
        totalScheduleAmount,
        countOfSchedules,
        frequency,
        donorInfo,
        firstPayment
    } = webhookData;
    
    // Find the person by their ID
    const donorNumber = donorInfo?.donorNumber;
    if (!donorNumber) {
        console.error('[Donary Webhook] No donor number in schedule webhook');
        return null;
    }
    
    const personId = parseInt(donorNumber);
    if (isNaN(personId)) {
        console.error('[Donary Webhook] Invalid donor number:', donorNumber);
        return null;
    }
    
    // Find the donor record
    const donor = await prisma.donor.findFirst({
        where: {
            personId: personId,
            campaignId: campaignId
        },
        include: {
            person: true,
            campaign: true
        }
    });
    
    if (!donor) {
        console.error('[Donary Webhook] Donor not found for personId:', personId, 'in campaign:', campaignId);
        return null;
    }
    
    // Check if schedule already exists
    const existingDonation = await prisma.donation.findFirst({
        where: {
            donorId: donor.id,
            note: { contains: `Schedule: ${scheduleUniqueID}` }
        }
    });
    
    if (existingDonation) {
        console.log('[Donary Webhook] Schedule donation already exists:', existingDonation.id);
        return existingDonation;
    }
    
    // Calculate payment details
    // IMPORTANT: countOfSchedules from Donary is the number of FUTURE scheduled payments
    // It does NOT include the first payment that was already processed
    // So total payments = countOfSchedules + 1 (if first payment exists)
    
    const scheduledPayments = parseInt(countOfSchedules) || 1;
    const hasFirstPayment = firstPayment && firstPayment.amount;
    
    // Total number of payments includes the first payment
    const numPayments = hasFirstPayment ? scheduledPayments + 1 : scheduledPayments;
    
    // Use firstPayment.amount as the monthly amount (most accurate)
    // Fallback to totalScheduleAmount / numPayments
    const monthlyAmount = hasFirstPayment 
        ? parseFloat(firstPayment.amount)
        : (parseFloat(totalScheduleAmount) || 0) / numPayments;
    
    // Remaining payments for Bevel = scheduled payments (without the first one that's already done)
    const remainingPaymentsForBevel = scheduledPayments;
    
    console.log('[Donary Webhook] Payment calculation:');
    console.log(`  - Scheduled payments (from Donary): ${scheduledPayments}`);
    console.log(`  - First payment done: ${hasFirstPayment ? 'Yes ($' + firstPayment.amount + ')' : 'No'}`);
    console.log(`  - Total payments: ${numPayments}`);
    console.log(`  - Amount per payment: $${monthlyAmount}`);
    console.log(`  - Remaining for Bevel: ${remainingPaymentsForBevel}`);
    
    // Get payment method from first payment if available
    const paymentMethod = firstPayment?.paymentMethod 
        ? mapDonaryPaymentMethod(firstPayment.paymentMethod)
        : null;
    
    // Create multi-payment donation
    const donation = await prisma.donation.create({
        data: {
            donorId: donor.id,
            monthlyAmount: monthlyAmount,
            numberOfPayments: numPayments,
            hasPaymentMethod: true,
            donateApproval: true,
            paymentMethod: paymentMethod,
            createdInSystem: 'DONARY',
            note: `Donary Schedule: ${scheduleUniqueID} | ${frequency} | Total: $${parseFloat(totalScheduleAmount)} (${numPayments} × $${monthlyAmount}) | ⚠️ צריך להקים schedule ב-Bevel`,
            // Store remaining payments for Bevel (not including the first one already done in Donary)
            bevelPaymentsLeft: remainingPaymentsForBevel
        }
    });

    // שליחה ל-Money API
    await sendDonationToMoney({
        campaignId: campaignId,
        donationId: donation.id,
        firstName: donor.person?.firstName,
        lastName: donor.person?.lastName,
        phone: donor.id.toString(),
        amount: monthlyAmount,
        numberOfPayments: numPayments,
        hasPaymentMethod: true,
        cityName: donor.person?.city?.name
    });
    
    console.log('[Donary Webhook] Created schedule donation:', donation.id, 'with', numPayments, 'total payments');
    console.log('[Donary Webhook] Remaining payments for Bevel:', remainingPaymentsForBevel);
    
    // Try to create Bevel schedule automatically if:
    // 1. Campaign has Bevel API key
    // 2. First payment was done via USAePay (gatewayName)
    // 3. We have the gateway reference number
    const gatewayName = firstPayment?.gatewayName;
    const gatewayRefNum = firstPayment?.gatewayRefNum;
    
    if (donor.campaign.bevelApiKey && gatewayName === 'USAePay' && gatewayRefNum && remainingPaymentsForBevel > 0) {
        console.log('[Donary Webhook] Attempting to create Bevel schedule automatically...');
        console.log(`  - Gateway: ${gatewayName}`);
        console.log(`  - Ref Num: ${gatewayRefNum}`);
        
        try {
            const { createBevelScheduleFromTransaction } = require('./bevelScheduleService');
            
            const bevelResult = await createBevelScheduleFromTransaction({
                campaign: donor.campaign,
                gatewayRefNum: gatewayRefNum,
                donor: donor,
                amountPerPayment: monthlyAmount,
                remainingPayments: remainingPaymentsForBevel,
                prisma: prisma,
                donationId: donation.id
            });
            
            if (bevelResult.success) {
                console.log('[Donary Webhook] ✅ Bevel schedule created automatically!');
                console.log(`  - Schedule ID: ${bevelResult.scheduleId}`);
                console.log(`  - Next payment: ${bevelResult.nextPaymentDate}`);
            } else {
                console.log('[Donary Webhook] ⚠️ Could not create Bevel schedule automatically');
                console.log(`  - Reason: ${bevelResult.message}`);
            }
        } catch (bevelError) {
            console.error('[Donary Webhook] Error creating Bevel schedule:', bevelError.message);
            // Don't fail the webhook - donation was created successfully
        }
    } else {
        console.log('[Donary Webhook] Skipping automatic Bevel schedule creation:');
        if (!donor.campaign.bevelApiKey) console.log('  - No Bevel API key');
        if (gatewayName !== 'USAePay') console.log(`  - Gateway is ${gatewayName}, not USAePay`);
        if (!gatewayRefNum) console.log('  - No gateway reference number');
    }
    
    return donation;
}

/**
 * Map Donary payment method to our enum
 * @param {string} donaryMethod - Donary payment method string
 * @returns {string} - Our payment method
 */
function mapDonaryPaymentMethod(donaryMethod) {
    const methodMap = {
        'Credit_Card': 'CREDIT',
        'Credit Card': 'CREDIT',
        'ACH': 'BANK_TRANSFER',
        'OJC': 'OJC',
        'Matbia': 'MATBIA',
        'Pledger': 'PLEDGER',
        'Donors_Fund': 'OTHER'
    };
    
    return methodMap[donaryMethod] || 'CREDIT';
}

module.exports = {
    saveDonor,
    saveCampaign,
    saveCollector,
    syncAllDonors,
    testConnection,
    processChargeWebhook,
    processScheduleWebhook,
    DONARY_BASE_URL,
    DONARY_SANDBOX_URL
};
