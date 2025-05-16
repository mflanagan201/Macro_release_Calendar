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
  nextWeek.setDate(now.getDate() + 8);

  return parsed.filter(r => {
    const dateStr = r.DTSTART?.replace(' ', 'T');
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date > now && date <= nextWeek;
  });
}

// Helper function for wrapping long text
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  let lines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + word + ' ';
    const { width } = ctx.measureText(testLine);
    if (width > maxWidth && currentLine !== '') {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}

async function generateImage(releases) {
  const width = 800;
  const padding = 20;
  const headerHeight = 50;
  const rowHeight = 70;
  const columnWidths = [160, 440, 160]; // Date | Indicator | Location
  const height = padding * 2 + headerHeight + rowHeight * releases.length + 60; // extra space for link

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  // Header background
  ctx.fillStyle = '#315469';
  ctx.fillRect(padding, padding, width - padding * 2, headerHeight);

  // Headers
  ctx.fillStyle = 'white';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const headers = ['Date', 'Indicator', 'Location'];
  let x = padding;
  headers.forEach((header, idx) => {
    ctx.fillText(header, x + columnWidths[idx] / 2, padding + headerHeight / 2);
    x += columnWidths[idx];
  });

  // Rows
  ctx.font = '16px Arial';
  releases.forEach((r, idx) => {
    const yStart = padding + headerHeight + idx * rowHeight;

    // Row background
    ctx.fillStyle = idx % 2 === 0 ? '#f9f9f9' : '#ffffff';
    ctx.fillRect(padding, yStart, width - padding * 2, rowHeight);

    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';

    const date = new Date(r.DTSTART.replace(' ', 'T'));
    const day = date.toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' });

    ctx.fillText(day, padding + columnWidths[0] / 2, yStart + rowHeight / 2);

    // Indicator text with wrapping
    ctx.textAlign = 'left';
    const indicatorX = padding + columnWidths[0] + 10;
    const indicatorYStart = yStart + 20;
    const indicatorLines = wrapText(ctx, r.SUMMARY || 'Unnamed', columnWidths[1] - 20);
    indicatorLines.forEach((line, lineIdx) => {
      ctx.fillText(line, indicatorX, indicatorYStart + lineIdx * 18);
    });

    // Location text
    ctx.textAlign = 'center';
    ctx.fillText(r.LOCATION || 'Ireland', padding + columnWidths[0] + columnWidths[1] + columnWidths[2] / 2, yStart + rowHeight / 2);
  });

  // MacroCalendar.com link at the bottom
  ctx.fillStyle = '#315469';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('See full calendar: www.macrocalendar.com', width / 2, height - 30);

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
    const tweetText = `Upcoming Economic Releases for Ireland! See more at www.macrocalendar.com ${hashtags}`;

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