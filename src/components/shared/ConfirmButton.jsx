import { useState, useRef, useEffect } from "react";
import { COLORS } from "../../lib/colors";

export function ConfirmButton({ onConfirm, armedLabel = "Tap again to confirm", style, children, ariaLabel }) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = () => {
    if (armed) {
      clearTimeout(timerRef.current);
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 2500);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={armed ? armedLabel : ariaLabel}
      style={{
        ...style,
        background: armed ? COLORS.waste : style.background,
        color: armed ? COLORS.ink : style.color,
        borderColor: armed ? COLORS.waste : style.borderColor,
      }}
    >
      {armed ? armedLabel : children}
    </button>
  );
}
