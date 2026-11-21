/**
 * Client-Side Canvas Image Watermarking Engine
 * Used for Disaster Management Field Verification Photos (House Damage, Polythene Relief, etc.)
 */

export interface WatermarkOptions {
  name: string;
  fatherName?: string;
  village: string;
  gp?: string;
  riCircle?: string;
  tahasil?: string;
  district?: string;
  mobileNumber?: string;
  categoryLabel?: string; // e.g. "HOUSE DAMAGE FIELD VERIFICATION" or "POLYTHENE RELIEF DISTRIBUTION"
  customDate?: string;
  geoCoords?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Formats current date-time e.g. "19-08-2026 08:35 AM"
 */
export function formatCurrentDateTime(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const formattedHours = String(hours).padStart(2, '0');

  return `${day}-${month}-${year} ${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Takes an image data URL and burns an official revenue watermark banner onto the canvas.
 * Returns a high quality JPEG data URL.
 */
export function applyDisasterWatermark(
  imageDataUrl: string,
  options: WatermarkOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Constrain max dimension to 1600px for speed & storage efficiency
        const maxDim = 1600;
        let width = img.width || 1200;
        let height = img.height || 900;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        // Draw original photo
        ctx.drawImage(img, 0, 0, width, height);

        // Adaptive typography sizing based on width and height
        const isPortrait = height > width;
        const baseDimension = isPortrait ? height : width;
        const baseFontSize = Math.max(15, Math.min(34, Math.round(baseDimension * (isPortrait ? 0.022 : 0.025))));
        
        const bannerPaddingX = Math.round(baseFontSize * 1.2);
        const bannerPaddingY = Math.round(baseFontSize * 0.9);
        const lineSpacing = Math.round(baseFontSize * 1.38);
        const totalLines = 4;
        const bannerHeight = bannerPaddingY * 2 + lineSpacing * (totalLines - 1) + baseFontSize + 14;

        const bannerY = height - bannerHeight;

        // 1. Semi-translucent dark vignette background banner
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'; // High contrast dark slate
        ctx.fillRect(0, bannerY, width, bannerHeight);

        // 2. High-visibility Gold / Amber accent top stripe
        ctx.fillStyle = '#F59E0B'; // Amber 500
        const stripeHeight = Math.max(4, Math.round(baseFontSize * 0.22));
        ctx.fillRect(0, bannerY, width, stripeHeight);

        // 3. Setup text drawing
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        const textX = bannerPaddingX;
        let baselineY = bannerY + bannerPaddingY + baseFontSize;

        // Helper to draw text with subtle drop shadow
        const drawTextWithShadow = (text: string, x: number, y: number, color: string, font: string) => {
          ctx.font = font;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = color;
          ctx.fillText(text, x, y);
        };

        // Line 1: Header Category Badge
        const catText = (options.categoryLabel || 'HOUSE DAMAGE FIELD VERIFICATION').toUpperCase();
        drawTextWithShadow(
          catText,
          textX,
          baselineY,
          '#FDE047', // Bright Yellow
          `bold ${Math.round(baseFontSize * 1.05)}px system-ui, -apple-system, sans-serif`
        );

        baselineY += lineSpacing;

        // Line 2: Beneficiary & Father / Husband Name
        const namePart = `NAME: ${options.name?.trim().toUpperCase() || 'N/A'}`;
        const fatherPart = options.fatherName?.trim() ? `  |  S/O: ${options.fatherName.trim().toUpperCase()}` : '';
        drawTextWithShadow(
          `${namePart}${fatherPart}`,
          textX,
          baselineY,
          '#FFFFFF', // Crisp White
          `bold ${baseFontSize}px system-ui, -apple-system, sans-serif`
        );

        baselineY += lineSpacing;

        // Line 3: Location / R.I. Circle / Tahasil
        const villagePart = `AT/VILL: ${options.village?.trim().toUpperCase() || 'N/A'}`;
        const gpPart = options.gp?.trim() ? ` (GP: ${options.gp.trim().toUpperCase()})` : '';
        const circlePart = options.riCircle ? `  |  RI CIRCLE: ${options.riCircle.toUpperCase()}` : '';
        const tahasilPart = options.tahasil ? `  |  TAHASIL: ${options.tahasil.toUpperCase()}` : '';
        drawTextWithShadow(
          `${villagePart}${gpPart}${circlePart}${tahasilPart}`,
          textX,
          baselineY,
          '#E2E8F0', // Slate 200
          `600 ${Math.round(baseFontSize * 0.92)}px system-ui, -apple-system, sans-serif`
        );

        baselineY += lineSpacing;

        // Line 4: Mobile Number & Verification Timestamp & GPS
        const dateStr = options.customDate || formatCurrentDateTime();
        const mobileStr = options.mobileNumber?.trim() ? `MOB: ${options.mobileNumber.trim()}  |  ` : '';
        const gpsStr = options.geoCoords
          ? `  |  GPS: ${options.geoCoords.latitude.toFixed(5)}°N, ${options.geoCoords.longitude.toFixed(5)}°E`
          : '';
        drawTextWithShadow(
          `${mobileStr}VERIFIED ON: ${dateStr}${gpsStr}`,
          textX,
          baselineY,
          '#94A3B8', // Slate 400
          `500 ${Math.round(baseFontSize * 0.85)}px monospace, system-ui, sans-serif`
        );

        ctx.restore();

        // Convert to data URL
        const watermarkedUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(watermarkedUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for watermarking'));
    };

    img.src = imageDataUrl;
  });
}
