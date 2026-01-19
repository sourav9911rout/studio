'use server';

import { DailyHighlight } from '@/lib/types';
import { format } from 'date-fns';
import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string[];
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    throw new Error('Email environment variables are not configured. Please check your .env file.');
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT, 10),
    secure: parseInt(EMAIL_PORT, 10) === 465, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Department of Pharmacology" <${EMAIL_USER}>`,
    to: to.join(','),
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
}

function generateHighlightHTML(dailyHighlight: DailyHighlight): string {
    const { date, drugs } = dailyHighlight;
    const formattedDate = format(new Date(date.replace(/-/g, '/')), 'MMMM d, yyyy');
  
    if (!drugs || drugs.length === 0) {
      return `<p>No drug highlights for ${formattedDate}.</p>`;
    }
  
    const drugsHTML = drugs.map(drug => `
      <div style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <h2 style="font-size: 1.5em; color: #333;">${drug.drugName}</h2>
        <table style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif;">
          ${Object.entries(drug)
            .filter(([key]) => !['id', 'drugName'].includes(key))
            .map(([key, value]) => {
                let displayValue = '';
                // A helper function to create a readable label from a camelCase key
                const createLabel = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());

                if (key === 'offLabelUse' && typeof value === 'object' && value !== null) {
                    const offLabel = value as { value: string; references: string[] };
                    displayValue = offLabel.value ? offLabel.value.replace(/\n/g, '<br>') : 'N/A';
                    if (offLabel.references && offLabel.references.length > 0) {
                        displayValue += '<br/><br/><b>References:</b><ul style="margin: 0; padding-left: 20px;">' + offLabel.references.map(ref => `<li><a href="${ref}" target="_blank" style="color: #0066cc;">${ref}</a></li>`).join('') + '</ul>';
                    }
                } else if (typeof value === 'string') {
                    displayValue = value.replace(/\n/g, '<br>') || 'N/A';
                } else {
                    displayValue = 'N/A'
                }

                return `
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px 8px; font-weight: bold; width: 30%; vertical-align: top; background-color: #f9f9f9;">${createLabel(key)}</td>
                  <td style="padding: 10px 8px; vertical-align: top;">${displayValue}</td>
                </tr>`;
            })
            .join('')
          }
        </table>
      </div>
    `).join('');
  
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: auto; border: 1px solid #ddd; padding: 20px;">
        <h1 style="color: #16a085; text-align: center;">Daily Drug Highlight</h1>
        <p style="text-align: center; font-size: 1.2em; margin-bottom: 20px;">${formattedDate}</p>
        <p>Respected Madam/Sir,</p>
        <p>Please find the drug highlight(s) for today:</p>
        <hr>
        ${drugsHTML}
        <br>
        <p>Best Regards,</p>
        <p><b>Department of Pharmacology</b></p>
      </div>
    `;
  }

export async function sendDailyHighlightEmail(
    dailyHighlight: DailyHighlight,
    recipients: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    if (!recipients || recipients.length === 0) {
        return { success: false, message: 'No recipients provided.' };
    }
    if (!dailyHighlight || !dailyHighlight.drugs || dailyHighlight.drugs.length === 0) {
        return { success: false, message: 'No drug highlights to send for the selected date.' };
    }

    const subject = `Pharmacology Daily Highlight: ${format(
        new Date(dailyHighlight.date.replace(/-/g, '/')),
      'MMMM d, yyyy'
    )}`;
    const html = generateHighlightHTML(dailyHighlight);

    await sendEmail({ to: recipients, subject, html });

    return { success: true, message: 'Email sent successfully!' };
  } catch (error) {
    console.error('Failed to send email:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `Failed to send email. ${errorMessage}` };
  }
}
