import ExcelJS from 'exceljs';

const CATEGORIES = ['Batsman', 'Bowler', 'All Rounder'];
const CATEGORY_ALIASES = {
  batsman: 'Batsman',
  bat: 'Batsman',
  batter: 'Batsman',
  bowler: 'Bowler',
  bowl: 'Bowler',
  'all rounder': 'All Rounder',
  allrounder: 'All Rounder',
  'all-rounder': 'All Rounder',
  ar: 'All Rounder'
};

const TRUE_VALUES = ['true', 'yes', 'y', '1'];

const PHOTO_CELL_SIZE = 50;

function toBoolCell(value) {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  return TRUE_VALUES.includes(String(value).trim().toLowerCase());
}

function normalizeCategory(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  if (CATEGORIES.includes(String(value).trim())) return String(value).trim();
  return CATEGORY_ALIASES[key] || null;
}

function getCell(row, ...keys) {
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    const match = rowKeys.find((rowKey) => rowKey.trim().toLowerCase() === key.toLowerCase());
    if (match !== undefined) return row[match];
  }
  return undefined;
}

function downloadWorkbookBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Player photos are stored as WebP (or, for older ones, whatever format they
// were originally uploaded as) — but Excel's own worksheet-drawing support
// is only consistent for PNG/JPEG across desktop Excel/LibreOffice. Rather
// than gate the export on source format, every photo is rasterized through
// a canvas (the browser decodes PNG/JPEG/WebP/GIF/SVG alike) and re-encoded
// as PNG right before embedding, so any source format Just Works.
async function rasterizeToPng(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const pngBlob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Could not encode image'))), 'image/png');
  });
  return pngBlob.arrayBuffer();
}

// Best-effort: a missing file, an undecodable image, or a cross-origin fetch
// failure just leaves that row without an embedded photo rather than
// failing the whole export.
async function embedPlayerPhoto(workbook, worksheet, photoPath, rowNumber) {
  try {
    const response = await fetch(photoPath);
    if (!response.ok) return;
    const blob = await response.blob();
    const buffer = await rasterizeToPng(blob);
    const imageId = workbook.addImage({ buffer, extension: 'png' });
    worksheet.addImage(imageId, {
      tl: { col: 0, row: rowNumber - 1 },
      ext: { width: PHOTO_CELL_SIZE, height: PHOTO_CELL_SIZE },
      editAs: 'oneCell'
    });
  } catch {
    // no-op — export still proceeds without this player's photo
  }
}

export async function exportPlayersToExcel(players, roomName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Players');

  worksheet.columns = [
    { header: 'Photo', key: 'photo', width: 10 },
    { header: 'Player Name', key: 'name', width: 24 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'Base Value', key: 'base_value', width: 12 },
    { header: 'Captain', key: 'captain', width: 9 },
    { header: 'Icon Player', key: 'icon', width: 12 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Sold Price', key: 'sold_price', width: 12 }
  ];

  players.forEach((p) => {
    worksheet.addRow({
      name: p.name,
      category: p.category,
      base_value: Number(p.base_value),
      captain: p.is_captain ? 'Yes' : 'No',
      icon: p.is_icon ? 'Yes' : 'No',
      status: p.team_id ? 'Sold' : p.auction_status === 'unsold' ? 'Unsold' : 'Pending',
      sold_price: p.sold_price != null ? Number(p.sold_price) : ''
    });
  });

  players.forEach((_, i) => {
    worksheet.getRow(i + 2).height = PHOTO_CELL_SIZE * 0.8;
  });

  await Promise.all(
    players.map((p, i) => (p.photo_path ? embedPlayerPhoto(workbook, worksheet, p.photo_path, i + 2) : null))
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = (roomName || 'players').replace(/[^a-z0-9]+/gi, '-');
  downloadWorkbookBuffer(buffer, `${safeName}-players.xlsx`);
}

export async function parsePlayersExcelFile(file) {
  let workbook;
  try {
    const arrayBuffer = await file.arrayBuffer();
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
  } catch (err) {
    throw new Error('Could not read the file — make sure it is a valid .xlsx or .xls file.');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('The file has no sheets.');
  }

  const headerByColumn = {};
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headerByColumn[colNumber] = String(cell.value ?? '').trim();
  });

  const photoByRow = {};
  worksheet.getImages().forEach((image) => {
    const media = workbook.getImage(image.imageId);
    if (media?.buffer) {
      const anchorRow = Math.round(image.range.tl.nativeRow) + 1;
      photoByRow[anchorRow] = media;
    }
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const rowData = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headerByColumn[colNumber];
      if (header) rowData[header] = cell.value;
    });
    rows.push({ rowNumber, rowData, photo: photoByRow[rowNumber] || null });
  });

  return rows;
}

// A row without an embedded image can still name a photo via plain URL text
// in the Photo column, or an actual Excel hyperlink over that cell.
function extractPhotoUrl(row) {
  const cellValue = getCell(row, 'Photo');
  if (!cellValue) return null;
  if (typeof cellValue === 'string') {
    const trimmed = cellValue.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  }
  if (typeof cellValue === 'object' && typeof cellValue.hyperlink === 'string') {
    return cellValue.hyperlink;
  }
  return null;
}

/** Maps one parsed spreadsheet row to a validated player payload, or a list of errors. */
export function mapImportRow({ rowNumber, rowData, photo }) {
  const row = rowData;
  const name = getCell(row, 'Player Name', 'Name');
  const categoryRaw = getCell(row, 'Category');
  const baseValueRaw = getCell(row, 'Base Value', 'BaseValue');
  const captainRaw = getCell(row, 'Captain', 'Is Captain');
  const iconRaw = getCell(row, 'Icon Player', 'Icon', 'Is Icon');

  const errors = [];

  const trimmedName = name != null ? String(name).trim() : '';
  if (!trimmedName) errors.push('missing Player Name');

  const category = normalizeCategory(categoryRaw);
  if (!category) {
    errors.push(`Category must be one of ${CATEGORIES.join(', ')} (got "${categoryRaw ?? ''}")`);
  }

  let baseValue = Number(baseValueRaw);
  if (baseValueRaw === '' || baseValueRaw == null || Number.isNaN(baseValue) || baseValue < 0) {
    baseValue = 1000;
  }

  if (errors.length > 0) {
    return { rowNumber, errors };
  }

  return {
    rowNumber,
    data: {
      name: trimmedName,
      category,
      base_value: baseValue,
      is_captain: toBoolCell(captainRaw),
      is_icon: toBoolCell(iconRaw),
      photo,
      photoUrl: photo ? null : extractPhotoUrl(row)
    }
  };
}
