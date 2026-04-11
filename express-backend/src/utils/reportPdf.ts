import PDFDocument from 'pdfkit';

type ReportSection = {
  heading: string;
  body: string;
};

function toParagraphs(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function buildPdfBuffer(title: string, sections: ReportSection[]) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      bufferPages: true,
      info: {
        Title: title,
        Author: 'HealthSage Assistant',
        Subject: 'Patient care report',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;

    doc
      .fillColor('#E66A6A')
      .roundedRect(left, 42, contentWidth, 70, 12)
      .fill();

    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(19)
      .text(title, left + 16, 58, { width: contentWidth - 32, align: 'left' })
      .font('Helvetica')
      .fontSize(10)
      .text(`Generated on ${new Date().toLocaleString()}`, left + 16, 86, {
        width: contentWidth - 32,
      });

    doc.moveDown(5);

    sections.forEach((section, index) => {
      if (doc.y > doc.page.height - 130) {
        doc.addPage();
      }

      doc
        .fillColor('#E66A6A')
        .roundedRect(left, doc.y, contentWidth, 24, 8)
        .fill();

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(section.heading, left + 12, doc.y + 7, {
          width: contentWidth - 24,
          lineBreak: false,
        });

      doc.y += 32;

      const paragraphs = toParagraphs(section.body);
      if (paragraphs.length === 0) {
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(11)
          .text('No additional details provided.', left + 8, doc.y, {
            width: contentWidth - 16,
            lineGap: 2,
          });
      } else {
        paragraphs.forEach((paragraph) => {
          const isBullet = /^[-*]\s+/.test(paragraph) || /^•\s+/.test(paragraph);
          if (isBullet) {
            const bulletText = paragraph.replace(/^[-*•]\s+/, '').trim();
            doc
              .fillColor('#0F172A')
              .font('Helvetica')
              .fontSize(11)
              .text('•', left + 10, doc.y, { continued: true })
              .text(` ${bulletText}`, {
                width: contentWidth - 30,
                align: 'left',
                lineGap: 2,
              });
          } else {
            doc
              .fillColor('#0F172A')
              .font('Helvetica')
              .fontSize(11)
              .text(paragraph, left + 8, doc.y, {
                width: contentWidth - 16,
                align: 'justify',
                lineGap: 2,
              });
          }
          doc.moveDown(0.4);
        });
      }

      if (index < sections.length - 1) {
        doc.moveDown(0.8);
      }
    });

    const pageCount = doc.bufferedPageRange().count;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(9)
        .text(`Page ${pageIndex + 1} of ${pageCount}`, left, doc.page.height - 34, {
          width: contentWidth,
          align: 'right',
        });
    }

    doc.end();
  });
}

export async function buildReportPdfBuffer(
  _reportId: string,
  title: string,
  sections: ReportSection[],
) {
  return buildPdfBuffer(title, sections);
}
