import puppeteer, { Browser, ElementHandle, GoToOptions, LaunchOptions, Page } from "puppeteer";
import { BaseScraper } from "./baseScraper";

export class ProshopScraper {
  private browser: Browser;
  private activePage: Page;

  private constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.activePage = page;
  }

  static async create(options: LaunchOptions, pageOptions: GoToOptions) {
    const browser = await puppeteer.launch(options);
    const page = await browser.newPage();

    // Set useragent since it's possible that if these are missing, the page won't load in headless mode
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // By default go to proshop url - testing some product url here
    await page.goto("https://www.proshop.fi/Naeyttoe/27-GIGABYTE-AORUS-FO27Q2-2560x1440-QHD-240Hz-QD-OLED-18W-USB-C/3281900", pageOptions)

    // Take care of GDPR consent so that it won't bother us on subsequent page visits
    await page.waitForSelector("#search-input");
    await page.click("#search-input");
    await page.waitForSelector("#declineButton");
    await page.click("#declineButton");

    return new this(browser, page);
  }

  public async login(username: string, password: string) {
    console.log(username, password);
    // Make sure login button is visible on the page
    await this.activePage.waitForSelector("#openLogin");

    // Open the login dialog
    await this.activePage.click("#openLogin");

    console.log("here");
  }

  public async setPage() {
    const page = await this.browser.newPage();

    return this.activePage = page;
  }

  public async getElementText(url: string) {
    const page = await this.browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log("jorma")



    await page.waitForSelector("#search-input");

    await page.click("#search-input");

    await page.waitForSelector("#declineButton");

    await page.click("#declineButton");

    await page.click("#openLogin");

    await page.waitForSelector(".login-modal--close"), { visible: true };

    await page.evaluate(() => {
      const button = document.querySelector(".login-modal--close");
      
      if (button) {
        (button as HTMLButtonElement).click();
      }
    });

    const elementHandle = await page.evaluateHandle(() => {
      const elements = document.querySelectorAll('.login-modal--close');
      console.log('elements', elements); // Logs the found elements to the browser console
      return elements[0]; // Return the first element handle to the Node.js environment
    });

    // if (elementHandle) {
    //   await elementHandle.click(); // Click the first element
    //   console.log('Clicked the first element!');
    // } else {
    //   console.log('Element not found!');
    // }

    console.log("elements");
    // const element = await page.$(".login-modal--close");
    // await element?.click();
    // console.log(element);
    // element?.click();

    return;
  }
}