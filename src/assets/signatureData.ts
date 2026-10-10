// Authentic high-resolution Official Seal & Signature matching Picture2.jpg and image.png
// Mainetti Packaging Bangladesh Pvt. Ltd. Rubber Stamp (Deep Violet Ink) + Pen Signature (Blue-Black Ink)

const SEAL_SIGNATURE_STORAGE_KEY = 'mainetti_declaration_signature';

/**
 * Returns an authentic canvas-rendered transparent PNG data URL of:
 * 1. Deep violet rubber stamp: "Mainetti Packaging Bangladesh Pvt. Ltd."
 * 2. Authentic handwritten pen signature slashing across the stamp with upward flourish
 */
export const getDefaultSealSignatureDataUrl = (): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  // 2x Retina resolution for ultra-sharp high-DPI rendering when enlarged
  canvas.width = 920;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(2, 2);

  // -------------------------------------------------------------
  // 1. OFFICIAL RUBBER STAMP (Deep Violet / Purple Stamp Ink)
  // -------------------------------------------------------------
  const stampColor = '#2d2b78'; // Authentic rubber stamp violet ink
  ctx.save();

  // Stamp is placed with a subtle authentic realistic angle (~ -2 degrees)
  ctx.translate(230, 95);
  ctx.rotate(-0.035);
  ctx.translate(-230, -95);

  // Stamp Outer Border (Rounded Rectangle Frame)
  ctx.strokeStyle = stampColor;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.88;

  const bx = 45;
  const by = 28;
  const bw = 370;
  const bh = 120;
  const radius = 10;

  // Draw rounded stamp box
  ctx.beginPath();
  ctx.moveTo(bx + radius, by);
  ctx.lineTo(bx + bw - radius, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
  ctx.lineTo(bx + bw, by + bh - radius);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
  ctx.lineTo(bx + radius, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
  ctx.lineTo(bx, by + radius);
  ctx.quadraticCurveTo(bx, by, bx + radius, by);
  ctx.closePath();
  ctx.stroke();

  // Thin inner border line for authentic official company seal
  ctx.lineWidth = 1.0;
  ctx.globalAlpha = 0.65;
  const ibx = bx + 4;
  const iby = by + 4;
  const ibw = bw - 8;
  const ibh = bh - 8;
  ctx.strokeRect(ibx, iby, ibw, ibh);

  // Stamp Text: MAINETTI PACKAGING BANGLADESH PVT. LTD.
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = stampColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Company Name - Bold Stamp Font
  ctx.font = 'bold 17px "Arial Black", "Arial", sans-serif';
  ctx.fillText('Mainetti Packaging Bangladesh Pvt. Ltd.', 230, 62);

  // Decorative rubber stamp divider dots or stars
  ctx.font = '11px Arial, sans-serif';
  ctx.globalAlpha = 0.75;
  ctx.fillText('★   ★   ★', 230, 85);

  // Stamp designation / authority footer inside the stamp
  ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText('AUTHORIZED SIGNATORY', 230, 112);

  // Subtle natural rubber stamp texture stipples
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = stampColor;
  for (let i = 0; i < 45; i++) {
    const rx = bx + 10 + Math.random() * (bw - 20);
    const ry = by + 8 + Math.random() * (bh - 16);
    ctx.fillRect(rx, ry, 1.5, 1.5);
  }

  ctx.restore();

  // -------------------------------------------------------------
  // 2. AUTHENTIC HANDWRITTEN PEN SIGNATURE (Blue-Black Ink)
  // Matching Picture2.jpg with sharp upward slash and dynamic loops
  // -------------------------------------------------------------
  ctx.save();
  const inkColor = '#0f244a'; // Deep ballpoint / fountain pen blue-black ink
  ctx.strokeStyle = inkColor;
  ctx.fillStyle = inkColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.96;

  // Stroke 1: High flourish loop and descent
  ctx.beginPath();
  ctx.lineWidth = 3.6;
  ctx.moveTo(170, 25);
  ctx.bezierCurveTo(155, 38, 140, 75, 128, 115);
  ctx.bezierCurveTo(120, 138, 105, 168, 88, 178);
  ctx.bezierCurveTo(80, 182, 74, 180, 78, 166);
  ctx.bezierCurveTo(86, 138, 112, 92, 146, 56);
  ctx.bezierCurveTo(168, 30, 196, 22, 204, 34);
  ctx.bezierCurveTo(210, 44, 192, 85, 174, 128);
  ctx.stroke();

  // Stroke 2: Center cursive loops across the text
  ctx.beginPath();
  ctx.lineWidth = 3.2;
  ctx.moveTo(102, 92);
  ctx.bezierCurveTo(122, 68, 175, 58, 215, 68);
  ctx.bezierCurveTo(242, 76, 250, 102, 224, 122);
  ctx.bezierCurveTo(202, 138, 165, 146, 135, 142);
  ctx.bezierCurveTo(115, 138, 100, 125, 108, 105);
  ctx.bezierCurveTo(116, 85, 148, 74, 182, 78);
  ctx.bezierCurveTo(210, 80, 235, 96, 225, 122);
  ctx.stroke();

  // Stroke 3: Sharp upward-slanted slash (Key signature characteristic from Picture2.jpg)
  ctx.beginPath();
  ctx.lineWidth = 4.2;
  ctx.moveTo(85, 155);
  ctx.bezierCurveTo(145, 125, 230, 85, 310, 38);
  ctx.stroke();

  // Secondary slash & sharp cut
  ctx.beginPath();
  ctx.lineWidth = 3.0;
  ctx.moveTo(140, 138);
  ctx.lineTo(290, 82);
  ctx.stroke();

  // Stroke 4: Vertical anchor stems
  ctx.beginPath();
  ctx.lineWidth = 3.4;
  ctx.moveTo(138, 62);
  ctx.lineTo(158, 165);
  ctx.moveTo(196, 56);
  ctx.lineTo(214, 158);
  ctx.stroke();

  // Stroke 5: Long sweeping underline flourish
  ctx.beginPath();
  ctx.lineWidth = 3.2;
  ctx.moveTo(80, 172);
  ctx.bezierCurveTo(135, 160, 210, 145, 300, 136);
  ctx.bezierCurveTo(325, 134, 345, 140, 332, 150);
  ctx.bezierCurveTo(320, 158, 290, 162, 260, 158);
  ctx.stroke();

  ctx.restore();

  return canvas.toDataURL('image/png');
};

// Storage retrieval helper: returns saved signature or the authentic default seal & signature
export const getMainettiSealSignature = (): string => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('mainetti_declaration_signature_v2');
    if (saved && saved.startsWith('data:image')) {
      return saved;
    }
  }
  return getDefaultSealSignatureDataUrl();
};

