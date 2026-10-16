const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('assert/strict');

(async()=>{
 const browser=await chromium.launch({...(process.env.QA_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true});
 fs.mkdirSync('outputs',{recursive:true});
 const results=[];
 const base=process.env.QA_BASE_URL||'http://127.0.0.1:8765/';

 for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['small',{width:320,height:568}],['landscape',{width:844,height:390}]]){
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.locator('#open').click();
  await page.locator('#pause').click();
  for(const [scene,time] of [['forest',1100],['title',3300],['museum',7800]]){
   await page.evaluate(value=>document.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=value}),time);
   await page.screenshot({path:`outputs/${name}-${scene}.png`});
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,skip:document.querySelector('.skip').getBoundingClientRect().toJSON()}));
   assert(layout.scroll<=layout.width);
   assert(layout.skip.x>=0&&layout.skip.right<=layout.width);
  }
  await page.locator('.skip').click();
  await page.screenshot({path:`outputs/${name}-choices.png`});
  assert.equal(await page.locator('.destinations').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(errors.length,0);
  results.push({test:name+' scenes, choices, overflow and JS errors',passed:true});
  await page.close();
 }

 const timed=await browser.newPage();
 await timed.goto(base);
 await timed.locator('#open').click();
 const initialUrl=timed.url();
 await timed.waitForTimeout(10300);
 assert.equal(timed.url(),initialUrl);
 assert.equal(await timed.locator('.destinations').isVisible(),true);
 assert.equal(await timed.locator('.destination-link').first().evaluate(element=>element===document.activeElement),true);
 results.push({test:'ten-second ending reveals focused choices without navigation',passed:true});
 await timed.close();

 const immediate=await browser.newPage();
 await immediate.goto(base);
 await immediate.locator('.skip').click();
 const links=await immediate.locator('.destination-link').evaluateAll(elements=>elements.map(element=>({text:element.textContent.trim(),href:element.href})));
 assert.deepEqual(links,[
  {text:'Открыть Виштынецкий сайт',href:'https://vishtynets.ru/'},
  {text:'Гостевой дом',href:'https://yumis84.github.io/guest-house-map/'}
 ]);
 assert.equal(await immediate.locator('.destination-link').first().evaluate(element=>element===document.activeElement),true);
 await immediate.keyboard.press('Tab');
 assert.equal(await immediate.locator('.destination-link').nth(1).evaluate(element=>element===document.activeElement),true);
 results.push({test:'immediate choice and keyboard-accessible destination links',passed:true});
 await immediate.close();

 const controls=await browser.newPage();
 await controls.goto(base);
 await controls.locator('#open').click();
 await controls.locator('#pause').click();
 await controls.waitForTimeout(300);
 assert.match(await controls.locator('#status').textContent(),/приостановлена/i);
 await controls.locator('#pause').click();
 await controls.locator('.skip').click();
 await controls.locator('#motion').click();
 assert.equal(await controls.locator('.destinations').isVisible(),false);
 assert.equal(await controls.locator('#pause').isVisible(),true);
 results.push({test:'pause, resume and replay remain available',passed:true});
 await controls.close();

 const reduced=await browser.newPage({reducedMotion:'reduce'});
 await reduced.goto(base);
 await reduced.locator('#open').click();
 assert.equal(await reduced.evaluate(()=>document.getAnimations().length),0);
 assert.equal(await reduced.locator('.museum').evaluate(element=>getComputedStyle(element).opacity),'1');
 await reduced.locator('.skip').click();
 await reduced.screenshot({path:'outputs/reduced-motion.png'});
 results.push({test:'reduced motion stays static and offers choices',passed:true});
 await reduced.close();

 const noJs=await browser.newPage({javaScriptEnabled:false});
 await noJs.goto(base);
 assert.equal(await noJs.locator('.destinations').isVisible(),true);
 assert.equal(await noJs.locator('.destination-link').count(),2);
 await noJs.waitForTimeout(1000);
 assert.equal(noJs.url().startsWith(base),true);
 results.push({test:'JavaScript-disabled fallback exposes both links without redirect',passed:true});
 await noJs.close();

 const source=fs.readFileSync('index.html','utf8');
 assert.equal(/location\.(replace|assign)|http-equiv=["']refresh/i.test(source),false);
 results.push({test:'static check finds no scripted or meta automatic navigation',passed:true});

 fs.writeFileSync('outputs/qa-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
