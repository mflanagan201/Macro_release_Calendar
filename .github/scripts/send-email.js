import fetch from 'node-fetch';
import Papa from 'papaparse';

// 1. Fetch email signups from GitHub Issues
async function getEmails() {
  const res = await fetch('https://api.github.com/repos/mflanagan201/Macro_release_Calendar/issues?labels=signup', {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN || ''}`
    }
  });

  const issues = await res.json();

  if (!Array.isArray(issues)) {
    console.error("Unexpected response from GitHub API:", issues);
    throw new Error("Failed to fetch issues from GitHub. Response was not an array.");
  }

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
  if (!releases.length) {
    return '<p>There are no economic indicators scheduled for next week.</p>';
  }

  const limitedReleases = releases.slice(0, 15);

  const listItems = limitedReleases.map(r => {
    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const fullDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    const title = r.SUMMARY || 'Unnamed release';

    return `
      <div style="padding: 12px 0; border-bottom: 1px solid #ddd;">
        <strong>${weekday}, ${fullDate}</strong><br/>
        ${title}
      </div>
    `;
  }).join('');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto;">
      <h2 style="color: #2C3E50;">Weekly Economic Calendar</h2>
      <p style="font-style: italic; color: #555;">
        Hi, the following indicators will be released next week:
      </p>
      <div style="font-size: 15px;">
        ${listItems}
      </div>
      <p style="margin-top: 30px; font-size: 14px; color: #888;">— Macro Release Calendar</p>
    </div>
  `;
}

// 4. Send via Brevo
async function sendEmail(toEmails, html) {
  const body = {
    sender: { name: "Macro Calendar", email: "noreply@macrocalendar.com" },
    to: toEmails.map(email => ({ email })),
    subject: "Weekly Economic Calendar",
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

// 5. Run the job
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