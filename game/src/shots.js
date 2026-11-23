// Screenshots: render a frame to a JPEG data URL and download it.
// Used by the in-game L key and by the capture script that makes the
// four dossier shots.

export function canvasShot(canvas) {
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function takeShot(canvas, G) {
  try {
    const data = canvasShot(canvas);
    const n = (G.shotCount = (G.shotCount || 0) + 1);
    const name = `shot-${n}.jpg`;
    const a = document.createElement('a');
    a.href = data;
    a.download = name;
    a.click();
    return { name, data };
  } catch (e) {
    return null;
  }
}

// Four named shots for the dossier, in display order: the chase is the
// cover, then the drive, the foot work and the title.
export const SHOT_NAMES = ['1-chase.jpg', '2-drive.jpg', '3-foot.jpg', '4-title.jpg'];
