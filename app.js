const chromium = require('chrome-aws-lambda');
const { AxePuppeteer } = require('axe-puppeteer');
const puppeteer = require('puppeteer');

const { createServer } = require('http');
const { parse: parseURL } = require('url');

const { PORT = 3000 } = process.env;

const analyze = async url => {
  const browser = await puppeteer.launch({
    args: chromium.args,
    headless: chromium.headless,
    executablePath: await chromium.executablePath
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/68.0.3419.0 Safari/537.36 RocketValidator (+https://rocketvalidator.com)");
    await page.setBypassCSP(true);

    await page.goto(url);

    const results = await new AxePuppeteer(page).analyze();

    await page.close();
    await browser.close();

    return results;
  } catch (err) {
    console.error(err);

    // Ensure we close the puppeteer connection when possible
    if (browser) {
      await browser.close();
    }

    // Re-throw
    throw err;
  }
};

const server = createServer((req, res) => {
  // Ensure ?url= was provided
  const { query = {} } = parseURL(req.url, true);
  const { url } = query;
  if (!url) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('URL required');
    return;
  }

  // Analyze the URL
  analyze(url)
    .then(results => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results, null, 2));
    })
    .catch(err => {
      console.error('Runtime error', { error: err.message, stack: err.stack });
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message || 'Unknown error');
    });
});

server.listen(PORT);
