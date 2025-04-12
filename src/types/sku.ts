export type SkuData = Record<string, { displayName: string, productSKU: string }>;

export interface SKUResponseData {
  success: boolean;
  map: null;
  listMap: {
    isActive: string,
    product_url: string,
    price: string,
    fe_sku: string,
  }[];
}