import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { NvidiaStoreListingResponse, SingleSkuData, SkuData, SKUResponseData } from "./types/sku";
import { ProshopScraper } from "./scraper";
import { exec } from 'child_process';
import { queryUser, envValues, delay } from "./util/utilities";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const proshopUsername = process.env.PROSHOP_USERNAME || "test-username";
const proshopPassword = process.env.PROSHOP_PASSWORD || "test-password";
const proshopRealname = process.env.PROSHOP_REALNAME || "test-realname";

const dataPath = path.join(__dirname, "data", "skuData.json");

const skuDataMap = new Map<keyof SkuData, SingleSkuData>();

async function loadInitialDataToMap() {
  try {
    const localSkuData = await readData();

    if (localSkuData) {
      (Object.entries(localSkuData) as [keyof SkuData, SingleSkuData][]).forEach(([k, v]) => {
        skuDataMap.set(k, v);
      });
    }

    console.log("Loaded local SKU data to map");

    return true;
  } catch (err) {
    console.log("Something went wrong reading the local SKU data", err);

    return false;
  }
};

async function readData(): Promise<SkuData | null> {
  try {
    const data = await fs.readFile(dataPath, "utf-8");

    const parsedData = JSON.parse(data);

    return parsedData;
  } catch (err) {
    console.error("Error reading or parsing the file: ", err);

    throw err;
  }
};

async function updateLocalSkuData(data: Map<keyof SkuData, SingleSkuData>) {
  const objectToWrite = Object.fromEntries(data);

  await fs.writeFile(dataPath, JSON.stringify(objectToWrite, null, 2), "utf-8");
}

async function program() {
  const isDataLoaded = await loadInitialDataToMap();

  if (!isDataLoaded) {
    process.exit(1);
  }

  checkAndUpdateSKUData();

  while (true) {
    await new Promise<void>((res) => setTimeout(() => {
      console.log("2000");
      res();
    }, 2000));
  }
};

program();

async function checkAndUpdateSKUData() {
  while (true) {
    try {
      const res = await fetch(`https://api.nvidia.partners/edge/product/search?page=1&limit=12&locale=fi-fi&manufacturer=NVIDIA&manufacturer_filter=NVIDIA~2&category=GPU`);

      const data = await res.json();

      if (res.status === 200) {
        const apiProductDetailsList = data.searchedProducts.productDetails as NvidiaStoreListingResponse;

        for (let i = 0; i < apiProductDetailsList.length; i++) {
          const record = apiProductDetailsList[i];
          const currentLocalSKUData = skuDataMap.get(record.gpu);
          const recordSKUName = record.productSKU;

          if (currentLocalSKUData) {
            if (currentLocalSKUData.productSKU !== recordSKUName) {
              currentLocalSKUData.productSKU = recordSKUName;
              currentLocalSKUData.updateAt = new Date().getTime();

              skuDataMap.set(record.gpu, currentLocalSKUData);
            
              // Update the local data with the updated data
              await updateLocalSkuData(skuDataMap);
            }
          }
        }
      }
    } catch (err) {
      console.log("Something went wrong making a call to Nvidia store api: ", err);
    }

    // Make the call every 20 seconds
    await delay(5000);
  }
};

// checkAndUpdateSKUData();

async function checkSKUStock(sku: string) {
  try {
    const res = await fetch(`https://api.store.nvidia.com/partner/v1/feinventory?status=1&skus=${sku}&locale=fi-fi`);

    const data: SKUResponseData = await res.json();
    console.log(data);
    return data;
  } catch (err) {
    console.log(err);
  }
};

async function checkApi() {
  try {
    const res = await fetch(`https://api.nvidia.partners/edge/product/search?page=1&limit=12&locale=fi-fi&manufacturer=NVIDIA&manufacturer_filter=NVIDIA~2&category=GPU`);

    const data = await res.json();



    console.log(data.searchedProducts.productDetails);
  } catch (err) {
    console.log(err);
  }
};

// async function run() {
//   const data = await readData();

//   if (data && "RTX 5080" in data) {
//     const skuResponseData = await checkSKUStock(data["RTX 5080"]);

