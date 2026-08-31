const nodemailer = require('nodemailer');
require('dotenv').config({ path: './.env' }); // Make sure it reads from the root .env

async function testEmail() {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  console.log('User:', user);
  console.log('App Password defined:', !!appPassword);

  if (user && appPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: appPassword,
        },
      });

      const info = await transporter.sendMail({
        from: `"SR Mall" <${user}>`,
        to: 'golroger07roger@gmail.com',
        cc: 'srmall@admin.com',
        subject: 'Test Email from SR Mall System',
        text: 'This is a test email to verify that the Gmail configuration is working correctly.',
      });

      console.log('Email sent successfully:', info.response);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  } else {
    console.error('GMAIL_USER or GMAIL_APP_PASSWORD is not set in .env');
    return false;
  }
}

testEmail();
