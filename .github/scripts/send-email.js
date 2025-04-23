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
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  const contentType = res.headers.get('content-type');
  if (!res.ok || !contentType.includes('application/json')) {
    const errorText = await res.text();
    throw new Error(`GitHub Issues API error: ${errorText}`);
  }

  const issues = await res.json();
  if (!Array.isArray(issues)) {
    throw new Error(`Unexpected GitHub response format: ${JSON.stringify(issues)}`);
  }

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

  return data.filter(item => {
    if (!item.DTSTART) return false;
    const date = new Date(item.DTSTART.replace(' ', 'T'));
    return date >= now && date <= nextWeek;
  }).slice(0, 15); // Limit to 15 releases
}

// 3. Format the email
function formatEmail(releases) {
  if (!releases.length) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto;">
        <h2 style="color: #2C3E50;">Weekly Economic Calendar – Ireland</h2>
        <p style="font-style: italic; color: #555;">
          Hi, there are no economic indicators scheduled for next week.
        </p>
        <p style="margin-top: 30px; font-size: 14px; color: #888;">— Macro Release Calendar</p>
      </div>
    `;
  }

  const rows = releases.map(r => {
    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const fullDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    const title = r.SUMMARY || 'Unnamed release';
    const location = r.LOCATION || 'N/A';

    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${weekday}, ${fullDate}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${title}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${location}</td>
      </tr>
    `;
  }).join('\n');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto;">
      <h2 style="color: #2C3E50;">Weekly Economic Calendar – Ireland</h2>
      <p style="font-style: italic; color: #555;">
        Hi, here are the key economic indicators scheduled for next week:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr>
            <th style="padding: 8px; border: 1px solid #ddd; background-color: #4CAF50; color: white;">Date</th>
            <th style="padding: 8px; border: 1px solid #ddd; background-color: #4CAF50; color: white;">Title</th>
            <th style="padding: 8px; border: 1px solid #ddd; background-color: #4CAF50; color: white;">Location</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin-top: 30px; font-size: 14px; color: #888;">— Macro Release Calendar</p>
      <p style="font-size: 12px; color: #888;">
        To unsubscribe, please visit <a href="https://github.com/${owner}/${repo}/issues/new?labels=unsubscribe&title=Unsubscribe%20Request">this link</a> and submit an issue labeled 'unsubscribe'.
      </p>
    </div>
  `;
}

// 4. Send via Brevo
async function sendEmail(toEmails, html) {
  const body = {
    sender: { name: "Macro Calendar", email: "noreply@macrocalendar.com" },
    to: toEmails.map(email => ({ email })),
    subject: "Upcoming Economic Releases – Ireland Weekly Summary",
    htmlContent: html
  };

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
    throw new Error(`Failed to send email: ${text}`);
  }

  console.log("Email sent to:", toEmails.join(', '));
}

// Main execution
(async () => {
  try {
    const emails = await getEmails();
    if (!emails.length) throw new Error("No email signups found.");

    const releases = await getReleases();
    const html = formatEmail(releases);
    await sendEmail(emails, html);
  } catch (err) {
    console.error("Error in weekly email:", err.message);
    process.exit(1);
  }
})();