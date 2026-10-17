import { test, expect } from "@playwright/test";

for (const width of [320, 360, 390]) {
  test(`Admin product row stays usable at ${width}px mobile width`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");

    await page.evaluate(() => {
      const host = document.createElement("section");
      host.id = "admin";
      host.dataset-testid = "admin-layout-fixture";
      host.style.cssText = "display:block!important;position:relative!important;width:100vw!important;max-width:100vw!important;height:auto!important;padding:0!important;margin:0!important;overflow:visible!important;visibility:visible!important;";
      host.innerHTML = `
        <div id="studioBody" style="display:block!important;width:100%!important;max-width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important;padding:0!important;margin:0!important;">
          <div class="admin-item" data-testid="product-row">
            <div class="admin-product-main">
              <img class="admin-product-thumb" src="assets/dress-4.svg" alt="" />
              <div class="admin-product-copy">
                <strong>Long product name that must wrap safely on a narrow mobile screen</strong>
                <div class="admin-product-meta">SAREES · ₹1,299 · Deep Maroon</div>
                <div class="admin-occasion-badges" aria-label="Occasions">
                  <span class="admin-occasion-badge">Wedding</span>
                  <span class="admin-occasion-badge">Festive Celebration</span>
                  <span class="admin-occasion-badge">Party Wear</span>
                </div>
                <div class="admin-product-status"><span class="admin-status is-available">AVAILABLE</span></div>
              </div>
            </div>
            <button class="danger edit" type="button">EDIT</button>
          </div>
        </div>`;
      document.body.appendChild(host);
    });

    const host = page.locator('[data-testid="admin-layout-fixture"]');
    const row = host.locator('[data-testid="product-row"]');
    const thumb = row.locator(".admin-product-thumb");
    const edit = row.getByRole("button", { name: "EDIT" });
    const badges = row.locator(".admin-occasion-badge");

    await expect(row).toBeVisible();
    await expect(thumb).toBeVisible();
    await expect(edit).toBeVisible();
    await expect(badges).toHaveCount(3);

    const geometry = await page.evaluate(() => {
      const host = document.querySelector('[data-testid="admin-layout-fixture"]');
      const row = host.querySelector('[data-testid="product-row"]');
      const thumb = row.querySelector(".admin-product-thumb");
      const edit = row.querySelector("button");
      const badgeNodes = [...row.querySelectorAll(".admin-occasion-badge")];
      const rect = (node) => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        viewportWidth: window.innerWidth,
        host: rect(host),
        row: rect(row),
        thumb: rect(thumb),
        edit: rect(edit),
        badges: badgeNodes.map(rect),
        hostScrollWidth: host.scrollWidth
      };
    });

    expect(geometry.row.width).toBeGreaterThan(0);
    expect(geometry.row.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.row.right).toBeLessThanOrEqual(width + 1);
    expect(geometry.thumb.width).toBeGreaterThan(0);
    expect(geometry.edit.width).toBeGreaterThan(0);
    expect(geometry.edit.left).toBeGreaterThanOrEqual(geometry.thumb.right);
    for (const badge of geometry.badges) {
      expect(badge.width).toBeGreaterThan(0);
      expect(badge.left).toBeGreaterThanOrEqual(-1);
      expect(badge.right).toBeLessThanOrEqual(width + 1);
    }
    expect(geometry.hostScrollWidth).toBeLessThanOrEqual(width + 1);
  });
}
