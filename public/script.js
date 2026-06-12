// ==========================================
// CONFIG & STATE
// ==========================================
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwtl4265ih1xovbR2aR_juLopUa3Iz9rhJKWYnCUwcUOf8cRMBbs3wt6AVW4TJXqy6y0g/exec";

let currentAIResult = null;
let uploadedFiles = [];
let excludedIndices = new Set();
let templateFBCover = null, templateIGCover = null, templateFBSub = null, templateIGSub = null;
let hasFiles = false;
let currentLang = 'th';
let currentCaptionFB = "";
let currentCaptionIG = "";

// Initialize Web Worker
const imageWorker = new Worker('imageWorker.js');
let workerCallbacks = {};
let msgIdCounter = 0;

imageWorker.onmessage = function(e) {
    if (e.data.action === 'progress') {
        const statusText = document.getElementById('ai-status');
        if (e.data.text) {
            statusText.innerText = e.data.text;
        } else if (e.data.progress) {
            statusText.innerText = `เตรียมภาพ... ${e.data.progress}%`;
        }
        return;
    }

    const { id, status, data, error } = e.data;
    if (workerCallbacks[id]) {
        if (status === 'success') {
            workerCallbacks[id].resolve(data);
        } else {
            workerCallbacks[id].reject(new Error(error));
        }
        delete workerCallbacks[id];
    }
};

function runWorkerTask(action, payload) {
    return new Promise((resolve, reject) => {
        const id = ++msgIdCounter;
        workerCallbacks[id] = { resolve, reject };
        imageWorker.postMessage({ id, action, payload });
    });
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon} toast-icon"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ==========================================
// FORM LOGIC
// ==========================================
function toggleTag(btn) {
    btn.classList.toggle('selected');
}
function selectTone(btn) {
    document.querySelectorAll('#tone-group .tag-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}
function getSelectedTags() {
    return [...document.querySelectorAll('#tag-group .tag-btn.selected')].map(b => b.dataset.val).join(', ') || 'ทั่วไป';
}
function getSelectedTone() {
    const t = document.querySelector('#tone-group .tag-btn.selected');
    return t ? t.dataset.val : 'อบอุ่น ภาคภูมิใจ';
}
function updateCharCount(el, counterId, max) {
    const n = el.value.length;
    document.getElementById(counterId).innerText = `${n} / ${max}`;
    if (n > max) el.value = el.value.substring(0, max);
}
function checkFormReady() {
    const name = document.getElementById('f-activity-name').value.trim();
    const date = document.getElementById('f-date').value;
    const ready = name && date && hasFiles;
    
    const btn = document.getElementById('btn-process');
    const lbl = document.getElementById('btn-label');
    btn.disabled = !ready;
    const t = I18N[currentLang];
    lbl.textContent = ready
        ? `${t.btn_process_ready} (${uploadedFiles.length} ${t.photos_unit})`
        : t.btn_process_idle;
}
function buildActivityContext() {
    const name     = document.getElementById('f-activity-name').value.trim();
    const date     = document.getElementById('f-date').value;
    const grade    = document.getElementById('f-grade').value.trim();
    const types    = getSelectedTags();
    const detail   = document.getElementById('f-detail').value.trim();
    const obj      = document.getElementById('f-objective').value.trim();
    const hashtag  = document.getElementById('f-hashtag').value.trim();
    const tone     = getSelectedTone();

    let dateStr = date;
    try {
        const d = new Date(date);
        dateStr = d.toLocaleDateString('th-TH', {day:'numeric', month:'long', year:'numeric'});
    } catch(e) {}

    let ctx = `ชื่อกิจกรรม: ${name}\nวันที่: ${dateStr}\nประเภท: ${types}`;
    if (grade)   ctx += `\nกลุ่มนักเรียน: ${grade}`;
    if (detail)  ctx += `\nรายละเอียด: ${detail}`;
    if (obj)     ctx += `\nวัตถุประสงค์: ${obj}`;
    if (hashtag) ctx += `\nHashtag ที่ต้องการ: ${hashtag}`;
    ctx += `\nโทนของแคปชั่น: ${tone}`;
    return ctx;
}

// ==========================================
// FILE UPLOAD
// ==========================================
const fileInput  = document.getElementById('activity-photos');
const uploadZone = document.getElementById('upload-zone');

fileInput.addEventListener('change', handleFiles);
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    fileInput.files = e.dataTransfer.files;
    handleFiles();
});

function handleFiles() {
    uploadedFiles = Array.from(fileInput.files);
    const n = uploadedFiles.length;
    hasFiles = n > 0;
    if (hasFiles) {
        uploadZone.classList.add('has-files');
        const t = I18N[currentLang];
        document.getElementById('upload-label').innerText = `${t.files_selected} ${n} ${t.files_unit}`;
    }
    checkFormReady();
}

