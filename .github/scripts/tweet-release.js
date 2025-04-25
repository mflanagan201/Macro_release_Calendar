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

function drawWrappedText(ctx, text, x, y, maxWidth) {
  const words = text.split(' ');
  let line = '';
  let lineHeight = 18;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
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

  const col1X = padding + 10;
  const col2X = col1X + col1Width;
  const col3X = col2X + col2Width;

  // Draw header with rounded corners
  drawRoundedRect(ctx, padding, padding, tableWidth, headerHeight, radius, '#315469');

  ctx.fillStyle = 'white';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillText('Date', col1X, padding + headerHeight / 2);
  ctx.fillText('Indicator', col2X, padding + headerHeight / 2);
  ctx.fillText('Location', col3X, padding + headerHeight / 2);

  // Draw rows
  ctx.font = '16px Arial';
  ctx.textBaseline = 'top';
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
    drawWrappedText(ctx, dayStr, col1X, y + 10, col1Width - 20);
    drawWrappedText(ctx, r.SUMMARY || 'Unnamed', col2X, y + 10, col2Width - 20);
    drawWrappedText(ctx, r.LOCATION || 'Ireland', col3X, y + 10, col3Width - 20);
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
    const hashtags = "#Ireland #Economy #Macro";
    const tweetText = `Upcoming Economic Releases for Ireland – see the full list below!\nhttps://www.macrocalendar.com/ ${hashtags}`;

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