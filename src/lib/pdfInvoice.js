import jsPDF from "jspdf";
import { formatMoney } from "./currency";

// Builds an actual PDF (real text, not a screenshot of the page) so the
// layout is deliberate and consistent across devices, instead of hoping
// each browser's print CSS behaves. Mirrors the same fields as the
// on-screen invoice preview and "Copy as text" in InvoiceStep.jsx — keep
// those three in sync if the invoice shape ever changes.
export function generateInvoicePdf({
  business, invoiceNumber, invoiceDate, clientName, clientAddress, jobName,
  materials, materialsAmount, laborAmount, extraLineItems,
  subtotal, taxPct, tax, total, paymentStatus, depositPaid, balanceDue,
  invoiceNotes, filename,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 20;
  const rightX = 210 - marginX;
  let y = 24;
  const money = (amount) => formatMoney(amount, business.currency);

  const line = (label, amount, opts = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size || 10);
    doc.text(label, marginX, y);
    doc.text(amount, rightX, y, { align: "right" });
    y += opts.gap || 6;
  };
  const rule = (color = 210) => {
    doc.setDrawColor(color);
    doc.line(marginX, y, rightX, y);
    y += 8;
  };

  // Header — logo (if any) + business name/contact on the left,
  // invoice number/date on the right.
  let textX = marginX;
  if (business.logo) {
    try {
      const img = doc.getImageProperties(business.logo);
      const w = 26;
      const h = (img.height / img.width) * w;
      doc.addImage(business.logo, img.fileType, marginX, y - 6, w, h);
      textX = marginX + w + 6;
    } catch {
      // skip the logo if the stored data URI can't be decoded — the rest
      // of the invoice still renders fine without it
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(business.name || "Your business", textX, y);
  if (business.contact) {
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(business.contact, textX, y);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`INVOICE ${invoiceNumber || ""}`.trim(), rightX, 24, { align: "right" });
  doc.text(invoiceDate || "", rightX, 30, { align: "right" });

  y = Math.max(y, 30) + 10;
  rule();

  // Bill to
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text("BILL TO", marginX, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(clientName || "—", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (clientAddress) {
    y += 5;
    doc.text(clientAddress, marginX, y);
  }
  y += 5;
  doc.text(`Job: ${jobName}`, marginX, y);
  y += 10;

  // Line items
  doc.setTextColor(20);
  const visibleExtras = extraLineItems.filter((li) => li.desc || li.amount);
  if (materials) {
    line(
      `Materials — ${materials.bufferedPacks} ${materials.packLabel}${materials.bufferedPacks === 1 ? "" : "s"} × ${money(materials.price)}`,
      money(materialsAmount)
    );
  }
  if (laborAmount > 0) line("Labor / installation", money(laborAmount));
  visibleExtras.forEach((li) => line(li.desc || "Line item", money(parseFloat(li.amount) || 0)));
  if (!materials && laborAmount === 0 && visibleExtras.length === 0) {
    doc.setTextColor(140);
    doc.text("No line items.", marginX, y);
    y += 6;
  }

  y += 2;
  rule();

  doc.setTextColor(90);
  line("Subtotal", money(subtotal));
  if (taxPct > 0) line(`Tax (${taxPct}%)`, money(tax));

  y += 2;
  doc.setTextColor(20);
  line("Total", money(total), { bold: true, size: 14, gap: 8 });

  if (paymentStatus === "deposit") {
    doc.setTextColor(90);
    line("Deposit received", `−${money(depositPaid)}`);
  }
  if (paymentStatus === "paid") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 140, 90);
    doc.text("PAID IN FULL", marginX, y);
    y += 8;
  } else {
    doc.setTextColor(180, 60, 50);
    line("Balance due", money(balanceDue), { bold: true, gap: 8 });
  }

  if (invoiceNotes) {
    y += 2;
    rule(225);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    const noteLines = doc.splitTextToSize(invoiceNotes, rightX - marginX);
    doc.text(noteLines, marginX, y);
    y += noteLines.length * 4.5 + 4;
  }

  if (business.bank_details) {
    y += 2;
    rule(225);
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text("PAYMENT DETAILS", marginX, y);
    y += 5;
    doc.setTextColor(90);
    const bankLines = doc.splitTextToSize(business.bank_details, rightX - marginX);
    doc.text(bankLines, marginX, y);
  }

  doc.save(filename);
}
