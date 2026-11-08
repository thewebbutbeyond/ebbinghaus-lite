// Lucide 0.575.0, the same version as the original app. See public/LUCIDE-LICENSE.txt.
const paths = {
  brain: [
    "M12 18V5",
    "M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4",
    "M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5",
    "M17.997 5.125a4 4 0 0 1 2.526 5.77",
    "M18 18a4 4 0 0 0 2-7.464",
    "M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517",
    "M6 18a4 4 0 0 1-2-7.464",
    "M6.003 5.125a4 4 0 0 0-2.526 5.77",
  ],
  arrowLeft: ["m12 19-7-7 7-7", "M19 12H5"],
  arrowRight: ["m12 5 7 7-7 7", "M5 12h14"],
  // Simple playback and attack symbols drawn for Lite, using the shared SVG style.
  stepBack: ["M6 4v16", "m18 4-12 8 12 8Z"],
  stepForward: ["M18 4v16", "m6 4 12 8-12 8Z"],
  play: ["m8 5 11 7-11 7Z"],
  pause: ["M9 5v14", "M15 5v14"],
  stop: ["M6 6h12v12H6Z"],
  swords: ["m4 3 3 1 12 12-3 3L4 7Z", "m3 21 5-5", "m3 14 7 7",
    "m14 8 6-5 1 4-5 6", "m16 16 5 5", "m14 21 7-7"],
  arrowUpRight: ["M7 7h10v10", "M7 17 17 7"],
  chevronRight: ["m9 18 6-6-6-6"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
  upload: ["M12 3v12", "m17 8-5-5-5 5", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
  home: ["M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  restart: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  undo: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"],
} as const;

export type IconName = keyof typeof paths;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [attribute, value] of Object.entries({
    class: "icon", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", "stroke-width": name === "brain" ? "2.2" : "2",
    "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false",
  })) svg.setAttribute(attribute, value);
  for (const d of paths[name]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
