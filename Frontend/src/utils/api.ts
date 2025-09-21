//  API utility functions for external integrations

const PROXY_URL = 'https://hooks.jdoodle.net';

export interface SMSData {
  to: string;
  message: string;
}

export interface EmailData {
  to: string;
  subject: string;
  message: string;
}

// Send SMS via Twilio integration
export const sendSMS = async (data: SMSData) => {
  try {
    const response = await fetch(`${PROXY_URL}?url=https://api.twilio.com/2010-04-01/Accounts/ACCOUNT_SID/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        To: data.to,
        Body: data.message,
        From: '+1234567890' // Your Twilio number
      })
    });
    return await response.json();
  } catch (error) {
    console.error('SMS Error:', error);
    throw error;
  }
};

// Send email via SendGrid integration
export const sendEmail = async (data: EmailData) => {
  try {
    const response = await fetch(`${PROXY_URL}?url=https://api.sendgrid.com/v3/mail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: data.to }],
          subject: data.subject
        }],
        from: { email: 'noreply@blooddonation.com' },
        content: [{
          type: 'text/html',
          value: data.message
        }]
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Email Error:', error);
    throw error;
  }
};

// Store data in Google Sheets
export const storeInGoogleSheets = async (data: any) => {
  try {
    const response = await fetch(`${PROXY_URL}?url=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error('Google Sheets Error:', error);
    throw error;
  }
};
 