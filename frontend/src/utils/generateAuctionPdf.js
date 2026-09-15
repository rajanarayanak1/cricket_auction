import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const money = (value) => `Rs. ${new Intl.NumberFormat('en-IN').format(Number(value) || 0)}`;

export function generateAuctionPdf(room, teams, players) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(room.name, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(
    `Auction Date: ${new Date(room.auction_date).toLocaleDateString()}  |  Purse per team: ${money(room.purse_value)}`,
    pageWidth / 2,
    26,
    { align: 'center' }
  );

  let cursorY = 36;

  teams.forEach((team) => {
    const roster = players.filter((p) => p.team_id === team.id);
    const spent = Number(room.purse_value) - Number(team.purse_remaining);

    if (cursorY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(team.team_name, 14, cursorY);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(
      `${roster.length}/${team.num_players} players  |  Spent: ${money(spent)}  |  Remaining purse: ${money(team.purse_remaining)}`,
      14,
      cursorY + 6
    );

    cursorY += 10;

    if (roster.length === 0) {
      doc.setFontSize(10);
      doc.text('No players purchased.', 14, cursorY + 4);
      cursorY += 14;
      return;
    }

    autoTable(doc, {
      startY: cursorY,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 110] },
      head: [['Player', 'Category', 'Sold Price', 'Jersey #', 'Size', 'Sleeve']],
      body: roster.map((p) => [
        p.name + (p.is_captain ? ' (C)' : '') + (p.is_icon ? ' (Icon)' : ''),
        p.category,
        money(p.sold_price),
        p.jersey_number || '-',
        p.jersey_size || '-',
        p.sleeve_type || '-'
      ]),
      didDrawPage: (data) => {
        cursorY = data.cursor.y + 12;
      }
    });
  });

  doc.save(`${room.name.replace(/[^a-z0-9]+/gi, '-')}-auction-results.pdf`);
}
