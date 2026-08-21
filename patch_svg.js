const fs = require('fs');
let code = fs.readFileSync('public/qr-generator/script.js', 'utf8');

const newLogic = `
    const downloadSvgBtn = document.getElementById('btn-download-svg');
    downloadSvgBtn.addEventListener('click', async () => {
        try {
            const blob = await qrCode.getRawData('svg');
            if (!blob) {
                alert("Error: Could not generate SVG.");
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "sv-portal-qr.svg";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (err) {
            alert("SVG Download failed: " + err);
            console.error(err);
        }
    });
});
`;

code = code.replace(/    \}\);\n\}\);/, '    });\n' + newLogic);
fs.writeFileSync('public/qr-generator/script.js', code);
