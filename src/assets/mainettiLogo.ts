// Official Mainetti Logo representation matching Picture1.png
// Ribbon M in square border + MAINETTI + separator line + Retail Solutions Worldwide

export const MAINETTI_LOGO_SVG = `
<svg viewBox="0 0 320 68" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
  <!-- Left square emblem box -->
  <rect x="3" y="4" width="60" height="60" rx="1" fill="#ffffff" stroke="#9e1b32" stroke-width="2.6" />
  
  <!-- Mainetti iconic 3-ribbon M emblem -->
  <g fill="#9e1b32">
    <!-- Ribbon 1 (Left) -->
    <path d="M 17 21 C 12 21 8 26 8 32 C 8 40 14 47 21 54 C 23 56 26 56 26 53 C 26 47 21 40 17 33 C 15 30 15 27 17 24 C 18 22 18 21 17 21 Z" />
    <path d="M 12 25 C 13 22 17 20 20 22 C 24 25 24 30 21 36 C 17 44 23 51 27 54 C 24 55 20 52 17 47 C 13 41 10 33 12 25 Z" />
    
    <!-- Ribbon 2 (Middle) -->
    <path d="M 28 20 C 23 20 20 25 20 31 C 20 39 27 46 34 53 C 36 55 38 54 38 51 C 37 45 32 39 28 32 C 26 29 27 26 29 23 C 30 21 29 20 28 20 Z" />
    <path d="M 23 24 C 24 21 28 19 32 21 C 36 24 36 29 33 35 C 29 43 35 50 39 53 C 36 54 32 51 29 46 C 24 40 21 32 23 24 Z" />
    
    <!-- Ribbon 3 (Right) -->
    <path d="M 39 20 C 34 20 31 25 31 31 C 31 39 38 46 45 53 C 47 55 49 54 49 51 C 48 45 43 39 39 32 C 37 29 38 26 40 23 C 41 21 40 20 39 20 Z" />
    <path d="M 34 24 C 35 21 39 19 43 21 C 47 24 47 29 44 35 C 40 43 46 50 50 53 C 47 54 43 51 40 46 C 35 40 32 32 34 24 Z" />
  </g>

  <!-- MAINETTI Wordmark -->
  <text 
    x="76" 
    y="34" 
    fill="#9e1b32" 
    font-family="'Cinzel', 'Trajan Pro', 'Georgia', 'Times New Roman', serif" 
    font-size="28" 
    font-weight="700" 
    letter-spacing="4.5"
  >
    MAINETTI
  </text>

  <!-- Horizontal divider line -->
  <line x1="76" y1="41" x2="314" y2="41" stroke="#9ca3af" stroke-width="1.2" />

  <!-- Retail Solutions Worldwide subtitle -->
  <text 
    x="76" 
    y="55" 
    fill="#52525b" 
    font-family="'Century Gothic', 'Montserrat', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" 
    font-size="11.5" 
    font-weight="500" 
    letter-spacing="1.8"
  >
    Retail Solutions Worldwide
  </text>
</svg>
`;

// Pre-rendered canvas-based Data URL generator for high-res print and PDF export
export const getMainettiLogoDataUrl = (): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  // 3x high resolution for crisp print
  const scale = 3;
  canvas.width = 320 * scale;
  canvas.height = 68 * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, 320, 68);

  const crimson = '#9e1b32';

  // 1. Draw Left Square
  ctx.strokeStyle = crimson;
  ctx.lineWidth = 2.4;
  ctx.strokeRect(3, 4, 60, 60);

  // 2. Draw 3 Ribbon strokes
  ctx.fillStyle = crimson;
  
  // Helper to draw ribbon stroke
  const drawRibbon = (offsetX: number) => {
    ctx.beginPath();
    ctx.moveTo(14 + offsetX, 20);
    ctx.bezierCurveTo(9 + offsetX, 23, 7 + offsetX, 30, 9 + offsetX, 36);
    ctx.bezierCurveTo(12 + offsetX, 43, 20 + offsetX, 50, 24 + offsetX, 54);
    ctx.bezierCurveTo(22 + offsetX, 54, 18 + offsetX, 51, 15 + offsetX, 47);
    ctx.bezierCurveTo(10 + offsetX, 41, 7 + offsetX, 32, 9 + offsetX, 24);
    ctx.bezierCurveTo(10 + offsetX, 21, 13 + offsetX, 20, 14 + offsetX, 20);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(14 + offsetX, 20);
    ctx.bezierCurveTo(18 + offsetX, 22, 21 + offsetX, 27, 19 + offsetX, 33);
    ctx.bezierCurveTo(16 + offsetX, 41, 21 + offsetX, 48, 25 + offsetX, 53);
    ctx.bezierCurveTo(23 + offsetX, 53, 19 + offsetX, 48, 16 + offsetX, 42);
    ctx.bezierCurveTo(13 + offsetX, 36, 13 + offsetX, 28, 15 + offsetX, 22);
    ctx.fill();
  };

  drawRibbon(0);
  drawRibbon(11);
  drawRibbon(22);

  // 3. MAINETTI text
  ctx.fillStyle = crimson;
  ctx.font = 'bold 27px "Cinzel", "Georgia", "Times New Roman", serif';
  ctx.textBaseline = 'alphabetic';
  
  // Custom letter spacing
  const word = 'MAINETTI';
  let x = 76;
  const letterSpacing = 4.2;
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    ctx.fillText(char, x, 34);
    x += ctx.measureText(char).width + letterSpacing;
  }

  // 4. Horizontal Rule
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(76, 41);
  ctx.lineTo(314, 41);
  ctx.stroke();

  // 5. Retail Solutions Worldwide
  ctx.fillStyle = '#4b5563';
  ctx.font = '500 11.5px "Century Gothic", "Montserrat", "Segoe UI", Arial, sans-serif';
  const subtitle = 'Retail Solutions Worldwide';
  let subX = 76;
  const subSpacing = 1.6;
  for (let i = 0; i < subtitle.length; i++) {
    const char = subtitle[i];
    ctx.fillText(char, subX, 55);
    subX += ctx.measureText(char).width + subSpacing;
  }

  return canvas.toDataURL('image/png');
};
