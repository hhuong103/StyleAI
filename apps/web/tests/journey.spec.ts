import { expect, test } from "@playwright/test";

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
  await page.getByLabel("Ngân sách đến (VND)").fill("1500000");
  await page.getByRole("button", { name: "Lưu sở thích", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu phong cách");
  await page.goto("/stylist");
  await page.getByRole("button", { name: "Phỏng vấn", exact: true }).click();
  await page.getByRole("button", { name: "Tối giản", exact: true }).click();
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
  await expect(page.locator(".product-detail h2")).toContainText(
    filtered[0].name,
  );
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
  const piece = page.getByRole("link", {
    name: "View Cherry A-line skirt",
    exact: true,
  });
  if (!isMobile) {
    await piece.locator("polygon").first().hover();
    await expect(
      page.getByRole("complementary", { name: "Garment preview" }),
    ).toContainText("Cherry A-line skirt");
    await expect(page.locator(".runway-preview-card")).toContainText(
      "Available sizes",
    );
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
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "M", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const destination = new URL(
    (await page
      .getByRole("link", { name: "Find this style on Shopee" })
      .getAttribute("href"))!,
  );
  expect(destination.hostname).toBe("shopee.vn");
  expect(destination.searchParams.get("keyword")).toContain("chân váy");
  expect(destination.searchParams.get("keyword")).toContain("size M");
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
