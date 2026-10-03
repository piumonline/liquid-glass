/** Backdrop presets, localStorage persistence, and URL validation. */

// Paths are relative to the document so the build works from a sub-path.
export const DEFAULT_BACKGROUND =
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop';

export const BACKGROUNDS = [
  { label: 'Interior', url: DEFAULT_BACKGROUND },
  { label: 'Image 1', url: 'backgrounds/image1.jpg' },
  { label: 'Image 2', url: 'backgrounds/image2.jpg' },
  { label: 'Image 3', url: 'backgrounds/image3.jpg' },
  { label: 'Image 4', url: 'backgrounds/image4.jpg' },
];

const STORAGE_KEY = 'liquid-glass-background';

export function loadStoredBackground() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function storeBackground(url) {
  try {
    if (url && url !== DEFAULT_BACKGROUND) {
      localStorage.setItem(STORAGE_KEY, url);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* storage unavailable (private mode); background just won't persist */
  }
}

/** Resolves when the URL is a loadable image, rejects otherwise. */
export function validateImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      reject(new Error('Image load timed out.'));
    }, 12000);

    img.onload = () => {
      clearTimeout(timer);
      resolve(url);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(
        new Error('Could not load that image. Check the URL, and that it allows cross-origin requests.'),
      );
    };
    img.src = url;
  });
}
