import fetch from 'node-fetch';
import Papa from 'papaparse';
import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

(async () => {
  try {
    const csvUrl = 'https://raw.githubusercontent.com/mflanagan201/gcal_auto/main/ECON_CAL.CSV';
    const res = await fetch(csvUrl);
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header: true }).data;

    console.log("CSV rows received:", parsed.length);
    console.log("Sample row:", parsed[0]);

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 5);

    const releases = parsed.filter(r => {
      if (!r.DTSTART || !r.SUMMARY) return false;
      const date = new Date(r.DTSTART.replace(' ', 'T'));
      return date >= now && date <= nextWeek;
    });

    if (!releases.length) {
      console.log('No Irish economic releases in the next 5 days.');
      return;
    }

    const lines = releases.map(r => {
      const date = new Date(r.DTSTART.replace(' ', 'T'));
      const day = date.toLocaleDateString(undefined, { weekday: 'short' });
      return `• ${day}: ${r.SUMMARY}`;
    });

    const hashtags = '\n#Irisheconomy #ireland #economy #centralbank';
    let body = "This Week's Irish Economic Releases:\n\n";
    for (const line of lines) {
      if ((body + line + '\n\nMore at macrocalendar.com' + hashtags).length > 280) break;
      body += line + '\n\n';
    }
    body += 'More at macrocalendar.com' + hashtags;

    const response = await client.v2.tweet(body);
    console.log('Tweet sent successfully!', response);
  } catch (err) {
    console.error('Tweet failed:', err.response?.data || err.message || err);
    process.exit(1);
  }
})();