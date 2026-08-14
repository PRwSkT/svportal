async function run() {
    const payload = {
        action: "translateCaption",
        thaiCaption: "สวัสดีครับ โรงเรียนของเรายินดีต้อนรับ"
    };
    
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwtl4265ih1xovbR2aR_juLopUa3Iz9rhJKWYnCUwcUOf8cRMBbs3wt6AVW4TJXqy6y0g/exec";
    
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        const rawText = await response.text();
        console.log("JSON Body Response:", rawText);
    } catch(err) {
        console.error(err);
    }
}
run();