export const saveMainettiSealSignature = (dataUrl: string): void => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('mainetti_declaration_signature_v2', dataUrl);
      localStorage.setItem('mainetti_declaration_signature', dataUrl);
    } catch (e) {
      console.warn('Could not save seal & signature to localStorage:', e);
    }
  }
};

export const resetMainettiSealSignature = (): string => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('mainetti_declaration_signature_v2');
      localStorage.removeItem('mainetti_declaration_signature');
    } catch {}
  }
  return getDefaultSealSignatureDataUrl();
};

// Backwards-compatible aliases
export const getSignatureDataUrl = getDefaultSealSignatureDataUrl;
export const SIGNATURE_SVG = `
<svg viewBox="0 0 460 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
  <!-- Rubber Stamp (Mainetti Packaging Bangladesh Pvt. Ltd.) in Deep Violet -->
  <g transform="rotate(-2 230 95)" stroke="#2d2b78" fill="#2d2b78">
    <rect x="45" y="28" width="370" height="120" rx="10" stroke-width="2.4" fill="none" opacity="0.88" />
    <rect x="49" y="32" width="362" height="112" rx="7" stroke-width="1.0" fill="none" opacity="0.6" />
    <text x="230" y="65" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="16" text-anchor="middle" stroke="none">Mainetti Packaging Bangladesh Pvt. Ltd.</text>
    <text x="230" y="86" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" stroke="none" opacity="0.75">★   ★   ★</text>
    <text x="230" y="114" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="12" text-anchor="middle" stroke="none" opacity="0.88">AUTHORIZED SIGNATORY</text>
  </g>

  <!-- Handwritten Ink Signature in Blue-Black -->
  <g stroke="#0f244a" stroke-linecap="round" stroke-linejoin="round" opacity="0.96">
    <path d="M 170 25 C 155 38 140 75 128 115 C 120 138 105 168 88 178 C 80 182 74 180 78 166 C 86 138 112 92 146 56 C 168 30 196 22 204 34 C 210 44 192 85 174 128" stroke-width="3.6" fill="none" />
    <path d="M 102 92 C 122 68 175 58 215 68 C 242 76 250 102 224 122 C 202 138 165 146 135 142 C 115 138 100 125 108 105 C 116 85 148 74 182 78 C 210 80 235 96 225 122" stroke-width="3.2" fill="none" />
    <path d="M 85 155 C 145 125 230 85 310 38" stroke-width="4.2" />
    <path d="M 140 138 L 290 82" stroke-width="3.0" />
    <path d="M 138 62 L 158 165" stroke-width="3.4" />
    <path d="M 196 56 L 214 158" stroke-width="3.4" />
    <path d="M 80 172 C 135 160 210 145 300 136 C 325 134 345 140 332 150 C 320 158 290 162 260 158" stroke-width="3.2" fill="none" />
  </g>
</svg>
`;

