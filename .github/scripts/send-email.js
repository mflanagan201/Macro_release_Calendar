import fetch from 'node-fetch';
import Papa from 'papaparse';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const owner = 'mflanagan201';
const repo = 'Macro_release_Calendar';

async function fetchIssues() {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-action'
    }
  });

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(`Failed to fetch issues from GitHub. Response was not an array: ${JSON.stringify(data)}`);
  }

  return data;
}

function generateCSV(issues) {
  const csv = Papa.unparse(
    issues.map(issue => ({
      Title: issue.title,
      URL: issue.html_url,
      Created_At: issue.created_at
    }))
  );
  return csv;
}

async function sendEmail(csv) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Macro Calendar', email: 'noreply@macrocalendar.com' },
      to: [{ email: TO_EMAIL }],
      subject: 'Weekly Macro Release Update',
      htmlContent: `<p>Attached is your weekly update.</p><pre>${csv}</pre>`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send email: ${response.status} - ${errorText}`);
  }
}

(async () => {
  try {
    const issues = await fetchIssues();
    const csv = generateCSV(issues);
    await sendEmail(csv);
    console.log('Weekly email sent successfully.');
  } catch (err) {
    console.error('Error in weekly email:', err.message);
    process.exit(1);
  }
})();