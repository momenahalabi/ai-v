const fs = require('fs');
const path = require('path');
const https = require('https');

const CHANNEL_ID = 'UCnh4W3S_KOhRgOUgmp7a06A';
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

const jsonPath = path.join(__dirname, '..', 'videos.json');
const htmlPath = path.join(__dirname, '..', 'index.html');

function decodeXml(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function fetchRss() {
  return new Promise((resolve, reject) => {
    https.get(RSS_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function parseRss(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entryContent = match[1];
    const videoIdMatch = entryContent.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entryContent.match(/<title>([^<]+)<\/title>/);
    const linkMatch = entryContent.match(/<link rel="alternate" href="([^"]+)"/);
    
    if (videoIdMatch && titleMatch && linkMatch) {
      entries.push({
        id: videoIdMatch[1].trim(),
        title: decodeXml(titleMatch[1].trim()),
        url: linkMatch[1].trim(),
        thumbnail: `https://img.youtube.com/vi/${videoIdMatch[1].trim()}/hqdefault.jpg`
      });
    }
  }
  return entries;
}

async function main() {
  try {
    console.log('Fetching YouTube RSS Feed...');
    const xml = await fetchRss();
    const fetchedVideos = parseRss(xml);
    console.log(`Fetched ${fetchedVideos.length} videos from RSS.`);

    // Read current database
    let existingVideos = [];
    if (fs.existsSync(jsonPath)) {
      existingVideos = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
    console.log(`Loaded ${existingVideos.length} existing videos from database.`);

    const existingIds = new Set(existingVideos.map(v => v.id));
    const newVideos = [];

    // RSS feeds list from newest to oldest. We want to identify videos we don't have.
    for (const v of fetchedVideos) {
      if (!existingIds.has(v.id)) {
        newVideos.push(v);
      }
    }

    if (newVideos.length === 0) {
      console.log('No new videos found. Everything is up to date.');
      return;
    }

    console.log(`Found ${newVideos.length} new videos! Adding them to the website.`);

    // Prepend new videos to the existing list (since they are newer)
    const updatedVideos = [...newVideos, ...existingVideos];

    // Build the grid HTML
    // Group into pairs (each pair has up to 2 items)
    const pairs = [];
    for (let i = 0; i < updatedVideos.length; i += 2) {
      pairs.push(updatedVideos.slice(i, i + 2));
    }

    let gridHtml = '        <!-- YOUTUBE_GRID_START -->\n';
    for (const pair of pairs) {
      gridHtml += '        <div class="portfolio-pair">\n';
      for (const item of pair) {
        gridHtml += `          <a href="${item.url}" class="portfolio-item" target="_blank" rel="noopener">
            <div class="portfolio-thumb-sm portfolio-thumb-yt">
              <img src="${item.thumbnail}" alt="${item.title}">
              <div class="play-btn sm"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
            </div>
            <h4>${item.title}</h4>
          </a>\n`;
      }
      gridHtml += '        </div>\n';
    }
    gridHtml += '        <!-- YOUTUBE_GRID_END -->';

    // Read index.html
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Replace the HTML between comments
    const startTag = '<!-- YOUTUBE_GRID_START -->';
    const endTag = '<!-- YOUTUBE_GRID_END -->';
    
    const startIndex = htmlContent.indexOf(startTag);
    const endIndex = htmlContent.indexOf(endTag);

    if (startIndex === -1 || endIndex === -1) {
      throw new Error(`Could not find comments ${startTag} or ${endTag} in index.html`);
    }

    const beforeGrid = htmlContent.substring(0, startIndex);
    const afterGrid = htmlContent.substring(endIndex + endTag.length);

    const newHtmlContent = beforeGrid + gridHtml + afterGrid;

    // Save files
    fs.writeFileSync(jsonPath, JSON.stringify(updatedVideos, null, 2), 'utf8');
    fs.writeFileSync(htmlPath, newHtmlContent, 'utf8');
    console.log('Successfully updated videos.json and index.html!');
  } catch (error) {
    console.error('Error updating videos:', error.message);
    process.exit(1);
  }
}

main();
