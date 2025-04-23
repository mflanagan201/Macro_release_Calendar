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
  if (!releases.length) return '<p>There are no economic indicators scheduled for next week.</p>';

  const rows = releases.map(r => {
    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const fullDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    const title = r.SUMMARY || 'Unnamed release';
    const location = r.LOCATION || 'N/A';
    return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #ddd;">${weekday}, ${fullDate}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #ddd;">${title}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #ddd;">${location}</td>
      </tr>
    `;
  }).join('\n');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto;">
      <p style="font-style: italic; color: #555;">
        Hi, here are the key economic indicators scheduled for next week:
      </p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: rgb(49, 84, 105); color: white;">
            <th style="padding: 12px 8px; text-align: left;">Date</th>
            <th style="padding: 12px 8px; text-align: left;">Indicator</th>
            <th style="padding: 12px 8px; text-align: left;">Location</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin-top: 30px; font-size: 14px; color: #888;">— Macro Release Calendar</p>
    </div>
  `;
}

// 4. Send via Brevo
async function sendEmail(toEmails, html) {
  const body = {
    sender: { name: "Macro Calendar", email: "noreply@macrocalendar.com" },
    to: toEmails.map(email => ({ email })),
    subject: "Upcoming Economic Releases – Weekly Summary",
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

// 5. Unsubscribe function
async function unsubscribeEmail(email) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?labels=signup`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${GITHUB_TOKEN}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub Issues API error: ${errorText}`);
  }

  const issues = await res.json();
  const issue = issues.find(issue => issue.title.includes(email));
  if (!issue) {
    console.log(`No signup issue found for ${email}`);
    return;
  }

  const issueNumber = issue.number;

  // Remove the 'signup' label
  const deleteRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels/signup`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${GITHUB_TOKEN}`
    }
  });

  if (!deleteRes.ok) {
    const errorText = await deleteRes.text();
    throw new Error(`Failed to remove label: ${errorText}`);
  }

  console.log(`Unsubscribed ${email}`);
}

// 6. Main function
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