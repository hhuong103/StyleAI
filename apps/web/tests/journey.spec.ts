import { expect, test } from "@playwright/test";
import {
  featuredLooks,
  shopeeListingFor,
  shopeeProductMatches,
  shopeeUrl,
} from "../src/lib/runway";
import { shopeeSearchUrl } from "../src/lib/shopee";

test("Catalog Shopee links search by the exact saved product name", () => {
  const destination = new URL(
    shopeeSearchUrl(" Double-lined oversized blazer "),
  );

  expect(destination.origin).toBe("https://shopee.vn");
  expect(destination.pathname).toBe("/search");
  expect(destination.searchParams.get("keyword")).toBe(
    "Double-lined oversized blazer",
  );
});

test("Every runway product uses a browser-safe Shopee listing URL", () => {
  const products = featuredLooks.flatMap((look) => look.products);

  expect(products).toHaveLength(30);
  expect(new Set(products.map((product) => product.id)).size).toBe(30);
  expect(Object.keys(shopeeProductMatches).sort()).toEqual(
    products.map((product) => product.id).sort(),
  );
  for (const product of products) {
    const listing = shopeeListingFor(product);
    const destination = new URL(shopeeUrl(product));
    const decodedPath = decodeURIComponent(destination.pathname);

    expect(destination.protocol).toBe("https:");
    expect(destination.hostname).toBe("shopee.vn");
    expect(decodedPath).toMatch(/-i\.\d+\.\d+$/u);
    expect(decodedPath).not.toContain("/product/");
    expect(decodedPath).not.toContain("/search");
    expect(destination.search).toBe("");
    expect(listing.listingTitle.length).toBeGreaterThan(12);
    expect(listing.matchedAttributes).toContain(product.category);
    expect(listing.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(product.packshot).toMatch(new RegExp(`/${product.id}\\.png$`, "u"));
  }

  const byId = Object.fromEntries(
    products.map((product) => [product.id, shopeeUrl(product)]),
  );
  expect(byId["heavy-tee"]).not.toBe(byId["ivory-blouse"]);
  expect(byId["cropped-jacket"]).not.toBe(byId["sand-blazer"]);
  expect(byId["cropped-denim-jacket"]).not.toBe(byId["green-overshirt"]);
  expect(byId["indigo-wide-jeans"]).not.toBe(byId["cream-trousers"]);
  expect(byId["blue-oxford-shirt"]).not.toBe(byId["ivory-blouse"]);
  expect(byId["flared-leggings"]).not.toBe(byId["black-performance-top"]);
  expect(byId["black-leather-bomber"]).not.toBe(byId["gray-fine-knit"]);
});

test("Collection and product detail use the saved product name", async ({
  page,
  isMobile,
}) => {
  await page.goto("/shop");
  await expect(page.locator(".product-card")).toHaveCount(24);

  const firstProductName = page.locator(".product-card h3").first();
  const savedName = await firstProductName.textContent();
  expect(savedName).toBeTruthy();
  await expect(page.locator("body")).not.toContainText(/₫|VND/u);

  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  await page
    .locator(".language-switch")
    .getByRole("button", { name: "VI" })
    .click();
  await expect(firstProductName).toHaveText(savedName!);
  await expect(
    page.getByRole("heading", { name: "Chọn ít hơn. Hợp hơn." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/₫|VND/u);
  await page.locator(".product-card").first().click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(savedName!);
  const shopeeLink = page.getByRole("link", {
    name: "Xem trên Shopee",
  });
  const destination = new URL((await shopeeLink.getAttribute("href"))!);
  expect(destination.hostname).toBe("shopee.vn");
  expect(destination.pathname).toBe("/search");
  expect(destination.searchParams.get("keyword")).toBe(savedName!.trim());
  await expect(shopeeLink).toHaveAttribute("target", "_blank");
});

test("A product can be added to the Waitlist", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.removeItem("styleai_waitlist_v1"),
  );
  const response = await page.request.get(
    "/api/v1/products?page_size=100&available=true",
  );
  expect(response.ok()).toBeTruthy();
  const result = (await response.json()) as {
    data: { id: string; available: boolean }[];
  };
  const product = result.data.find((item) => item.available);
  if (!product)
    throw new Error(
      "The catalog has no available products for the Waitlist test.",
    );

  await page.goto(`/shop/${product.id}`);
  await page.getByRole("button", { name: "Add to Waitlist" }).click();
  await expect(
    page.getByRole("button", { name: "Added to Waitlist" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: /Review Waitlist \(1\)/u }),
  ).toBeVisible();

  const items = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("styleai_waitlist_v1") || "[]"),
  );
  expect(items).toHaveLength(1);
  expect(items[0].product_id).toBe(product.id);
  expect(items[0].variant_id).toBeTruthy();
});

