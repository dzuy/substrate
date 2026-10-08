import { reportSectionLabel } from "../shared/report-section-labels.mjs";
import { clarifyReport } from "../shared/report-clarifications.mjs";
import PDFDocument from "pdfkit";

const color = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(v || "") ? v : fallback);
const plain = (v) =>
  String(v || "")
    .replaceAll("→", " > ")
    .replaceAll("™", "")
    .replace(/[\u2011\u2013\u2014]/g, "-");
export function renderReportPdf(report, theme = {}) {
  report = clarifyReport(report);
  return new Promise((resolve, reject) => {
    const navy = color(theme.ink, "#102F3C"),
      gold = color(theme.gold, "#AA8248"),
      ivory = color(theme.paper, "#F6F3EC");
    const doc = new PDFDocument({
      size: "A4",
      margin: 52,
      bufferPages: true,
      info: {
        Title: "Substrate Skin Intelligence Report",
        Author: "Substrate",
      },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const serif = theme.headingFont === "sans" ? "Helvetica" : "Times-Roman";
    const bodyFont = theme.bodyFont === "serif" ? "Times-Roman" : "Helvetica";
    const top = () => {
      doc
        .fillColor(navy)
        .font("Times-Roman")
        .fontSize(23)
        .text("Substrate", 52, 35);
      doc
        .strokeColor(gold)
        .lineWidth(0.7)
        .moveTo(52, 72)
        .lineTo(543, 72)
        .stroke();
      doc.y = 98;
    };
    doc.rect(0, 0, 596, 842).fill(ivory);
    top();
    doc
      .fillColor(gold)
      .font("Helvetica")
      .fontSize(10)
      .text("PERSONAL SKIN INTELLIGENCE", 52, 123, { characterSpacing: 2 });
    doc
      .fillColor(navy)
      .font(serif)
      .fontSize(43)
      .text("Your skin.\nA clearer direction.", 52, 158, { width: 480 });
    doc
      .font(bodyFont)
      .fontSize(14)
      .text(
        `${plain(report.name)} · ${new Date(report.createdAt).toISOString().slice(0, 10)}`,
        52,
        290,
      );
    let summaryY = 340;
    if (/^data:image\/jpeg;base64,/.test(report.photo || "")) {
      try {
        doc.image(Buffer.from(report.photo.split(",")[1], "base64"), 52, 335, {
          fit: [150, 190],
          align: "center",
          valign: "center",
        });
        summaryY = 555;
      } catch {
        /* Image is optional; observations remain intact. */
      }
    }
    doc
      .font(bodyFont)
      .fontSize(12)
      .text(plain(report.summary), 52, summaryY, { width: 490, lineGap: 5 });
    for (const [index, section] of report.sections.entries()) {
      doc.addPage();
      top();
      const heading = (continued = false) => {
        doc
          .fillColor(gold)
          .font("Helvetica")
          .fontSize(9)
          .text(
            `${reportSectionLabel(section, index).toUpperCase()}${continued ? " / CONTINUED" : ""}`,
          );
        doc
          .moveDown(0.7)
          .fillColor(navy)
          .font(serif)
          .fontSize(29)
          .text(plain(section.title), { width: 490 });
        doc
          .moveDown(0.45)
          .font(bodyFont)
          .fontSize(11)
          .text(plain(section.intro), { width: 490, lineGap: 3 });
        doc.moveDown(1.2);
      };
      heading();
      for (const entry of section.items) {
        const label = plain(entry.label),
          body = plain(
            [
              entry.body,
              ...(entry.clarifications || []).map(
                (note) => `${note.label}: ${note.body}`,
              ),
            ].join("\n\n"),
          ),
          detail = plain(entry.detail);
        doc.font(bodyFont).fontSize(11);
        const height =
          doc.heightOfString(body + (detail ? "\n" + detail : ""), {
            width: 490,
            lineGap: 3,
          }) +
          doc
            .font("Helvetica-Bold")
            .fontSize(12)
            .heightOfString(label, { width: 490 }) +
          65;
        if (doc.y + height > 755 && doc.y > 235) {
          doc.addPage();
          top();
          heading(true);
        }
        doc
          .fillColor(navy)
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(label, { width: 490 });
        if (entry.evidence)
          doc
            .moveDown(0.3)
            .fillColor(gold)
            .font("Helvetica")
            .fontSize(9)
            .text(plain(entry.evidence).toUpperCase());
        doc
          .moveDown(0.5)
          .fillColor(navy)
          .font(bodyFont)
          .fontSize(11)
          .text(body, { width: 490, lineGap: 3 });
        if (detail)
          doc
            .moveDown(0.5)
            .fillColor("#5F6C70")
            .fontSize(10)
            .text(detail, { width: 490, lineGap: 3 });
        if (/^https:\/\//.test(entry.sourceUrl || ""))
          doc
            .moveDown(0.4)
            .fillColor(navy)
            .fontSize(9)
            .text("View source", { link: entry.sourceUrl, underline: true });
        doc.moveDown(1.4);
      }
    }
    doc.addPage();
    top();
    doc.fillColor(navy).font(serif).fontSize(29).text("About this report");
    doc
      .moveDown()
      .font(bodyFont)
      .fontSize(11)
      .text(
        "A personal baseline, not a diagnosis. Photo analysis and ingredient relationships have limitations. This report preserves the evidence and catalog versions used at generation; it does not claim later updates have been incorporated.",
        { lineGap: 4 },
      );
    doc
      .moveDown()
      .text(plain(report.photoLimitations.join("\n")), { lineGap: 4 });
    doc
      .moveDown()
      .text(
        "This PDF contains personal information; share it only with people you choose.",
      );
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor("#647177")
        .font("Helvetica")
        .fontSize(8)
        .text(
          `SUBSTRATE / PRIVATE REPORT                                  ${i + 1} / ${range.count}`,
          52,
          793,
          { lineBreak: false },
        );
    }
    doc.end();
  });
}
const titleCase = (s) =>
  s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
