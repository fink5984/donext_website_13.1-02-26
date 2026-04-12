/**
 * Bevel Schedule Service
 * Creates recurring payment schedules in Bevel/USAePay
 * Used when donations come from external sources (like Donary) 
 * and need to continue payments through Bevel
 * 
 * IMPORTANT: This service creates FUTURE billing schedules WITHOUT charging immediately.
 * The first payment is assumed to have been done elsewhere (e.g., Donary).
 */

const crypto = require('crypto');

/**
 * Generate authentication for USAePay API
 * @param {string} apiKey - Bevel API key
 * @param {string} apiPin - Bevel API PIN
 * @returns {string} - Base64 encoded auth string
 */
function generateBevelAuth(apiKey, apiPin) {
    const seed = generateRandomString(16);
    const preHash = apiKey + seed + (apiPin || '');
    const apiHash = 's2/' + seed + '/' + crypto.createHash('sha256').update(preHash).digest('hex');
    return Buffer.from(apiKey + ':' + apiHash).toString('base64');
}

/**
 * Generate random string for API authentication
 * @param {number} length - Length of string
 * @returns {string} - Random string
 */
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Create a FUTURE billing schedule in Bevel/USAePay WITHOUT charging immediately.
 * This is used when the first payment was already done in another system (like Donary).
 * 
 * Flow:
 * 1. Create customer in Bevel
 * 2. Save payment method using payment_key (NO charge)
 * 3. Create billing schedule for REMAINING payments (starts next month)
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.campaign - Campaign with bevelApiKey and bevelApiPin
 * @param {string} params.paymentKey - Payment key from pay.js (one-time token)
 * @param {Object} params.donor - Donor record with person info
 * @param {number} params.amountPerPayment - Amount to charge per payment
 * @param {number} params.totalPayments - TOTAL number of payments (including first done elsewhere)
 * @param {number} params.paymentsAlreadyDone - Number of payments already completed (default: 1)
 * @param {Object} params.prisma - Prisma client for updates
 * @param {number} params.donationId - Donation ID to update with Bevel IDs
 * @returns {Promise<Object>} - Result with custkey, schedule_id, etc.
 */
