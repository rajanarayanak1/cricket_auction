import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

function loadImageAsDataUrl(url) {
  return fetch(url)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}

function loadImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    //img.src = dataUrl;
    img.src = `${import.meta.env.VITE_API_URL}${dataUrl}`;
  });
}

// The logo is best-effort: a missing file, an SVG (jsPDF's addImage only
// accepts raster formats), or a cross-origin fetch failure should still let
// the rest of the report generate rather than blocking the whole download.
async function addTeamLogo(doc, logoPath) {
  try {
    const dataUrl = await loadImageAsDataUrl(logoPath);
    const { width, height } = await loadImageDimensions(dataUrl);
    const boxSize = 24;
    const scale = Math.min(boxSize / width, boxSize / height);
    const format = (dataUrl.match(/^data:image\/(\w+);/)?.[1] || 'PNG').toUpperCase();
    doc.addImage(dataUrl, format, 14, 12, width * scale, height * scale);
  } catch {
    // no-op — report still generates without the logo
  }
}

export async function generateTeamRosterPdf(team, players) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  if (team.logo_path) {
    await addTeamLogo(doc, team.logo_path);
  }

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(team.team_name, pageWidth / 2, 20, { align: 'center' });

  let cursorY = 40;

  if (team.owner_name) {
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const ownerLine = [`Team Owner: ${team.owner_name}`];
    if (team.owner_jersey_number) ownerLine.push(`Jersey #${team.owner_jersey_number}`);
    if (team.owner_jersey_size) ownerLine.push(`Size: ${team.owner_jersey_size}`);
    doc.text(ownerLine.join('   |   '), pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 10;
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 58, 110] },
    head: [['Player', 'Category', 'Jersey #', 'Size', 'Sleeve']],
    body: players.map((p) => [
      p.name + (p.is_captain ? ' (C)' : '') + (p.is_icon ? ' (Icon)' : ''),
      p.category,
      p.jersey_number || '-',
      p.jersey_size || '-',
      p.sleeve_type || '-'
    ])
  });

  doc.save(`${team.team_name.replace(/[^a-z0-9]+/gi, '-')}-jersey-report.pdf`);
}
