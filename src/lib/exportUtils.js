// Browser-API export helpers (canvas PNG export, file download) —
// ported unchanged, no adaptation needed since they only touch the DOM.

export async function exportSvgAsPng(svgEl, filename, bgColor) {
  if (!svgEl) return;
  try {
    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    const w = (vb && vb.width) || svgEl.clientWidth || 320;
    const h = (vb && vb.height) || svgEl.clientHeight || 240;
    const scale = 2;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute("width", w * scale);
    clone.setAttribute("height", h * scale);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    // best-effort — silently skip if the environment blocks canvas export
  }
}

export function downloadTextFile(content, filename, mime = "text/plain") {
  try {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    // best-effort — ignore
  }
}

export function csvField(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
