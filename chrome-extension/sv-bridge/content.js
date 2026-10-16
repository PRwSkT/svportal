// SV-Bridge Content Script for sso.opec.go.th/regis

console.log('🚀 SV-Bridge Content Script Active on OPEC Portal');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'INJECT_GRADES') {
    const data = request.data || [];
    let matchedCount = 0;

    console.log('Received grade injection payload:', data.length, 'records');

    // Create Map by citizenId and studentName
    const citizenMap = new Map();
    const nameMap = new Map();

    data.forEach(item => {
      if (item.citizenId) citizenMap.set(item.citizenId.replace(/\D/g, ''), item);
      if (item.studentName) nameMap.set(item.studentName.trim(), item);
    });

    // Scan table rows in REGIS
    const tableRows = document.querySelectorAll('table tbody tr');

    tableRows.forEach(row => {
      const rowText = row.innerText.replace(/\s+/g, ' ');
      let matchedRecord = null;

      // Try citizen ID match
      for (const [cid, rec] of citizenMap.entries()) {
        if (rowText.includes(cid)) {
          matchedRecord = rec;
          break;
        }
      }

      // Try name match if not found by citizen ID
      if (!matchedRecord) {
        for (const [name, rec] of nameMap.entries()) {
          if (rowText.includes(name)) {
            matchedRecord = rec;
            break;
          }
        }
      }

      if (matchedRecord) {
        // Find score / grade inputs in this row
        const inputs = row.querySelectorAll('input[type="text"], input[type="number"], select');

        inputs.forEach(input => {
          const inputName = (input.name || input.id || input.className || '').toLowerCase();
          
          if (inputName.includes('score') || inputName.includes('point') || inputName.includes('คะแนน') || input.dataset?.type === 'score') {
            input.value = matchedRecord.totalScore;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (inputName.includes('grade') || inputName.includes('เกรด') || input.dataset?.type === 'grade') {
            input.value = matchedRecord.grade;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });

        // Highlight visually
        row.style.transition = 'background-color 0.4s';
        row.style.backgroundColor = '#ecfdf5'; // Soft emerald
        matchedCount++;
      }
    });

    sendResponse({
      success: true,
      matchedCount,
      totalPayload: data.length,
      message: `จับคู่นักเรียนและฉีดคะแนนสำเร็จ ${matchedCount}/${data.length} รายการ`
    });
  }
  return true;
});