async function createBevelFutureSchedule({
    campaign,
    paymentKey,
    donor,
    amountPerPayment,
    totalPayments,
    paymentsAlreadyDone = 1,
    prisma,
    donationId
}) {
    if (!campaign.bevelApiKey) {
        throw new Error('Campaign does not have Bevel API key configured');
    }

    const remainingPayments = totalPayments - paymentsAlreadyDone;
    
    if (remainingPayments <= 0) {
        throw new Error(`No payments remaining. Total: ${totalPayments}, Already done: ${paymentsAlreadyDone}`);
    }

    console.log(`[Bevel Schedule] Creating FUTURE schedule:`);
    console.log(`  - Total payments: ${totalPayments}`);
    console.log(`  - Already done: ${paymentsAlreadyDone}`);
    console.log(`  - Remaining (to schedule): ${remainingPayments}`);
    console.log(`  - Amount per payment: ${amountPerPayment}`);

    const isProduction = !campaign.bevelApiKey.includes('sandbox');
    const baseUrl = isProduction
        ? 'https://usaepay.com/api/v2'
        : 'https://sandbox.usaepay.com/api/v2';

    const authKey = generateBevelAuth(campaign.bevelApiKey, campaign.bevelApiPin);

    const donorName = `${donor.person?.firstName || ''} ${donor.person?.lastName || ''}`.trim() || 'Anonymous Donor';
    const donorEmail = donor.person?.email || '';
    const donorPhone = donor.person?.mainMobile || '';

    const hasNonAscii = /[^\x00-\x7F]/.test(donorName);
    const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

    try {
        // ========================================
        // Step 1: Create customer
        // ========================================
        console.log('[Bevel Schedule] Step 1: Creating customer for:', donorName);

        const customerData = hasNonAscii ? {
            company: donorName,
            street: donor.person?.street || 'N/A',
            city: donor.person?.city || 'N/A',
            state: 'N/A',
            postalcode: '00000',
            phone: donorPhone,
            email: donorEmail
        } : {
            first_name: capitalize(donorName.split(' ')[0]) || 'Anonymous',
            last_name: capitalize(donorName.split(' ').slice(1).join(' ')) || 'Donor',
            company: donorName,
            street: donor.person?.street || 'N/A',
            city: donor.person?.city || 'N/A',
            state: 'N/A',
            postalcode: '00000',
            phone: donorPhone,
            email: donorEmail
        };

        const customerResponse = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify(customerData)
        });

        if (!customerResponse.ok) {
            const errorData = await customerResponse.json().catch(() => ({}));
            console.error('[Bevel Schedule] Customer creation failed:', errorData);
            throw new Error(`Failed to create customer: ${JSON.stringify(errorData)}`);
        }

        const customer = await customerResponse.json();
        const custkey = customer.key;
        console.log('[Bevel Schedule] Customer created:', custkey);

        // ========================================
        // Step 2: Add payment method WITHOUT charging
        // Using authonly command with $0 or $1 then void
        // ========================================
        console.log('[Bevel Schedule] Step 2: Saving payment method (NO CHARGE)');

        // Try $0 auth first to validate and save card
        let authResponse = await fetch(`${baseUrl}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify({
                command: 'authonly',
                payment_key: paymentKey,
                amount: '0.00',
                custkey: custkey,
                save_customer_paymethod: true,
                description: `Save payment method - Campaign ${campaign.id}`
            })
        });

        let authResult = null;
        
        // If $0 auth doesn't work, try $1 auth then void
        if (!authResponse.ok) {
            console.log('[Bevel Schedule] $0 auth not supported, trying $1 auth + void...');
            
            authResponse = await fetch(`${baseUrl}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authKey}`
                },
                body: JSON.stringify({
                    command: 'authonly',
                    payment_key: paymentKey,
                    amount: '1.00',
                    custkey: custkey,
                    save_customer_paymethod: true,
                    description: `Card verification - Campaign ${campaign.id}`
                })
            });
            
            if (authResponse.ok) {
                authResult = await authResponse.json();
                
                if (authResult.result_code === 'A' && authResult.key) {
                    // VOID the authorization immediately - no charge will happen
                    console.log('[Bevel Schedule] Voiding verification auth:', authResult.key);
                    
                    await fetch(`${baseUrl}/transactions/${authResult.key}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Basic ${authKey}`
                        }
                    });
                    console.log('[Bevel Schedule] Authorization voided - no charge made');
                }
            }
        } else {
            authResult = await authResponse.json();
            console.log('[Bevel Schedule] $0 auth successful:', authResult.result_code);
        }

        // ========================================
        // Step 3: Get payment method key
        // ========================================
        console.log('[Bevel Schedule] Step 3: Retrieving saved payment method');

        const paymentMethodsResponse = await fetch(`${baseUrl}/customers/${custkey}/payment_methods`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${authKey}`
            }
        });

        if (!paymentMethodsResponse.ok) {
            throw new Error('Failed to retrieve payment methods');
        }

        const paymentMethods = await paymentMethodsResponse.json();
        const paymethodKey = paymentMethods.data?.[0]?.key;

        if (!paymethodKey) {
            throw new Error('No payment method was saved. Card may be invalid.');
        }
        
        console.log('[Bevel Schedule] Payment method saved:', paymethodKey);

        // ========================================
        // Step 4: Create Billing Schedule for FUTURE payments
        // ========================================
        console.log('[Bevel Schedule] Step 4: Creating billing schedule');

        // Calculate next payment date (next month)
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const startDate = nextMonth.toISOString().split('T')[0]; // YYYY-MM-DD

        const scheduleData = {
            paymethod_key: paymethodKey,
            amount: parseFloat(amountPerPayment).toFixed(2),
            description: `Campaign ${campaign.id} - Recurring (${remainingPayments} payments remaining)`,
            enabled: true,
            frequency: 'monthly',
            next_date: startDate,
            start_date: startDate,
            numleft: String(remainingPayments),  // Only remaining payments!
            send_receipt: true,
            skip_count: "1"  // Every month
        };

        console.log('[Bevel Schedule] Schedule data:', JSON.stringify(scheduleData, null, 2));

        const scheduleResponse = await fetch(`${baseUrl}/customers/${custkey}/billing_schedules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify([scheduleData])  // API expects array
        });

        if (!scheduleResponse.ok) {
            const errorData = await scheduleResponse.json().catch(() => ({}));
            console.error('[Bevel Schedule] Schedule creation failed:', errorData);
            throw new Error(`Failed to create billing schedule: ${JSON.stringify(errorData)}`);
        }

        const scheduleResult = await scheduleResponse.json();
        const scheduleId = scheduleResult[0]?.key;
        
        console.log('[Bevel Schedule] ✅ Schedule created successfully!');
        console.log(`  - Schedule ID: ${scheduleId}`);
        console.log(`  - Next payment: ${startDate}`);
        console.log(`  - Payments scheduled: ${remainingPayments}`);
        console.log(`  - Amount per payment: $${amountPerPayment}`);

        // ========================================
        // Step 5: Update donation record
        // ========================================
        if (donationId && prisma) {
            console.log('[Bevel Schedule] Step 5: Updating donation record');
            
            // Get existing note
            const existingDonation = await prisma.donation.findUnique({ 
                where: { id: donationId },
                select: { note: true }
            });
            
            // Update donation with Bevel info
            await prisma.donation.update({
                where: { id: donationId },
                data: {
                    bevelCustKey: custkey,
                    bevelScheduleId: scheduleId,
                    bevelPaymethodKey: paymethodKey,
                    bevelPaymentsLeft: remainingPayments,
                    paymentMethod: 'BEVEL',
                    note: existingDonation?.note
                        ? existingDonation.note.replace('⚠️ צריך להקים schedule ב-Bevel', '✅ Bevel schedule פעיל')
                        : existingDonation?.note
                }
            });
            
            console.log('[Bevel Schedule] Donation updated successfully');
        }

        return {
            success: true,
            custkey,
            scheduleId,
            paymethodKey,
            totalPayments,
            paymentsAlreadyDone,
            remainingPayments,
            nextPaymentDate: startDate,
            amountPerPayment: parseFloat(amountPerPayment).toFixed(2),
            noChargeNow: true,  // Confirm no charge was made
            message: `Bevel schedule created for ${remainingPayments} future payments. First payment on ${startDate}. No charge was made today.`
        };

    } catch (error) {
        console.error('[Bevel Schedule] Error:', error);
        throw error;
    }
}

/**
 * Charge a payment using existing customer and payment method
 * Used to manually trigger a payment for an existing customer
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.campaign - Campaign with bevelApiKey
 * @param {string} params.custkey - Bevel customer key
 * @param {string} params.paymethodKey - Bevel payment method key
 * @param {number} params.amount - Amount to charge
 * @returns {Promise<Object>} - Transaction result
 */
async function chargeExistingCustomer({
    campaign,
    custkey,
    paymethodKey,
    amount
}) {
    if (!campaign.bevelApiKey) {
        throw new Error('Campaign does not have Bevel API key configured');
    }

    const isProduction = !campaign.bevelApiKey.includes('sandbox');
    const baseUrl = isProduction
        ? 'https://usaepay.com/api/v2'
        : 'https://sandbox.usaepay.com/api/v2';

    const authKey = generateBevelAuth(campaign.bevelApiKey, campaign.bevelApiPin);

    const transactionData = {
        command: 'sale',
        custkey: custkey,
        paymethod_key: paymethodKey,
        amount: parseFloat(amount).toFixed(2),
        description: `Campaign ${campaign.id} - Manual Payment`
    };

    const response = await fetch(`${baseUrl}/transactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authKey}`
        },
        body: JSON.stringify(transactionData)
    });

    const result = await response.json();

    if (result.result_code !== 'A') {
        throw new Error(`Transaction declined: ${result.result || 'Unknown error'}`);
    }

    return {
        success: true,
        transactionId: result.refnum,
        authCode: result.authcode,
        amount: result.auth_amount
    };
}

/**
 * Get billing schedule details from Bevel
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.campaign - Campaign with bevelApiKey
 * @param {string} params.custkey - Customer key
 * @param {string} params.scheduleId - Billing schedule key
 * @returns {Promise<Object>} - Schedule details
 */
async function getBevelSchedule({
    campaign,
    custkey,
    scheduleId
}) {
    if (!campaign.bevelApiKey) {
        throw new Error('Campaign does not have Bevel API key configured');
    }

    const isProduction = !campaign.bevelApiKey.includes('sandbox');
    const baseUrl = isProduction
        ? 'https://usaepay.com/api/v2'
        : 'https://sandbox.usaepay.com/api/v2';

    const authKey = generateBevelAuth(campaign.bevelApiKey, campaign.bevelApiPin);

    const response = await fetch(`${baseUrl}/customers/${custkey}/billing_schedules/${scheduleId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${authKey}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to retrieve billing schedule');
    }

    const schedule = await response.json();

    return {
        key: schedule.key,
        amount: schedule.amount,
        enabled: schedule.enabled === '1' || schedule.enabled === true,
        frequency: schedule.frequency,
        nextDate: schedule.next_date,
        paymentsLeft: schedule.numleft === '-1' ? 'unlimited' : parseInt(schedule.numleft),
        description: schedule.description,
        sendReceipt: schedule.send_receipt === '1' || schedule.send_receipt === true
    };
}

