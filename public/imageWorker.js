self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

// Helper to fit text
function fitAndDrawText(ctx, text, x, y, basePx, weight, maxWidth) {
    const family = "'Sukhumvit Set','Kanit',sans-serif";
    let size = basePx;
    ctx.font = `${weight} ${size}px ${family}`;
    while (ctx.measureText(text).width > maxWidth && size > 24) {
        size -= 1;
        ctx.font = `${weight} ${size}px ${family}`;
    }
    ctx.fillText(text, x, y);
}

// Function to draw template on OffscreenCanvas
async function drawOnCanvas(imgBtm, w, h, tplBtm, hl, pos) {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    
    // Draw the main image
    const r = Math.max(w / imgBtm.width, h / imgBtm.height);
    ctx.drawImage(imgBtm, 0, 0, imgBtm.width, imgBtm.height,
        (w - imgBtm.width * r) / 2, (h - imgBtm.height * r) / 2,
        imgBtm.width * r, imgBtm.height * r);
        
    // Overlay template
    if (tplBtm) {
        ctx.drawImage(tplBtm, 0, 0, w, h);
    }
    
    if (hl && pos) {
        ctx.fillStyle    = "#e6e6d7";
        ctx.textAlign    = "left";
        ctx.textBaseline = "alphabetic";
        const leftMost = Math.min(pos[0].x, pos[1].x, pos[2].x);
        const margin   = 80;
        const sharedMaxWidth = w - leftMost - margin;
        fitAndDrawText(ctx, hl.headline||'', pos[0].x, pos[0].y, pos[0].s, 'bold', sharedMaxWidth);
        fitAndDrawText(ctx, hl.subhead ||'', pos[1].x, pos[1].y, pos[1].s, '500',  sharedMaxWidth);
        fitAndDrawText(ctx, hl.detail  ||'', pos[2].x, pos[2].y, pos[2].s, '400',  sharedMaxWidth);
    }
    
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result);
    });
}

// Facebook Cover: 2160x2160 px
async function drawCoverTemplate(imgBtm, hl, tplBtm) {
    return drawOnCanvas(imgBtm, 2160, 2160, tplBtm, hl, [
        { x: 217.7505, y: 1910.7412, s: 91.79 },  // Main Headline Bold
        { x: 217.7505, y: 1991.0234, s: 86.94 },  // Sub Headline Medium
        { x: 217.7505, y: 2048.3008, s:  49 }   // Detail Text
    ]);
}

// Instagram Cover: 2048x2560 px
async function drawIGCover(imgBtm, hl, tplBtm) {
    return drawOnCanvas(imgBtm, 2048, 2560, tplBtm, hl, [
        { x: 206.6353, y: 2323.6885, s: 91.79 },  // Main Headline Bold
        { x: 206.6353, y: 2399.8008, s:  82.43 },  // Sub Headline Medium
        { x: 206.6353, y: 2454.1025, s:  46.45 }   // Detail Text
    ]);
}

async function processSubPhoto(imgBtm, ratio, tplBtm) {
    const w = ratio === '1:1' ? 2160 : 2048;
    const h = ratio === '1:1' ? 2160 : 2560;
    return drawOnCanvas(imgBtm, w, h, tplBtm, null, null);
}

// Just copy original image for enhance step since we are keeping original colors
async function autoEnhanceAndWarm(imgBtm) {
    const canvas = new OffscreenCanvas(imgBtm.width, imgBtm.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgBtm, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result);
    });
}

async function resizeImage(imgBtm, maxW) {
    if (!imgBtm.width) throw new Error("รูปเสียหาย");
    const sc = Math.min(1, maxW / imgBtm.width);
    const canvas = new OffscreenCanvas(imgBtm.width * sc, imgBtm.height * sc);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgBtm, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result);
    });
}

self.onmessage = async function(e) {
    const { action, payload, id } = e.data;
    
    try {
        if (action === 'resizeImagesForAI') {
            const { images, maxW } = payload;
            const results = [];
            for (let i = 0; i < images.length; i++) {
                const bmp = await createImageBitmap(images[i]);
                const b64 = await resizeImage(bmp, maxW);
                results.push(b64.split(',')[1]); // return just base64 data for AI
                self.postMessage({ action: 'progress', progress: Math.round(((i + 1) / images.length) * 100) });
            }
            self.postMessage({ id, status: 'success', data: results });
        } 
        else if (action === 'drawCovers') {
            const { leadImgBlob, hl, templates } = payload;
            const imgBtm = await createImageBitmap(leadImgBlob);
            
            const fbTplBtm = await createImageBitmap(templates.fbCover);
            const igTplBtm = await createImageBitmap(templates.igCover);
            
            const enhancedB64 = await autoEnhanceAndWarm(imgBtm);
            const enhancedBtm = await createImageBitmap(await fetch(enhancedB64).then(r => r.blob()));

            const fbData = await drawCoverTemplate(enhancedBtm, hl, fbTplBtm);
            const igData = await drawIGCover(enhancedBtm, hl, igTplBtm);
            
            self.postMessage({ id, status: 'success', data: { fbData, igData } });
        }
        else if (action === 'generateZip') {
            const { files, maxPhotos, templates, hl, caption } = e.data.payload;
            const zip = new JSZip();
            const fbFolder = zip.folder("1_Facebook_Set");
            const igFolder = zip.folder("2_Instagram_Set");
            
            const tplBtmFB = templates.fbCover ? await createImageBitmap(templates.fbCover) : null;
            const tplBtmIG = templates.igCover ? await createImageBitmap(templates.igCover) : null;
            const tplBtmFBSub = templates.fbSub ? await createImageBitmap(templates.fbSub) : null;
            const tplBtmIGSub = templates.igSub ? await createImageBitmap(templates.igSub) : null;
            
            for (let i = 0; i < maxPhotos; i++) {
                self.postMessage({ action: 'progress', text: `กำลังแพ็คไฟล์รูปที่ ${i + 1} จาก ${maxPhotos}...` });
                const bmp = await createImageBitmap(files[i]);
                const eB64 = await autoEnhanceAndWarm(bmp);
                const eBmp = await createImageBitmap(await fetch(eB64).then(r => r.blob()));
                const num  = String(i+1).padStart(2,'0');

                if (i === 0) {
                    fbFolder.file(`${num}_FB_Cover.jpg`, (await drawCoverTemplate(eBmp, hl, tplBtmFB)).split(',')[1], {base64:true});
                    igFolder.file(`${num}_IG_Cover.jpg`, (await drawIGCover(eBmp, hl, tplBtmIG)).split(',')[1], {base64:true});
                } else {
                    const fbRatio = (i <= 4) ? '1:1' : '4:5';
                    const fbTpl   = (fbRatio === '1:1') ? tplBtmFBSub : tplBtmIGSub;
                    fbFolder.file(`${num}_FB_Photo.jpg`, (await processSubPhoto(eBmp, fbRatio, fbTpl)).split(',')[1], {base64:true});
                    igFolder.file(`${num}_IG_Photo.jpg`, (await processSubPhoto(eBmp, '4:5', tplBtmIGSub)).split(',')[1], {base64:true});
                }
            }
            zip.file("caption.txt", caption);
            const content = await zip.generateAsync({type:"blob"});
            self.postMessage({ id, status: 'success', data: content });
        }
    } catch (err) {
        self.postMessage({ id, status: 'error', error: err.message });
    }
};
