import fetch from 'node-fetch';
import Papa from 'papaparse';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';

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

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const releases = parsed.filter(r => {
      const dateStr = r.DTSTART?.replace(' ', 'T');
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= now && date <= nextWeek;
    });

    if (!releases.length) {
      console.log('No releases found for next week.');
      return;
    }

    const lines = releases.slice(0, 6).map(r => {
      const date = new Date(r.DTSTART.replace(' ', 'T'));
      const day = date.toLocaleDateString(undefined, { weekday: 'short' });
      return `• ${day}: ${r.SUMMARY}`;
    });

    const tweet = `Next Week's Economic Releases:\n${lines.join('\n')}\n\nMore: macrocalendar.com`;

    await client.v2.tweet(tweet);
    console.log('Tweet sent successfully!');
  } catch (err) {
    console.error('Tweet failed:', err.message);
    process.exit(1);
  }
})();