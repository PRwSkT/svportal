function initQRCodeGenerator() {
    if (typeof QRCodeStyling === 'undefined') {
        console.error('QRCodeStyling library is not loaded.');
        const container = document.getElementById('qr-code-canvas');
        if (container) {
            container.innerHTML = '<div style="color: #6E0D22; text-align: center; padding: 24px; font-weight: 600;">ไม่สามารถโหลดระบบสร้าง QR Code ได้ กรุณารีเฟรชหน้าเว็บอีกครั้ง</div>';
        }
        return;
    }

    // Presets
    const presetBtns = document.querySelectorAll('.preset-card');
    
    // Content
    const qrDataInput = document.getElementById('qr-data');
    
    // Colors & Styles
    const qrColorInput = document.getElementById('qr-color');
    const colorHexDisplay = document.getElementById('color-hex');
    const bgColorInput = document.getElementById('bg-color');
    const bgColorHexDisplay = document.getElementById('bg-color-hex');
    const qrDotsSelect = document.getElementById('qr-dots');
    
    // Corners
    const cornerSquareStyle = document.getElementById('corner-square-style');
    const cornerSquareColor = document.getElementById('corner-square-color');
    const cornerDotStyle = document.getElementById('corner-dot-style');
    const cornerDotColor = document.getElementById('corner-dot-color');
    
    // Logo
    const predefinedLogoSelect = document.getElementById('predefined-logo');
    const customLogoGroup = document.getElementById('custom-logo-group');
    const logoUpload = document.getElementById('logo-upload');
    const fileNameDisplay = document.getElementById('file-name-display');
    const clearLogoBtn = document.getElementById('clear-logo');
    const logoSizeInput = document.getElementById('logo-size');
    const logoMarginInput = document.getElementById('logo-margin');
    
    const downloadBtn = document.getElementById('btn-download');
    const downloadSvgBtn = document.getElementById('btn-download-svg');
    const qrContainer = document.getElementById('qr-code-canvas');

    if (!qrContainer) {
        console.error('QR container element (#qr-code-canvas) not found.');
        return;
    }

    // CI Colors
    const ciRed = '#6E0D22';
    const ciBlue = '#173D66';
    const ciCream = '#E6E6D7';
    const ciBlack = '#000000';
    const ciGold = '#b6a555';

    // Define Presets
    const presets = {
        ruby: {
            qrColor: ciRed,
            bgColor: '#ffffff',
            dotsStyle: 'classy',
            cornerSquareColor: ciRed,
            cornerSquareStyle: 'square',
            cornerDotColor: ciRed,
            cornerDotStyle: 'dot',
            logo: 'logo/sv-logo-social.png'
        },
        sapphire: {
            qrColor: ciBlue,
            bgColor: '#F4F7F9',
            dotsStyle: 'rounded',
            cornerSquareColor: ciBlue,
            cornerSquareStyle: 'dot',
            cornerDotColor: ciBlue,
            cornerDotStyle: 'dot',
            logo: 'logo/sv-logo-social.png'
        },
        luxury_navy: {
            qrColor: ciCream,
            bgColor: ciBlue,
            dotsStyle: 'dots',
            cornerSquareColor: ciCream,
            cornerSquareStyle: 'dot',
            cornerDotColor: ciCream,
            cornerDotStyle: 'dot',
            logo: 'logo.png'
        },
        crimson_night: {
            qrColor: ciCream,
            bgColor: ciRed,
            dotsStyle: 'classy-rounded',
            cornerSquareColor: ciCream,
            cornerSquareStyle: 'square',
            cornerDotColor: ciCream,
            cornerDotStyle: 'dot',
            logo: 'logo.png'
        },
        minimal: {
            qrColor: '#111111',
            bgColor: '#ffffff',
            dotsStyle: 'square',
            cornerSquareColor: '#111111',
            cornerSquareStyle: 'square',
            cornerDotColor: '#111111',
            cornerDotStyle: 'square',
            logo: ''
        },
        royal_gold: {
            qrColor: ciGold,
            bgColor: '#ffffff',
            dotsStyle: 'classy-rounded',
            cornerSquareColor: ciGold,
            cornerSquareStyle: 'square',
            cornerDotColor: ciGold,
            cornerDotStyle: 'dot',
            logo: 'logo/sv-logo-social.png'
        }
    };

    // Default to ruby preset
    let currentLogoUrl = presets.ruby.logo;
    if (qrColorInput) qrColorInput.value = presets.ruby.qrColor;
    if (bgColorInput) bgColorInput.value = presets.ruby.bgColor;
    if (qrDotsSelect) qrDotsSelect.value = presets.ruby.dotsStyle;
    if (cornerSquareColor) cornerSquareColor.value = presets.ruby.cornerSquareColor;
    if (cornerSquareStyle) cornerSquareStyle.value = presets.ruby.cornerSquareStyle;
    if (cornerDotColor) cornerDotColor.value = presets.ruby.cornerDotColor;
    if (cornerDotStyle) cornerDotStyle.value = presets.ruby.cornerDotStyle;
    if (predefinedLogoSelect) predefinedLogoSelect.value = presets.ruby.logo;

    // Initialize QR Code Styling instance
    const qrCode = new QRCodeStyling({
        width: 1024,
        height: 1024,
        margin: 64,
        type: 'svg',
        data: (qrDataInput && qrDataInput.value) ? qrDataInput.value.trim() : 'https://svportal.example.com',
        image: currentLogoUrl,
        dotsOptions: {
            color: qrColorInput ? qrColorInput.value : ciRed,
            type: qrDotsSelect ? qrDotsSelect.value : 'classy'
        },
        backgroundOptions: {
            color: (bgColorInput && bgColorInput.value === '#ffffff') ? 'transparent' : (bgColorInput ? bgColorInput.value : 'transparent'),
        },
        imageOptions: {
            crossOrigin: 'anonymous',
            margin: logoMarginInput ? parseInt(logoMarginInput.value) * 3 : 30,
            imageSize: logoSizeInput ? parseFloat(logoSizeInput.value) : 0.4
        },
        cornersSquareOptions: {
            type: cornerSquareStyle ? cornerSquareStyle.value : 'square',
            color: cornerSquareColor ? cornerSquareColor.value : ciRed
        },
        cornersDotOptions: {
            type: cornerDotStyle ? cornerDotStyle.value : 'dot',
            color: cornerDotColor ? cornerDotColor.value : ciRed
        }
    });

    qrContainer.innerHTML = '';
    qrCode.append(qrContainer);

    function updateQR() {
        const data = (qrDataInput && qrDataInput.value.trim()) ? qrDataInput.value.trim() : ' ';
        
        if (colorHexDisplay && qrColorInput) colorHexDisplay.textContent = qrColorInput.value.toUpperCase();
        if (bgColorHexDisplay && bgColorInput) bgColorHexDisplay.textContent = bgColorInput.value.toUpperCase();

        qrCode.update({
            data: data,
            width: 1024,
            height: 1024,
            margin: 64,
            dotsOptions: {
                color: qrColorInput ? qrColorInput.value : ciRed,
                type: qrDotsSelect ? qrDotsSelect.value : 'classy'
            },
            backgroundOptions: {
                color: (bgColorInput && bgColorInput.value === '#ffffff') ? 'transparent' : (bgColorInput ? bgColorInput.value : 'transparent')
            },
            cornersSquareOptions: {
                type: cornerSquareStyle ? cornerSquareStyle.value : 'square',
                color: cornerSquareColor ? cornerSquareColor.value : ciRed
            },
            cornersDotOptions: {
                type: cornerDotStyle ? cornerDotStyle.value : 'dot',
                color: cornerDotColor ? cornerDotColor.value : ciRed
            },
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: logoMarginInput ? parseInt(logoMarginInput.value) * 3 : 30,
                imageSize: logoSizeInput ? parseFloat(logoSizeInput.value) : 0.4
            },
            image: currentLogoUrl || ''
        });
    }

    // Call updateQR to ensure labels and colors are properly synced
    updateQR();
    
    // Handle Predefined Logo Selection
    if (predefinedLogoSelect) {
        predefinedLogoSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            presetBtns.forEach(b => b.classList.remove('active'));
            if (val === 'custom') {
                if (customLogoGroup) customLogoGroup.style.display = 'flex';
                if (logoUpload && logoUpload.files.length > 0) {
                    const file = logoUpload.files[0];
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        currentLogoUrl = event.target.result;
                        updateQR();
                    };
                    reader.readAsDataURL(file);
                } else {
                    currentLogoUrl = null;
                    updateQR();
                }
            } else {
                if (customLogoGroup) customLogoGroup.style.display = 'none';
                currentLogoUrl = val === '' ? null : val;
                updateQR();
            }
        });
    }

    // Attach event listeners to all manual inputs
    const inputs = [
        qrDataInput, qrColorInput, bgColorInput, qrDotsSelect,
        cornerSquareStyle, cornerSquareColor, cornerDotStyle, cornerDotColor,
        logoSizeInput, logoMarginInput
    ].filter(Boolean);
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            presetBtns.forEach(b => b.classList.remove('active'));
            updateQR();
        });
    });

    // Handle Presets
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.preset;
            const preset = presets[presetId];
            if (!preset) return;
            
            if (qrColorInput) qrColorInput.value = preset.qrColor;
            if (bgColorInput) bgColorInput.value = preset.bgColor;
            if (cornerSquareColor) cornerSquareColor.value = preset.cornerSquareColor;
            if (cornerDotColor) cornerDotColor.value = preset.cornerDotColor;
            
            if (qrDotsSelect) qrDotsSelect.value = preset.dotsStyle;
            if (cornerSquareStyle) cornerSquareStyle.value = preset.cornerSquareStyle;
            if (cornerDotStyle) cornerDotStyle.value = preset.cornerDotStyle;
            
            if (preset.logo !== undefined) {
                currentLogoUrl = preset.logo;
                if (predefinedLogoSelect) predefinedLogoSelect.value = currentLogoUrl;
                if (customLogoGroup) customLogoGroup.style.display = 'none';
            }

            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            updateQR();
        });
    });

    // Handle Logo Upload
    if (logoUpload) {
        logoUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (fileNameDisplay) fileNameDisplay.textContent = file.name;
                if (clearLogoBtn) clearLogoBtn.classList.remove('hidden');
                presetBtns.forEach(b => b.classList.remove('active'));
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    currentLogoUrl = event.target.result;
                    updateQR();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle Clear Custom Logo
    if (clearLogoBtn) {
        clearLogoBtn.addEventListener('click', () => {
            if (logoUpload) logoUpload.value = '';
            currentLogoUrl = null;
            if (fileNameDisplay) fileNameDisplay.textContent = 'No file selected';
            clearLogoBtn.classList.add('hidden');
            presetBtns.forEach(b => b.classList.remove('active'));
            updateQR();
        });
    }

    // Handle PNG Download
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            const originalHTML = downloadBtn.innerHTML;
            try {
                downloadBtn.disabled = true;
                downloadBtn.innerHTML = '<span>กำลังประมวลผล...</span>';
                await qrCode.download({ name: 'sv-portal-qr', extension: 'png' });
            } catch (err) {
                console.warn('qrCode.download PNG failed, attempting fallback:', err);
                try {
                    const blob = await qrCode.getRawData('png');
                    if (!blob) throw new Error('Could not generate PNG blob');
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'sv-portal-qr.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 500);
                } catch (fallbackErr) {
                    alert('ไม่สามารถดาวน์โหลด PNG ได้: ' + fallbackErr.message);
                    console.error(fallbackErr);
                }
            } finally {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = originalHTML;
            }
        });
    }

    // Handle SVG Download
    if (downloadSvgBtn) {
        downloadSvgBtn.addEventListener('click', async () => {
            const originalHTML = downloadSvgBtn.innerHTML;
            try {
                downloadSvgBtn.disabled = true;
                downloadSvgBtn.innerHTML = '<span>กำลังประมวลผล...</span>';
                await qrCode.download({ name: 'sv-portal-qr', extension: 'svg' });
            } catch (err) {
                console.warn('qrCode.download SVG failed, attempting fallback:', err);
                try {
                    const blob = await qrCode.getRawData('svg');
                    if (!blob) throw new Error('Could not generate SVG blob');
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'sv-portal-qr.svg';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 500);
                } catch (fallbackErr) {
                    alert('ไม่สามารถดาวน์โหลด SVG ได้: ' + fallbackErr.message);
                    console.error(fallbackErr);
                }
            } finally {
                downloadSvgBtn.disabled = false;
                downloadSvgBtn.innerHTML = originalHTML;
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQRCodeGenerator);
} else {
    initQRCodeGenerator();
}
