// Solmar Bay: screenshots. The L key downloads the current canvas frame
// as a JPEG; the dossier screenshots are taken the same way in a browser.
export function downloadShot(canvas, name) {
  try {
    const url = canvas.toDataURL('image/jpeg', 0.85);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'solmar-shot.jpg';
    a.click();
  } catch (e) {
    // A tainted canvas cannot export; the game keeps running.
  }
}

export function shotFileName(scene, n) {
  return `${n}-${scene}.jpg`;
}
