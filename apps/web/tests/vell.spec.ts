import { expect, test } from "@playwright/test";

test("the former Collection URL opens VELL", async ({ page }) => {
  await page.goto("/shop");
  await expect(page).toHaveURL(/\/vell$/);
  await expect(
    page.getByRole("link", { name: "Về trang chủ", exact: true }),
  ).toBeVisible();
  await page.goto("/catalog");
  await expect(page.getByText("PRODUCT CATALOG")).toBeVisible();
});

test("VELL shows eight illustrative looks with the compact controls", async ({
  page,
  isMobile,
}) => {
  await page.goto("/vell");
  if (isMobile) await page.getByRole("button", { name: /Outfits 8/ }).click();
  await expect(
    page.getByRole("button", { name: "Xem Casual streetwear" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".vell-outfit-card")).toHaveCount(8);
  await expect(page.locator(".vell-categories button")).toHaveCount(7);
  expect(
    await page
      .locator(".vell-categories")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await expect(page.locator(".vell-groups")).toHaveCount(0);
  await expect(page.locator(".vell-group-items a")).toHaveCount(0);
  await page.getByRole("button", { name: "Formal" }).click();
  await expect(page.locator(".vell-outfit-card")).toHaveCount(3);
  if (isMobile)
    await page.getByRole("button", { name: "Đóng outfits" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  if (isMobile) await page.getByRole("button", { name: /Outfits 8/ }).click();
  await expect(
    page.getByRole("button", { name: "Xem Casual streetwear" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("demo outfits restore their own similar shopping links", async ({
  page,
  isMobile,
}) => {
  await page.goto("/vell");
  if (isMobile) await page.getByRole("button", { name: /Outfits 8/ }).click();
  await page.getByRole("button", { name: "Xem City denim" }).click();
  await expect(
    page.getByRole("img", { name: /Ảnh minh họa City denim/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /SAVE TO LIBRARY/ }).click();
  await page.reload();
  await page.getByRole("button", { name: "Mở thư viện đã lưu" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "City denim" })
    .click();
  await expect(
    page.getByRole("img", { name: /Ảnh minh họa City denim/ }),
  ).toBeVisible();
  await expect(page.locator(".vell-regions a")).toHaveCount(2);
  await expect(page.locator(".vell-regions a").first()).toHaveAttribute(
    "aria-label",
    /tương tự/,
  );
});

test("VELL does not invent products when the real catalog is unavailable", async ({
  page,
  isMobile,
}) => {
  await page.goto("/vell");
  if (isMobile) await page.getByRole("button", { name: /Outfits 8/ }).click();
  await expect(page.getByRole("group", { name: "Nguồn outfit" })).toHaveCount(
    0,
  );
  await expect(page.locator(".vell-grid .vell-outfit-card")).toHaveCount(8);
  await expect(page.locator(".vell-grid .vell-outfit-card.live")).toHaveCount(
    0,
  );
});

test("male presets can be selected in the studio", async ({ page }) => {
  await page.goto("/vell");
  await page
    .getByRole("button", { name: "Chọn người mẫu", exact: true })
    .click();
  await expect(page.locator(".vell-model-picker button")).toHaveCount(8);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Marcus", exact: true })
    .click();
  await expect(page.locator(".vell-profile strong")).toContainText("Marcus");
  await expect(
    page.locator(".vell-model > .vell-avatar-current"),
  ).toHaveAttribute("src", /marcus-everyday.svg$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("outfit reveal and camera distance controls work", async ({
  page,
  isMobile,
}) => {
  await page.goto("/vell");
  if (isMobile) await page.getByRole("button", { name: /Outfits 8/ }).click();
  await page.getByRole("button", { name: "Xem City denim" }).click();
  const avatar = page.locator(".vell-avatar-current");
  await expect(avatar).toHaveAttribute("src", /denim.png$/);
  await expect(page.locator(".vell-outfit-glow")).toHaveCount(1);
  await expect(page.locator(".vell-outfit-glow")).toHaveCSS(
    "animation-name",
    "vell-outfit-light",
  );
  await expect(page.locator(".vell-outfit-glow")).toHaveCSS(
    "mask-image",
    "none",
  );
  if (!isMobile) {
    await page.locator(".vell-model").evaluate((element) =>
      element.getAnimations({ subtree: true }).forEach((animation) => {
        animation.pause();
        animation.currentTime = 500;
      }),
    );
    await page.screenshot({
      path: "../../docs/screenshots/vell-outfit-glow.png",
    });
  }
  await expect(page.locator(".vell-profile > img")).toHaveAttribute(
    "src",
    /denim.png$/,
  );
  await expect(page.locator(".vell-avatar-previous")).toHaveCount(0, {
    timeout: 3000,
  });
  await expect(page.locator(".vell-outfit-glow")).toHaveCount(0);
  await expect(page.locator(".vell-zoom")).toHaveCount(0);
  await page.locator(".vell-stage").hover();
  const scale = async () =>
    Number(
      (await page.locator(".vell-model").getAttribute("style"))?.match(
        /scale\(([\d.]+)\)/,
      )?.[1],
    );
  await page.mouse.wheel(0, -400);
  await expect.poll(scale).toBeGreaterThan(1);
  await page.mouse.wheel(0, 800);
  await expect.poll(scale).toBeLessThan(1);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".vell-model")).toHaveAttribute(
    "style",
    /scale\(1\)/,
  );
});

test("lighting presets and realism affect the studio preview", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Realism panel is desktop-only");
  await page.goto("/vell");
  const backdrop = page.locator(".vell-backdrop");
  const cool = await backdrop.evaluate(
    (element) => getComputedStyle(element).filter,
  );
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByRole("option", { name: /Warm Studio/ }).click();
  await expect(backdrop).toHaveAttribute("data-filter", "Warm Studio");
  await expect(backdrop).not.toHaveCSS("filter", cool);
  const avatar = page.locator(".vell-avatar-current");
  const original = await avatar.getAttribute("src");
  const realism = page.getByRole("slider", { name: "Realism", exact: true });
  await realism.focus();
  await realism.press("Home");
  await expect(realism).toHaveValue("0");
  const soft = await avatar.evaluate(
    (element) => getComputedStyle(element).filter,
  );
  await realism.press("End");
  await expect(realism).toHaveValue("100");
  await expect(avatar).not.toHaveCSS("filter", soft);
  await expect(avatar).toHaveAttribute("src", original!);
  await expect(
    page.getByText("Ảnh sản phẩm giữ màu gốc", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Chỉ áp dụng khi dịch vụ AI hỗ trợ", { exact: true }),
  ).toHaveCount(0);
});

test("studio lighting picker supports selection and keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/vell");
  const trigger = page.getByRole("button", { name: "Filter", exact: true });
  await trigger.click();
  await expect(
    page.getByRole("listbox", { name: "Ánh sáng studio" }),
  ).toBeVisible();
  await page.getByRole("option", { name: /Warm Studio/ }).click();
  await expect(trigger).toContainText("Warm Studio");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".vell-backdrop")).toHaveAttribute(
    "data-filter",
    "Warm Studio",
  );
  await trigger.press("ArrowDown");
  await page.getByRole("option", { name: /Warm Studio/ }).press("Home");
  await page.getByRole("option", { name: /Cool Studio/ }).press("Enter");
  await expect(trigger).toContainText("Cool Studio");
  await trigger.click();
  await page.getByRole("option", { name: /Cool Studio/ }).press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
});
import {
  illustrativeShopping,
  safeShoppingUrl,
} from "../src/lib/vell-shopping";

test("shopping suggestions cover all outfits without claiming exact product identity", async () => {
  expect(Object.keys(illustrativeShopping)).toHaveLength(50);
  for (const targets of Object.values(illustrativeShopping)) {
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target.match).toBe("SIMILAR");
      expect(safeShoppingUrl(target.url)).toBe(true);
      expect(["www2.hm.com", "www.uniqlo.com"]).toContain(
        new URL(target.url).hostname,
      );
      expect(target.url).toMatch(/productpage\.\d+\.html|\/products\/E\d+/);
      expect(
        target.polygons.every(
          (p) =>
            p.length >= 3 &&
            p.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1),
        ),
      ).toBe(true);
    }
  }
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:password@example.com",
    "not a url",
  ])
    expect(safeShoppingUrl(url)).toBe(false);
});

test("garment hotspots show similarity and open the specific product in a new tab", async ({
  page,
  context,
  isMobile,
}) => {
  await context.route("https://www2.hm.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Retailer navigation intercepted by test</h1>",
    }),
  );
  await page.goto("/vell");
  const jacket = page.getByRole("link", {
    name: /tương tự: Áo khoác bomber đen/,
  });
  await expect(jacket).toBeVisible();
  await expect(page.locator(".vell-avatar-current")).toHaveCount(1);
  await expect(jacket).toHaveAttribute(
    "href",
    "https://www2.hm.com/en_gb/productpage.1323320001.html",
  );
  if (!isMobile) {
    await jacket.locator("circle").first().hover();
    await expect(page.getByRole("tooltip")).toContainText("TƯƠNG TỰ · H&M");
    await page.screenshot({ path: "../../docs/screenshots/vell-shopping.png" });
  }
  const [popup] = await Promise.all([
    page.waitForEvent("popup", { timeout: 15000 }),
    jacket.locator("circle").first().click(),
  ]);
  await expect(popup).toHaveURL(
    "https://www2.hm.com/en_gb/productpage.1323320001.html",
  );
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
  await expect(page).toHaveURL(/\/vell$/);
  if (isMobile) await page.getByRole("button", { name: /Outfits 8/ }).click();
  await page.getByRole("button", { name: "Xem City denim" }).click();
  await expect(jacket).toHaveCount(0);
  const tank = page.getByRole("link", { name: /tương tự: Áo sát nách đen/ });
  await expect(tank).toBeVisible();
  await expect(page.locator(".vell-avatar-current")).toHaveCount(1);
  await tank.focus();
  await expect(page.getByRole("tooltip")).toContainText("TƯƠNG TỰ · UNIQLO");
  await tank.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.mouse.move(10, 400);
  await page.locator(".vell-stage").hover();
  await page.mouse.wheel(0, -200);
  await expect(page.locator(".vell-model")).not.toHaveAttribute(
    "style",
    /scale\(1\)/,
  );
  await expect(page.locator(".vell-shopping-regions")).toHaveAttribute(
    "preserveAspectRatio",
    "xMidYMax meet",
  );
  await page
    .getByRole("button", { name: "Chọn người mẫu", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Marcus", exact: true })
    .click();
  await expect(page.locator(".vell-regions a")).toHaveCount(2);
});

test("shopping hotspots stay hidden while an outfit image is loading", async ({
  page,
  isMobile,
}) => {
  await page.goto("/vell");
  await expect(page.locator(".vell-regions a")).toHaveCount(3);
  // A failed replacement must never leave the next outfit's links on the old image.
  await page.route("**/images/vell-outfits/denim.png", (route) =>
    route.abort(),
  );
  if (isMobile) await page.getByRole("button", { name: /Outfits 8/ }).click();
  await page.getByRole("button", { name: "Xem City denim" }).click();
  await expect(page.locator(".vell-regions a")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".vell-regions a")).toHaveCount(3);
});

test("each model owns a complete categorized outfit wardrobe", async ({
  page,
  context,
  isMobile,
}) => {
  await page.goto("/vell");
  test.setTimeout(180_000);
  await context.route("https://www2.hm.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Retailer test</h1>" }),
  );
  for (const name of [
    "Alex",
    "Minh",
    "Marcus",
    "Linh",
    "Amara",
    "Sofia",
    "VELL Utility",
  ]) {
    await page
      .getByRole("button", { name: "Chọn người mẫu", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name, exact: true })
      .click();
    if (isMobile) await page.getByRole("button", { name: /Outfits 6/ }).click();
    await expect(page.locator(".vell-outfit-card")).toHaveCount(6);
    for (const group of [
      "Everyday",
      "Athletic",
      "Sleep",
      "Formal",
      "Party",
      "Street",
    ]) {
      await page.getByRole("button", { name: group, exact: true }).click();
      const card = page.getByRole("button", {
        name: `Xem ${name} · ${group}`,
        exact: true,
      });
      await expect(card).toBeVisible();
      await card.click();
      await expect(page.locator(".vell-avatar-current")).toHaveAttribute(
        "src",
        new RegExp(
          `${name === "VELL Utility" ? "male" : name.toLowerCase()}-${group.toLowerCase()}.svg$`,
        ),
      );
      await expect(page.locator(".vell-profile strong")).toContainText(name);
      await expect(page.locator(".vell-profile > img")).toHaveAttribute(
        "src",
        (await page.locator(".vell-avatar-current").getAttribute("src")) || "",
      );
      const slug = name === "VELL Utility" ? "male" : name.toLowerCase();
      const targets = illustrativeShopping[`${slug}-${group.toLowerCase()}`];
      await expect(page.locator(".vell-regions a")).toHaveCount(targets.length);
      const link = page.locator(".vell-regions a").first();
      await link.focus();
      await expect(page.getByRole("tooltip")).toContainText(
        `TƯƠNG TỰ · ${targets[0].retailer}`,
      );
      await expect(page.getByRole("tooltip")).toContainText(targets[0].name);
      const [popup] = await Promise.all([
        page.waitForEvent("popup", { timeout: 15000 }),
        link.locator("circle").first().click({ timeout: 15000 }),
      ]);
      await expect(popup).toHaveURL(targets[0].url);
      expect(await popup.evaluate(() => window.opener === null)).toBe(true);
      await popup.close();
      if (isMobile)
        await page
          .getByRole("button", { name: /Outfits/ })
          .last()
          .click();
    }
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.locator(".vell-outfit-card")).toHaveCount(6);
    if (isMobile)
      await page.getByRole("button", { name: "Đóng outfits" }).click();
  }
  await page.screenshot({
    path: `../../docs/screenshots/vell-model-outfits-${isMobile ? "mobile" : "desktop"}.png`,
  });
});