test("Selected Waitlist pieces open the AI try-on studio", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    localStorage.removeItem("styleai_waitlist_v1"),
  );
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Try-on Tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`try-on-${info.project.name}-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("An-E2E-password-12345");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile$/u);

  const response = await page.request.get(
    "/api/v1/products?page_size=100&available=true",
  );
  const catalog = (await response.json()) as {
    data: { id: string; available: boolean }[];
  };
  const product = catalog.data.find((item) => item.available);
  if (!product) throw new Error("No available product for try-on test.");

  await page.goto(`/shop/${product.id}`);
  await page.getByRole("button", { name: "Add to Waitlist" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("styleai_waitlist_v1") || "[]")
            .length,
      ),
    )
    .toBe(1);
  await page.getByRole("link", { name: /Review Waitlist/u }).click();
  await page.getByRole("checkbox", { name: /Select .* for styling/u }).check();

  await expect(
    page.getByRole("heading", { name: "Create your AI try-on" }),
  ).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: /^Age/u })).toHaveValue(
    "24",
  );
  await expect(page.getByRole("spinbutton", { name: /^Height/u })).toHaveValue(
    "165",
  );
  await expect(page.getByRole("spinbutton", { name: /^Weight/u })).toHaveValue(
    "52",
  );
  await page.getByLabel(/I agree that these measurements/u).check();
  await page.getByRole("button", { name: "Generate AI try-on" }).click();
  await expect(page.locator(".try-on-form .error-box")).toContainText(
    "Gemini image generation is not configured",
  );
});

test("Home, registration, stylist, replace, save and feedback persist", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 2, name: "Coral confidence" }),
  ).toBeVisible();
  await page
    .locator(".shop-look-language")
    .getByRole("button", { name: "VI" })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Rực rỡ đầy tự tin" }),
  ).toBeVisible();
  await page.goto("/register");
  await page.getByLabel("Tên của bạn").fill("Fashion Tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`fashion-${info.project.name}-${Date.now()}@example.com`);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("An-E2E-password-12345");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole("button", { name: "Lưu sở thích", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu phong cách");
  await page.goto("/stylist");
  await page.getByRole("button", { name: "Phỏng vấn", exact: true }).click();
  await page.getByRole("button", { name: "Trang trọng", exact: true }).click();
  await page.getByRole("button", { name: "Xanh dương", exact: true }).click();
  await page.getByLabel("Gender / ngữ cảnh").selectOption("FEMALE");
  await page
    .getByLabel("Mô tả nhu cầu phối đồ")
    .fill("I need a minimalist outfit for an interview");
  const planResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/stylist/plan") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Hiểu yêu cầu của tôi" }).click();
  const plan = await planResponse;
  expect(plan.request().postDataJSON().context).toMatchObject({
    gender: "FEMALE",
    occasion: "INTERVIEW",
    style: "FORMAL",
    preferred_colors: ["BLUE"],
  });
  await expect(page.locator(".understood")).toContainText("Phỏng vấn");
  await expect(page.locator(".understood")).toContainText("Trang trọng");
  await page.getByRole("button", { name: "Tạo Look dành cho tôi" }).click();
  await expect(page).toHaveURL(/\/recommendations\/[a-f0-9-]+$/);
  await expect(page.locator(".look-card")).toHaveCount(3);
  await page.locator(".look-card a").first().click();
  await expect(page.locator(".look-item")).toHaveCount(4);
  await page.getByRole("button", { name: /Chọn Áo:/ }).click();
  await expect(page.getByRole("button", { name: /Chọn Áo:/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByRole("button", { name: "Thay món", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Chọn món này", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".look-panel > .eyebrow")).toContainText(
    "PHIÊN BẢN 2",
  );
  await page.getByRole("button", { name: "Lưu Look này", exact: true }).click();
  await expect(page).toHaveURL(/\/my-looks\/[a-f0-9-]+$/);
  await page.getByRole("button", { name: "Thích Look", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Thích Look", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator(".saved-item")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Thích Look", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/my-looks");
  await expect(page.locator(".look-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Yêu thích", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Yêu thích", exact: true }).last(),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/shop");
  await expect(page.locator(".product-card")).toHaveCount(24);
  const firstProductName = page.locator(".product-card h3").first();
  const firstSavedName = await firstProductName.textContent();
  expect(firstSavedName).toBeTruthy();
  await expect(page.locator("body")).not.toContainText(/₫|VND/u);
  await page
    .locator(".language-switch")
    .getByRole("button", { name: "EN" })
    .click();
  await expect(firstProductName).toHaveText(firstSavedName!);
  await expect(
    page.getByRole("heading", { name: "Fewer pieces. Better choices." }),
  ).toBeVisible();
  await page
    .locator(".language-switch")
    .getByRole("button", { name: "VI" })
    .click();
  const filteredResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/products?") &&
      response.url().includes("category=SHIRT") &&
      response.status() === 200,
  );
  await page
    .getByRole("combobox", { name: "Loại trang phục" })
    .selectOption("SHIRT");
  await expect(page).toHaveURL(/category=SHIRT/);
  const filtered = (await (await filteredResponse).json()).data;
  expect(filtered.length).toBeGreaterThan(0);
  expect(
    filtered.every(
      (product: { category: string }) => product.category === "SHIRT",
    ),
  ).toBe(true);
  await expect(page.locator(".product-card").first()).toHaveAttribute(
    "href",
    `/shop/${filtered[0].id}`,
  );
  await page.locator(".product-card").first().click();
  await expect(page).toHaveURL(/\/shop\/[a-f0-9-]+$/);
  await expect(page.locator(".product-detail h2")).toHaveText(filtered[0].name);
  expect(errors).toEqual([]);
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    body: document.documentElement.scrollWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.width);
});

test("Public navigation is usable with keyboard and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page
    .getByRole("link", { name: "View Cherry A-line skirt", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/outfits\/coral-weekend\/red-skirt$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Cherry A-line skirt" }),
  ).toBeVisible();
  await expect(page.locator(".runway-transition")).toBeHidden();
  await page.getByRole("link", { name: "Back to the runway" }).click();
  await page.getByRole("link", { name: "Find my look" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
});

test("Circular runway previews garments and opens their separate details", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".runway-model")).toHaveCount(5);
  await expect
    .poll(() =>
      page
        .locator(".runway-model img")
        .evaluateAll((images: HTMLImageElement[]) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await expect(page.locator(".runway .lucide-plus")).toHaveCount(0);
  const front = await page
    .locator('.runway-model[data-active="true"] .runway-photo')
    .boundingBox();
  expect(front!.y).toBeGreaterThanOrEqual(0);
  expect(front!.y + front!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  for (const name of ["Previous style", "Next style"]) {
    const arrow = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(arrow!.y).toBeGreaterThan(front!.y);
    expect(arrow!.y + arrow!.height).toBeLessThan(front!.y + front!.height);
  }
  const activeFilter = await page
    .locator('.runway-model[data-active="true"] .runway-photo')
    .evaluate((photo) => getComputedStyle(photo).filter);
  expect(Number(activeFilter.match(/blur\((.+)px\)/)?.[1])).toBe(0);
  expect(
    Number(activeFilter.match(/brightness\((.+?)\)/)?.[1]),
  ).toBeGreaterThan(1);
  await expect(
    page.locator('.runway-model[data-active="true"] img'),
  ).toHaveAttribute("src", /cutout/);
  const rearFilters = await page
    .locator('.runway-model[data-active="false"] .runway-photo')
    .evaluateAll((photos) =>
      photos.map((photo) => getComputedStyle(photo).filter),
    );
  expect(
    rearFilters.every(
      (filter) => Number(filter.match(/blur\((.+)px\)/)?.[1]) > 0,
    ),
  ).toBe(true);
  expect(
    rearFilters.every(
      (filter) => Number(filter.match(/brightness\((.+?)\)/)?.[1]) < 0.25,
    ),
  ).toBe(true);

  const nextStyle = page.getByRole("button", {
    name: "Next style",
    exact: true,
  });
  await nextStyle.click();
  await nextStyle.click();
  await expect(nextStyle).toBeEnabled();
  await expect(
    page.getByRole("heading", { level: 2, name: "Modern utility" }),
  ).toBeVisible();

  if (!isMobile) {
    const stage = page.locator(".runway-stage");
    const box = await stage.boundingBox();
    await page.mouse.move(
      box!.x + box!.width * 0.18,
      box!.y + box!.height * 0.4,
    );
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width * 0.3,
      box!.y + box!.height * 0.4,
      {
        steps: 4,
      },
    );
    await expect(stage).toHaveAttribute("data-dragging", "true");
    await page.mouse.up();
    await expect(stage).toHaveAttribute("data-dragging", "false");
  }

  await page.locator(".runway-dots button").first().click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Coral confidence" }),
  ).toBeVisible();
  const piece = page.getByRole("link", {
    name: "View Cherry A-line skirt",
    exact: true,
  });
  if (!isMobile) {
    await piece.locator("polygon").first().hover();
    await expect(
      page.getByRole("complementary", { name: "Garment preview" }),
    ).toContainText("Cherry A-line skirt");
    await expect(piece.locator(".runway-garment-hit polygon")).not.toHaveCount(
      0,
    );
    await expect(
      piece.locator(".runway-garment-outline polygon"),
    ).not.toHaveCount(0);
    await expect
      .poll(() =>
        piece
          .locator(".runway-garment-outline polygon")
          .first()
          .evaluate((polygon) => getComputedStyle(polygon).pointerEvents),
      )
      .toBe("none");
    await expect(page.locator(".runway-preview-card")).toContainText(
      "Available sizes",
    );
    const isolatedPreview = page.locator(
      ".runway-preview-image > .runway-preview-packshot",
    );
    await expect(isolatedPreview).toBeVisible();
    await expect(isolatedPreview).toHaveAttribute(
      "src",
      "/images/products/coral-weekend/red-skirt.png",
    );
    await expect(page.locator(".runway-preview-image svg")).toHaveCount(0);
    await page.locator(".runway-preview-detail").hover();
    await expect(page.locator(".runway-preview-card")).toBeVisible();
  }
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".runway-product-info")).toHaveCount(0);
  await piece.locator("polygon").first().click();
  await expect(page).toHaveURL(/\/outfits\/coral-weekend\/red-skirt$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Cherry A-line skirt" }),
  ).toBeVisible();

  await expect(page.locator(".runway-listing-proof")).toHaveCount(0);
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "M", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const destination = new URL(
    (await page
      .getByRole("link", { name: "View product on Shopee" })
      .getAttribute("href"))!,
  );
  expect(destination.hostname).toBe("shopee.vn");
  expect(decodeURIComponent(destination.pathname)).toMatch(
    /-i\.366027874\.43517419917$/u,
  );
  expect(destination.pathname).not.toContain("/product/");
  expect(destination.pathname).not.toContain("/search");
  expect(destination.searchParams.has("keyword")).toBe(false);
  for (const pose of ["Walking pose", "Back view", "Front view"]) {
    await page.getByRole("button", { name: pose, exact: true }).click();
    await expect(
      page.getByRole("button", { name: pose, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".runway-gallery-tag")).toContainText(pose);
    await expect
      .poll(() =>
        page
          .locator(".runway-gallery-photo img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
  }
  await page.getByRole("button", { name: "Enlarge photo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: /Sculpted cuff blouse/ }).click();
  await expect(page).toHaveURL(/\/outfits\/coral-weekend\/ivory-blouse$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Sculpted cuff blouse" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to the runway" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Next style" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Soft tailoring" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View Polished penny loafers", exact: true })
    .locator("polygon")
    .first()
    .click();
  await expect(page).toHaveURL(/\/outfits\/soft-tailoring\/brown-loafers$/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { level: 2, name: "Soft tailoring" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test("Expanded Hot Trend models provide complete three-view galleries", async ({
  page,
  request,
}) => {
  for (const look of [
    "city-denim",
    "neo-prep",
    "elevated-active",
    "monochrome-edge",
  ]) {
    const response = await request.get(
      `/images/shop-the-look/${look}-poses.png`,
    );
    expect(response.ok()).toBe(true);
    expect((await response.body()).byteLength).toBeGreaterThan(100_000);
  }

  await page.goto("/outfits/city-denim/cropped-denim-jacket");
  await expect(
    page.getByRole("heading", { level: 1, name: "Cropped denim jacket" }),
  ).toBeVisible();

  for (const pose of ["Front view", "Walking pose", "Back view"]) {
    const selector = page.getByRole("button", { name: pose, exact: true });
    await expect(selector).toBeVisible();
    await selector.click();
    await expect(selector).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".runway-gallery-tag")).toContainText(pose);
    await expect
      .poll(() =>
        page
          .locator(".runway-gallery-photo img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
  }
});
