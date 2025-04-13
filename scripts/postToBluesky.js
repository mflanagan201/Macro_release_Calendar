import fetch from 'node-fetch';
import Papa from 'papaparse';
import pkg from '@atproto/api';
const { BskyAgent } = pkg;

const agent = new BskyAgent({ service: 'https://bsky.social' });

(async () => {
  try {
    await agent.login({
      identifier: process.env.BLUESKY_USER,
      password: process.env.BLUESKY_PASSWORD
    });

    // Fetch CSV
    const csvUrl = 'https://raw.githubusercontent.com/mflanagan201/gcal_auto/main/ECON_CAL.CSV';
    const res = await fetch(csvUrl);
    const csvText = await res.text();

    // Parse CSV
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

    const lines = releases.slice(0, 6).map(r => {
      const date = new Date(r.DTSTART.replace(' ', 'T'));
      const day = date.toLocaleDateString(undefined, { weekday: 'short' });
      return `• ${day}: ${r.SUMMARY}`;
    });

    const post = `This Week's Irish Economic Releases:\n${lines.join('\n')}\n\nMore at macrocalendar.com`;

    await agent.post({ text: post });
    console.log('Bluesky post sent successfully!');
  } catch (err) {
    console.error('Bluesky post failed:', err.message);
    process.exit(1);
  }
})();