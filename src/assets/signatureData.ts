// Authentic high-resolution signature representation matching Ashraf Uddin Khan signature
export const SIGNATURE_SVG = `
<svg viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
  <g stroke="#000000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <!-- Top dynamic flourish & high loop -->
    <path d="M 115 15 C 105 28, 90 70, 75 110 C 68 128, 55 152, 38 165 C 32 170, 26 172, 28 160 C 33 135, 52 95, 78 58 C 96 32, 118 18, 126 28 C 132 36, 120 75, 102 118 C 90 148, 80 162, 68 166 C 58 170, 48 162, 54 140 C 65 98, 98 48, 125 35 C 145 25, 160 38, 142 78 C 128 110, 108 145, 92 165" />
    
    <!-- Central loop and body strokes -->
    <path d="M 45 75 C 65 52, 112 40, 145 52 C 168 62, 175 88, 150 110 C 130 128, 95 138, 70 135 C 48 132, 35 118, 42 98 C 50 78, 82 65, 115 68 C 140 70, 162 85, 155 112 C 148 135, 118 152, 85 150 C 62 148, 45 135, 55 115 C 68 88, 105 80, 138 88 C 162 95, 172 115, 158 132" />

    <!-- Cross anchor and vertical tie -->
    <path d="M 72 45 C 80 75, 88 120, 92 158" stroke-width="3.6" />
    <path d="M 132 40 C 138 80, 145 118, 148 145" stroke-width="3.4" />
    
    <!-- Angular sharp cuts & crossing flourish -->
    <path d="M 42 125 L 175 92" stroke-width="2.8" />
    <path d="M 30 142 C 60 130, 120 115, 185 105" stroke-width="3" />
    
    <!-- Bottom base underline flourish -->
    <path d="M 28 168 C 55 155, 95 142, 140 135 C 165 132, 180 138, 172 148 C 165 156, 148 158, 132 155" stroke-width="3.2" />
  </g>
</svg>
`;

// Clean transparent PNG data URL of the signature for jsPDF and <img> rendering
// Pre-rendered high-res canvas data URL
export const getSignatureDataUrl = (): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, 240, 200);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw signature strokes
  ctx.beginPath();
  // 1. High loop
  ctx.moveTo(135, 18);
  ctx.bezierCurveTo(120, 32, 105, 85, 88, 130);
  ctx.bezierCurveTo(80, 150, 65, 180, 45, 192);
  ctx.bezierCurveTo(38, 196, 32, 198, 34, 185);
  ctx.bezierCurveTo(40, 155, 62, 110, 92, 68);
  ctx.bezierCurveTo(112, 38, 138, 22, 148, 32);
  ctx.bezierCurveTo(155, 42, 140, 88, 120, 138);
  ctx.stroke();

  // 2. Center loops & cross strokes
  ctx.beginPath();
  ctx.moveTo(52, 88);
  ctx.bezierCurveTo(75, 60, 130, 48, 168, 60);
  ctx.bezierCurveTo(195, 72, 205, 102, 175, 128);
  ctx.bezierCurveTo(152, 148, 112, 160, 82, 156);
  ctx.bezierCurveTo(58, 152, 42, 138, 50, 112);
  ctx.bezierCurveTo(60, 90, 98, 75, 135, 78);
  ctx.bezierCurveTo(165, 80, 190, 98, 182, 128);
  ctx.stroke();

  // 3. Sharp crossing strokes
  ctx.beginPath();
  ctx.lineWidth = 4.0;
  ctx.moveTo(85, 52);
  ctx.lineTo(108, 182);
  ctx.moveTo(152, 48);
  ctx.lineTo(170, 168);
  ctx.stroke();

  ctx.beginPath();
  ctx.lineWidth = 3.2;
  ctx.moveTo(48, 145);
  ctx.lineTo(202, 108);
  ctx.moveTo(35, 162);
  ctx.bezierCurveTo(70, 148, 140, 132, 215, 122);
  ctx.stroke();

  // 4. Base flourish
  ctx.beginPath();
  ctx.lineWidth = 3.6;
  ctx.moveTo(34, 192);
  ctx.bezierCurveTo(65, 178, 110, 162, 162, 155);
  ctx.bezierCurveTo(190, 152, 208, 158, 198, 170);
  ctx.stroke();

  return canvas.toDataURL('image/png');
};
