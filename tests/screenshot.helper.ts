// Shared helper: capture a full-page screenshot into media/ for vision review.
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const mediaDir = resolve(here, '..', 'media');

export async function snap(page: Page, name: string): Promise<string> {
  mkdirSync(mediaDir, { recursive: true });
  const path = resolve(mediaDir, `${name}.png`);
  await page.screenshot({ path });
  return path;
}
