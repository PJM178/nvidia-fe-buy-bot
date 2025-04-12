import puppeteer, { Browser, GoToOptions, LaunchOptions, Page } from 'puppeteer';

export const startBrowser = async (): Promise<Browser> => {
  return await puppeteer.launch({ headless: true });
};

export const openPage = async (browser: Browser, url: string): Promise<Page> => {
  const page = await browser.newPage();

  await page.goto(url);

  return page;
};

export abstract class BaseScraper {
  protected browser: Browser;
  protected text = "jorma";

  protected constructor(browser: Browser) {
    this.browser = browser;
  }

  static async create<T extends BaseScraper>(this: new (browser: Browser) => T, options: LaunchOptions): Promise<T> {
    const browser = await puppeteer.launch(options);

    return new this(browser);
  }

  protected async newPage(url: string, options: GoToOptions): Promise<Page> {
    const page = await this.browser.newPage();

    await page.goto(url, options);

    return page;
  }

  async close() {
    await this.browser.close();
  }
}