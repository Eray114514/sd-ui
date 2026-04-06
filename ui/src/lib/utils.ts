import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

export function smoothScrollToBottom() {
  const start = window.scrollY;
  let target = document.documentElement.scrollHeight - window.innerHeight;
  if (start >= target) return;

  const duration = 500;
  const startTime = performance.now();

  function easeInOutQuad(t: number, b: number, c: number, d: number) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  }

  function animation(currentTime: number) {
    const elapsed = currentTime - startTime;
    // Always recalculate target in case document height changed
    target = document.documentElement.scrollHeight - window.innerHeight;
    const distance = target - start;

    if (elapsed < duration) {
      window.scrollTo(0, easeInOutQuad(elapsed, start, distance, duration));
      requestAnimationFrame(animation);
    } else {
      window.scrollTo(0, target);
    }
  }

  requestAnimationFrame(animation);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed, falling back to execCommand', error);
    }
  }
  
  // Fallback for older browsers or non-secure contexts
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (error) {
    console.error('Fallback clipboard failed', error);
    return false;
  }
}
