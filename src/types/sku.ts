export interface SkuData {
  "RTX 5090": SingleSkuData;
  "RTX 5080": SingleSkuData;
  "RTX 5070": SingleSkuData;
}

export interface SingleSkuData {
  displayName: string,
  productTitle: string,
  gpu: keyof SkuData,
  productSKU: string,
  updateAt: number | null;
}

export interface SKUResponseData {
  success: boolean;
  map: null;
  listMap: {
    is_active: string,
    product_url: string,
    price: string,
    fe_sku: string,
  }[];
}

interface NvidiaStoreListingRecord {
  gpu: keyof SkuData;
  productSKU: string;
  [key: string]: unknown;
}

export type NvidiaStoreListingResponse = NvidiaStoreListingRecord[];