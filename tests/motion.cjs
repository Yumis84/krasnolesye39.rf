const {chromium}=require('playwright');
const assert=require('assert/strict');

(async()=>{
 const browser=await chromium.launch({...(process.env.QA_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true});
 const base=process.env.QA_BASE_URL||'http://127.0.0.1:8765/';
 for(const reducedMotion of ['reduce','no-preference']){
  const page=await browser.newPage({reducedMotion,viewport:{width:390,height:844}});
  await page.goto(base);
  await page.locator('.skip').click();
  await page.locator('#motion').click();
  if(reducedMotion==='reduce') assert((await page.evaluate(()=>document.getAnimations().length))>0);
  const first=await page.locator('.forest').evaluate(element=>getComputedStyle(element).transform);
  await page.waitForTimeout(1000);
  assert.notEqual(await page.locator('.forest').evaluate(element=>getComputedStyle(element).transform),first);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const initialUrl=page.url();
  await page.waitForTimeout(9300);
  assert.equal(page.url(),initialUrl);
  assert.equal(await page.locator('.destinations').isVisible(),true);
  await page.close();
 }
 await browser.close();
 console.log('Motion replay ends at the destination choice without navigation.');
})().catch(error=>{console.error(error);process.exit(1)});
