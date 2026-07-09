document.addEventListener('DOMContentLoaded', () => {
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
    const qrContainer = document.getElementById('qr-code-canvas');

    let currentLogoUrl = 'logo/sv-logo-social.png'; // Set default logo

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

    // Initialize QR Code Styling instance
    const qrCode = new QRCodeStyling({
        width: 300,
        height: 300,
        margin: 20,
        type: "svg",
        data: qrDataInput.value || "https://svportal.example.com",
        image: currentLogoUrl,
        dotsOptions: {
            color: qrColorInput.value,
            type: qrDotsSelect.value
        },
        backgroundOptions: {
            color: bgColorInput.value === '#ffffff' ? 'transparent' : bgColorInput.value,
        },
        imageOptions: {
            margin: parseInt(logoMarginInput.value),
            imageSize: parseFloat(logoSizeInput.value)
        },
        cornersSquareOptions: {
            type: cornerSquareStyle.value,
            color: cornerSquareColor.value
        },
        cornersDotOptions: {
            type: cornerDotStyle.value,
            color: cornerDotColor.value
        }
    });

    qrCode.append(qrContainer);

    function updateQR() {
        const data = qrDataInput.value.trim() || " ";
        
        colorHexDisplay.textContent = qrColorInput.value.toUpperCase();
        bgColorHexDisplay.textContent = bgColorInput.value.toUpperCase();

        qrCode.update({
            data: data,
            margin: 20,
            dotsOptions: {
                color: qrColorInput.value,
                type: qrDotsSelect.value
            },
            backgroundOptions: {
                color: bgColorInput.value === '#ffffff' ? 'transparent' : bgColorInput.value
            },
            cornersSquareOptions: {
                type: cornerSquareStyle.value,
                color: cornerSquareColor.value
            },
            cornersDotOptions: {
                type: cornerDotStyle.value,
                color: cornerDotColor.value
            },
            imageOptions: {
                margin: parseInt(logoMarginInput.value),
                imageSize: parseFloat(logoSizeInput.value)
            },
            image: currentLogoUrl || ""
        });
    }
    
    // Handle Predefined Logo Selection
    predefinedLogoSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        presetBtns.forEach(b => b.classList.remove('active')); // Custom tweak
        if (val === 'custom') {
            customLogoGroup.style.display = 'flex';
            if (logoUpload.files.length > 0) {
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
            customLogoGroup.style.display = 'none';
            currentLogoUrl = val === "" ? null : val;
            updateQR();
        }
    });

    // Attach event listeners to all manual inputs
    const inputs = [
        qrDataInput, qrColorInput, bgColorInput, qrDotsSelect,
        cornerSquareStyle, cornerSquareColor, cornerDotStyle, cornerDotColor,
        logoSizeInput, logoMarginInput
    ];
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            // Remove active state from presets if user manually tweaks colors
            presetBtns.forEach(b => b.classList.remove('active'));
            updateQR();
        });
    });

    // Handle Presets
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.preset;
            const preset = presets[presetId];
            if(!preset) return;
            
            // Update UI inputs
            qrColorInput.value = preset.qrColor;
            bgColorInput.value = preset.bgColor;
            cornerSquareColor.value = preset.cornerSquareColor;
            cornerDotColor.value = preset.cornerDotColor;
            
            qrDotsSelect.value = preset.dotsStyle;
            cornerSquareStyle.value = preset.cornerSquareStyle;
            cornerDotStyle.value = preset.cornerDotStyle;
            
            if (preset.logo !== undefined) {
                currentLogoUrl = preset.logo;
                if (currentLogoUrl !== '') {
                    predefinedLogoSelect.value = currentLogoUrl;
                    customLogoGroup.style.display = 'none';
                } else {
                    predefinedLogoSelect.value = '';
                    customLogoGroup.style.display = 'none';
                }
            }

            // Update active state
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Apply updates
            updateQR();
        });
    });

    // Handle Logo Upload
    logoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            clearLogoBtn.classList.remove('hidden');
            presetBtns.forEach(b => b.classList.remove('active'));
            
            const reader = new FileReader();
            reader.onload = (event) => {
                currentLogoUrl = event.target.result;
                updateQR();
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle Clear Custom Logo
    clearLogoBtn.addEventListener('click', () => {
        logoUpload.value = '';
        currentLogoUrl = null;
        fileNameDisplay.textContent = 'No file selected';
        clearLogoBtn.classList.add('hidden');
        presetBtns.forEach(b => b.classList.remove('active'));
        updateQR();
    });

    // Handle Download
    downloadBtn.addEventListener('click', () => {
        qrCode.download({
            name: "sv-portal-qr",
            extension: 'png'
        });
    });
});
