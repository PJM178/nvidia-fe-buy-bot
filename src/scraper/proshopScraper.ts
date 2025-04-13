import puppeteer, { Browser, GoToOptions, LaunchOptions, Page } from "puppeteer";
import { BaseScraper } from "./baseScraper";

export class ProshopScraper {
  private browser: Browser;
  private page: Page;

  private constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.page = page;
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

    // Take care of GDPR consent so that it won't bother us on subsequent page visits and potentially blockin interaction
    await page.waitForSelector("#search-input");
    await page.click("#search-input");
    await page.waitForSelector("#declineButton");
    await page.click("#declineButton");

    return new this(browser, page);
  }

  /**
  * Attempts to login the user with the provided cerendtials as parameters.
  *
  * @param username - Proshop username - case sensitive.
  * @param password - Proshop password - case sensitive.
  * @param realname - Proshop realname - case sensitive.
  * 
  * @returns Promise<boolean>
  */
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
        console.log(`Logged in and found user ${realname} on the page.`)

        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.log("Something went wrong trying to login the user: ", err);

      return false;
    }
  }

  /**
  * Navigates to the specified proshop product URL and attempts to add the product 
  * associated with the page to the cart.
  *
  * @param url - The proshop product page URL to navigate to.
  * @param options - Optional Puppeteer `GoToOptions` for navigation behavior.
  * 
  * @returns void
  */
  public async addProductToCart(url: string, options: GoToOptions) {
    // Go to the url - should come from Nvidia sku api
    await this.page.goto(url, options);

    // TODO: it's not clear whether simply visiting the url adds the card to the cart
    // so do some checks if there is the add to basket button on page but if there is
    // not proceed with the program just the same. The card should be reserved in any case

    return;
  }
}