// ==========================================
// STEP INDICATOR
// ==========================================
function setStep(n) {
    for (let i = 1; i <= 5; i++) {
        const node = document.getElementById('step' + i);
        if (i < n) {
            node.className = 'step-node done';
            node.innerHTML = '<i class="fas fa-check" style="font-size:11px;"></i>';
        } else if (i === n) {
            node.className = 'step-node active';
            node.textContent = i;
        } else {
            node.className = 'step-node';
            node.textContent = i;
        }
        if (i < 5) {
            document.getElementById('line' + i).className = 'step-line' + (i < n ? ' done' : '');
        }
    }
}

// ==========================================
// MAIN PROCESS
// ==========================================
async function processPost() {
    if (!document.getElementById('f-activity-name').value.trim()) return showToast("กรุณากรอกชื่อกิจกรรม", "error");
    if (!document.getElementById('f-date').value) return showToast("กรุณาเลือกวันที่จัดกิจกรรม", "error");
    if (!hasFiles) return showToast("กรุณาเลือกรูปภาพ", "error");

    const btn = document.getElementById('btn-process');
    const statusText = document.getElementById('ai-status');

    // Use View Transitions if supported to show the result area smoothly
    if (document.startViewTransition) {
        document.startViewTransition(() => {
            document.getElementById('result-area').style.display = 'block';
        });
    } else {
        document.getElementById('result-area').style.display = 'block';
    }
    document.getElementById('result-area').scrollIntoView({behavior:'smooth', block:'start'});
    btn.disabled = true;
    btn.classList.add('loading');
    
    // Show skeleton initially
    document.getElementById('final-caption-fb').innerHTML = '<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div>';
    document.getElementById('final-caption-ig').innerHTML = '<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div>';
    document.getElementById('final-cover-fb').src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlN2U3ZTciLz48L3N2Zz4=';
    document.getElementById('final-cover-ig').src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlN2U3ZTciLz48L3N2Zz4=';

    const activityContext = buildActivityContext();

    try {
        setStep(1); statusText.innerText = "โหลดฟอนต์และเทมเพลต...";
        await document.fonts.ready;
        
        // Fetch blobs for templates to send to worker
        const [fbCovBlob, igCovBlob, fbSubBlob, igSubBlob] = await Promise.all([
            fetch('cover-fb.png').then(r => r.blob()),
            fetch('cover-ig.png').then(r => r.blob()),
            fetch('watermark-new.png').then(r => r.blob()),
            fetch('overlay-ig.png').then(r => r.blob())
        ]);
        
        templateFBCover = fbCovBlob;
        templateIGCover = igCovBlob;
        templateFBSub = fbSubBlob;
        templateIGSub = igSubBlob;

        setStep(2); statusText.innerText = "เตรียมภาพทั้งหมดส่งให้ AI วิเคราะห์ และคัดรูปที่ซ้ำออก...";
        
        const maxProcess = Math.min(uploadedFiles.length, 40);
        const filesToProcess = uploadedFiles.slice(0, maxProcess);
        
        // Run resize in worker
        const imagesDataForAI = await runWorkerTask('resizeImagesForAI', { images: filesToProcess, maxW: 600 });

        setStep(3); statusText.innerText = "AI กำลังคัดกรองรูปภาพและเขียนแคปชั่น... (รอประมาณ 15-30 วินาที)";

        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'images': JSON.stringify(imagesDataForAI),
                'mimeType': 'image/jpeg',
                'activityInfo': activityContext
            })
        });

        if (!response.ok) throw new Error("เซิร์ฟเวอร์ผิดพลาด (HTTP " + response.status + ")");
        const rawText = await response.text();
        let parsedData;
        try {
            const cleaned = rawText.replace(/```json/gi,'').replace(/```/g,'').trim();
            parsedData = JSON.parse(cleaned);
        } catch(e) {
            throw new Error("AI ตอบผิดรูปแบบ: " + rawText.substring(0,150));
        }
        if (parsedData.error) throw new Error(parsedData.error);
        if (!parsedData.kept_image_indices) throw new Error("ไม่ได้รับข้อมูลการคัดภาพจาก AI");

        let keptIndices = parsedData.kept_image_indices;
        if (keptIndices && keptIndices.length > 0) {
            let filteredFiles = [];
            for (let idx of keptIndices) {
                if (idx >= 0 && idx < uploadedFiles.length) {
                    filteredFiles.push(uploadedFiles[idx]);
                }
            }
            if (filteredFiles.length > 0) {
                uploadedFiles = filteredFiles;
            }
        }
        
        currentAIResult = parsedData;
        currentCaptionFB = parsedData.post_caption;
        currentCaptionIG = parseIGCaption(parsedData.post_caption);
        
        document.getElementById('final-caption-fb').innerText = currentCaptionFB;
        document.getElementById('final-caption-ig').innerText = currentCaptionIG;

        const hl = parsedData.cover_headline;
        document.getElementById('hl-line1').value = hl.headline || '';
        document.getElementById('hl-line2').value = hl.subhead  || '';
        document.getElementById('hl-line3').value = hl.detail   || '';

        setStep(4); statusText.innerText = "ปรับแสงสีและวาดภาพปก...";
        
        // Let worker draw covers
        const leadFile = uploadedFiles[0];
        const covers = await runWorkerTask('drawCovers', {
            leadImgBlob: leadFile,
            hl: getHeadlineFromEditor(),
            templates: { fbCover: templateFBCover, igCover: templateIGCover }
        });
        
        document.getElementById('final-cover-fb').src = covers.fbData;
        document.getElementById('final-cover-ig').src = covers.igData;

        setStep(5);
        statusText.innerText = `เสร็จสมบูรณ์! AI ได้คัดภาพที่ดี ไว้ให้คุณแล้ว ${uploadedFiles.length} รูป (ตัดภาพซ้ำ/เบลอ) ตรวจสอบแล้วกดดาวน์โหลดได้เลย`;
        
        await renderPhotoSelector(uploadedFiles);

        document.getElementById('headline-editor').style.display = 'block';
        document.getElementById('btn-download-zip').style.display = 'flex';
        document.getElementById('btn-review-publish').style.display = 'flex';
        document.getElementById('dl-label').innerText = `ดาวน์โหลด ${uploadedFiles.length} รูปภาพ (.zip) — FB + IG Ready`;
        
        btn.disabled = false;
        btn.classList.remove('loading');
        showToast("ประมวลผลเสร็จสมบูรณ์!", "success");

    } catch(err) {
        console.error(err);
        statusText.innerText = "❌ " + err.message;
        showToast(err.message, "error");
        btn.disabled = false;
        btn.classList.remove('loading');
        // Remove skeleton if failed
        document.getElementById('final-caption-fb').innerText = 'เกิดข้อผิดพลาดในการสร้างแคปชั่น';
        document.getElementById('final-caption-ig').innerText = 'เกิดข้อผิดพลาดในการสร้างแคปชั่น';
    }
}

