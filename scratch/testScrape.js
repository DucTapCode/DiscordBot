import { chromium } from "playwright";

async function test() {
  console.log("Starting test scrape...");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    // Disable CSS/Images/Fonts/Media
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "stylesheet", "font", "media"].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const url = "https://motchillza.cc/?post_type=movie&s=Bài Học Đáng Đời";
    console.log(`Navigating to ${url}...`);
    
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    console.log("Page loaded!");

    const content = await page.content();
    console.log("HTML length:", content.length);
    console.log("Title of page:", await page.title());

    const hasSwItem = await page.$(".sw-item");
    console.log("Has .sw-item:", !!hasSwItem);

    const hasItem = await page.$(".item");
    console.log("Has .item:", !!hasItem);

    const hasArticle = await page.$("article");
    console.log("Has article:", !!hasArticle);

    // Let's print out some text of the body to see if there is Cloudflare protection
    const bodyText = await page.innerText("body").catch(() => "");
    console.log("Body text contains Cloudflare:", bodyText.toLowerCase().includes("cloudflare") || bodyText.toLowerCase().includes("just a moment"));

  } catch (e) {
    console.error("Scrape error:", e);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

test();