/**
 * Cancel a billing schedule in Bevel
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.campaign - Campaign with bevelApiKey
 * @param {string} params.custkey - Customer key
 * @param {string} params.scheduleId - Billing schedule key
 * @returns {Promise<Object>} - Result
 */
async function cancelBevelSchedule({
    campaign,
    custkey,
    scheduleId
}) {
    if (!campaign.bevelApiKey) {
        throw new Error('Campaign does not have Bevel API key configured');
    }

    const isProduction = !campaign.bevelApiKey.includes('sandbox');
    const baseUrl = isProduction
        ? 'https://usaepay.com/api/v2'
        : 'https://sandbox.usaepay.com/api/v2';

    const authKey = generateBevelAuth(campaign.bevelApiKey, campaign.bevelApiPin);

    const response = await fetch(`${baseUrl}/customers/${custkey}/billing_schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Basic ${authKey}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to cancel billing schedule');
    }

    return {
        success: true,
        message: 'Billing schedule cancelled'
    };
}

/**
 * Create a Bevel billing schedule from an existing transaction (refnum)
 * This is used when Donary already processed a payment through USAePay
 * and we want to continue the schedule in Bevel
 * 
 * Flow:
 * 1. Get transaction details using refnum
 * 2. Get or create customer from transaction
 * 3. Get saved payment method
 * 4. Create billing schedule for remaining payments
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.campaign - Campaign with bevelApiKey
 * @param {string} params.gatewayRefNum - USAePay transaction reference number from Donary
 * @param {Object} params.donor - Donor info
 * @param {number} params.amountPerPayment - Amount per payment
 * @param {number} params.remainingPayments - Number of remaining payments
 * @param {Object} params.prisma - Prisma client
 * @param {number} params.donationId - Donation ID to update
 * @returns {Promise<Object>} - Result
 */
async function createBevelScheduleFromTransaction({
    campaign,
    gatewayRefNum,
    donor,
    amountPerPayment,
    remainingPayments,
    prisma,
    donationId
}) {
    if (!campaign.bevelApiKey) {
        throw new Error('Campaign does not have Bevel API key configured');
    }

    if (remainingPayments <= 0) {
        throw new Error('No payments remaining to schedule');
    }

    console.log(`[Bevel Schedule] Creating schedule from existing transaction:`);
    console.log(`  - Gateway Ref Num: ${gatewayRefNum}`);
    console.log(`  - Remaining payments: ${remainingPayments}`);
    console.log(`  - Amount per payment: ${amountPerPayment}`);

    const isProduction = !campaign.bevelApiKey.includes('sandbox');
    const baseUrl = isProduction
        ? 'https://usaepay.com/api/v2'
        : 'https://sandbox.usaepay.com/api/v2';

    const authKey = generateBevelAuth(campaign.bevelApiKey, campaign.bevelApiPin);

    try {
        // Step 1: Get transaction details using refnum
        console.log('[Bevel Schedule] Step 1: Fetching transaction details');
        
        const transactionResponse = await fetch(`${baseUrl}/transactions?refnum=${gatewayRefNum}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${authKey}`
            }
        });

        if (!transactionResponse.ok) {
            const errorText = await transactionResponse.text();
            console.error('[Bevel Schedule] Failed to fetch transaction:', errorText);
            throw new Error(`Transaction not found: ${gatewayRefNum}`);
        }

        const transactionData = await transactionResponse.json();
        console.log('[Bevel Schedule] Transaction data:', JSON.stringify(transactionData, null, 2));

        // Get the transaction key
        const transKey = transactionData.data?.[0]?.key || transactionData.key;
        let custkey = transactionData.data?.[0]?.custkey || transactionData.custkey;
        let paymethodKey = null;

        if (!custkey && transKey) {
            // Transaction doesn't have a customer - CREATE ONE from the transaction!
            console.log('[Bevel Schedule] No customer found, creating customer from transaction...');
            console.log('[Bevel Schedule] Transaction key:', transKey);
            
            // Prepare donor info for customer creation
            // USAePay requires either first_name+last_name OR company name
            const donorName = `${donor?.person?.firstName || ''} ${donor?.person?.lastName || ''}`.trim();
            const hasNonAscii = /[^\x00-\x7F]/.test(donorName);
            
            let customerInfo = {
                transaction_key: transKey
            };
            
            // Add donor details to customer
            if (donorName) {
                if (hasNonAscii) {
                    // Hebrew name - use company field
                    customerInfo.company = donorName;
                    console.log('[Bevel Schedule] Using company name (Hebrew):', donorName);
                } else {
                    // English name - use first/last name fields
                    const nameParts = donorName.split(' ');
                    customerInfo.first_name = nameParts[0] || 'Donor';
                    customerInfo.last_name = nameParts.slice(1).join(' ') || 'Anonymous';
                    console.log('[Bevel Schedule] Using first/last name:', customerInfo.first_name, customerInfo.last_name);
                }
            } else {
                // No name available - use default company name
                customerInfo.company = `Donor ${donor?.id || 'Unknown'}`;
                console.log('[Bevel Schedule] Using default company name:', customerInfo.company);
            }
            
            // Add contact info if available
            if (donor?.person?.email) {
                customerInfo.email = donor.person.email;
            }
            if (donor?.person?.mainMobile) {
                customerInfo.phone = donor.person.mainMobile;
            }
            
            console.log('[Bevel Schedule] Customer info:', JSON.stringify(customerInfo, null, 2));
            
            // Use USAePay's "Create Customer From Transaction" API
            const createCustomerResponse = await fetch(`${baseUrl}/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authKey}`
                },
                body: JSON.stringify(customerInfo)
            });
            
            if (createCustomerResponse.ok) {
                const customerData = await createCustomerResponse.json();
                custkey = customerData.key;
                console.log('[Bevel Schedule] ✅ Customer created from transaction!');
                console.log('[Bevel Schedule] New custkey:', custkey);
                
                // Get the payment method that was saved with the customer
                const paymentMethodsResponse = await fetch(`${baseUrl}/customers/${custkey}/payment_methods`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${authKey}`
                    }
                });
                
                if (paymentMethodsResponse.ok) {
                    const paymentMethods = await paymentMethodsResponse.json();
                    paymethodKey = paymentMethods.data?.[0]?.key;
                    console.log('[Bevel Schedule] Payment method from new customer:', paymethodKey);
                }
            } else {
                const errorData = await createCustomerResponse.json().catch(() => ({}));
                console.error('[Bevel Schedule] Failed to create customer from transaction:', errorData);
            }
        }

        if (!custkey) {
            // Still no customer - cannot create schedule automatically
            console.log('[Bevel Schedule] Cannot create customer from transaction');
            console.log('[Bevel Schedule] Manual card entry will be required');
            
            // Update donation to indicate manual setup needed
            if (donationId && prisma) {
                const existingDonation = await prisma.donation.findUnique({
                    where: { id: donationId },
                    select: { note: true }
                });
                
                const currentNote = existingDonation?.note || '';
                const newNote = currentNote 
                    ? `${currentNote} | ❌ לא ניתן להקים schedule אוטומטית - נדרשת הזנת כרטיס ידנית`
                    : '❌ לא ניתן להקים schedule אוטומטית - נדרשת הזנת כרטיס ידנית';
                
                await prisma.donation.update({
                    where: { id: donationId },
                    data: {
                        note: newNote
                    }
                });
            }
            
            return {
                success: false,
                needsManualSetup: true,
                message: 'Cannot create schedule automatically - manual card entry required',
                gatewayRefNum
            };
        }

        console.log('[Bevel Schedule] Found customer:', custkey);

        // Step 2: Get customer's payment methods (if not already retrieved)
        if (!paymethodKey) {
            console.log('[Bevel Schedule] Step 2: Getting payment methods');
            
            const paymentMethodsResponse = await fetch(`${baseUrl}/customers/${custkey}/payment_methods`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${authKey}`
                }
            });

            if (paymentMethodsResponse.ok) {
                const paymentMethods = await paymentMethodsResponse.json();
                paymethodKey = paymentMethods.data?.[0]?.key;
                console.log('[Bevel Schedule] Payment method:', paymethodKey);
            }
        } else {
            console.log('[Bevel Schedule] Step 2: Payment method already retrieved:', paymethodKey);
        }

        if (!paymethodKey) {
            console.log('[Bevel Schedule] No payment method found for customer');
            return {
                success: false,
                needsManualSetup: true,
                message: 'No payment method found - manual card entry required',
                custkey
            };
        }

        // Step 3: Create billing schedule
        console.log('[Bevel Schedule] Step 3: Creating billing schedule');

        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const startDate = nextMonth.toISOString().split('T')[0];

        const scheduleData = {
            paymethod_key: paymethodKey,
            amount: parseFloat(amountPerPayment).toFixed(2),
            description: `Campaign ${campaign.id} - Auto from Donary (Ref: ${gatewayRefNum})`,
            enabled: true,
            frequency: 'monthly',
            next_date: startDate,
            start_date: startDate,
            numleft: String(remainingPayments),
            send_receipt: true,
            skip_count: "1"
        };

        const scheduleResponse = await fetch(`${baseUrl}/customers/${custkey}/billing_schedules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify([scheduleData])
        });

        if (!scheduleResponse.ok) {
            const errorData = await scheduleResponse.json().catch(() => ({}));
            console.error('[Bevel Schedule] Schedule creation failed:', errorData);
            throw new Error(`Failed to create schedule: ${JSON.stringify(errorData)}`);
        }

        const scheduleResult = await scheduleResponse.json();
        const scheduleId = scheduleResult[0]?.key;

        console.log('[Bevel Schedule] ✅ Schedule created successfully!');
        console.log(`  - Schedule ID: ${scheduleId}`);
        console.log(`  - Next payment: ${startDate}`);
        console.log(`  - Payments: ${remainingPayments}`);

        // Step 4: Update donation record
        if (donationId && prisma) {
            const existingDonation = await prisma.donation.findUnique({
                where: { id: donationId },
                select: { note: true }
            });

            await prisma.donation.update({
                where: { id: donationId },
                data: {
                    bevelCustKey: custkey,
                    bevelScheduleId: scheduleId,
                    bevelPaymethodKey: paymethodKey,
                    bevelPaymentsLeft: remainingPayments,
                    paymentMethod: 'BEVEL',
                    note: existingDonation?.note
                        ? existingDonation.note.replace('⚠️ צריך להקים schedule ב-Bevel', '✅ Bevel schedule פעיל')
                        : existingDonation?.note
                }
            });
        }

        return {
            success: true,
            custkey,
            scheduleId,
            paymethodKey,
            remainingPayments,
            nextPaymentDate: startDate,
            amountPerPayment: parseFloat(amountPerPayment).toFixed(2),
            message: `Bevel schedule created for ${remainingPayments} payments starting ${startDate}`
        };

    } catch (error) {
        console.error('[Bevel Schedule] Error:', error);
        throw error;
    }
}

module.exports = {
    createBevelFutureSchedule,
    createBevelScheduleFromTransaction,
    chargeExistingCustomer,
    getBevelSchedule,
    cancelBevelSchedule,
    generateBevelAuth
};
