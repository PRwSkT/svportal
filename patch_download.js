const fs = require('fs');
let code = fs.readFileSync('public/qr-generator/script.js', 'utf8');

const newDownload = `    downloadBtn.addEventListener('click', async () => {
        try {
            const blob = await qrCode.getRawData('png');
            if (!blob) {
                alert("Error: Could not generate QR Code image.");
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "sv-portal-qr.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (err) {
            alert("Download failed: " + err);
            console.error(err);
        }
    });`;

code = code.replace(/downloadBtn\.addEventListener\('click', \(\) => {[\s\S]*?\}\);/, newDownload);
fs.writeFileSync('public/qr-generator/script.js', code);
