import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const money = (value) => `Rs. ${new Intl.NumberFormat('en-IN').format(Number(value) || 0)}`;
const PHOTO_CELL_SIZE = 14; // mm

// Player photos are stored as WebP — jsPDF's own image decoder isn't
// guaranteed to handle every source format reliably, so each photo is
// rasterized through a canvas (the browser decodes WebP/PNG/JPEG/GIF alike)
// and re-encoded as a PNG data URL before being embedded, the same technique
// already used for the player-photo Excel export. Best-effort: a missing
// file or a decode failure just leaves that row without a photo.
async function loadPhotoAsPng(photoPath) {
  try {
    const response = await fetch(photoPath);
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), width: bitmap.width, height: bitmap.height };
  } catch {
    return null;
  }
}

// "Pool players" = anyone not yet sold to a team — mirrors the same
// team_id-based definition generateAuctionPdf uses for "who's on a roster",
// just inverted, rather than trusting auction_status alone (a player could
// in principle be marked 'unsold' but still carry no team_id either way).
export async function generatePoolPlayersPdf(room, players) {
  const poolPlayers = players.filter((p) => !p.team_id);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(room.name, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(
    `Pool Players — ${poolPlayers.length} remaining  |  Auction Date: ${new Date(room.auction_date).toLocaleDateString()}`,
    pageWidth / 2,
    26,
    { align: 'center' }
  );

  if (poolPlayers.length === 0) {
    doc.setFontSize(11);
    doc.text('No players remaining in the pool.', pageWidth / 2, 40, { align: 'center' });
    doc.save(`${room.name.replace(/[^a-z0-9]+/gi, '-')}-pool-players.pdf`);
    return;
  }

  // Pre-fetch every photo up front — autoTable's cell-drawing hooks run
  // synchronously while the table is being laid out, so all image data must
  // already be in hand before that starts.
  const photosByPlayerId = new Map();
  await Promise.all(
    poolPlayers.map(async (p) => {
      if (!p.photo_path) return;
      const photo = await loadPhotoAsPng(p.photo_path);
      if (photo) photosByPlayerId.set(p.id, photo);
    })
  );

  autoTable(doc, {
    startY: 36,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, minCellHeight: PHOTO_CELL_SIZE + 2, valign: 'middle' },
    headStyles: { fillColor: [30, 58, 110] },
    columnStyles: { 0: { cellWidth: PHOTO_CELL_SIZE + 4 } },
    head: [['Photo', 'Player', 'Category', 'Base Value', 'Status']],
    body: poolPlayers.map((p) => [
      '',
      p.name + (p.is_captain ? ' (C)' : '') + (p.is_icon ? ' (Icon)' : ''),
      p.category,
      money(p.base_value),
      p.auction_status === 'unsold' ? 'Unsold' : 'Pending'
    ]),
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      // When a row is split across a page break, autoTable draws its
      // overflow portion via a synthetic "remainder" row with index -1 —
      // there's no corresponding poolPlayers entry for that draw call, and
      // the row's main portion (with a valid index) already drew the photo.
      const player = poolPlayers[data.row.index];
      if (!player) return;
      const photo = photosByPlayerId.get(player.id);
      if (!photo) return;

      const scale = Math.min(PHOTO_CELL_SIZE / photo.width, PHOTO_CELL_SIZE / photo.height);
      const w = photo.width * scale;
      const h = photo.height * scale;
      const x = data.cell.x + (data.cell.width - w) / 2;
      const y = data.cell.y + (data.cell.height - h) / 2;
      doc.addImage(photo.dataUrl, 'PNG', x, y, w, h);
    }
  });

  doc.save(`${room.name.replace(/[^a-z0-9]+/gi, '-')}-pool-players.pdf`);
}
