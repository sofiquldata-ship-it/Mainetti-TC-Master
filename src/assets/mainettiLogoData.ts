// Official Mainetti Logo (matching Picture1.png: red geometric M / hanger mark, horizontal divider line, and MAINETTI wordmark)
// Plus localStorage persistence so the user can also upload their exact Picture1.png image file

const LOGO_STORAGE_KEY = 'mainetti_custom_company_logo_v1';

export const getDefaultMainettiLogoDataUrl = (): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Mainetti Brand Crimson Red
  const red = '#a6192e';
  ctx.fillStyle = red;
  ctx.strokeStyle = red;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // 1. Far-left short vertical bar (bottom-aligned with the stems)
  // Top: y=82, Bottom: y=132
  ctx.fillRect(68, 82, 16, 50);

  // 2. Center-left tall vertical bar
  // Top: y=24, Bottom: y=132
  ctx.fillRect(156, 24, 16, 108);

  // 3. Center-right tall vertical bar
  // Top: y=24, Bottom: y=132
  ctx.fillRect(238, 24, 16, 108);

  // 4. Right diagonal bar slanting from top-left (near center-right bar) to bottom-right
  ctx.beginPath();
  ctx.moveTo(264, 24);
  ctx.lineTo(282, 24);
  ctx.lineTo(368, 132);
  ctx.lineTo(349, 132);
  ctx.closePath();
  ctx.fill();

  // 5. Thin horizontal dark grey/black divider line below the red emblem
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(42, 148);
  ctx.lineTo(398, 148);
  ctx.stroke();

  // 6. "M A I N E T T I" wide-tracked sans-serif wordmark below the line
  ctx.fillStyle = '#222222';
  ctx.font = '600 37px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'top';

  const letters = ['M', 'A', 'I', 'N', 'E', 'T', 'T', 'I'];
  const startX = 46;
  const endX = 394;
  const totalSpan = endX - startX;
  const step = totalSpan / (letters.length - 1);

  letters.forEach((char, idx) => {
    const x = startX + idx * step;
    const metrics = ctx.measureText(char);
    const drawX = idx === 0 ? startX : idx === letters.length - 1 ? endX - metrics.width : x - metrics.width / 2;
    ctx.fillText(char, drawX, 164);
  });

  return canvas.toDataURL('image/png');
};

export const getMainettiLogo = (): string => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(LOGO_STORAGE_KEY);
    if (saved) return saved;
  }
  return getDefaultMainettiLogoDataUrl();
};

export const saveMainettiLogo = (dataUrl: string): void => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
    } catch (e) {
      console.warn('Could not save custom logo to localStorage:', e);
    }
  }
};

export const resetMainettiLogo = (): string => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LOGO_STORAGE_KEY);
  }
  return getDefaultMainettiLogoDataUrl();
};
