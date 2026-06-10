const PDFDocument = require('pdfkit');

const MARGIN = 40;
const LOGO_BOX = 80;
const PAGE_FOOTER_OFFSET = 35;
const COLORS = {
  text:    '#1a1a1a',
  muted:   '#555555',
  border:  '#cccccc',
  banner:  '#f0f0f0',
  conforme:    '#1f7a1f',
  naoConforme: '#a01010',
  inconclusivo:'#7a6500',
};

const CONFORMIDADE_LABEL = {
  CONFORME:     'CONFORME',
  NAO_CONFORME: 'NÃO CONFORME',
  INCONCLUSIVO: 'INCONCLUSIVO',
};

function fmtDate(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function fmtDateShort(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function fmtDoc(documento, tipo) {
  if (!documento) return '—';
  const d = documento.replace(/\D/g, '');
  if (tipo === 'PF' && d.length === 11) {
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }
  if (tipo === 'PJ' && d.length === 14) {
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  }
  return documento;
}

function fmtReferencia(assay) {
  if (!assay) return '—';
  const { tipoComparacao, limiteMinimo, limiteMaximo, valorReferencia } = assay;
  switch (tipoComparacao) {
    case 'ENTRE':       return `entre ${limiteMinimo} e ${limiteMaximo}`;
    case 'MENOR_QUE':   return `< ${limiteMaximo}`;
    case 'MENOR_IGUAL': return `≤ ${limiteMaximo}`;
    case 'MAIOR_QUE':   return `> ${limiteMinimo}`;
    case 'MAIOR_IGUAL': return `≥ ${limiteMinimo}`;
    case 'TEXTO':       return valorReferencia || '—';
    default:            return valorReferencia || '—';
  }
}

function conformidadeColor(c) {
  if (c === 'CONFORME')     return COLORS.conforme;
  if (c === 'NAO_CONFORME') return COLORS.naoConforme;
  return COLORS.inconclusivo;
}

function drawHeader(doc, tenant) {
  const startY = doc.y;
  const logoX  = MARGIN;
  const logoY  = startY;

  doc.save();
  doc.lineWidth(1).strokeColor(COLORS.border)
     .rect(logoX, logoY, LOGO_BOX, LOGO_BOX).stroke();
  doc.fontSize(7).fillColor(COLORS.muted)
     .text('LOGO', logoX, logoY + LOGO_BOX / 2 - 4, { width: LOGO_BOX, align: 'center' });
  doc.restore();

  const textX = logoX + LOGO_BOX + 15;
  const textW = doc.page.width - textX - MARGIN;

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13)
     .text(tenant.razaoSocial || tenant.nomeFantasia || '—', textX, logoY, { width: textW });

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  if (tenant.nomeFantasia && tenant.nomeFantasia !== tenant.razaoSocial) {
    doc.text(tenant.nomeFantasia, textX, doc.y, { width: textW });
  }
  doc.text(`CNPJ: ${fmtDoc(tenant.cnpj, 'PJ')}`, textX, doc.y, { width: textW });
  if (tenant.endereco) doc.text(tenant.endereco, textX, doc.y, { width: textW });
  const contato = [tenant.email, tenant.telefone].filter(Boolean).join(' · ');
  if (contato) doc.text(contato, textX, doc.y, { width: textW });

  const headerEnd = Math.max(doc.y, logoY + LOGO_BOX);
  doc.y = headerEnd + 12;
  doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y)
     .strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.y += 12;
}

function drawIdentificacao(doc, report) {
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(15)
     .text(`LAUDO Nº ${report.numeroLaudo}`, MARGIN, doc.y, { align: 'center' });
  doc.moveDown(0.4);

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  const linha = [
    `Status: ${report.status}`,
    `Emissão: ${fmtDate(report.dataEmissao)}`,
    `Responsável: ${report.responsavel || '—'}`,
  ].join('   |   ');
  doc.text(linha, MARGIN, doc.y, { align: 'center' });
  doc.moveDown(1);
}

function drawSectionTitle(doc, title) {
  ensureRoom(doc, 28);
  const y = doc.y;
  doc.save();
  doc.rect(MARGIN, y, doc.page.width - MARGIN * 2, 16)
     .fill(COLORS.banner);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
     .text(title, MARGIN + 6, y + 3.5);
  doc.restore();
  doc.y = y + 22;
}

function drawKeyValueGrid(doc, pairs) {
  const colW = (doc.page.width - MARGIN * 2) / 2;
  let col = 0;
  let rowY = doc.y;
  const lineH = 14;

  for (const [k, v] of pairs) {
    if (v == null || v === '') continue;
    const x = MARGIN + col * colW;
    ensureRoom(doc, lineH + 2);
    if (col === 0) rowY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted)
       .text(`${k}: `, x, rowY, { continued: true, width: colW - 6 });
    doc.font('Helvetica').fillColor(COLORS.text)
       .text(String(v), { width: colW - 6 });
    col++;
    if (col === 2) {
      col = 0;
      doc.y = rowY + lineH;
    } else {
      doc.y = rowY;
    }
  }
  if (col === 1) doc.y = rowY + lineH;
  doc.moveDown(0.6);
}

