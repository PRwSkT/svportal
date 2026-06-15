export function exportToCSV(filename: string, headers: string[], rows: any[][]) {
  // Add UTF-8 BOM so Excel opens it correctly with Thai characters
  const BOM = '\uFEFF';
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => {
        // Handle quotes, commas, and newlines in CSV cells
        const cellStr = cell === null || cell === undefined ? '' : String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
