import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true}); const page=await browser.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message)); page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
await page.goto('http://127.0.0.1:4181/video-tools.html',{waitUntil:'networkidle'});
await page.locator('#video-tab-join').click();
for (const [name,file] of [['a','quickkit-test-cf6045.webm'],['b','quickkit-test-3973b9.webm']]) console.log(name,(await readFile(`qa-results/video-fixtures/${file}`)).length);
await page.locator('#video-files').setInputFiles(['qa-results/video-fixtures/quickkit-test-cf6045.webm','qa-results/video-fixtures/quickkit-test-3973b9.webm']);
await page.waitForFunction(()=>document.querySelectorAll('#video-segments>li').length===2,{timeout:20000});
console.log('JOINBTN', await page.locator('#video-run-join').isDisabled(), await page.locator('#video-segments > li').count(), await page.locator('#video-status').innerText()); await page.locator('#video-run-join').click();
for(let i=0;i<18;i++){await page.waitForTimeout(2000); console.log('STATE',i,await page.locator('#video-status').innerText(),await page.locator('#video-progress-label').innerText().catch(()=>''),await page.locator('#video-result').isVisible()); if(await page.locator('#video-result').isVisible())break;}
await browser.close();
