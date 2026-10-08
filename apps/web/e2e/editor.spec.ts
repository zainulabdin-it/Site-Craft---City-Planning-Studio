import { test, expect } from "@playwright/test";
test("real Cesium editor: draw, connect, edit, persist, reload and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const start = Date.now();
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByLabel("Project name").fill("Acceptance site");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.waitForTimeout(1400);
  const box = (await page.locator("canvas").boundingBox())!;
  const click = async (x: number, y: number) =>
    page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await page.getByRole("button", { name: "Boundary", exact: true }).click();
  for (const p of [
    [0.16, 0.3],
    [0.84, 0.3],
    [0.84, 0.78],
    [0.16, 0.78],
  ])
    await click(...(p as [number, number]));
  await page.getByRole("button", { name: "Finish drawing" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .locator(".toolbar")
    .getByRole("button", { name: "Road", exact: true })
    .click();
  await click(0.27, 0.53);
  await click(0.73, 0.53);
  await page.getByRole("button", { name: "Finish drawing" }).click();
  await page
    .locator(".toolbar")
    .getByRole("button", { name: "Road", exact: true })
    .click();
  await click(0.5, 0.7);
  await click(0.5, 0.53);
  await page.getByRole("button", { name: "Finish drawing" }).click();
  await page.getByLabel("Road width (m)").fill("14");
  await page.getByLabel("Road width (m)").press("Enter");
  await page.getByRole("button", { name: "Building", exact: true }).click();
  await click(0.38, 0.42);
  await page.getByLabel("Floors", { exact: true }).fill("4");
  await page.getByLabel("Floors", { exact: true }).press("Enter");
  await expect(page.getByText("12.0 m", { exact: true })).toBeVisible();
  await page.getByRole('combobox', {name:'Roof',exact:true}).selectOption('pitched');
  await page.getByRole('button', {name:'Undo',exact:true}).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Floors", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Floors", { exact: true })).toHaveValue("4");
  for (const [name, x, y] of [
    ["Tree", 0.6, 0.42],
    ["Car", 0.65, 0.53],
    ["Bridge", 0.65, 0.66],
  ] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    await click(x, y);
  }
  await page.getByLabel("Rotation (°)").fill("30");
  await page.getByLabel("Rotation (°)").press("Enter");
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await click(0.63, 0.66);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.locator(".save-state")).toContainText("Saved");
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sitecraft.projects.v1")!).find(
      (p: any) => p.id === localStorage.getItem("sitecraft.active"),
    ),
  );
  expect(before.objects).toHaveLength(7);
  const roads = before.objects.filter((o: any) => o.kind === "road");
  expect(
    roads[0].nodeIds.some((n: string) => roads[1].nodeIds.includes(n)),
  ).toBeTruthy();
  expect(roads[1].width).toBe(14);
  expect(before.objects.find((o: any) => o.kind === "building").floors).toBe(4);
  await page.reload();
  await expect(page.locator(".project-title")).toContainText("Acceptance site");
  await expect(page.locator(".object-list .object")).toHaveCount(7);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Project JSON", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toContain(".json");
  await page.getByLabel("Save destination").selectOption("server");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.locator(".save-state")).toContainText("Saved");
  const response = await page.request.get(`/api/projects/${before.id}`);
  expect(response.ok()).toBeTruthy();
  const persisted = await response.json();
  expect(persisted.objects).toEqual(before.objects);
  expect(persisted.revision).toBe(1);
  await page.screenshot({ path: "../../docs/editor-acceptance.png" });
  await page.getByRole('button',{name:'3D',exact:true}).click();
  await page.waitForTimeout(1200);
  await page.screenshot({path:'../../docs/editor-3d.png'});
  expect(errors).toEqual([]);
  console.log(
    `Acceptance workflow duration: ${Date.now() - start} ms; browser ${page.context().browser()?.version()}; ${persisted.objects.length} objects`,
  );
});
test("invalid dimensions and network failures are visible", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "East–west avenue" }).click();
  await page.getByLabel("Road width (m)").fill("-4");
  await page.getByLabel("Road width (m)").press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Road width (m)")).toHaveValue("8");
  await page.route("**/api/projects/**", (r) => r.abort());
  await page.getByLabel("Save destination").selectOption("server");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.locator(".save-state")).toContainText("Save failed");
});
