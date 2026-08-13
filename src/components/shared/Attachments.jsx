import { useState, useEffect, useRef } from "react";
import { COLORS } from "../../lib/colors";
import { uploadAttachment, getAttachmentObjectUrl, deleteAttachment } from "../../lib/attachments";

function AttachmentThumbnail({ attachment, onDelete }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    getAttachmentObjectUrl(attachment.path)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.path]);

  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${COLORS.border}`, aspectRatio: "1", background: "#FBFAF7" }}>
      {url ? (
        <img src={url} alt={attachment.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: COLORS.sub, fontFamily: "Inter", textAlign: "center", padding: 4 }}>
          {error ? "Couldn't load" : "Loading…"}
        </div>
      )}
      <span style={{ position: "absolute", left: 4, bottom: 4, fontFamily: "JetBrains Mono", fontSize: 9, fontWeight: 600, color: "#FFFFFF", background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "2px 5px" }}>
        {attachment.label}
      </span>
      <button
        onClick={() => onDelete(attachment)}
        aria-label={`Remove ${attachment.label} photo`}
        style={{ position: "absolute", top: 4, right: 4, minWidth: 22, minHeight: 22, borderRadius: 6, border: "none", background: "rgba(0,0,0,0.55)", color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 13, cursor: "pointer", lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}

// Room photos and material receipts, attached to a job — a stronger tax
// paper trail than the numbers alone, per the "next to the CSV export"
// idea this ships alongside. Metadata lives in job.attachments (autosaved
// the same way as every other job field); the actual bytes live in a
// private Storage bucket, fetched per-thumbnail since a private bucket's
// paths aren't directly renderable as an <img src>.
export function AttachmentsSection({ job, jobId, updateJob }) {
  const [uploading, setUploading] = useState(null); // "Room" | "Receipt" | null
  const [error, setError] = useState("");
  const roomInputRef = useRef(null);
  const receiptInputRef = useRef(null);
  const attachments = job.attachments || [];

  const handleFile = async (label, e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(label);
    try {
      const meta = await uploadAttachment(jobId, file, label);
      updateJob({ attachments: [...attachments, meta] });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (attachment) => {
    setError("");
    try {
      await deleteAttachment(attachment.path);
      updateJob({ attachments: attachments.filter((a) => a.id !== attachment.id) });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Attachments</div>
      <p style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, margin: "0 0 12px", lineHeight: 1.5 }}>
        Room photos and material receipts, kept with the job — a stronger paper trail than numbers alone at tax time.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: attachments.length ? 12 : 0 }}>
        <button
          onClick={() => roomInputRef.current?.click()}
          disabled={uploading !== null}
          style={{ flex: 1, minHeight: 40, borderRadius: 8, border: `1px dashed ${COLORS.accent}`, background: "transparent", color: COLORS.accentText, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {uploading === "Room" ? "Uploading…" : "+ Room photo"}
        </button>
        <button
          onClick={() => receiptInputRef.current?.click()}
          disabled={uploading !== null}
          style={{ flex: 1, minHeight: 40, borderRadius: 8, border: `1px dashed ${COLORS.accent}`, background: "transparent", color: COLORS.accentText, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {uploading === "Receipt" ? "Uploading…" : "+ Receipt"}
        </button>
        <input ref={roomInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFile("Room", e)} />
        <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFile("Receipt", e)} />
      </div>
      {error && <p style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.wasteText, margin: "0 0 12px" }}>{error}</p>}
      {attachments.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
          {attachments.map((a) => (
            <AttachmentThumbnail key={a.id} attachment={a} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </section>
  );
}