// ==========================================
// PHOTO SELECTOR
// ==========================================
async function renderPhotoSelector(files) {
    const grid  = document.getElementById('photo-grid');
    const badge = document.getElementById('photo-count-badge');
    const panel = document.getElementById('photo-selector');
    grid.innerHTML = '';
    
    const activeCount = files.filter((_, i) => !excludedIndices.has(i)).length;
    badge.innerText = `${activeCount} รูป`;
    panel.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        const url = URL.createObjectURL(files[i]);
        const div = document.createElement('div');
        div.className = 'photo-thumb ' + (i === 0 ? 'is-cover' : 'is-kept');
        if (excludedIndices.has(i)) div.classList.add('is-excluded');
        div.dataset.index = i;
        div.innerHTML = `
            <img src="${url}" loading="lazy" onclick="setAsCover(${i})">
            <div class="thumb-badge">${I18N[currentLang].cover_badge}</div>
            <div class="thumb-order">#${i + 1}</div>
            <button class="btn-exclude" onclick="toggleExclude(event, ${i})"><i class="fas fa-times"></i></button>`;
        grid.appendChild(div);
    }
}

function toggleExclude(event, idx) {
    event.stopPropagation();
    if (idx === 0) {
        showToast("ไม่สามารถซ่อนภาพปกได้ (เปลี่ยนเป็นรูปอื่นก่อน)", "error");
        return;
    }
    if (excludedIndices.has(idx)) {
        excludedIndices.delete(idx);
    } else {
        excludedIndices.add(idx);
    }
    renderPhotoSelector(uploadedFiles);
    
    // Update button counts
    const activeCount = uploadedFiles.length - excludedIndices.size;
    document.getElementById('dl-label').innerText = `ดาวน์โหลด ${activeCount} รูปภาพ (.zip) — FB + IG Ready`;
}

async function setAsCover(newCoverIdx) {
    if (newCoverIdx === 0 || excludedIndices.has(newCoverIdx)) return;

    const picked = uploadedFiles.splice(newCoverIdx, 1)[0];
    uploadedFiles.unshift(picked);
    
    // Re-map excluded indices so they point to correct files after shift
    let newSet = new Set();
    for (let ex of excludedIndices) {
        if (ex < newCoverIdx) newSet.add(ex + 1);
        else if (ex > newCoverIdx) newSet.add(ex);
    }
    excludedIndices = newSet;

    await renderPhotoSelector(uploadedFiles);

    document.getElementById('ai-status').innerText = 'กำลังวาดภาพปกใหม่...';
    
    try {
        const hl = getHeadlineFromEditor();
        const covers = await runWorkerTask('drawCovers', {
            leadImgBlob: uploadedFiles[0],
            hl: hl,
            templates: { fbCover: templateFBCover, igCover: templateIGCover }
        });
        
        document.getElementById('final-cover-fb').src = covers.fbData;
        document.getElementById('final-cover-ig').src = covers.igData;
        document.getElementById('ai-status').innerText = 'เปลี่ยนภาพปกเรียบร้อยแล้ว';
        if (currentAIResult) currentAIResult.cover_headline = hl;
        showToast("เปลี่ยนภาพปกเรียบร้อย", "success");
    } catch(e) {
        showToast("เกิดข้อผิดพลาดในการวาดรูป", "error");
    }
}

