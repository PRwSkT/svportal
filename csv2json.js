const fs = require('fs');

const csv = fs.readFileSync('students_data.csv', 'utf8');
const lines = csv.split('\n');
const headers = lines[0].split(',').map(h => h.trim());

const data = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  
  // Handle commas inside quotes if any. Simple split might fail if there are commas inside fields.
  // Actually, Apple Numbers CSV export usually wraps fields with commas in quotes. Let's use a basic regex.
  const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
  const values = lines[i].split(regex).map(v => v.replace(/^"|"$/g, '').trim());
  
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = values[index] !== undefined ? values[index] : '';
  });
  data.push(obj);
}

fs.writeFileSync('students_data.json', JSON.stringify(data, null, 2));
console.log('Converted CSV to JSON. Row count:', data.length);
