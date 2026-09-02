const fs = require('fs');
let code = fs.readFileSync('public/imageWorker.js', 'utf8');

const newLogic = `    // Draw blurred background (cover)
    const rCover = Math.max(w / imgBtm.width, h / imgBtm.height);
    ctx.filter = 'blur(60px) brightness(0.7)';
    ctx.drawImage(imgBtm, 0, 0, imgBtm.width, imgBtm.height,
        (w - imgBtm.width * rCover) / 2, (h - imgBtm.height * rCover) / 2,
        imgBtm.width * rCover, imgBtm.height * rCover);
    ctx.filter = 'none';

    // Draw main image (contain, so nothing is cropped)
    const rContain = Math.min(w / imgBtm.width, h / imgBtm.height);
    // Optionally scale up slightly (e.g. 1.05) if we want a tiny bit of cropping to reduce borders, but 1.0 is safest
    const scale = rContain * 1.0; 
    ctx.drawImage(imgBtm, 0, 0, imgBtm.width, imgBtm.height,
        (w - imgBtm.width * scale) / 2, (h - imgBtm.height * scale) / 2,
        imgBtm.width * scale, imgBtm.height * scale);`;

code = code.replace(/    const r = Math\.max\(w \/ imgBtm\.width, h \/ imgBtm\.height\);\n    ctx\.drawImage\(imgBtm, 0, 0, imgBtm\.width, imgBtm\.height,\n        \(w - imgBtm\.width \* r\) \/ 2, \(h - imgBtm\.height \* r\) \/ 2,\n        imgBtm\.width \* r, imgBtm\.height \* r\);/, newLogic);

fs.writeFileSync('public/imageWorker.js', code);
