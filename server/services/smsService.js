/**
 * Twilio SMS Service
 * Handles sending SMS alerts to caretakers when medicine is not taken.
 * Gracefully degrades if Twilio credentials are not configured.
 */

let client = null;
let isConfigured = false;

/**
 * Initialize the Twilio client
 */
const init = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken && 
      accountSid !== 'your_account_sid_here' && 
      authToken !== 'your_auth_token_here') {
    try {
      const twilio = require('twilio');
      client = twilio(accountSid, authToken);
      isConfigured = true;
      console.log('📱 Twilio SMS service initialized');
    } catch (error) {
      console.warn('⚠️  Twilio initialization failed:', error.message);
      isConfigured = false;
    }
  } else {
    console.warn('⚠️  Twilio credentials not configured. SMS alerts will be logged but not sent.');
    console.warn('   Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env');
    isConfigured = false;
  }
};

/**
 * Send SMS alert to a single phone number
 * @param {string} to - Recipient phone number (with country code)
 * @param {string} message - SMS message body
 * @returns {object} Result with success status and message SID
 */
const sendSMS = async (to, message) => {
  if (!isConfigured || !client) {
    console.log(`📱 [SMS SIMULATION] To: ${to}`);
    console.log(`   Message: ${message}`);
    return { success: true, simulated: true, to, message };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log(`📱 SMS sent to ${to} | SID: ${result.sid}`);
    return { success: true, sid: result.sid, to };
  } catch (error) {
    console.error(`❌ SMS failed to ${to}: ${error.message}`);
    return { success: false, error: error.message, to };
  }
};

/**
 * Send alert SMS to all active caretakers
 * @param {Array} caretakers - Array of caretaker documents
 * @param {object} schedule - The missed schedule document
 * @returns {Array} Results for each SMS attempt
 */
const sendAlertToCaretakers = async (caretakers, schedule) => {
  const time = schedule.scheduledTime;
  const medicineName = schedule.medicineName || 'Medicine';
  
  const message = `⚠️ MEDICINE ALERT: ${medicineName} scheduled at ${time} was NOT taken. Please check on the patient immediately.`;

  console.log(`📱 Sending alerts to ${caretakers.length} caretaker(s)...`);

  const results = [];
  for (const caretaker of caretakers) {
    if (!caretaker.isActive) continue;
    
    const personalMessage = `Hello ${caretaker.name}, ${message}`;
    const result = await sendSMS(caretaker.phone, personalMessage);
    results.push({
      ...result,
      caretakerName: caretaker.name,
      caretakerPhone: caretaker.phone,
      sentAt: new Date()
    });
  }

  return results;
};

/**
 * Check if Twilio is properly configured
 * @returns {boolean}
 */
const getStatus = () => ({
  configured: isConfigured,
  phoneNumber: isConfigured ? process.env.TWILIO_PHONE_NUMBER : null
});

module.exports = { init, sendSMS, sendAlertToCaretakers, getStatus };