// ==========================================
// HEADLINE & CAPTION
// ==========================================
function getHeadlineFromEditor() {
    return {
        headline: document.getElementById('hl-line1').value || 'SOMKIDVITTAYA SCHOOL',
        subhead:  document.getElementById('hl-line2').value || 'Creating the Best Experience',
        detail:   document.getElementById('hl-line3').value || 'Somkidvittaya School, Chonburi'
    };
}
async function redrawPreviews() {
    if (!uploadedFiles.length) return;
    try {
        const hl = getHeadlineFromEditor();
        const covers = await runWorkerTask('drawCovers', {
            leadImgBlob: uploadedFiles[0],
            hl: hl,
            templates: { fbCover: templateFBCover, igCover: templateIGCover }
        });
        
        document.getElementById('final-cover-fb').src = covers.fbData;
        document.getElementById('final-cover-ig').src = covers.igData;
        if (currentAIResult) currentAIResult.cover_headline = hl;
        showToast("อัปเดตพรีวิวแล้ว", "success");
    } catch(e) {
        showToast("อัปเดตพรีวิวล้มเหลว", "error");
    }
}

let activeTab = 'fb';
function switchCaptionTab(tab) {
    activeTab = tab;
    document.getElementById('tab-fb').classList.toggle('active', tab === 'fb');
    document.getElementById('tab-ig').classList.toggle('active', tab === 'ig');
    document.getElementById('final-caption-fb').style.display = tab === 'fb' ? 'block' : 'none';
    document.getElementById('final-caption-ig').style.display = tab === 'ig' ? 'block' : 'none';
}

function parseIGCaption(fullCaption) {
    // English text is the first block before _______________
    // Contact us is the 4th block, Hashtag is 5th
    const blocks = fullCaption.split('_______________').map(s => s.trim());
    if (blocks.length >= 4) {
        const enText = blocks[0];
        const contactText = blocks[3];
        const hashtagText = blocks[4] || "";
        return `${enText}\n_______________\n\n${contactText}\n_______________\n\n${hashtagText}`;
    }
    return fullCaption;
}

let isEditing = false;
function toggleEdit() {
    const boxId = activeTab === 'fb' ? 'final-caption-fb' : 'final-caption-ig';
    const box = document.getElementById(boxId);
    isEditing = !isEditing;
    box.contentEditable = isEditing ? 'true' : 'false';
    if (isEditing) box.focus();
    
    // Show translate button only when editing FB tab
    const btnTrans = document.getElementById('btn-translate-th');
    if (btnTrans) {
        btnTrans.style.display = (isEditing && activeTab === 'fb') ? 'inline-block' : 'none';
    }
}

async function translateFromThai() {
    const fbBox = document.getElementById('final-caption-fb');
    const fullText = fbBox.innerText;
    
    const blocks = fullText.split('_______________').map(s => s.trim());
    if (blocks.length < 4) {
        alert("คำเตือน: ไม่พบโครงสร้างเส้นคั่น _______________ ตามรูปแบบเดิม ระบบไม่สามารถดึงภาษาไทยไปแปลอัตโนมัติได้ กรุณาใส่เส้นคั่น 15 ขีดให้ครบถ้วน");
        return;
    }
    
    // Thai is block index 2
    const thaiText = blocks[2];
    if (!thaiText || thaiText.trim() === '') {
        alert("ไม่พบข้อความภาษาไทยระหว่างเส้นคั่น");
        return;
    }

    const btnTrans = document.getElementById('btn-translate-th');
    const originalBtn = btnTrans.innerHTML;
    btnTrans.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังแปล...';
    btnTrans.disabled = true;

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'action': 'translateCaption',
                'thaiCaption': thaiText
            })
        });

        if (!response.ok) throw new Error("เซิร์ฟเวอร์ผิดพลาด");
        const rawText = await response.text();
        const cleaned = rawText.replace(/```json/gi,'').replace(/```/g,'').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.error) {
            console.error("Translation error details:", parsed.error);
            const rawMsg = parsed.error.raw ? JSON.stringify(parsed.error.raw) : "";
            throw new Error((parsed.error.message || "เกิดข้อผิดพลาด") + (rawMsg ? " - Details: " + rawMsg : ""));
        }

        // Reconstruct FB caption
        blocks[0] = parsed.english;
        blocks[1] = parsed.chinese;
        
        const newFbCaption = `${blocks[0]}\n_______________\n\n${blocks[1]}\n_______________\n\n${blocks[2]}\n_______________\n\n${blocks[3]}\n_______________\n\n${blocks[4] || ""}`;
        
        fbBox.innerText = newFbCaption;
        currentCaptionFB = newFbCaption;
        
        // Update IG caption
        const newIgCaption = parseIGCaption(newFbCaption);
        document.getElementById('final-caption-ig').innerText = newIgCaption;
        currentCaptionIG = newIgCaption;

        showToast("แปลภาษาและอัปเดตแคปชั่น IG เรียบร้อยแล้ว!", 'success');
        
        // Disable editing mode to prevent accidents
        if (isEditing) toggleEdit();

    } catch (e) {
        alert("เกิดข้อผิดพลาดในการแปล: " + e.message);
    } finally {
        btnTrans.innerHTML = originalBtn;
        btnTrans.disabled = false;
    }
}
function copyCaption() {
    const boxId = activeTab === 'fb' ? 'final-caption-fb' : 'final-caption-ig';
    const text = document.getElementById(boxId).innerText;
    navigator.clipboard.writeText(text)
        .then(() => showToast("คัดลอกแคปชั่นเรียบร้อยแล้วครับ!"))
        .catch(() => { document.execCommand('copy'); showToast("คัดลอกแคปชั่นเรียบร้อยแล้วครับ!"); });
}