function drawCliente(doc, client) {
  drawSectionTitle(doc, 'Dados do Cliente');
  drawKeyValueGrid(doc, [
    ['Nome', client.nome],
    ['Tipo', client.tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'],
    ['Documento', fmtDoc(client.documento, client.tipoPessoa)],
    ['Email', client.email],
    ['Telefone', client.telefone],
    ['Endereço', client.endereco],
  ]);
}

function drawAmostra(doc, sample) {
  drawSectionTitle(doc, 'Dados da Amostra');
  drawKeyValueGrid(doc, [
    ['Número', sample.numeroAmostra],
    ['Data coleta', fmtDateShort(sample.dataColeta)],
    ['Data recebimento', fmtDateShort(sample.dataRecebimento)],
    ['Amostrador', sample.amostrador],
    ['Ponto de coleta', sample.pontoColeta],
    ['Etiqueta', sample.etiqueta],
    ['Temp. amostra', sample.temperaturaAmostra != null ? `${sample.temperaturaAmostra} °C` : null],
    ['Temp. ambiente', sample.temperaturaAmbiente != null ? `${sample.temperaturaAmbiente} °C` : null],
    ['Umidade relativa', sample.umidadeRelativa != null ? `${sample.umidadeRelativa} %` : null],
    ['Descrição', sample.descricao],
  ]);
}

function drawEnsaios(doc, items) {
  drawSectionTitle(doc, 'Resultados dos Ensaios');

  const cols = [
    { key: 'ensaio',       label: 'Ensaio',       w: 0.32 },
    { key: 'unidade',      label: 'Unidade',      w: 0.10 },
    { key: 'referencia',   label: 'Referência',   w: 0.22 },
    { key: 'resultado',    label: 'Resultado',    w: 0.16 },
    { key: 'conformidade', label: 'Conformidade', w: 0.20 },
  ];
  const totalW = doc.page.width - MARGIN * 2;
  cols.forEach(c => { c.width = c.w * totalW; });

  drawTableRow(doc, cols, cols.map(c => c.label), { header: true });

  for (const item of items) {
    const row = [
      item.assay?.nome || '—',
      item.assay?.unidade || '—',
      fmtReferencia(item.assay),
      item.valor != null && item.valor !== '' ? item.valor : '—',
      CONFORMIDADE_LABEL[item.conformidade] || item.conformidade,
    ];
    drawTableRow(doc, cols, row, { conformidadeIdx: 4, conformidade: item.conformidade });
  }
  doc.moveDown(0.5);
}

function drawTableRow(doc, cols, values, opts = {}) {
  const rowH = computeRowHeight(doc, cols, values, opts.header);
  ensureRoom(doc, rowH + 4);

  const y0 = doc.y;
  let x = MARGIN;

  if (opts.header) {
    doc.save().rect(MARGIN, y0, doc.page.width - MARGIN * 2, rowH).fill(COLORS.banner).restore();
  }

  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    doc.save();
    doc.strokeColor(COLORS.border).lineWidth(0.5)
       .rect(x, y0, c.width, rowH).stroke();
    if (opts.header) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text);
    } else if (opts.conformidadeIdx === i) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(conformidadeColor(opts.conformidade));
    } else {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    }
    doc.text(String(values[i]), x + 4, y0 + 4, { width: c.width - 8 });
    doc.restore();
    x += c.width;
  }
  doc.y = y0 + rowH;
}

function computeRowHeight(doc, cols, values, header) {
  const font = header ? 'Helvetica-Bold' : 'Helvetica';
  let maxH = 16;
  doc.save();
  doc.font(font).fontSize(9);
  for (let i = 0; i < cols.length; i++) {
    const h = doc.heightOfString(String(values[i]), { width: cols[i].width - 8 });
    if (h + 8 > maxH) maxH = h + 8;
  }
  doc.restore();
  return maxH;
}

function drawObservacoes(doc, observacoes) {
  if (!observacoes) return;
  drawSectionTitle(doc, 'Observações');
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
     .text(observacoes, MARGIN, doc.y, { width: doc.page.width - MARGIN * 2, align: 'justify' });
  doc.moveDown(0.8);
}

function drawFooters(doc, generatedAt) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - PAGE_FOOTER_OFFSET;
    doc.save();
    doc.moveTo(MARGIN, y - 4).lineTo(doc.page.width - MARGIN, y - 4)
       .strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
    doc.text(
      'Documento sem assinatura digital — sujeito a versão definitiva.',
      MARGIN, y, { width: doc.page.width - MARGIN * 2, align: 'left' }
    );
    doc.text(
      `Gerado em ${fmtDate(generatedAt)}   ·   página ${i + 1} de ${total}`,
      MARGIN, y + 10, { width: doc.page.width - MARGIN * 2, align: 'left' }
    );
    doc.restore();
  }
}

function ensureRoom(doc, needed) {
  const limit = doc.page.height - PAGE_FOOTER_OFFSET - 10;
  if (doc.y + needed > limit) doc.addPage();
}

function renderReportPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN + 20, left: MARGIN, right: MARGIN },
      bufferPages: true,
    });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawHeader(doc, data.tenant);
      drawIdentificacao(doc, data.report);
      drawCliente(doc, data.client);
      drawAmostra(doc, data.sample);
      drawEnsaios(doc, data.items);
      drawObservacoes(doc, data.report.observacoes);
      drawFooters(doc, data.generatedAt || new Date());
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { renderReportPdf };
