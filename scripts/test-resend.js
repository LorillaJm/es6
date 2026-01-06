// Quick test script for Resend email
// Run with: node scripts/test-resend.js your-email@gmail.com

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_GYwUfKpH_5CpniKuuscroxeYZaFBVy5Ja';
const RESEND_FROM = process.env.RESEND_FROM || 'Attendance System <noreply@passicitycollege.online>';

async function testResend(toEmail) {
    console.log('Testing Resend email...');
    console.log('From:', RESEND_FROM);
    console.log('To:', toEmail);
    
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: RESEND_FROM,
                to: [toEmail],
                subject: '✅ Resend Test - Email Working!',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
                        <h2 style="color: #4f46e5;">🎉 Email Test Successful!</h2>
                        <p>Your Resend integration with <strong>passicitycollege.online</strong> is working correctly.</p>
                        <p style="color: #6b7280; font-size: 14px;">Sent at: ${new Date().toISOString()}</p>
                    </div>
                `,
            }),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('\n✅ SUCCESS! Email sent');
            console.log('Message ID:', data.id);
            console.log('\nCheck your inbox (and spam folder)!');
        } else {
            console.log('\n❌ FAILED');
            console.log('Error:', data);
        }
    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
    }
}

// Get email from command line argument
const testEmail = process.argv[2];

if (!testEmail) {
    console.log('Usage: node scripts/test-resend.js your-email@gmail.com');
    process.exit(1);
}

testResend(testEmail);
