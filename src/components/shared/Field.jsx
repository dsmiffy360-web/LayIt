import { COLORS } from "../../lib/colors";

export function Field({ label, value, onChange, step = "0.1" }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: "JetBrains Mono",
          fontSize: 16,
          padding: "12px 12px",
          minHeight: 44,
          borderRadius: 8,
          border: `1px solid ${COLORS.border}`,
          background: "#FBFAF7",
          color: COLORS.ink,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
    </label>
  );
}
