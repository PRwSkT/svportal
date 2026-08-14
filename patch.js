const fs = require('fs');
let codeGs = fs.readFileSync('Code.gs', 'utf8');

// Replace doPost top part to support JSON payload
codeGs = codeGs.replace(/function doPost\(e\) \{\n  try \{\n    var action = e\.parameter\.action;/, 
`function doPost(e) {
  try {
    var params = e.parameter;
    if (e.postData && e.postData.contents) {
      try {
        var parsed = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, parsed);
      } catch(err) {}
    }
    var action = params.action;`);

// Replace e.parameter with params in doPost
codeGs = codeGs.replace(/e\.parameter/g, 'params');

// But handlePublishToSocial is a separate function, let's fix it too
codeGs = codeGs.replace(/function handlePublishToSocial\(e\)/, 'function handlePublishToSocial(params)');

// In handlePublishToSocial, replace e.parameter with params
codeGs = codeGs.replace(/e\.parameter/g, 'params');

// Fix handleTranslateCaption
codeGs = codeGs.replace(/function handleTranslateCaption\(e\)/, 'function handleTranslateCaption(params)');

// Fix Video Handlers
codeGs = codeGs.replace(/function handleVideoStepFB\(e\)/, 'function handleVideoStepFB(params)');
codeGs = codeGs.replace(/function handleVideoStepIG\(e\)/, 'function handleVideoStepIG(params)');
codeGs = codeGs.replace(/function handleVideoCheckIG\(e\)/, 'function handleVideoCheckIG(params)');
codeGs = codeGs.replace(/function handleVideoPublishIG\(e\)/, 'function handleVideoPublishIG(params)');

fs.writeFileSync('Code.gs', codeGs);

let scriptJs = fs.readFileSync('public/script.js', 'utf8');

// Replace processPost fetch
scriptJs = scriptJs.replace(/body: new URLSearchParams\(\{\n                'images': JSON\.stringify\(imagesDataForAI\),\n                'mimeType': 'image\/jpeg',\n                'activityInfo': activityContext,\n                'mediaMode': mediaMode\n            \}\)/, 
`body: JSON.stringify({
                'images': JSON.stringify(imagesDataForAI),
                'mimeType': 'image/jpeg',
                'activityInfo': activityContext,
                'mediaMode': mediaMode
            })`);
scriptJs = scriptJs.replace(/headers: \{ 'Content-Type': 'application\/x-www-form-urlencoded' \}/, 
`headers: { 'Content-Type': 'text/plain;charset=utf-8' }`);

// Replace confirmPublish fetch
scriptJs = scriptJs.replace(/requestBody = new URLSearchParams\(\{\n                'action': 'publishToSocial',\n                'mediaMode': 'photo',\n                'fbImages': JSON\.stringify\(processedImages\.fbImages\),\n                'igImages': JSON\.stringify\(processedImages\.igImages\),\n                'fbCaption': fbCaption,\n                'igCaption': igCaption\n            \}\);/g, 
`requestBody = JSON.stringify({
                'action': 'publishToSocial',
                'mediaMode': 'photo',
                'fbImages': JSON.stringify(processedImages.fbImages),
                'igImages': JSON.stringify(processedImages.igImages),
                'fbCaption': fbCaption,
                'igCaption': igCaption
            });`);
// There are multiple headers: { 'Content-Type': 'application/x-www-form-urlencoded' } in script.js, let's just replace all
scriptJs = scriptJs.replace(/headers: \{ 'Content-Type': 'application\/x-www-form-urlencoded' \}/g, 
`headers: { 'Content-Type': 'text/plain;charset=utf-8' }`);

// Also fix callStep inside video mode
scriptJs = scriptJs.replace(/body: new URLSearchParams\(params\)/g, `body: JSON.stringify(params)`);

fs.writeFileSync('public/script.js', scriptJs);

console.log("Patched!");
