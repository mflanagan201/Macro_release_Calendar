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

function drawRoundedRect(ctx, x, y, width, height, radius, color) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

async function generateImage(releases) {
  const width = 800;
  const rowHeight = 60;
  const padding = 20;
  const headerHeight = 60;
  const tableWidth = width - padding * 2;
  const radius = 10;
  const totalHeight = padding * 2 + headerHeight + rowHeight * releases.length;

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, totalHeight);

  const col1Width = tableWidth * 0.2; // Date
  const col2Width = tableWidth * 0.6; // Indicator
  const col3Width = tableWidth * 0.2; // Location

  const col1Center = padding + col1Width / 2;
  const col2Center = padding + col1Width + col2Width / 2;
  const col3Center = padding + col1Width + col2Width + col3Width / 2;

  // Draw header with rounded corners
  drawRoundedRect(ctx, padding, padding, tableWidth, headerHeight, radius, '#315469');

  ctx.fillStyle = 'white';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('Date', col1Center, padding + headerHeight / 2);
  ctx.fillText('Indicator', col2Center, padding + headerHeight / 2);
  ctx.fillText('Location', col3Center, padding + headerHeight / 2);

  // Draw rows
  ctx.font = '16px Arial';
  releases.forEach((r, idx) => {
    const y = padding + headerHeight + idx * rowHeight;

    // Alternate row background
    ctx.fillStyle = idx % 2 === 0 ? 'white' : '#f9f9f9';
    ctx.fillRect(padding, y, tableWidth, rowHeight);

    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(padding, y, tableWidth, rowHeight);

    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const dayStr = date.toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' });

    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textY = y + rowHeight / 2;

    ctx.fillText(dayStr, col1Center, textY);
    ctx.fillText(r.SUMMARY || 'Unnamed', col2Center, textY);
    ctx.fillText(r.LOCATION || 'Ireland', col3Center, textY);
  });

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
    const hashtags = "#IRE #economy #macro #nextweek #upcoming #eire";
    const tweetText = `Upcoming Economic Releases for Ireland – see the full list at https://www.macrocalendar.com/ ${hashtags}`;

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