import puppeteer, { Browser, GoToOptions, LaunchOptions, Page } from "puppeteer";
import { BaseScraper } from "./baseScraper";

export class ProshopScraper {
  private browser: Browser;
  private page: Page;

  private constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.page = page;
  }

  static async create(options: LaunchOptions, pageOptions: GoToOptions) {
    const browser = await puppeteer.launch(options);
    const page = await browser.newPage();

    // Set useragent since it's possible that if these are missing, the page won't load in headless mode
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set viewport to ensure that certain elements appear because of media queries
    await page.setViewport({
      width: 1280,
      height: 720,
    });

    // By default go to proshop url
    await page.goto("https://www.proshop.fi", pageOptions)

    // Take care of GDPR consent so that it won't bother us on subsequent page visits
    await page.waitForSelector("#search-input");
    await page.click("#search-input");
    await page.waitForSelector("#declineButton");
    await page.click("#declineButton");

    return new this(browser, page);
  }

  public async login(username: string, password: string, realname: string) {
    try {
      // Make sure login button is visible on the page
      await this.page.waitForSelector("#openLogin");

      // Open the login dialog
      await this.page.click("#openLogin");

      // Wait for username field
      await this.page.waitForSelector("input#UserName.form-control");

      // Insert username into the input field
      await this.page.evaluate((text) => {
        const inputElement = document.querySelector("input#UserName.form-control") as HTMLInputElement;

        inputElement.value = text;
      }, username);

      // Wait for password field
      await this.page.waitForSelector("input#Password.form-control");

      // Insert password into the input field
      await this.page.evaluate((text) => {
        const inputElement = document.querySelector("input#Password.form-control") as HTMLInputElement;

        inputElement.value = text;
      }, password);

      // Check for remember me input element
      await this.page.waitForSelector("input#RememberMe");

      // Check the remember me checkbox
      await this.page.click("input#RememberMe");

      // Check for submit button
      await this.page.waitForSelector("form#LoginDropDownForm input[type='submit']");

      // Click the submit button
      await this.page.click("form#LoginDropDownForm input[type='submit']")

      // Wait for navigation event which happens when logging in
      await this.page.waitForNavigation({ waitUntil: "networkidle2" });

      // Wait for login button to appear on the page which contains the user's name or text "login"
      // There is different text for different viewports but with the current settings this should be correct
      await this.page.waitForSelector("#loginButtonText");

      // Real name after logging in the button element
      const text = await this.page.$eval('#loginButtonText', el => el.textContent);

      // If the textContent contains the real name of the user, consider the user logged in
      // Otherwise return false
      if (text?.includes(realname)) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.log(err);

      return false;
    }
  }

  public async addProductToCart(url: string) {
    await this.page.goto("https://www.proshop.fi/Naeyttoe/27-GIGABYTE-AORUS-FO27Q2-2560x1440-QHD-240Hz-QD-OLED-18W-USB-C/3281900");
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