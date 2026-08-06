// Shared design tokens — extracted unchanged from the verified prototype.
export const COLORS = {
  bg: "#EEEDE8",
  panel: "#FFFFFF",
  border: "#8D8A82",
  ink: "#1E1B16",
  sub: "#6B6559",
  blueprint: "#16283A",
  grid: "#28405A",
  chalk: "#8FB8D9",
  chalkDim: "#5D7E99",
  wood1: "#C68A4E",
  wood2: "#B4763A",
  reuse: "#6FA98A",
  waste: "#D9614F",
  accent: "#C68A4E",
  // Darker text-safe variants of the two above — wood1/waste/reuse/accent
  // read fine as backgrounds or borders, but fail WCAG AA (4.5:1) as small
  // text on a light panel. accentText and wasteText are for text only;
  // the light-background colors stay unchanged everywhere else.
  accentText: "#8A5A2E",
  wasteText: "#8A2E23",
};