//     if (skuResponseData?.success && skuResponseData?.listMap.length > 0) {
//       console.log(skuResponseData.listMap[0].fe_sku);
//     } else if (skuResponseData?.success) {
//       console.log("Api response successful but the sku data is missing");
//     } else {
//       console.log("Something went wrong making the api call");
//     }
//   }
// }

async function initializeSetup(): Promise<{ headless: boolean }> {
  const runInHeadless = await queryUser("Run chrome in headless mode?\n");

  const createEnvFile = await queryUser("Create .env file and write credentials to it?\n");

  if (createEnvFile) {
    await envValues();
  }

  return { headless: runInHeadless };
}

async function testPuppeteer() {
  // Setup values and create .env variables
  const setupValues = await initializeSetup();

  // Create the scraper
  const proshopSraper = await ProshopScraper.create({ ...setupValues }, { waitUntil: "domcontentloaded" }, "https://www.proshop.fi");

  if (proshopSraper) {
    // Run the first contact method to get rid of potentially blocking stuff
    await proshopSraper.firstContact();

    // Login to the site
    const isLoggedIn = await proshopSraper.login(proshopUsername, proshopPassword, proshopRealname);

    if (isLoggedIn) {

      // TODO: rename this whole function, and start the api call loops here and call the addProductToCart method from them
      // Add product to basket based on the url - networkidle0 to make sure there is no network requests going on after loading
      const productAddedToCart = await proshopSraper.addProductToCart("https://www.proshop.fi/Naeyttoe/27-GIGABYTE-AORUS-FO27Q2-2560x1440-QHD-240Hz-QD-OLED-18W-USB-C/3281900", { waitUntil: "networkidle0" });

      // If the product is added to cart, open default system browser with shopping cart url for checkout and exit the program
      if (productAddedToCart.success) {
        console.log("Added to cart ", productAddedToCart.product);

        // Open default browser with proshop cart link in order to checkout
        exec('start https://www.proshop.fi/Basket', (err: any, stdout: any, stderr: any) => {
          if (err) {
            console.error('Error opening browser:', err);
            return;
          }
          console.log('Browser opened');
        });
      } else {
        console.log("Could not add to cart, opening browser with the product url");

        // Open default browser with the product url
        // TODO: Add url here when rest of the program is done
        exec('start https://www.proshop.fi/Basket', (err: any, stdout: any, stderr: any) => {
          if (err) {
            console.error('Error opening browser:', err);
            return;
          }
          console.log('Browser opened');
        });
      }
    }
  }
};

// First run
// run();

// checkApi();

// testPuppeteer();

async function testProductAvailabilityTime() {
  const proshopSraper = await ProshopScraper.create({ headless: false }, { waitUntil: "domcontentloaded" }, "https://www.proshop.fi");

  if (proshopSraper) {
    // Run the first contact method to get rid of potentially blocking stuff
    await proshopSraper.firstContact();

    // Login to the site
    const isLoggedIn = await proshopSraper.login(proshopUsername, proshopPassword, proshopRealname);

    if (isLoggedIn) {
      const startTime = new Date().setUTCHours(0, 0, 0, 0);

      const productAddedToCart = await proshopSraper.waitForProductAvailability(startTime, "https://www.proshop.fi/Naeytoenohjaimet/ZOTAC-GeForce-RTX-5070-Ti-Solid-SFF-16GB-GDDR7-RAM-Naeytoenohjaimet/3359722");
      // const productAddedToCart = await proshopSraper.waitForProductAvailability(startTime, "https://www.proshop.fi/Naeyttoe/27-GIGABYTE-AORUS-FO27Q2-2560x1440-QHD-240Hz-QD-OLED-18W-USB-C/3281900");

      // If the product is added to cart, open default system browser with shopping cart url for checkout and exit the program
      if (productAddedToCart.success) {
        console.log("added to cart", productAddedToCart.product);

        // Open default browser with proshop cart link in order to checkout
        exec('start https://www.proshop.fi/Basket', (err: any, stdout: any, stderr: any) => {
          if (err) {
            console.error('Error opening browser:', err);
            return;
          }
          console.log('Browser opened');
        });

        return process.exit(1);
      }
    }
  }
}

// testProductAvailabilityTime();

// Keep the program running;
// setInterval(() => {
//   // checkApi();
//   run();
// }, 5000);