function thaiToArabic(str) {
  if (!str) return str;
  const thaiNums = ['๐','๑','๒','๓','๔','๕','๖','๗','๘','๙'];
  return str.split('').map(char => {
    const idx = thaiNums.indexOf(char);
    return idx !== -1 ? idx.toString() : char;
  }).join('');
}
console.log(thaiToArabic('๑๒๑๙๙๐๑๙๐๕๙๒๐'));
