const fetch = require('node-fetch');
const Papa = require('papaparse');

// 1. Fetch email signups from GitHub Issues
async function getEmails() {
  const issues = await fetch('https://api.github.com/repos/mflanagan201/Macro_release_Calendar/issues?labels=signup', {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN || ''}` // optional if public repo
    }
  }).then(res => res.json());

  return issues.map(issue => {
    const match = issue.title.match(/New Signup:\s*(.*)/);
    return match ? match[1].trim() : null;
  }).filter(Boolean);
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
  });
}

// 3. Format the email
function formatEmail(releases) {
  if (!releases.length) return 'There are no economic indicators scheduled for next week.';

  const grouped = releases.map(r => {
    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const fullDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    return `<li><strong>${weekday}, ${fullDate}</strong> — ${r.SUMMARY || 'Unnamed release'}${r.LOCATION ? ` (${r.LOCATION})` : ''}</li>`;
  }).join('\n');

  return `
    <p>Here are the key economic indicators scheduled for next week:</p>
    <ul>${grouped}</ul>
    <p>— Macro Release Calendar</p>
  `;
}

// 4. Send via Brevo
async function sendEmail(toEmails, html) {
  const body = {
  sender: { name: "Macro Calendar", email: "noreply@macrocalendar.com" },  // Make sure this is verified in Brevo
  to: [{ email: TO_EMAIL }],
  subject: "Test Email from Macro Release Calendar",
  htmlContent: html
};
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to send email: ${errText}`);
  }

  console.log("Email sent to:", toEmails.join(', '));
}

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
