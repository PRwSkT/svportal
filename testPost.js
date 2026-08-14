async function run() {
    console.log("Fetching a small test image...");
    const imgRes = await fetch("https://picsum.photos/600/600.jpg");
    const buffer = await imgRes.arrayBuffer();
    const base64Str = Buffer.from(buffer).toString('base64');
    
    const payload = {
        action: "publishToSocial",
        mediaMode: "photo",
        fbImages: JSON.stringify([base64Str]),
        igImages: JSON.stringify([base64Str]),
        fbCaption: "[TEST] ขออภัย นี่คือโพสต์ทดสอบระบบครับ สามารถลบได้เลยครับ",
        igCaption: "[TEST] ขออภัย นี่คือโพสต์ทดสอบระบบครับ สามารถลบได้เลยครับ"
    };
    
    console.log("Sending POST to Apps Script...");
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwtl4265ih1xovbR2aR_juLopUa3Iz9rhJKWYnCUwcUOf8cRMBbs3wt6AVW4TJXqy6y0g/exec";
    
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        const rawText = await response.text();
        console.log("HTTP Status:", response.status);
        console.log("Response Body:", rawText);
    } catch(err) {
        console.error("Fetch Error:", err);
    }
}
run();
