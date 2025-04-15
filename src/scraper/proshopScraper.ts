import puppeteer, { Browser, GoToOptions, LaunchOptions, Page } from "puppeteer";
import { BaseScraper } from "./baseScraper";
import { getLocalTimeInUTCTimestamp } from "../util/utilities";

export class ProshopScraper extends BaseScraper {
  /**
  * Click element on the page to trigger effects, in this case GDPR cookie popup happens so take care of it before
  * other interactions. Should be the first thing to run after creating the class instance.
  * 
  * @returns Promise<void>
  */
  public async firstContact() {
    try {
      // Wait for search input field on the page
      await this.page.waitForSelector("#search-input");

      // Click to focus the search box to trigger the modal if it hasn't happened already
      await this.page.click("#search-input");

      // Wait for decline button to appear on the page
      await this.page.waitForSelector("#declineButton");

      // Click the decline button to close the modal
      await this.page.click("#declineButton");
    } catch (err) {
      console.log(err);

      // Throw err to maybe handle it in outer try catch block
      throw err;
    }
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
  public async login(username: string, password: string, realname: string): Promise<boolean> {
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

  public async clickElementToAddToCart(selector: string, url: string) {
    const splittedUrl = url.split("/");

    // Click the buy button
    await this.page.click(selector);

    // Navigation event happens to /basket page after clicking the buy button so wait for it to finish
    await this.page.waitForNavigation({ waitUntil: "networkidle2" });

    // Check to see if the page is the shopping cart, which indicates that the product has been added to the cart
    // and hopefully reserved
    const pageUrl = this.page.url().toLowerCase();
    const cartElement = await this.page.$(("#CommerceBasketApp"));
    const buyButton = await this.page.$("a[href='/Basket/CheckOut']");

    if (pageUrl.includes("basket") || cartElement || buyButton) {
      return { success: true, product: splittedUrl[4] ?? url };
    } else {
      return { success: false, product: splittedUrl[4] ?? url };
    }
  }

  /**
  * Navigates to the specified proshop product URL and attempts to add the product 
  * associated with the page to the cart.
  *
  * @param url - The proshop product page URL to navigate to.
  * @param options - Optional Puppeteer `GoToOptions` for navigation behavior.
  * 
  * @returns Promise<{ succcess: boolean, product: string }>
  */
  public async addProductToCart(url: string, options: GoToOptions): Promise<{ success: boolean, product: string }> {
    const splittedUrl = url.split("/");

    try {
      // Go to the url - should come from Nvidia sku api
      await this.page.goto(url, options);

      // TODO: it's not clear whether simply visiting the url adds the card to the cart
      // so do some checks if there is the add to basket button on the page but if there is
      // not proceed with the program just the same. The card should be reserved in any case

      // Check to see if the page is the shopping cart, which indicates that the product has been added to the cart
      // and hopefully reserved
      let pageUrl = this.page.url().toLowerCase();
      let cartElement = await this.page.$(("#CommerceBasketApp"));
      let buyButton = await this.page.$("a[href='/Basket/CheckOut']");

      // If the page is basket using multiple checks, since it's possible that the url doesn't include basket, return
      // Else proceed with adding the product to the basket
      if (pageUrl.includes("basket") || cartElement || buyButton) {
        return { success: true, product: splittedUrl[4] ?? url };
      }

      // Wait for buy button to appear on the site - 5000ms till timeout
      await this.page.waitForSelector("form#addToCart_BtnForm button[data-form-action='addToBasket']", { timeout: 5000 });

      // // Click the buy button
      // await this.page.click("form#addToCart_BtnForm button[data-form-action='addToBasket']");

      // // Navigation event happens to /basket page after clicking the buy button so wait for it to finish
      // await this.page.waitForNavigation({ waitUntil: "networkidle2" });

      // // Check to see if the page is the shopping cart, which indicates that the product has been added to the cart
      // // and hopefully reserved
      // pageUrl = this.page.url().toLowerCase();
      // cartElement = await this.page.$(("#CommerceBasketApp"));
      // buyButton = await this.page.$("a[href='/Basket/CheckOut']");

      // if (pageUrl.includes("basket") || cartElement || buyButton) {
      //   return { success: true, product: splittedUrl[4] ?? url };
      // } else {
      //   return { success: false, product: splittedUrl[4] ?? url };
      // }

      const addToCart = await this.clickElementToAddToCart(
        "form#addToCart_BtnForm button[data-form-action='addToBasket']",
        url
      );

      return addToCart;
    } catch (err) {
      console.log("Something went wrong trying to add the product to the cart: ", err)

      return { success: false, product: splittedUrl[4] ?? url };
    }
  }

  // TODO: maybe create add to cart method since it's being repeated in multiple places
  public async waitForProductAvailability(startTime: number, url: string): Promise<{ success: boolean, product: string }> {
    let isAvailable = false;
    const splittedUrl = url.split("/");

    while (getLocalTimeInUTCTimestamp() < startTime) {
      // Throttle checks to see if the time has come by 100ms
      await new Promise<void>((res) => setTimeout(res, 100));
    }

    try {
      await this.page.goto(url, { waitUntil: "domcontentloaded" });

      while (!isAvailable) {
        await this.page.reload({ waitUntil: "domcontentloaded" });

        try {
          await this.page.waitForSelector("form#addToCart_BtnForm button[data-form-action='addToBasket']", { timeout: 200 });

          isAvailable = true;
        } catch (err) {
          console.log("No buy button on page");

          // Wait until refreshing the page
          await new Promise<void>((res) => setTimeout(res, 5000));
        }
      }

      const addToCart = await this.clickElementToAddToCart(
        "form#addToCart_BtnForm button[data-form-action='addToBasket']",
        url
      );

      return addToCart;
    } catch (err) {
      return { success: false, product: splittedUrl[4] ?? url };
    }
  }
}