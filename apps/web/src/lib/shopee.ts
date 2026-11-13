export function shopeeSearchUrl(productName: string) {
  const url = new URL("https://shopee.vn/search");
  url.searchParams.set("keyword", productName.trim());
  return url.toString();
}
