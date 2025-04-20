import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { NvidiaStoreListingResponse, SingleSkuData, SkuData, SKUResponseData } from "./types/sku";
import { ProshopScraper } from "./scraper";
import { exec } from 'child_process';
import { queryUser, envValues, delay } from "./util/utilities";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// const mockDataInStock = {
//   success: true,
//   map: null,
//   listMap: [
//     {
//       is_active: 'true',
//       product_url: "https://www.proshop.fi/Naeyttoe/27-GIGABYTE-AORUS-FO27Q2-2560x1440-QHD-240Hz-QD-OLED-18W-USB-C/3281900",
//       price: '1000000',
//       fe_sku: 'PRO5080FESHOP_FI',
//       locale: 'FI'
//     }
//   ]
// };

// const mockDataNotInStock = {
//   success: true,
//   map: null,
//   listMap: [
//     {
//       is_active: 'false',
//       product_url: '',
//       price: '1000000',
//       fe_sku: 'PRO5080FESHOP_FI',
//       locale: 'FI'
//     }
//   ],
// };

const proshopUsername = process.env.PROSHOP_USERNAME || "test-username";
const proshopPassword = process.env.PROSHOP_PASSWORD || "test-password";
const proshopRealname = process.env.PROSHOP_REALNAME || "test-realname";

const dataPath = path.join(__dirname, "data", "skuData.json");

// For caching the local and possibly updated sku data
const skuDataMap = new Map<keyof SkuData, SingleSkuData>();

// Store sku api responses here
const skuApiResponseData = new Map<keyof SkuData, SKUResponseData>();

// Run the main program
program();

// Read the data and cache it into Map
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

// Read the data from the .json file
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

// Update the .json file data
async function updateLocalSkuData(data: Map<keyof SkuData, SingleSkuData>, gpu: string) {
  const objectToWrite = Object.fromEntries(data);

  console.log(`Updated the local ${gpu} sku data with the data from Nvidia store api - ` + new Date().toString());

  await fs.writeFile(dataPath, JSON.stringify(objectToWrite, null, 2), "utf-8");
}

// The main program
async function program() {
  // Load the data
  const isDataLoaded = await loadInitialDataToMap();

  if (!isDataLoaded) {
    process.exit(1);
  }

  // Setup values and create .env variables
  const setupValues = await initializeSetup();

  // Create the scraper
  const proshopScraper = await ProshopScraper.create({ ...setupValues }, { waitUntil: "domcontentloaded" }, "https://www.proshop.fi");

  if (proshopScraper) {
    // Run the first contact method to get rid of potentially blocking stuff
    await proshopScraper.firstContact();

    // Login to the site
    const isLoggedIn = await proshopScraper.login(proshopUsername, proshopPassword, proshopRealname);

    if (isLoggedIn) {
      // Periodically poll the nvidia store api to update local sku data
      pollNvidiaStoreApi(20000);

      // Poll the individual sku api with the each sku in the data
      pollSkuApi(5000, proshopScraper);
    }
  }


};

// Polls the Nvidia store api periodically based on the updateDelay parameter
async function pollNvidiaStoreApi(updateDelay: number) {
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
              await updateLocalSkuData(skuDataMap, record.gpu);
            } else {
              console.log(record.gpu + " local sku data up to date - " + new Date().toString());
            }
          }
        }
      }
    } catch (err) {
      console.log("Something went wrong making a call to Nvidia store api: ", err);
    }

    // Delay the calls based on the paremeter
    await delay(updateDelay);
  }
};

// Polls the Nvidia sku api endpoints periodically based on the updateDelay parameter
async function pollSkuApi(updateDelay: number, proshopScraper: ProshopScraper) {
  while (true) {
    // Make a call to sku api for each productSku
    const promises = Array.from(skuDataMap.values()).map((sku) =>
      checkSKUStock(sku.productSKU).then(async (res) => {
        // Process each result as soon as it resolves
        if (res) {
          if (res.success && res.listMap[0].is_active === "true" && res.listMap[0].product_url.length > 0) {
            console.log(sku.gpu + " is in stock");
            // Add product to basket based on the url - networkidle0 to make sure there is no network requests going on after loading
            const productAddedToCart = await proshopScraper.addProductToCart(res.listMap[0].product_url, { waitUntil: "networkidle0" });

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
              exec(`start ${res.listMap[0].product_url}`, (err: any, stdout: any, stderr: any) => {
                if (err) {
                  console.error('Error opening browser:', err);
                  return;
                }
                console.log('Browser opened');
              });
            }
          } else {
            console.log(sku.gpu + " not in stock - " + new Date().toString());
          }
        }
      }).catch((err) => {
        console.error(`Error checking stock for ${sku.productSKU}:`, err);
      })
    );

    await delay(updateDelay);
  }
};

async function checkSKUStock(sku: string) {
  try {
    const res = await fetch(`https://api.store.nvidia.com/partner/v1/feinventory?status=1&skus=${sku}&locale=fi-fi`);

    const data: SKUResponseData = await res.json();

    return data;
  } catch (err) {
    // Throw the error and handle it elsewhere
    throw err;
  }
};

async function initializeSetup(): Promise<{ headless: boolean }> {
  const runInHeadless = await queryUser("Run chrome in headless mode?\n");

  const createEnvFile = await queryUser("Create .env file and write credentials to it?\n");

  if (createEnvFile) {
    await envValues();
  }

  return { headless: runInHeadless };
};