// ==========================================
// DOWNLOAD ZIP (Using Worker)
// ==========================================
async function generateAndDownloadZip() {
    const btn  = document.getElementById('btn-download-zip');
    const lbl  = document.getElementById('dl-label');
    btn.disabled = true; lbl.innerText = "กำลังประมวลผลและแพ็คไฟล์...";

    try {
        const activeFiles = uploadedFiles.filter((_, i) => !excludedIndices.has(i));
        const maxPhotos = Math.min(activeFiles.length, 40);
        const hl = getHeadlineFromEditor();
        const captionFB = document.getElementById('final-caption-fb').innerText;
        const captionIG = document.getElementById('final-caption-ig').innerText;

        const zipBlob = await runWorkerTask('generateZip', {
            files: activeFiles.slice(0, maxPhotos),
            maxPhotos: maxPhotos,
            hl: hl,
            caption: `=== FACEBOOK CAPTION ===\n${captionFB}\n\n=== INSTAGRAM CAPTION ===\n${captionIG}`,
            templates: { fbCover: templateFBCover, igCover: templateIGCover, fbSub: templateFBSub, igSub: templateIGSub }
        });

        saveAs(zipBlob, `SomkidPost_${Date.now()}.zip`);
        
        btn.disabled = false;
        lbl.innerText = "ดาวน์โหลดเสร็จสมบูรณ์";
        btn.classList.add('success');
        showToast("แพ็คและดาวน์โหลดไฟล์สำเร็จ", "success");
    } catch(e) {
        btn.disabled = false;
        lbl.innerText = "เกิดข้อผิดพลาดในการดาวน์โหลด";
        showToast("เกิดข้อผิดพลาด: " + e.message, "error");
    }
}

// ==========================================
// HELPERS
// ==========================================
function resetAll() {
    if (!confirm(I18N[currentLang].confirm_reset)) return;
    
    const resetUI = () => {
        document.getElementById('f-activity-name').value='';
        document.getElementById('f-date').value='';
        document.getElementById('f-grade').value='';
        document.getElementById('f-detail').value='';
        document.getElementById('f-objective').value='';
        document.getElementById('f-hashtag').value='';
        document.getElementById('cc-detail').innerText='0 / 1000';
        document.querySelectorAll('#tag-group .tag-btn').forEach(b=>b.classList.remove('selected'));
        document.querySelectorAll('#tone-group .tag-btn').forEach((b,i)=>{ b.classList.toggle('selected', i===0); });
        uploadZone.classList.remove('has-files');
        document.getElementById('upload-label').innerText='คลิกหรือลากไฟล์มาวางที่นี่';
        document.getElementById('result-area').style.display='none';
        document.getElementById('photo-selector').style.display='none';
        document.getElementById('photo-grid').innerHTML='';
        document.getElementById('btn-download-zip').style.display='none';
        document.getElementById('btn-review-publish').style.display='none';
        document.getElementById('btn-download-zip').classList.remove('success');
        document.getElementById('dl-label').innerText='ดาวน์โหลดรูปภาพทั้งหมด (.zip) — FB + IG Ready';
        currentAIResult=null; uploadedFiles=[]; hasFiles=false; excludedIndices.clear();
        checkFormReady();
        window.scrollTo({top:0,behavior:'smooth'});
    };

    if (document.startViewTransition) {
        document.startViewTransition(() => resetUI());
    } else {
        resetUI();
    }
}

document.getElementById('f-date').valueAsDate = new Date();

// ==========================================
// PUBLISH MODAL & SOCIAL MEDIA
// ==========================================
let igCarouselInterval = null;

function getActiveFiles() {
    return uploadedFiles.filter((_, i) => !excludedIndices.has(i));
}

