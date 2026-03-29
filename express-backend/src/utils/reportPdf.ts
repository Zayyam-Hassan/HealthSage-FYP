import fs from 'fs';
import path from 'path';

type ReportSection = {
  heading: string;
  body: string;
};

type PageLine = {
  x: number;
  y: number;
  fontSize: number;
  text: string;
};

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars = 82) {
  const paragraphs = text
    .split('\n')
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
        }
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines.length > 0 ? lines : [''];
}

function paginateContent(title: string, sections: ReportSection[]) {
  const pages: PageLine[][] = [];
  let currentPage: PageLine[] = [];
  let y = 760;

  const startNewPage = () => {
    currentPage = [];
    pages.push(currentPage);
    y = 760;

    currentPage.push({
      x: 50,
      y,
      fontSize: 20,
      text: title,
    });
    y -= 32;
  };

  startNewPage();

  for (const section of sections) {
    if (y < 100) {
      startNewPage();
    }

    currentPage.push({
      x: 50,
      y,
      fontSize: 13,
      text: section.heading,
    });
    y -= 20;

    const lines = wrapText(section.body);
    for (const line of lines) {
      if (y < 60) {
        startNewPage();
      }

      currentPage.push({
        x: 58,
        y,
        fontSize: 11,
        text: line,
      });
      y -= 16;
    }

    y -= 8;
  }

  return pages;
}

function buildContentStream(lines: PageLine[]) {
  return lines
    .map((line) => [
      'BT',
      `/F1 ${line.fontSize} Tf`,
      `${line.x} ${line.y} Td`,
      `(${escapePdfText(line.text)}) Tj`,
      'ET',
    ].join('\n'))
    .join('\n');
}

function buildPdfBuffer(title: string, sections: ReportSection[]) {
  const pageStreams = paginateContent(title, sections).map((page) => buildContentStream(page));
  const pageCount = pageStreams.length;
  const fontObjectId = 3 + pageCount * 2;

  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';

  const kidRefs: string[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    kidRefs.push(`${pageObjectId} 0 R`);

    objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    const stream = pageStreams[index];
    objects[contentObjectId] = `<< /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${kidRefs.join(' ')}] /Count ${pageCount} >>`;
  objects[fontObjectId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: string[] = ['0000000000 65535 f '];
  let offset = Buffer.byteLength(header, 'utf8');

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const objectContent = `${objectId} 0 obj ${objects[objectId]} endobj\n`;
    offsets[objectId] = `${offset.toString().padStart(10, '0')} 00000 n `;
    body += objectContent;
    offset += Buffer.byteLength(objectContent, 'utf8');
  }

  const xrefOffset = offset;
  const xref = `xref\n0 ${objects.length}\n${offsets.join('\n')}\n`;
  const trailer = `trailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(`${header}${body}${xref}${trailer}`, 'utf8');
}

export async function writeReportPdf(
  reportId: string,
  title: string,
  sections: ReportSection[],
) {
  const reportsDir = path.join(process.cwd(), 'generated-reports');
  await fs.promises.mkdir(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, `${reportId}.pdf`);
  await fs.promises.writeFile(filePath, buildPdfBuffer(title, sections));
  return filePath;
}
