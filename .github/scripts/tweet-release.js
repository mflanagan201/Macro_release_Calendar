import fetch from 'node-fetch';
import Papa from 'papaparse';
import { TwitterApi } from 'twitter-api-v2';
import { createCanvas } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Twitter client
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function fetchReleases() {
  const csvUrl = 'https://raw.githubusercontent.com/mflanagan201/gcal_auto/main/ECON_CAL.CSV';
  const res = await fetch(csvUrl);
  const csvText = await res.text();
  const parsed = Papa.parse(csvText, { header: true }).data;

  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  return parsed.filter(r => {
    const dateStr = r.DTSTART?.replace(' ', 'T');
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date >= now && date <= nextWeek;
  });
}

async function generateImage(releases) {
  const width = 800;
  const rowHeight = 50;
  const padding = 20;
  const headerHeight = 60;
  const footerHeight = 40;
  const totalHeight = padding * 2 + headerHeight + rowHeight * releases.length + footerHeight;

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, totalHeight);

  // Table header background
  const headerTop = padding;
  ctx.fillStyle = '#315469';
  ctx.fillRect(padding, headerTop, width - padding * 2, headerHeight);

  // Header text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const col1 = padding + (width - padding * 2) * 0.2;
  const col2 = padding + (width - padding * 2) * 0.55;
  const col3 = padding + (width - padding * 2) * 0.85;
  ctx.fillText('Date', col1, headerTop + headerHeight / 2);
  ctx.fillText('Indicator', col2, headerTop + headerHeight / 2);
  ctx.fillText('Location', col3, headerTop + headerHeight / 2);

  // Rows
  ctx.font = '16px Arial';
  ctx.fillStyle = '#333';
  releases.forEach((r, idx) => {
    const y = headerTop + headerHeight + idx * rowHeight;
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(padding, y, width - padding * 2, rowHeight);

    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const dayStr = date.toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' });

    ctx.fillText(dayStr, col1, y + rowHeight / 2);
    ctx.fillText(r.SUMMARY || 'Unnamed', col2, y + rowHeight / 2);
    ctx.fillText(r.LOCATION || 'Ireland', col3, y + rowHeight / 2);
  });

  // Footer
  ctx.font = '14px Arial';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  ctx.fillText('— mflanagan201@gmail.com', width / 2, totalHeight - padding);

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join('/tmp', 'releases.png');
  await fs.writeFile(filePath, buffer);
  return filePath;
}

(async () => {
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
    const hashtags = "#Ireland #Economy #Macro";
    const tweetText = `Upcoming Economic Releases for Ireland – see the full list below! ${hashtags}`;

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