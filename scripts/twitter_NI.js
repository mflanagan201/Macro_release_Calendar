import fetch from 'node-fetch';
import Papa from 'papaparse';
import { TwitterApi } from 'twitter-api-v2';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs/promises';
import path from 'path';

// Initialize Twitter client
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function fetchReleases() {
  const csvUrl = 'https://raw.githubusercontent.com/mflanagan201/gcal_auto/main/NI_CALENDAR.CSV';
  const res = await fetch(csvUrl);
  const csvText = await res.text();
  const parsed = Papa.parse(csvText, { header: true }).data;

  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 8);

  return parsed.filter(r > {
    const dateStr = r.DTSTART?.replace(' ', 'T');
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date >= now && date <= nextWeek;
  });
}

async function generateImage(releases) {
  const width = 800;
  const rowHeight = 40;
  const padding = 20;
  const height = padding * 2 + rowHeight * (releases.length + 1);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#315469';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('Economic Releases – Next Week', padding, padding + 30);

  // Table headers
  ctx.fillStyle = '#333';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('Date', padding, padding + 70);
  ctx.fillText('Release', width / 3, padding + 70);

  // Table rows
  ctx.font = '16px Arial';
  releases.forEach((r, idx) => {
    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const day = date.toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' });
    ctx.fillText(day, padding, padding + 70 + (idx + 1) * rowHeight);
    ctx.fillText(r.SUMMARY || 'Unnamed', width / 3, padding + 70 + (idx + 1) * rowHeight);
  });

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join('/tmp', 'releases.png');
  await fs.writeFile(filePath, buffer);
  return filePath;
}

(async () > {
  try {
    const releases = await fetchReleases();

    if (!releases.length) {
      console.log('No releases found for next week.');
      return;
    }

    const imagePath = await generateImage(releases);

    // Upload the image to Twitter
    const mediaId = await client.v1.uploadMedia(imagePath);

    // Compose the tweet text
    const hashtags = "#NI #NorthernIreland #UK #Release";
    const tweetText = `Upcoming Economic Releases for Northern Ireland – see the full list below! ${hashtags}`;

    // Send the tweet
    await client.v2.tweet({
      text: tweetText,
      media: {
        media_ids: [mediaId],
      },
    });

    console.log('Tweet with image sent successfully!');
  } catch (err) {
    console.error('Tweet failed:', err.message);
    process.exit(1);
  }
})();
