import fetch from 'node-fetch';
import Papa from 'papaparse';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const owner = 'mflanagan201';
const repo = 'Macro_release_Calendar';

// 1. Fetch email signups from GitHub Issues
async function getEmails() {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?labels=signup`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${GITHUB_TOKEN}`
    }
  });

  const issues = await res.json();
  return issues
    .map(issue => {
      const match = issue.title.match(/New Signup:\s*(.*)/);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);
}

// 2. Fetch and parse releases from CSV
async function getReleases() {
  const csvUrl = 'https://raw.githubusercontent.com/mflanagan201/gcal_auto/main/ECON_CAL.CSV';
  const csvData = await fetch(csvUrl).then(res => res.text());

  const { data } = Papa.parse(csvData, { header: true });
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  return data
    .filter(item => {
      if (!item.DTSTART) return false;
      const date = new Date(item.DTSTART.replace(' ', 'T'));
      return date >= now && date <= nextWeek;
    })
    .slice(0, 15); // Limit to 15 releases
}

// 3. Format the email
function formatEmail(releases) {
  if (!releases.length) return '<p>There are no economic indicators scheduled for next week.</p>';

  const rows = releases.map(r => {
    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const weekday = date.toLocaleDateString('en-IE', { weekday: 'long' });
    const fullDate = date.toLocaleDateString('en-IE', { month: 'long', day: 'numeric' });
    const title = r.SUMMARY || 'Unnamed release';
    const location = r.LOCATION || 'N/A';
    return `
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd;">${weekday}, ${fullDate}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${title}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${location}</td>
      </tr>
    `;
  }).join('\n');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto;">
      <p style="font-style: italic; color: #555;font-size:16px;">
        Hi, the following indicators will be released next week:
      </p>
      <table style="width: 100%; border-collapse: collapse; text-align: center;">
        <thead>
          <tr style="background-color: rgb(49, 84, 105); color: white;">
            <th style="padding: 12px; border: 1px solid #ddd;">Date</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Indicator</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Location</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin-top: 30px; font-size: 14px; color: #888;">— mflanagan201@gmail.com</p>
    </div>
  `;
}

// 4. Send via Brevo
async function sendEmail(toEmails, htmlContents) {
  for (let i = 0; i < toEmails.length; i++) {
    const email = toEmails[i];
    const html = htmlContents[i];

    const body = {
      sender: { name: "Macro Calendar", email: "noreply@macrocalendar.com" },
      to: [{ email }],
      subject: "Upcoming Economic Releases",
      htmlContent: html
    };

    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      if (!res.ok) {
        console.error(`Failed to send email to ${email}: ${text}`);
      } else {
        console.log(`Email sent to: ${email}`);
      }
    } catch (error) {
      console.error(`Error sending email to ${email}: ${error.message}`);
    }
  }
}

// 5. Main execution
(async () => {
  try {
    const emails = await getEmails();
    if (!emails.length) throw new Error("No email signups found.");

    const releases = await getReleases();
    const htmlContents = emails.map(() => formatEmail(releases));
    await sendEmail(emails, htmlContents);
  } catch (err) {
    console.error("Error in weekly email:", err.message);
    process.exit(1);
  }
})();