import { expect, test } from "@playwright/test";

test("Home, registration, stylist, replace, save and feedback persist", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good style. Made yours." }),
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
  await expect(page.locator(".look-panel > .eyebrow")).toContainText("EDIT 2");
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
    page.getByRole("link", { name: "Đi đến nội dung" }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Khám phá phong cách của bạn" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
});
