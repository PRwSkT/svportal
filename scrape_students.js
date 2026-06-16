const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function run() {
  console.log("=========================================================");
  console.log("🚀 บอทดึงข้อมูลนักเรียน (รองรับการดึงทุกห้องอัตโนมัติ)");
  console.log("=========================================================");
  console.log("1. กรุณาล็อกอินในหน้าต่างเบราว์เซอร์ที่เปิดขึ้นมา");
  console.log("2. คลิกเข้าไปที่เมนู 'หน้ารายการห้องเรียน' (ที่เห็นตารางห้อง อ.1/1, อ.1/2 ฯลฯ)");
  console.log("3. เมื่อเห็นตารางรายชื่อห้อง ให้กลับมาที่นี่แล้วกด Enter");
  console.log("=========================================================");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://regis2.opec.go.th/web/Login.htm');

  await new Promise(resolve => rl.question("กด Enter เพื่อเริ่มดูดข้อมูล...", resolve));

  console.log("กำลังวิเคราะห์รายชื่อห้องเรียน...");

  const allPages = context.pages();
  const targetPage = allPages.find(p => p.url().includes('SchoolClassRoom'));

  if (!targetPage) {
      console.log("❌ ไม่พบหน้ารายชื่อห้องเรียน (SchoolClassRoom.htm)");
      rl.close();
      await browser.close();
      return;
  }

  // ดึงรายชื่อห้องทั้งหมดในตารางปัจจุบัน
  const classList = await targetPage.$$eval('table tr', rows => {
      let data = [];
      rows.forEach(r => {
          const btn = r.querySelector('button[onclick^="javascript:submitFormStudentInClassRoom"]');
          if (btn) {
             const className = r.querySelector('td:nth-child(2)') ? r.querySelector('td:nth-child(2)').innerText.trim() : 'Unknown';
             data.push({
                 className: className,
                 onclick: btn.getAttribute('onclick')
             });
          }
      });
      return data;
  });

  if (classList.length === 0) {
      console.log("❌ ไม่พบปุ่ม 'แสดงนักเรียน' ในหน้านี้ โปรดแน่ใจว่าคุณอยู่หน้าตารางห้องเรียน");
      rl.close();
      await browser.close();
      return;
  }

  console.log(`✅ พบห้องเรียนทั้งหมด ${classList.length} ห้อง ในหน้านี้`);

  // โหลดข้อมูลเก่าถ้ามี (เพื่อทำ Append)
  let studentsData = [];
  if (fs.existsSync('students_data.json')) {
      try {
          studentsData = JSON.parse(fs.readFileSync('students_data.json', 'utf8'));
          console.log(`โหลดข้อมูลเดิมมาทำต่อ (มีอยู่แล้ว ${studentsData.length} คน)`);
      } catch (e) {}
  }

  // ลูปเข้าทีละห้อง
  for (let c = 0; c < classList.length; c++) {
      const cls = classList[c];
      console.log(`\n▶️ [${c+1}/${classList.length}] กำลังเข้าสู่ห้องเรียน: ${cls.className}`);
      
      // คลิกเข้าห้องเรียนด้วยการรันคำสั่ง JS ตามปุ่ม
      const navPromise = targetPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
      await targetPage.evaluate((onclickScript) => {
          eval(onclickScript.replace('javascript:', ''));
      }, cls.onclick);
      await navPromise;

      // รอจนกว่าลิงก์ชื่อนักเรียนจะขึ้น
      await targetPage.waitForSelector('a[title="ข้อมูลนักเรียน"]', { timeout: 10000 }).catch(()=>{});

      const studentLinks = await targetPage.$$eval('a[title="ข้อมูลนักเรียน"]', links => {
          return links.map(a => ({ text: a.innerText.trim() }));
      });

      console.log(`   พบนกเรียน ${studentLinks.length} คนในห้องนี้`);

      for (let i = 0; i < studentLinks.length; i++) {
        const student = studentLinks[i];
        process.stdout.write(`   กำลังดึงข้อมูล ${i + 1}/${studentLinks.length} (รหัส: ${student.text})`);
        
        try {
          await targetPage.locator(`a[title="ข้อมูลนักเรียน"]:has-text("${student.text}")`).first().click();
          
          const detailBtn = targetPage.locator('a:has-text("รายละเอียดนักเรียนเพิ่มเติม"), button:has-text("รายละเอียดนักเรียนเพิ่มเติม")').first();
          await detailBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          const pagePromise = context.waitForEvent('page').catch(() => null);
          const detailNavPromise = targetPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => null);
          
          await detailBtn.evaluate(el => el.click());
          
          let newPage;
          const maybeNewPage = await Promise.race([
              pagePromise,
              new Promise((resolve) => setTimeout(() => resolve(null), 3000))
          ]);

          if (maybeNewPage) {
              newPage = maybeNewPage;
              await newPage.waitForLoadState('networkidle');
          } else {
              newPage = targetPage;
              await detailNavPromise;
              await newPage.waitForLoadState('networkidle').catch(()=>{});
          }

          await newPage.waitForSelector('text=ข้อมูล', { timeout: 10000 }).catch(()=>{});

          // 3. ดึงข้อมูลประวัติแบบจัดเต็ม (รวมทุก Tab ที่ซ่อนอยู่)
          const profileData = await newPage.evaluate(() => {
              let data = {};
              
              // ฟังก์ชันจัดการข้อความให้สะอาด (ลบช่องว่างส่วนเกินและขึ้นบรรทัดใหม่)
              const clean = (el) => el ? el.textContent.replace(/\\s+/g, ' ').trim() : '';
              
              // หากมีการแบ่งเป็น Panel (เช่น ข้อมูลที่อยู่, ข้อมูลครอบครัว ฯลฯ)
              const panels = document.querySelectorAll('.panel');
              if (panels.length > 0) {
                  panels.forEach(panel => {
                      const titleEl = panel.querySelector('.panel-title, .heading') || panel.querySelector('h3');
                      const sectionTitle = titleEl ? titleEl.textContent.trim() : '';
                      // ใส่ชื่อหมวดหมู่ไว้ข้างหน้า เพื่อกันชื่อฟิลด์ซ้ำกัน (เช่น [ข้อมูลครอบครัว] ชื่อ)
                      const prefix = sectionTitle ? `[${sectionTitle}] ` : '';

                      const rows = panel.querySelectorAll('table tr');
                      rows.forEach(tr => {
                          const tds = tr.querySelectorAll('td, th');
                          
                          if (tds.length >= 2 && tds.length < 4) {
                              const key = clean(tds[0]);
                              const val = clean(tds[1]);
                              if (key && key !== '') data[prefix + key] = val;
                          } else if (tds.length >= 4) {
                              const key1 = clean(tds[0]);
                              const val1 = clean(tds[1]);
                              const key2 = clean(tds[2]);
                              const val2 = clean(tds[3]);
                              if (key1 && key1 !== '') data[prefix + key1] = val1;
                              if (key2 && key2 !== '') data[prefix + key2] = val2;
                          }
                      });

                      // ดึงข้อมูลฟอร์มเผื่อมี (label -> input/span)
                      const labels = panel.querySelectorAll('label');
                      labels.forEach(label => {
                          const key = label.textContent.replace(/\\s+/g, ' ').replace(/:/g, '').trim();
                          let nextEl = label.nextElementSibling || (label.parentElement ? label.parentElement.nextElementSibling : null);
                          if (nextEl) {
                              const input = nextEl.querySelector('input') || (nextEl.tagName.toLowerCase() === 'input' ? nextEl : null);
                              const val = input ? input.value : nextEl.textContent.replace(/\\s+/g, ' ').trim();
                              if (key && key !== '') data[prefix + key] = val;
                          }
                      });
                  });
              } else {
                  // สำรองกรณีไม่มี Panel: ลุยดึงจากตารางตรงๆ ทั่วทั้งหน้า
                  const rows = document.querySelectorAll('table tr');
                  rows.forEach(tr => {
                      const tds = tr.querySelectorAll('td, th');
                      if (tds.length >= 2 && tds.length < 4) {
                          const key = clean(tds[0]);
                          const val = clean(tds[1]);
                          if (key && key !== '') data[key] = val;
                      } else if (tds.length >= 4) {
                          const key1 = clean(tds[0]);
                          const val1 = clean(tds[1]);
                          const key2 = clean(tds[2]);
                          const val2 = clean(tds[3]);
                          if (key1 && key1 !== '') data[key1] = val1;
                          if (key2 && key2 !== '') data[key2] = val2;
                      }
                  });
              }

              return data;
          });

          profileData['รหัสอ้างอิง'] = student.text;
          profileData['ห้องเรียนอ้างอิง'] = cls.className;
          studentsData.push(profileData);

          console.log(` - สำเร็จ!`);

          if (newPage !== targetPage) {
              await newPage.close(); 
          } else {
              try {
                 await targetPage.goBack({ timeout: 10000 });
              } catch(e) {
                 await targetPage.evaluate(() => window.history.back());
              }
              await targetPage.waitForSelector(`a[title="ข้อมูลนักเรียน"]:has-text("${student.text}")`, { state: 'visible', timeout: 10000 }).catch(()=>{}); 
          }

        } catch (err) {
          console.log(` - ❌ ผิดพลาด: ${err.message}`);
          try {
            const closeBtn = targetPage.getByText('ปิดหน้าจอ').first();
            if (await closeBtn.isVisible()) await closeBtn.click();
          } catch(e) {}
        }
        
        fs.writeFileSync('students_data.json', JSON.stringify(studentsData, null, 2), 'utf-8');
      }

      // ย้อนกลับไปหน้ารายชื่อห้องเรียน
      console.log(`   ย้อนกลับไปหน้ารายชื่อห้องเรียน...`);
      try {
          const backBtn = targetPage.locator('button:has-text("ย้อนกลับ"), a:has-text("ย้อนกลับ")').first();
          if (await backBtn.count() > 0) {
              const backNavPromise = targetPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => null);
              await backBtn.click();
              await backNavPromise;
          } else {
              await targetPage.evaluate(() => window.history.back());
              await targetPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => null);
          }
      } catch (e) {
          console.log(`   (เกิดปัญหาตอนกดย้อนกลับ อาจต้องเช็คหน้าจอ)`);
      }
  }

  console.log("=========================================================");
  console.log("🎉 บันทึกข้อมูลของทุกห้องในหน้านี้เสร็จสิ้น!");
  console.log("=========================================================");
  
  rl.close();
  await browser.close();
}

run().catch(console.error);
