let openCVPromise;

/**
 * Loads the locally hosted OpenCV.js runtime once and only resolves once its
 * WASM runtime is ready. No npm wrapper is used.
 */
export function loadOpenCV() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV can only run in a browser."));
  }

  if (window.cv?.Mat) return Promise.resolve(window.cv);
  if (openCVPromise) return openCVPromise;

  openCVPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.cv?.Mat) resolve(window.cv);
      else reject(new Error("OpenCV loaded but did not initialize correctly."));
    };

    const existing = document.querySelector('script[data-opencv-runtime="true"]');
    if (existing) {
      if (window.cv) window.cv.onRuntimeInitialized = finish;
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("OpenCV failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "/vendor/opencv.js";
    script.async = true;
    script.dataset.opencvRuntime = "true";
    script.onerror = () => reject(new Error("Could not load /vendor/opencv.js."));
    script.onload = () => {
      const runtime = window.cv;
      if (!runtime) {
        reject(new Error("OpenCV script loaded without a cv runtime."));
        return;
      }
      if (runtime.Mat) {
        finish();
        return;
      }
      runtime.onRuntimeInitialized = finish;
    };
    document.head.appendChild(script);
  });

  return openCVPromise;
}
