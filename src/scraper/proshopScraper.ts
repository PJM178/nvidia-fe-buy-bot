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

  /**
  * Helper method to add products to basket based on the selector.
  *
  * @param selector - Selector for button which adds the product to the cart.
  * @param url - Product page URL.
  * 
  * @returns Promise<{ succcess: boolean, product: string }>
  */
  private async clickElementToAddToCart(selector: string, url: string) {
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



  // TODO: detect whether cloudflare captcha is triggered and simulate mouse movement to check the checkbox
  public async waitForProductAvailability(startTime: number, url: string): Promise<{ success: boolean, product: string }> {
    let isAvailable = false;
    let isCloudflare = false;
    const splittedUrl = url.split("/");

    while (getLocalTimeInUTCTimestamp() < startTime) {
      // Throttle checks to see if the time has come by 100ms
      await new Promise<void>((res) => setTimeout(res, 100));
    }

    try {
      await this.page.goto(url, { waitUntil: "domcontentloaded" });

      while (!isAvailable) {
        if (isCloudflare) {
          // Wait for anchor element to position the click
          await this.page.waitForSelector(".h2.spacer-bottom", { visible: true });

          // Select the element
          const anchorElementHandle = await this.page.$(".h2.spacer-bottom");

          // Get the bounding box
          const anchorBoundingBox = await this.page.evaluate((el) => {
            if (el) {
              const rect = el.getBoundingClientRect();

              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right,
              };
            }
          }, anchorElementHandle);

          const elMarginBottom = 32;
          const inputMarginLeft = 16;
          const inputHeight = 24;
          const inputWidth = 24;
          const inputContainerheight = 63;
          const mouseX = (anchorBoundingBox?.left ?? 0) + inputMarginLeft + inputWidth / 2;
          const mouseY = (anchorBoundingBox?.bottom ?? 0) + elMarginBottom + inputContainerheight / 2;
          
          await this.handleCloudflare({ x: mouseX, y: mouseY });
          
          isCloudflare = false;
          // await new Promise((res) => setTimeout(res, 99999999));

          // const cloudflareHandled = this.handleCloudflare();
        };

        await this.page.reload({ waitUntil: "domcontentloaded" });

        // Check network requests for cloudflare page
        this.page.on("response", async (res) => {
          const responseUrl = res.url();

          if (responseUrl.toLowerCase().includes("cloudflare")) {
            isCloudflare = true;
            console.log(isCloudflare);
            console.log("Cloudflare captcha detected");
          }
        });

        this.page.setRequestInterception

        try {
          await this.page.waitForSelector("form#addToCart_BtnForm button[data-form-action='addToBasket']", { timeout: 200 });

          isAvailable = true;
        } catch (err) {
          console.log("No buy button on page, time: ", new Date().toString());

          // Wait until refreshing the page, adding random delay to maybe fool some checks
          await new Promise<void>((res) => setTimeout(res, 1000 + Math.random() * 2000));
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

  /**
  * Detects and attemps to handle cloudflare captcha which can happen for certain product pages when refreshing them
  * heavily.
  * 
  * @returns Promise<boolean>
  */
  private async handleCloudflare(coordinates: { x: number, y: number }): Promise<boolean> {
    let inputPressed = false;
    let shouldBreak = false;
    let firstPress = false;

    // Move and click mouse to where input checkmark is
    await this.page.mouse.move(coordinates.x, coordinates.y);

    this.page.on("response", async (res) => {
      if (firstPress) {
        const responseUrl = res.url();

        if (inputPressed && responseUrl.toLowerCase().includes("proshop")) {
          shouldBreak = true;
          console.log(shouldBreak);
        }

        if (responseUrl.toLowerCase().includes("cloudflare")) {
          inputPressed = true;
        }
      }
    });

    while (true) {
      if (shouldBreak) break;

      if (inputPressed) continue;

      await this.page.mouse.down();
      await new Promise((res) => setTimeout(res, Math.floor(Math.random() * 1000)));
      await this.page.mouse.up();

      firstPress = true;

      await this.page.mouse.reset();
      await this.page.mouse.move(coordinates.x, coordinates.y, { steps: Math.floor(Math.random() * 32) });
    }

    return true;
  }
}