async function openPublishModal() {
    const btnPublish = document.getElementById('btn-review-publish');
    const originalBtnText = btnPublish ? btnPublish.innerHTML : '';
    if (btnPublish) {
        btnPublish.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังเตรียมภาพพรีวิว...';
        btnPublish.disabled = true;
    }

    try {
        const fbCaption = document.getElementById('final-caption-fb').innerText;
        const igCaption = document.getElementById('final-caption-ig').innerText;
        
        document.getElementById('modal-fb-caption').innerText = fbCaption;
        document.getElementById('modal-ig-caption').innerText = igCaption;

        const fbGallery = document.getElementById('modal-fb-gallery');
        fbGallery.innerHTML = '';
        
        const igGallery = document.getElementById('modal-ig-gallery');
        igGallery.innerHTML = '';
        const igDots = document.getElementById('modal-ig-dots');
        igDots.innerHTML = '';

        const activeFiles = getActiveFiles();
        const hl = getHeadlineFromEditor();

        // Process images for preview so user sees the overlays
        const processedImages = await runWorkerTask('prepareImagesForSocial', {
            files: activeFiles.slice(0, 40),
            hl: hl,
            templates: { fbCover: templateFBCover, igCover: templateIGCover, fbSub: templateFBSub, igSub: templateIGSub }
        });
        
        // Cache globally for confirmPublish
        window.socialProcessedImagesCache = processedImages;

        // FB Gallery (preview up to 5)
        let fbImgs = processedImages.fbImages.map(b64 => "data:image/jpeg;base64," + b64);
        fbImgs.slice(0, 5).forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            img.style.width = '100%'; img.style.height = '120px'; img.style.objectFit = 'cover'; img.style.borderRadius = '8px';
            fbGallery.appendChild(img);
        });

        // IG Gallery (Carousel up to 10)
        let igImgs = processedImages.igImages.map(b64 => "data:image/jpeg;base64," + b64);
        igImgs.forEach((src, idx) => {
            const img = document.createElement('img');
            img.src = src;
            img.className = 'ig-carousel-item' + (idx === 0 ? ' active' : '');
            igGallery.appendChild(img);
            
            const dot = document.createElement('div');
            dot.className = 'ig-dot' + (idx === 0 ? ' active' : '');
            igDots.appendChild(dot);
        });
        
        const igCount = igImgs.length;
        const warning = document.getElementById('modal-ig-warning');
        if (activeFiles.length > 10) {
            warning.style.display = 'block';
            warning.innerText = `* รูปสำหรับ Instagram จะถูกเลือกเฉพาะ 10 รูปแรกเท่านั้น`;
        } else {
            warning.style.display = 'none';
        }

        document.getElementById('publish-modal').classList.add('is-active');
        
        // Simple carousel animation
        if (igCarouselInterval) clearInterval(igCarouselInterval);
        if (igCount > 1) {
            let curIdx = 0;
            igCarouselInterval = setInterval(() => {
                const items = igGallery.querySelectorAll('.ig-carousel-item');
                const dots = igDots.querySelectorAll('.ig-dot');
                if(items.length === 0) return;
                items[curIdx].classList.remove('active');
                dots[curIdx].classList.remove('active');
                curIdx = (curIdx + 1) % igCount;
                items[curIdx].classList.add('active');
                dots[curIdx].classList.add('active');
            }, 2000);
        }
    } catch (e) {
        showToast("เกิดข้อผิดพลาดในการเตรียมรูปภาพพรีวิว: " + e.message, 'error');
    } finally {
        if (btnPublish) {
            btnPublish.innerHTML = originalBtnText;
            btnPublish.disabled = false;
        }
    }
}

function closePublishModal() {
    document.getElementById('publish-modal').classList.remove('is-active');
    if (igCarouselInterval) clearInterval(igCarouselInterval);
}

