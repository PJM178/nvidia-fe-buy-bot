import puppeteer, { Browser, GoToOptions, LaunchOptions, Page } from 'puppeteer';

export abstract class BaseScraper {
  protected browser: Browser;
  protected page: Page;
  protected chromeVersionList: string[];

  public constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.page = page;
    this.chromeVersionList = ["135.0.7049.95", "91.0.4472.124", "135.0.7049.41"];
  }

  /**
  * Creates and initializes an instance of the class with a configured Puppeteer browser and page.
  *
  * This method launches a new, possibly headless browser using the provided `LaunchOptions`, sets up
  * the page with a custom user agent and viewport, and navigates to the Proshop homepage.
  * It also handles GDPR consent popups to avoid interaction issues on future page visits.
  *
  * @param options - Puppeteer `LaunchOptions` used to configure the browser launch (e.g., headless mode, args).
  * @param pageOptions - Puppeteer `GoToOptions` used for navigating to the initial page.
  * 
  * @returns A promise that resolves to an instance of the class containing the initialized browser and page.
  */
  public static async create<T extends BaseScraper>(
    this: new (browser: Browser, page: Page) => T,
    options: LaunchOptions,
    pageOptions: GoToOptions,
    url: string
  ): Promise<T> {
    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch(options);
      const page = await browser.newPage();

      // Set useragent since it's possible that if these are missing, the page won't load in headless mode
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.124');

      // Set viewport to ensure that certain elements appear because of media queries
      await page.setViewport({
        width: 1280,
        height: 720,
      });

      // By default go to proshop url
      await page.goto(url, pageOptions)

      return new this(browser, page);
    } catch (err) {
      console.log(err);

      if (browser) {
        await browser.close();
      }

      throw err;
    }
  }

  /**
  * Closes the current browser instance.
  * 
  * @returns Promise<void>.
  */
  public async closeBrowser() {
    await this.browser.close();
  }

  /**
  * Closes the current page instance.
  * 
  * @returns Promise<void>.
  */
  public async closePage() {
    await this.page.close();
  }
}