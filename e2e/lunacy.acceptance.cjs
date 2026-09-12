const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const base = process.env.BASE_URL || "http://localhost:3001";
const out =
  process.env.LUNACY_QA_OUTPUT || "../assets/recovery-2026-09-10/chrome-lunacy";
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const p = await context.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base + "/ko/tools/lunacy");
    await p.getByTestId("monthly-free").waitFor();
    const plan = {
      version: 1,
      month: "2026-09",
      openingFree: 100,
      openingPaid: 200,
      priorBonuses: 0,
      firstUsed: [],
      existingDays: { 21: 0, 22: 0 },
      maintenance: true,
      maintenanceExcluded: [],
      events: [],
    };
    await context.clearCookies();
    await p.evaluate(
      (plan) =>
        localStorage.setItem(
          "limbus-lunacy-plan-v1:2026-09",
          JSON.stringify(plan),
        ),
      plan,
    );
    await p.reload();
    await p.getByTestId("monthly-free").waitFor();
    await p.getByRole("button", { name: /계산 설정/ }).click();
    assert.equal(
      await p
        .locator(
          "input[type=month], input[type=number], input[type=checkbox], select, details",
        )
        .count(),
      0,
    );
    await p.getByRole("button", { name: "연도", exact: true }).click();
    await p.getByRole("menuitem", { name: "2026", exact: true }).click();
    await p.getByRole("button", { name: "월", exact: true }).click();
    await p.getByRole("menuitem", { name: "9월", exact: true }).click();
    await p.getByRole("button", { name: "설정 완료", exact: true }).click();
    assert.equal(await p.getByTestId("monthly-free").innerText(), "1,200");
    await p.getByTestId("day-2026-09-19").click();
    await p.getByRole("button", { name: "BM · 패키지", exact: true }).click();
    await p.getByTestId("product-21").waitFor();
    assert.equal(await p.locator('[data-testid^="product-"]').count(), 8);
    for (const id of ["6", "21", "22"]) {
      const image = p.getByTestId(`product-${id}`).locator("img").first();
      assert((await image.getAttribute("src")).includes(`lunacy-${id}.webp`));
    }
    assert.match(await p.getByTestId("product-21").innerText(), /9,900/);
    assert.match(await p.getByTestId("product-21").innerText(), /65/);
    assert.match(await p.getByTestId("product-22").innerText(), /4,400/);
    assert.match(await p.getByTestId("product-22").innerText(), /39/);
    await p.screenshot({ path: path.join(out, "packages-desktop.png") });
    for (const card of await p.locator('[data-testid^="product-"]').all()) {
      await card.scrollIntoViewIfNeeded();
      await card
        .locator("img")
        .first()
        .evaluate((img) => img.decode());
    }
    const firstSwitch = p.getByTestId("product-6").getByRole("switch");
    assert.equal(await p.locator("button button").count(), 0);
    assert.equal(await firstSwitch.getAttribute("aria-checked"), "true");
    await firstSwitch.click();
    assert.equal(await firstSwitch.getAttribute("aria-checked"), "false");
    assert.match(await p.getByTestId("product-6").innerText(), /8336/);
    await p.reload();
    await p.getByTestId("day-2026-09-19").click();
    await p.getByRole("button", { name: "BM · 패키지", exact: true }).click();
    assert.equal(await firstSwitch.getAttribute("aria-checked"), "false");
    await firstSwitch.click();
    await p.getByTestId("product-6").getByRole("button").click();
    assert.match(await p.getByTestId("product-6").innerText(), /16672/);
    await p.getByLabel("구매 수량", { exact: true }).fill("3");
    await p.getByRole("button", { name: "일정 추가", exact: true }).click();
    assert.equal(await p.getByTestId("day-paid").innerText(), "+33,344");
    assert.equal(await firstSwitch.isDisabled(), false);
    await firstSwitch.click();
    assert.match(await p.getByTestId("product-6").innerText(), /25008/);
    assert.match(await p.getByTestId("product-6").innerText(), /4047/);
    assert.equal(await firstSwitch.isDisabled(), false);
    assert.equal(await p.getByTestId("day-paid").innerText(), "+33,344");
    await firstSwitch.click();
    assert.equal(await firstSwitch.getAttribute("aria-checked"), "true");
    await p
      .getByRole("button", { name: "삭제 광기 모음 · 초회 ×3", exact: true })
      .click();
    await p.getByTestId("product-21").getByRole("button").click();
    await p.getByRole("button", { name: "일정 추가", exact: true }).click();
    assert.equal(await p.getByTestId("day-free").innerText(), "+65");
    assert.equal(await p.getByTestId("day-paid").innerText(), "+650");
    await p.getByRole("button", { name: "닫기", exact: true }).click();
    assert.equal(await p.getByTestId("monthly-free").innerText(), "1,980");
    assert.equal(await p.getByTestId("monthly-paid").innerText(), "650");
    assert.equal(await p.getByTestId("monthly-cash").innerText(), "₩9,900");
    await p
      .getByRole("button", { name: "계산 시작 월 +1", exact: true })
      .click();
    assert.equal(await p.getByTestId("monthly-free").innerText(), "2,670");
    assert.equal(await p.getByTestId("monthly-paid").innerText(), "0");
    assert.equal(await p.getByTestId("balance-paid").innerText(), "850");
    assert.equal(await p.getByTestId("monthly-cash").innerText(), "₩0");
    await p
      .getByRole("button", { name: "계산 시작 월 -1", exact: true })
      .click();
    await p.getByTestId("day-2026-09-19").click();
    await p.getByRole("button", { name: "거울 던전", exact: true }).click();
    await p.getByRole("button", { name: "일정 추가", exact: true }).click();
    await p.getByRole("button", { name: "일정 추가", exact: true }).click();
    assert.equal(await p.getByTestId("day-free").innerText(), "+815");
    await p.screenshot({ path: path.join(out, "desktop-modal.png") });
    await p.getByRole("button", { name: "닫기", exact: true }).click();
    assert(
      (await context.cookies()).some((c) => c.name === "limbus_lunacy_v1"),
    );
    await p.evaluate(() => localStorage.clear());
    const cdp = await context.newCDPSession(p);
    await cdp.send("Page.reload", { ignoreCache: true });
    await p.getByTestId("monthly-free").filter({ hasText: "2,730" }).waitFor();
    await p.goto(base + "/ko");
    await p.goto(base + "/ko/tools/lunacy");
    await p.getByTestId("monthly-free").filter({ hasText: "2,730" }).waitFor();
    for (const lang of ["ko", "en", "ja"])
      for (const width of [1440, 390]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.goto(`${base}/${lang}/tools/lunacy`);
        await p
          .getByTestId("monthly-free")
          .filter({ hasText: "2,730" })
          .waitFor();
        await cdp.send("Page.reload", { ignoreCache: true });
        await p
          .getByTestId("monthly-free")
          .filter({ hasText: "2,730" })
          .waitFor();
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        assert.equal(await p.locator("select").count(), 0);
        assert(
          await p
            .locator('img[src*="lunacy"]')
            .first()
            .evaluate((img) => img.complete && img.naturalWidth > 0),
        );
        await p.screenshot({ path: path.join(out, `${lang}-${width}.png`) });
        await p.getByTestId("day-2026-09-19").click();
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await p.waitForFunction(() => {
          const el = document.querySelector("[role=dialog]");
          return el && Number(getComputedStyle(el).opacity) === 1;
        });
        await p.screenshot({
          path: path.join(out, `${lang}-${width}-modal.png`),
        });
        await p.keyboard.press("Escape");
        await p.goto(`${base}/${lang}`);
        await p.goto(`${base}/${lang}/tools/lunacy`);
        await p
          .getByTestId("monthly-free")
          .filter({ hasText: "2,730" })
          .waitFor();
      }
    await p.setViewportSize({ width: 390, height: 900 });
    await p.goto(base + "/ko/tools/lunacy");
    await p.getByTestId("monthly-free").waitFor();
    await p.getByRole("button", { name: /계산 설정/ }).click();
    await p.waitForFunction(
      () =>
        getComputedStyle(document.querySelector("[role=dialog]")).opacity ===
        "1",
    );
    await p.screenshot({ path: path.join(out, "settings-mobile.png") });
    await p.getByRole("button", { name: "월정액", exact: true }).click();
    await p.screenshot({
      path: path.join(out, "settings-membership-mobile.png"),
    });
    await p.getByRole("button", { name: "설정 완료", exact: true }).click();
    await p.getByTestId("day-2026-09-19").click();
    await p.getByRole("button", { name: "BM · 패키지", exact: true }).click();
    await p.getByTestId("product-22").scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(out, "packages-mobile.png") });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: free/paid separation, membership cross-month claims and cost, weekly cap, saved plan, three locales, Chrome desktop/mobile, hard reload/revisit, asset, custom dropdowns.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
