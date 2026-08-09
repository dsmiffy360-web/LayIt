import { useState, useEffect } from "react";
import { COLORS } from "../../lib/colors";
import { computeJobInvoiceTotal } from "../../lib/invoiceTotal";
import { getBusinessProfile, saveBusinessProfile } from "../../lib/jobsApi";
import { resizeImageToDataUri } from "../../lib/exportUtils";
import { Field } from "../shared/Field";
import { TextField } from "../shared/TextField";
import { ConfirmButton } from "../shared/ConfirmButton";

let lineItemIdCounter = 1000;

export function InvoiceStep({ job, updateJob, jobName, clientName, setClientName }) {
  const [business, setBusiness] = useState({ name: "", contact: "", bank_details: "", logo: null });
  const [copyStatus, setCopyStatus] = useState("");
  const [logoError, setLogoError] = useState("");

  useEffect(() => {
    getBusinessProfile().then(setBusiness).catch(() => {});
  }, []);

  const updateBusiness = (patch) => {
    const next = { ...business, ...patch };
    setBusiness(next);
    saveBusinessProfile(next).catch(() => {});
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // let the same file be re-picked later if needed
    if (!file) return;
    setLogoError("");
    try {
      const dataUri = await resizeImageToDataUri(file);
      updateBusiness({ logo: dataUri });
    } catch (err) {
      setLogoError(err.message);
    }
  };

  const {
    clientAddress, invoiceNumber, invoiceDate, laborCost, taxRate, invoiceNotes,
    extraLineItems, paymentStatus, depositAmount,
  } = job;

  const { total, subtotal, tax, materials } = computeJobInvoiceTotal(job);
  const materialsAmount = materials ? materials.amount : 0;
  const laborAmount = Math.max(0, parseFloat(laborCost) || 0);
  const taxPct = Math.max(0, parseFloat(taxRate) || 0);
  const depositPaid = paymentStatus === "deposit" ? Math.max(0, parseFloat(depositAmount) || 0) : 0;
  const depositExceedsTotal = paymentStatus === "deposit" && depositPaid > total + 0.01;
  const balanceDue = paymentStatus === "paid" ? 0 : Math.max(0, total - depositPaid);

  const addLineItem = () => {
    lineItemIdCounter += 1;
    updateJob({ extraLineItems: [...extraLineItems, { id: lineItemIdCounter, desc: "", amount: "" }] });
  };
  const updateLineItem = (id, patch) => updateJob({ extraLineItems: extraLineItems.map((li) => (li.id === id ? { ...li, ...patch } : li)) });
  const removeLineItem = (id) => updateJob({ extraLineItems: extraLineItems.filter((li) => li.id !== id) });

  const buildInvoiceText = () => {
    const lines = [];
    lines.push(business.name || "Invoice");
    if (business.contact) lines.push(business.contact);
    lines.push("");
    lines.push(`Invoice #: ${invoiceNumber || "—"}`);
    lines.push(`Date: ${invoiceDate || "—"}`);
    lines.push("");
    lines.push(`Bill to: ${clientName || "—"}`);
    if (clientAddress) lines.push(clientAddress);
    lines.push("");
    lines.push(`Job: ${jobName}`);
    lines.push("");
    lines.push("Line items:");
    if (materials) lines.push(`  Materials — ${materials.bufferedPacks} ${materials.packLabel}${materials.bufferedPacks === 1 ? "" : "s"} × ${materials.price.toFixed(2)}: ${materialsAmount.toFixed(2)}`);
    if (laborAmount > 0) lines.push(`  Labor / installation: ${laborAmount.toFixed(2)}`);
    extraLineItems.forEach((li) => { if (li.desc || li.amount) lines.push(`  ${li.desc || "Line item"}: ${(parseFloat(li.amount) || 0).toFixed(2)}`); });
    lines.push("");
    lines.push(`Subtotal: ${subtotal.toFixed(2)}`);
    if (taxPct > 0) lines.push(`Tax (${taxPct}%): ${tax.toFixed(2)}`);
    lines.push(`Total: ${total.toFixed(2)}`);
    if (paymentStatus === "paid") lines.push("Status: PAID");
    else {
      if (paymentStatus === "deposit") lines.push(`Deposit received: ${depositPaid.toFixed(2)}`);
      lines.push(`Balance due: ${balanceDue.toFixed(2)}`);
    }
    if (invoiceNotes) { lines.push(""); lines.push(invoiceNotes); }
    if (business.bank_details) { lines.push(""); lines.push("Payment details:"); lines.push(business.bank_details); }
    return lines.join("\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildInvoiceText());
      setCopyStatus("Copied!");
    } catch (e) {
      setCopyStatus("Couldn't copy");
    }
    setTimeout(() => setCopyStatus(""), 2000);
  };

  return (
    <div>
      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Your business</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <TextField label="Business / your name" value={business.name} onChange={(v) => updateBusiness({ name: v })} />
          <TextField label="Contact (phone, email, or address)" value={business.contact} onChange={(v) => updateBusiness({ contact: v })} />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Bank details (for client payment)
            </span>
            <textarea
              value={business.bank_details}
              onChange={(e) => updateBusiness({ bank_details: e.target.value })}
              placeholder={"Bank name\nAccount name\nAccount / IBAN number\nSort code / routing number"}
              rows={3}
              style={{ fontFamily: "Inter", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <div>
            <span style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Logo (shown on the invoice)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              {business.logo && (
                <img src={business.logo} alt="Business logo" style={{ maxHeight: 48, maxWidth: 120, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "#FBFAF7" }} />
              )}
              <label style={{ minHeight: 40, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 14px", display: "flex", alignItems: "center" }}>
                {business.logo ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
              </label>
              {business.logo && (
                <ConfirmButton
                  onConfirm={() => updateBusiness({ logo: null })}
                  armedLabel="Remove?"
                  ariaLabel="Remove logo"
                  style={{ minHeight: 40, border: "none", background: "none", color: COLORS.wasteText, cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, padding: "0 8px" }}
                >
                  Remove
                </ConfirmButton>
              )}
            </div>
            {logoError && <p style={{ fontSize: 12, color: COLORS.wasteText, marginTop: 6, marginBottom: 0 }}>{logoError}</p>}
          </div>
        </div>
        <p style={{ fontSize: 11, color: COLORS.sub, marginTop: 10, marginBottom: 0 }}>Saved once, reused on every job's invoice.</p>
      </section>

      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Client & invoice details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <TextField label="Client name" value={clientName} onChange={setClientName} />
          <TextField label="Client address (optional)" value={clientAddress} onChange={(v) => updateJob({ clientAddress: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <TextField label="Invoice #" value={invoiceNumber} onChange={(v) => updateJob({ invoiceNumber: v })} placeholder="INV-001" />
            <TextField label="Date" value={invoiceDate} onChange={(v) => updateJob({ invoiceDate: v })} placeholder="2026-08-04" />
          </div>
        </div>
      </section>

      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Payment</div>
        <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
          {[{ id: "unpaid", label: "Unpaid", color: COLORS.waste }, { id: "deposit", label: "Deposit paid", color: COLORS.accent }, { id: "paid", label: "Paid in full", color: COLORS.reuse }].map((p) => (
            <button key={p.id} onClick={() => updateJob({ paymentStatus: p.id })} style={{ flex: 1, minHeight: 44, fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, border: "none", background: paymentStatus === p.id ? p.color : "#FBFAF7", color: paymentStatus === p.id ? COLORS.ink : COLORS.sub }}>
              {p.label}
            </button>
          ))}
        </div>
        {paymentStatus === "deposit" && <Field label="Deposit amount received" value={depositAmount} onChange={(v) => updateJob({ depositAmount: v })} step="0.01" />}
        {depositExceedsTotal && <p style={{ fontSize: 12, color: COLORS.wasteText, marginTop: 8, marginBottom: 0 }}>This deposit is more than the invoice total ({total.toFixed(2)}) — double check the amount.</p>}
      </section>

      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Extra costs</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Labor / installation (optional)" value={laborCost} onChange={(v) => updateJob({ laborCost: v })} step="0.01" />
          <Field label="Tax rate % (optional)" value={taxRate} onChange={(v) => updateJob({ taxRate: v })} step="0.1" />
        </div>
        {extraLineItems.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {extraLineItems.map((li) => (
              <div key={li.id} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 2 }}><TextField label="Description" value={li.desc} onChange={(v) => updateLineItem(li.id, { desc: v })} /></div>
                <div style={{ flex: 1 }}><Field label="Amount" value={li.amount} onChange={(v) => updateLineItem(li.id, { amount: v })} step="0.01" /></div>
                <ConfirmButton onConfirm={() => removeLineItem(li.id)} armedLabel="Remove?" ariaLabel={`Remove ${li.desc || "line item"}`} style={{ minHeight: 44, minWidth: 40, border: "none", background: "none", color: COLORS.wasteText, cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600 }}>×</ConfirmButton>
              </div>
            ))}
          </div>
        )}
        <button onClick={addLineItem} style={{ marginTop: 10, width: "100%", minHeight: 40, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, borderRadius: 7, border: `1px dashed ${COLORS.accent}`, background: "transparent", color: COLORS.accentText, cursor: "pointer" }}>
          + Add line item
        </button>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase" }}>Notes / payment terms</span>
            <textarea value={invoiceNotes} onChange={(e) => updateJob({ invoiceNotes: e.target.value })} rows={2} style={{ fontFamily: "Inter", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", width: "100%", boxSizing: "border-box", resize: "vertical" }} />
          </label>
        </div>
      </section>

      <section className="invoice-print-area" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {business.logo && <img src={business.logo} alt="" style={{ maxHeight: 44, maxWidth: 100 }} />}
            <div>
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 18 }}>{business.name || "Your business"}</div>
              {business.contact && <div style={{ fontSize: 12, color: COLORS.sub, marginTop: 2 }}>{business.contact}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: COLORS.sub }}>INVOICE {invoiceNumber || ""}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: COLORS.sub }}>{invoiceDate || ""}</div>
          </div>
        </div>
        <div style={{ borderTop: `1px dashed ${COLORS.border}`, paddingTop: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: COLORS.sub, textTransform: "uppercase", fontWeight: 600 }}>Bill to</div>
          <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginTop: 2 }}>{clientName || "—"}</div>
          {clientAddress && <div style={{ fontSize: 13, color: COLORS.sub }}>{clientAddress}</div>}
          <div style={{ fontSize: 12, color: COLORS.sub, marginTop: 4 }}>Job: {jobName}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {materials && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Materials — {materials.bufferedPacks} {materials.packLabel}{materials.bufferedPacks === 1 ? "" : "s"} × {materials.price.toFixed(2)}</span>
              <span style={{ fontFamily: "JetBrains Mono" }}>{materialsAmount.toFixed(2)}</span>
            </div>
          )}
          {laborAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Labor / installation</span><span style={{ fontFamily: "JetBrains Mono" }}>{laborAmount.toFixed(2)}</span></div>}
          {extraLineItems.filter((li) => li.desc || li.amount).map((li) => (
            <div key={li.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{li.desc || "Line item"}</span><span style={{ fontFamily: "JetBrains Mono" }}>{(parseFloat(li.amount) || 0).toFixed(2)}</span></div>
          ))}
          {!materials && laborAmount === 0 && extraLineItems.length === 0 && (
            <p style={{ fontSize: 12, color: COLORS.sub, margin: 0 }}>Add a price on Material, a labor cost above, or a line item to build the invoice.</p>
          )}
        </div>
        <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: COLORS.sub }}><span>Subtotal</span><span style={{ fontFamily: "JetBrains Mono" }}>{subtotal.toFixed(2)}</span></div>
          {taxPct > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: COLORS.sub }}><span>Tax ({taxPct}%)</span><span style={{ fontFamily: "JetBrains Mono" }}>{tax.toFixed(2)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 700, marginTop: 4, fontFamily: "Space Grotesk" }}><span>Total</span><span style={{ fontFamily: "JetBrains Mono", color: COLORS.accentText }}>{total.toFixed(2)}</span></div>
          {paymentStatus === "deposit" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: COLORS.sub }}><span>Deposit received</span><span style={{ fontFamily: "JetBrains Mono" }}>−{depositPaid.toFixed(2)}</span></div>}
          {paymentStatus === "paid" ? (
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.reuse, marginTop: 4 }}>PAID IN FULL</div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: COLORS.wasteText, marginTop: 4 }}><span>Balance due</span><span style={{ fontFamily: "JetBrains Mono" }}>{balanceDue.toFixed(2)}</span></div>
          )}
        </div>
        {invoiceNotes && <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 16, borderTop: `1px dashed ${COLORS.border}`, paddingTop: 12 }}>{invoiceNotes}</p>}
        {business.bank_details && (
          <div style={{ marginTop: 16, borderTop: `1px dashed ${COLORS.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: COLORS.sub, textTransform: "uppercase", fontWeight: 600 }}>Payment details</div>
            <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 4, marginBottom: 0, whiteSpace: "pre-line" }}>{business.bank_details}</p>
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button onClick={handleCopy} style={{ flex: 1, minHeight: 44, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, cursor: "pointer" }}>
          {copyStatus || "📋 Copy as text"}
        </button>
        <button onClick={() => window.print()} style={{ flex: 1, minHeight: 44, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`, color: COLORS.ink, cursor: "pointer" }}>
          🖨 Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
