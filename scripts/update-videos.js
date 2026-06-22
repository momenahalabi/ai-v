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

    // Identify new videos
    for (const v of fetchedVideos) {
      if (!existingIds.has(v.id)) {
        newVideos.push(v);
      }
    }

    if (newVideos.length > 0) {
      console.log(`Found ${newVideos.length} new videos in RSS.`);
    }

    // Merge lists (newest first)
    const updatedVideos = [...newVideos, ...existingVideos];

    // Partition videos into Full Videos (Horizontal) and Shorts (Vertical)
    // Vertical: URL contains '/shorts/'
    // Horizontal: URL does NOT contain '/shorts/'
    const fullVideos = updatedVideos.filter(v => !v.url.includes('/shorts/'));
    const shortsVideos = updatedVideos.filter(v => v.url.includes('/shorts/'));

    console.log(`Partitioned: ${fullVideos.length} Full Videos, ${shortsVideos.length} Shorts.`);

    // 1. Build Horizontal (Full) Videos HTML - NO titles, 16:9 ratio
    let fullHtml = '      <!-- YOUTUBE_FULL_START -->\n';
    fullHtml += '      <div class="full-videos-grid reveal">\n';
    for (const item of fullVideos) {
      fullHtml += `        <div class="full-video-card">
          <div class="portfolio-thumb portfolio-thumb-video wide">
            <iframe
              src="https://www.youtube.com/embed/${item.id}"
              title="إعلان سينمائي"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              loading="lazy"
            ></iframe>
          </div>
        </div>\n`;
    }
    fullHtml += '      </div>\n';
    fullHtml += '      <!-- YOUTUBE_FULL_END -->';

    // 2. Build Vertical (Shorts) Videos HTML - grouped in pairs, with titles
    const pairs = [];
    for (let i = 0; i < shortsVideos.length; i += 2) {
      pairs.push(shortsVideos.slice(i, i + 2));
    }

    let shortsHtml = '        <!-- YOUTUBE_GRID_START -->\n';
    for (const pair of pairs) {
      shortsHtml += '        <div class="portfolio-pair">\n';
      for (const item of pair) {
        shortsHtml += `          <a href="${item.url}" class="portfolio-item" target="_blank" rel="noopener">
            <div class="portfolio-thumb-sm portfolio-thumb-yt">
              <img src="${item.thumbnail}" alt="${item.title}">
              <div class="play-btn sm"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
            </div>
            <h4>${item.title}</h4>
          </a>\n`;
      }
      shortsHtml += '        </div>\n';
    }
    shortsHtml += '        <!-- YOUTUBE_GRID_END -->';

    // Read index.html
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Replace Full Videos Section
    const fullStartTag = '<!-- YOUTUBE_FULL_START -->';
    const fullEndTag = '<!-- YOUTUBE_FULL_END -->';
    const fullStartIdx = htmlContent.indexOf(fullStartTag);
    const fullEndIdx = htmlContent.indexOf(fullEndTag);

    if (fullStartIdx === -1 || fullEndIdx === -1) {
      throw new Error(`Could not find comments ${fullStartTag} or ${fullEndTag} in index.html`);
    }

    let beforeFull = htmlContent.substring(0, fullStartIdx);
    let afterFull = htmlContent.substring(fullEndIdx + fullEndTag.length);
    htmlContent = beforeFull + fullHtml + afterFull;

    // Replace Shorts Grid Section
    const gridStartTag = '<!-- YOUTUBE_GRID_START -->';
    const gridEndTag = '<!-- YOUTUBE_GRID_END -->';
    const gridStartIdx = htmlContent.indexOf(gridStartTag);
    const gridEndIdx = htmlContent.indexOf(gridEndTag);

    if (gridStartIdx === -1 || gridEndIdx === -1) {
      throw new Error(`Could not find comments ${gridStartTag} or ${gridEndTag} in index.html`);
    }

    let beforeGrid = htmlContent.substring(0, gridStartIdx);
    let afterGrid = htmlContent.substring(gridEndIdx + gridEndTag.length);
    const newHtmlContent = beforeGrid + shortsHtml + afterGrid;

    // Write file only if content changes
    const originalHtml = fs.readFileSync(htmlPath, 'utf8');
    if (originalHtml !== newHtmlContent) {
      fs.writeFileSync(htmlPath, newHtmlContent, 'utf8');
      fs.writeFileSync(jsonPath, JSON.stringify(updatedVideos, null, 2), 'utf8');
      console.log('Successfully updated videos.json and index.html!');
    } else {
      console.log('No content changes detected in index.html. Everything is up to date.');
    }
  } catch (error) {
    console.error('Error updating videos:', error.message);
    process.exit(1);
  }
}

main();
