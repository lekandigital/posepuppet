import { test } from '@playwright/test';

const OUT = '/private/tmp/claude-501/-Users-lekan-Dev-posepuppet-shared-world/6bf51b30-f766-4463-b50c-52271817814f/scratchpad';

test('ecco grade evidence shots', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/shared-world/?view=region&hud=0');
  await page.waitForFunction(
    () => {
      const h = (window as any).__SHARED_WORLD;
      return !!h && !!h.ocean && h.state().inWater === true;
    },
    undefined,
    { timeout: 40_000 },
  );
  await page.addStyleTag({ content: '#region-overlay { display: none !important; }' });
  const hook = (expr: string) => page.evaluate(`(window).__SHARED_WORLD.test.${expr}`);
  await hook('teleport(600, 600, -3)');
  await hook('setIntent({ brake: true })');
  await hook('setTimeOfDay({ phase: 0.41, frozen: true })'); // noon
  await hook('setOcean({ frozen: true, timeS: 137.25 })');

  const shot = async (name: string, expr: string, wait = 1600) => {
    await hook(expr);
    await page.waitForTimeout(wait);
    await page.locator('#app canvas').screenshot({ path: `${OUT}/${name}.png` }); // warm-up
    await page.waitForTimeout(300);
    await page.locator('#app canvas').screenshot({ path: `${OUT}/${name}.png` });
  };

  // (a) above water: sea + cliffs + cumulus sky (vs D08_R0006 / D10_R0022)
  await shot('ecco-a-above', `shotMode({ pos: [-450, 6, -380], look: [-620, 30, -300], fov: 60, size: [1600, 900] })`);
  // (b) underwater over the shelf: sandy near-field → teal fog (vs frame 1 / D12 set)
  await shot('ecco-b-under-shelf', `shotMode({ pos: [-180, ${-4}, 260], look: [-180, -12, 340], fov: 62, size: [1600, 900] })`);
  // (c) underwater oblique up: surface underside + caustic ceiling (vs D10_R0131)
  await shot('ecco-c-under-up', `shotMode({ pos: [-260, -8, -380], look: [-180, 2, -380], fov: 62, size: [1600, 900] })`);
  // (d) sunset above water (warm sky check)
  await hook('setTimeOfDay({ phase: 0.805, frozen: true })');
  await shot('ecco-d-sunset', `shotMode({ pos: [-450, 6, -380], look: [-620, 30, -300], fov: 60, size: [1600, 900] })`);
});
