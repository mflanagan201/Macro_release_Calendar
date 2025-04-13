import pkg from '@atproto/api';
const { BskyAgent } = pkg;

console.log("Starting Bluesky post...");

const agent = new BskyAgent({ service: 'https://bsky.social' });

await agent.login({
  identifier: process.env.BLUESKY_USER,
  password: process.env.BLUESKY_PASSWORD
});

const releaseSummary = `This week's Irish economic calendar: GDP, CPI, and more. Visit https://www.macrocalendar.com to stay up-to-date.`;

await agent.post({
  text: releaseSummary
});
