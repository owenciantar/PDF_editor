import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportToPDF(element: HTMLElement, fileName: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const imgWidthMm = 210; // A4 width
  const pageHeightMm = 297; // A4 height
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let remaining = imgHeightMm;
  let offsetMm = 0;

  // First page
  pdf.addImage(imgData, 'JPEG', 0, offsetMm, imgWidthMm, imgHeightMm);
  remaining -= pageHeightMm;

  // Additional pages if content overflows
  while (remaining > 0) {
    offsetMm -= pageHeightMm;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, offsetMm, imgWidthMm, imgHeightMm);
    remaining -= pageHeightMm;
  }

  // Strip path-traversal characters and anything outside safe filename chars
  const safeName = (fileName || 'document')
    .replace(/[/\\:*?"<>|]/g, '_')  // Windows + Unix reserved chars
    .replace(/\.{2,}/g, '_')         // collapse .. sequences
    .replace(/^[. ]+|[. ]+$/g, '')  // strip leading/trailing dots and spaces
    .slice(0, 200)                    // cap length
    || 'document';
  pdf.save(`${safeName}.pdf`);
}
