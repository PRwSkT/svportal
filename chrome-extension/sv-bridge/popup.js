document.addEventListener('DOMContentLoaded', async () => {
  const pageStatusEl = document.getElementById('pageStatus');
  const csvFileInput = document.getElementById('csvFileInput');
  const fileInfoEl = document.getElementById('fileInfo');
  const injectBtn = document.getElementById('injectBtn');
  const logBox = document.getElementById('logBox');

  let parsedData = [];

  function log(msg) {
    logBox.style.display = 'block';
    logBox.innerHTML += `<div>> ${msg}</div>`;
    logBox.scrollTop = logBox.scrollHeight;
  }

  // Check active tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isOpec = tab?.url && (tab.url.includes('opec.go.th') || tab.url.includes('localhost'));

  if (isOpec) {
    pageStatusEl.textContent = 'พร้อมเชื่อมต่อ REGIS';
    pageStatusEl.style.background = '#ecfdf5';
    pageStatusEl.style.color = '#059669';
  } else {
    pageStatusEl.textContent = 'ไม่ใช่เว็บ สช.';
    pageStatusEl.style.background = '#fef2f2';
    pageStatusEl.style.color = '#dc2626';
  }

  // Handle CSV file selection
  csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileInfoEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target.result;
      if (file.name.endsWith('.json')) {
        try {
          parsedData = JSON.parse(text);
          injectBtn.disabled = false;
          log(`อ่านข้อมูล JSON สำเร็จ ${parsedData.length} แถว`);
        } catch (err) {
          log('ไฟล์ JSON ไม่ถูกต้อง');
        }
      } else {
        // Parse CSV
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length <= 1) {
          log('ไม่พบแถวข้อมูลใน CSV');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 7) {
            rows.push({
              room: cols[0],
              courseCode: cols[1],
              courseName: cols[2],
              citizenId: cols[3],
              studentName: cols[4],
              totalScore: cols[5],
              grade: cols[6],
              teacherName: cols[7] || ''
            });
          }
        }

        parsedData = rows;
        injectBtn.disabled = false;
        log(`โหลดข้อมูลจาก CSV สำเร็จ ${parsedData.length} รายการ`);
      }
    };

    reader.readAsText(file);
  });

  // Inject into REGIS page via Scripting API
  injectBtn.addEventListener('click', async () => {
    if (parsedData.length === 0) return;

    log('กำลังส่งข้อมูลไปยังหน้าเว็บ สช...');
    injectBtn.disabled = true;

    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'INJECT_GRADES',
        data: parsedData
      }, (response) => {
        if (chrome.runtime.lastError) {
          log(`เกิดข้อผิดพลาด: ${chrome.runtime.lastError.message}`);
          injectBtn.disabled = false;
          return;
        }

        if (response && response.success) {
          log(`🎉 สำเร็จ! ฉีดคะแนนเข้าตารางแล้ว ${response.matchedCount} คน`);
        } else {
          log(`แจ้งเตือน: ${response?.message || 'ไม่สามารถฉีดข้อมูลได้'}`);
        }
        injectBtn.disabled = false;
      });
    } catch (err) {
      log(`Error: ${err.message}`);
      injectBtn.disabled = false;
    }
  });
});
