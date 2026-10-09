import {test,expect} from '@playwright/test';
const cases=['start','player-speech','counter','signature','requirement','irrevocable-cost','partial','success','failure','missing','reduced','contrast','long-text'];
for(const state of cases)test('fixed scene '+state,async({page})=>{
  await page.goto('/verification/debate/'+state+'.html');
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).filter(i=>!i.hidden&&i.getAttribute('src')).map(i=>i.decode().catch(()=>{})));});
  await expect(page.locator('.debate-scene')).toHaveScreenshot(state+'.png',{animations:'disabled'});
});
test('live UI: preview cancellation and HUD/card overlap',async({page},testInfo)=>{
  await page.goto('/');await page.locator('[data-a="to-lords"]').click();await page.locator('[data-a="debate-scene-demo"][data-id="guojia"]').click();await page.locator('[data-a="move"][data-col="0"]').click();await page.locator('#social-general').selectOption('guojia');await page.locator('[data-kind="begin-debate"][data-choice="sponsorship"]').click();
  await page.locator('[data-debate-select="pledge"]').click();await expect(page.locator('[data-argument-detail]')).toBeVisible();await expect(page.locator('[data-argument-detail]')).toContainText('환급하지');await page.locator('[data-close-argument]').click();await expect(page.locator('[data-argument-detail]')).toBeHidden();
  const portrait=await page.locator('.player .portrait-frame').boundingBox(),hud=await page.locator('.cinematic-hud').boundingBox();expect(portrait.y).toBeGreaterThanOrEqual(hud.y+hud.height);
  if(testInfo.project.name==='desktop'||testInfo.project.name==='laptop')expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2)).toBe(true);
  await page.locator('[data-debate-select="evidence"]').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-debate-select="rebuttal"]')).toBeFocused();
});
