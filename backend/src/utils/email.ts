import crypto from 'crypto';

export async function sendEmail({ to, subject, text, html }: { to: string, subject: string, text: string, html: string }) {
  const isProduction = process.env.NODE_ENV === 'production';
  const mailProvider = process.env.EMAIL_PROVIDER; // 'sendgrid', 'resend', 'smtp'
  
  if (!mailProvider) {
    if (isProduction) {
      throw new Error('Email provider is not configured in production. Cannot send email.');
    }
    // Development-only fallback
    console.log('\n==================================================');
    console.log(' DEVELOPMENT EMAIL INTERCEPTED');
    console.log('==================================================');
    console.log(' To:', to);
    console.log(' Subject:', subject);
    console.log(' Body:', text);
    console.log('==================================================\n');
    return;
  }

  // Handle actual providers if needed later
  if (mailProvider === 'resend' && process.env.RESEND_API_KEY) {
     // Resend logic
     const response = await fetch('https://api.resend.com/emails', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         from: process.env.EMAIL_FROM || 'support@regencysalma.com',
         to,
         subject,
         html
       })
     });
     if (!response.ok) throw new Error('Failed to send Resend email');
     return;
  }
  
  throw new Error(`Configured email provider ${mailProvider} requires proper API keys`);
}

export function generateResetToken() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  return { resetToken, resetTokenHash };
}
