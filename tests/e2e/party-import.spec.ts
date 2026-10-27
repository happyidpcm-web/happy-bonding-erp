import { expect, test } from "@playwright/test";

test("saved upload remains visible in import history after reloading", async ({ page }) => {
  const parties: any[] = [];
  const history: any[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("hb_erp_token", "browser-test-only");
    localStorage.setItem("hb_erp_branch", "test-branch");
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === "/api/auth/me") json = { id: "tester", name: "Tester", isAdmin: true, branchIds: ["test-branch"] };
    if (path === "/api/branches") json = [{ id: "test-branch", name: "Test Branch", code: "TEST" }];
    if (path === "/api/party-imports") json = history;
    if (path === "/api/parties/remove-selected") {
      const { ids } = route.request().postDataJSON();
      expect(ids).toEqual(["party-0"]);
      parties.splice(0, parties.length);
      json = { deletedIds: ids, protectedCount: 0 };
    }
    if (path === "/api/parties") {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        expect(payload.importFileName).toBe("contacts.json");
        expect(payload.importId).toBeTruthy();
        const party = { ...payload, id: `party-${parties.length}`, openingBalance: "0" };
        parties.push(party);
        let batch = history.find(item => item.id === payload.importId);
        if (!batch) { batch = { id: payload.importId, fileName: payload.importFileName, createdAt: new Date().toISOString(), partyIds: [] }; history.push(batch); }
        batch.partyIds.push(party.id);
        json = party;
      } else json = parties;
    }
    await route.fulfill({ json });
  });
  const openBulk = async () => {
    await page.getByRole("button", { name: "Parties", exact: true }).click();
    await page.getByRole("button", { name: "Bulk Action", exact: true }).click();
    await page.getByRole("button", { name: /Bulk Add Parties/ }).click();
  };
  await page.goto("/");
  await openBulk();
  await page.locator('input[type="file"]').setInputFiles({ name: "contacts.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ data: { parties: [{ name: "Import Test", phone: "9000000001" }] } })) });
  await expect(page.getByText("Selected file:")).toBeVisible();
  await page.getByRole("button", { name: "Save Parties", exact: true }).click();
  await expect(page.getByRole("heading", { name: "contacts.json — Saved Contacts (1)" })).toBeVisible();
  await expect(page.locator(".bulk-add-parties-fullscreen").getByRole("cell", { name: "Import Test", exact: true }).last()).toBeVisible();
  await page.reload();
  await openBulk();
  await page.getByRole("button", { name: /contacts.json — 1 added/ }).click();
  await expect(page.locator(".bulk-add-parties-fullscreen").getByRole("cell", { name: "Import Test", exact: true }).last()).toBeVisible();
  expect(parties).toHaveLength(1);
  await page.getByRole("button", { name: "Delete imported contacts", exact: true }).click();
  expect(parties).toHaveLength(1);
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 contacts removed");
  expect(parties).toHaveLength(0);
});