async function confirmPublish() {
    const btn = document.getElementById('btn-confirm-publish');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังโพสต์...';
    btn.disabled = true;
    
    try {
        const activeFiles = getActiveFiles();
        const fbCaption = document.getElementById('final-caption-fb').innerText;
        const igCaption = document.getElementById('final-caption-ig').innerText;
        const hl = getHeadlineFromEditor();

        // Use cached processed images or prepare them if missing
        let processedImages = window.socialProcessedImagesCache;
        if (!processedImages) {
            processedImages = await runWorkerTask('prepareImagesForSocial', {
                files: activeFiles.slice(0, 40),
                hl: hl,
                templates: { fbCover: templateFBCover, igCover: templateIGCover, fbSub: templateFBSub, igSub: templateIGSub }
            });
        }

        // Backend call
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'action': 'publishToSocial',
                'fbImages': JSON.stringify(processedImages.fbImages),
                'igImages': JSON.stringify(processedImages.igImages),
                'fbCaption': fbCaption,
                'igCaption': igCaption
            })
        });

        const rawText = await response.text();
        let resData;
        try {
            resData = JSON.parse(rawText);
        } catch(e) {
            throw new Error(rawText);
        }
        
        if (resData.error) throw new Error(resData.error);
        
        showToast("โพสต์สำเร็จเรียบร้อย!", "success");
        closePublishModal();
    } catch(err) {
        alert("Publish Failed: " + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// i18n — Thai / English
// ==========================================
const I18N = {
    th: {
        page_subtitle:    'สร้างโพสต์โซเชียลมีเดีย 3 ภาษา + ภาพพร้อมโพสต์',
        sec_activity:     'ข้อมูลกิจกรรม',
        sec_upload:       'อัปโหลดรูปภาพกิจกรรม',
        lbl_name:         'ชื่อกิจกรรม',
        lbl_date:         'วันที่จัดกิจกรรม',
        lbl_grade:        'ระดับ/กลุ่มนักเรียนที่เข้าร่วม',
        lbl_type:         'ประเภทกิจกรรม',
        hint_type:        '(เลือกได้หลายประเภท)',
        lbl_detail:       'รายละเอียดกิจกรรม / ไฮไลต์ที่อยากเน้น',
        hint_detail:      ' — ยิ่งละเอียดยิ่งได้แคปชั่นดี',
        lbl_obj:          'วัตถุประสงค์หลัก',
        hint_obj:         '(สั้นๆ)',
        lbl_hashtag:      'Hashtag ที่อยากใช้',
        lbl_tone:         'โทนเสียงของแคปชั่น',
        upload_title:     'คลิกหรือลากไฟล์มาวางที่นี่',
        upload_hint:      'รองรับ JPG, PNG — อัปโหลดได้หลายไฟล์ ระบบ AI จะเลือกภาพปกที่ดีที่สุดให้',
        btn_process_idle: 'กรุณากรอกข้อมูลกิจกรรมและเลือกรูปภาพ',
        btn_process_ready:'ให้ AI วิเคราะห์และสร้างโพสต์',
        lbl_status:       'สถานะ:',
        status_processing:'กำลังประมวลผล...',
        sec_photos:       'ภาพที่ AI คัดเลือกไว้',
        hint_photos:      'กดที่รูปเพื่อเปลี่ยนเป็น <strong>ภาพปก</strong> — กรอบ <span style="color:var(--sv-maroon);">■</span> = ปก &nbsp; กรอบ <span style="color:var(--sv-success);">■</span> = ภาพประกอบ',
        sec_headline:     'แก้ไขพาดหัวบนรูปภาพ',
        lbl_hl1:          'บรรทัดที่ 1 — Main Headline',
        lbl_hl2:          'บรรทัดที่ 2 — Sub Headline',
        lbl_hl3:          'บรรทัดที่ 3 — Detail',
        btn_redraw:       'อัปเดตพรีวิว',
        sec_caption:      'แคปชั่น (EN · 中文 · ไทย)',
        btn_copy:         'คัดลอกแคปชั่น',
        btn_edit:         'แก้ไข',
        btn_download:     'ดาวน์โหลดรูปภาพทั้งหมด (.zip) — FB + IG Ready',
        btn_reset:        'เริ่มใหม่อีกครั้ง',
        tag_sport:'กีฬา', tag_academic:'วิชาการ', tag_art:'ศิลปวัฒนธรรม',
        tag_trip:'ทัศนศึกษา', tag_volunteer:'จิตอาสา', tag_parents:'ผู้ปกครอง',
        tag_ceremony:'พิธีการ', tag_training:'อบรม', tag_health:'สุขภาพ', tag_tech:'เทคโนโลยี',
        tone_warm:'อบอุ่น/ภาคภูมิใจ', tone_fun:'สนุก/พลังงาน', tone_formal:'เป็นทางการ',
        tone_grateful:'ซาบซึ้ง/ขอบคุณ', tone_inspire:'สร้างแรงบันดาลใจ',
        ph_name:  'เช่น กีฬาสี ประจำปี 2568, วันไหว้ครู, ทัศนศึกษา จ.เชียงใหม่',
        ph_grade: 'เช่น ป.4–ป.6, ทุกระดับ',
        ph_detail:'เช่น\n- มีการแข่งขันกีฬา 8 ประเภท นักเรียน 450 คนเข้าร่วม\n- รับเกียรติบัตรจากผู้อำนวยการโรงเรียน',
        ph_obj:   'เช่น เสริมสร้างความสามัคคี',
        ph_hashtag:'เช่น #กีฬาสี2568',
        ph_hl1:'เช่น SPORTS DAY 2026', ph_hl2:'เช่น Building Champions Together',
        ph_hl3:'เช่น June 2, 2026 · Somkidvittaya School',
        files_selected:'เลือกแล้ว', files_unit:'ไฟล์ ✅ (คลิกเพื่อเปลี่ยน)',
        photos_unit:'รูป', cover_badge:'ปก',
        copy_alert:'คัดลอกแคปชั่นเรียบร้อยแล้วครับ!',
        confirm_reset:'เริ่มต้นใหม่? ข้อมูลปัจจุบันจะหายครับ',
    },
    en: {
        page_subtitle:    'Generate trilingual social posts + ready-to-publish images',
        sec_activity:     'Activity Information',
        sec_upload:       'Upload Activity Photos',
        lbl_name:         'Activity Name',
        lbl_date:         'Event Date',
        lbl_grade:        'Student Level / Group',
        lbl_type:         'Activity Type',
        hint_type:        '(multiple selection)',
        lbl_detail:       'Activity Details / Highlights',
        hint_detail:      ' — More detail = better caption',
        lbl_obj:          'Main Objective',
        hint_obj:         '(brief)',
        lbl_hashtag:      'Hashtags to Use',
        lbl_tone:         'Caption Tone',
        upload_title:     'Click or drag files here',
        upload_hint:      'Supports JPG, PNG — multiple files. AI selects the best cover photo.',
        btn_process_idle: 'Please fill in activity info and select photos',
        btn_process_ready:'Analyze & Generate Post with AI',
        lbl_status:       'Status:',
        status_processing:'Processing...',
        sec_photos:       'AI-Selected Photos',
        hint_photos:      'Tap a photo to set as <strong>cover</strong> — <span style="color:var(--sv-maroon);">■</span> Cover &nbsp; <span style="color:var(--sv-success);">■</span> Supporting',
        sec_headline:     'Edit Cover Headline',
        lbl_hl1:          'Line 1 — Main Headline',
        lbl_hl2:          'Line 2 — Sub Headline',
        lbl_hl3:          'Line 3 — Detail',
        btn_redraw:       'Update Preview',
        sec_caption:      'Caption (EN · 中文 · ไทย)',
        btn_copy:         'Copy Caption',
        btn_edit:         'Edit',
        btn_download:     'Download All Images (.zip) — FB + IG Ready',
        btn_reset:        'Start Over',
        tag_sport:'Sports', tag_academic:'Academic', tag_art:'Arts & Culture',
        tag_trip:'Field Trip', tag_volunteer:'Volunteer', tag_parents:'Parents',
        tag_ceremony:'Ceremony', tag_training:'Training', tag_health:'Health', tag_tech:'Technology',
        tone_warm:'Warm / Proud', tone_fun:'Fun / Energetic', tone_formal:'Formal',
        tone_grateful:'Heartfelt / Grateful', tone_inspire:'Inspiring',
        ph_name:  'e.g. Sports Day 2026, Teacher Appreciation Day',
        ph_grade: 'e.g. Grades 4–6, All levels',
        ph_detail:'e.g.\n- 8 sports competitions, 450 students\n- Awards presented by the director',
        ph_obj:   'e.g. Build teamwork and school spirit',
        ph_hashtag:'e.g. #SportsDay2026',
        ph_hl1:'e.g. SPORTS DAY 2026', ph_hl2:'e.g. Building Champions Together',
        ph_hl3:'e.g. June 2, 2026 · Somkidvittaya School',
        files_selected:'Selected', files_unit:'file(s) ✅ (click to change)',
        photos_unit:'photo(s)', cover_badge:'Cover',
        copy_alert:'Caption copied to clipboard!',
        confirm_reset:'Start over? Current data will be lost.',
    }
};

function setLang(lang) {
    currentLang = lang;
    document.getElementById('lang-th').classList.toggle('active', lang === 'th');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    const t = I18N[lang];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key] === undefined) return;
        if (key === 'hint_photos') el.innerHTML = t[key];
        else el.textContent = t[key];
    });

    const ph = {
        'f-activity-name': t.ph_name, 'f-grade': t.ph_grade,
        'f-detail': t.ph_detail, 'f-objective': t.ph_obj,
        'f-hashtag': t.ph_hashtag, 'hl-line1': t.ph_hl1,
        'hl-line2': t.ph_hl2, 'hl-line3': t.ph_hl3,
    };
    Object.entries(ph).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.placeholder = val;
    });

    const tagMap = {
        'กีฬา':'tag_sport','วิชาการ':'tag_academic','ศิลปวัฒนธรรม':'tag_art',
        'ทัศนศึกษา':'tag_trip','จิตอาสา':'tag_volunteer','ประชุมผู้ปกครอง':'tag_parents',
        'พิธีการ':'tag_ceremony','อบรมสัมมนา':'tag_training',
        'ส่งเสริมสุขภาพ':'tag_health','เทคโนโลยี':'tag_tech'
    };
    document.querySelectorAll('#tag-group .tag-btn').forEach(btn => {
        const key = tagMap[btn.dataset.val];
        if (!key || !t[key]) return;
        const icon = btn.querySelector('i');
        btn.textContent = ' ' + t[key];
        if (icon) btn.prepend(icon);
    });

    const toneKeys = ['tone_warm','tone_fun','tone_formal','tone_grateful','tone_inspire'];
    document.querySelectorAll('#tone-group .tag-btn').forEach((btn, i) => {
        if (t[toneKeys[i]]) btn.textContent = t[toneKeys[i]];
    });

    if (hasFiles) {
        document.getElementById('upload-label').textContent =
            `${t.files_selected} ${uploadedFiles.length} ${t.files_unit}`;
    }

    document.querySelectorAll('.thumb-badge').forEach(b => b.textContent = t.cover_badge);
    document.documentElement.lang = lang;
}

checkFormReady();
