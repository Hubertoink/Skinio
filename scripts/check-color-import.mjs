import {_electron as electron,expect} from '@playwright/test';
import path from 'node:path';
const env={...process.env,SKIN_FORGE_TEST_DATA:path.resolve(`artifacts/color-import-${Date.now()}`)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
try {
 const page=await app.firstWindow();
 await expect(page.getByLabel('Projektname')).toBeVisible();
 await page.locator('input[accept=".png,.skinforge,.json"]').setInputFiles(path.resolve('Results/Niko_outfit_1788785063552/Niko-hybrid.skinforge'));
 await expect(page.getByRole('status')).toContainText('Importiert');
 await page.waitForTimeout(600);
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('skin-forge-project-v1')));
 const before=await stored();
 await page.getByRole('button',{name:'Farbe #ff0000',exact:true}).click();
 await page.waitForTimeout(600);
 const after=await stored();
 expect(after.palette).toContain('#ff0000');expect(after.palette.length).toBeLessThanOrEqual(256);expect(after.pixels).toEqual(before.pixels);
 await page.getByLabel('Kameraansicht').selectOption('1');
 await page.getByRole('button',{name:'Pixelraster',exact:true}).click();
 await page.screenshot({path:path.resolve('artifacts/skin-forge-0.5.0.png')});
 console.log('Color import passed: permanent red bank after photo-palette import; adds red within limit without recoloring pixels.');
} finally {await app.close();}
