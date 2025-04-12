import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { SkuData, SKUResponseData } from "./types/sku";
import { openPage, startBrowser } from "./scraper";
import { Browser, LaunchOptions } from "puppeteer";
import { ProshopScraper } from "./scraper";
import { exec } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const proshopUsername = process.env.PROSHOP_USERNAME || "test-username";
const proshopPassword = process.env.PROSHOP_PASSWORD || "test-password";
const proshopRealname = process.env.PROSHOP_REALNAME || "test-realname";

const dataPath = path.join(__dirname, "data", "skuData.json");

async function readData(): Promise<SkuData | undefined> {
  try {
    const data = await fs.readFile(dataPath, "utf-8");

    const parsedData = JSON.parse(data);

    return parsedData;
  } catch (err) {
    console.error("Error reading or parsing the file: ", err);
  }
};

async function updateSKUData() {
  try {
    const res = await fetch(`https://api.nvidia.partners/edge/product/search?page=1&limit=12&locale=fi-fi&manufacturer=NVIDIA&manufacturer_filter=NVIDIA~2&category=GPU`);

    const data = await res.json();



    console.log(data.searchedProducts.productDetails);
    console.log(res);
  } catch (err) {
    console.log(err);
  }
};

async function checkSKUData() {
  try {
    const res = await fetch(`https://api.nvidia.partners/edge/product/search?page=1&limit=12&locale=fi-fi&manufacturer=NVIDIA&manufacturer_filter=NVIDIA~2&category=GPU`);

    const data = await res.json();

    // console.log(data.searchedProducts.productDetails);
    // console.log(res);
  } catch (err) {
    console.log(err);
  }
};

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

checkSKUData();

async function run() {
  const data = await readData();

  if (data && "RTX 5080" in data) {
    const skuResponseData = await checkSKUStock(data["RTX 5080"].productSKU);

    if (skuResponseData?.success && skuResponseData?.listMap.length > 0) {
      console.log(skuResponseData.listMap[0].fe_sku);
    } else if (skuResponseData?.success) {
      console.error("Api response successful but the sku data is missing");
    } else {
      console.error("Something went wrong making the api call");
    }
  }
}

async function testPuppeteer() {
  // const browser = await startBrowser();
  // const page = await openPage(browser, "https://www.twitch.tv/steelmage");

  // const title = await page.title();

  // await browser.close();
  // console.log(title);
  // return { title };
  const proshopSraper = await ProshopScraper.create({ headless: true }, { waitUntil: "domcontentloaded" });
  
  // Return true if succesfully logged in
  const isLoggedIn = await proshopSraper.login(proshopUsername, proshopPassword, proshopRealname);
  console.log(isLoggedIn);
  if (isLoggedIn) {
    await proshopSraper.addProductToCart("jorma");
  }

  // Open default browser - works for sure using Windows, Linux and others not confirmed
  // exec('start chrome https://www.proshop.fi', (err: any, stdout: any, stderr: any) => {
  //   if (err) {
  //     console.error('Error opening browser:', err);
  //     return;
  //   }
  //   console.log('Browser opened');
  // });

  return process.exit(1);
  // console.log(await proshopSraper.getElementText("https://www.proshop.fi/"));
};

// First run
// run();

testPuppeteer();

// Keep the program running;
// setInterval(() => {
//   // checkApi();
//   run();
// }, 5000);