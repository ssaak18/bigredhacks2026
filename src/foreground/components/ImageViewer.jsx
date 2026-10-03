import { useMemo } from "react";
import ConstellationOverlay from "./ConstellationOverlay";

function createMaskUrl(mask) {
  if (!mask) return null;
  const canvas = document.createElement("canvas");
  canvas.width = mask.width;
  canvas.height = mask.height;
  const context = canvas.getContext("2d");
  const output = context.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.data.length; index += 1) {
    output.data[index * 4] = 108;
    output.data[index * 4 + 1] = 230;
    output.data[index * 4 + 2] = 255;
    output.data[index * 4 + 3] = mask.data[index] ? 145 : 0;
  }
  context.putImageData(output, 0, 0);
  return canvas.toDataURL();
}

export default function ImageViewer({ imageUrl, imageRef, imageReady, onImageReady, onImageError, result, onAnalyze, onClear, isProcessing, progress, debug, onDebugChange, pointCount, onPointCountChange }) {
  const maskUrl = useMemo(() => debug ? createMaskUrl(result?.segmentationMask) : null, [debug, result]);
  return (
    <section className="image-workspace" aria-label="Image analysis workspace">
      <div className="workspace-toolbar">
        <div>
          <p className="eyebrow">{result ? "Constellation preview" : "Source preview"}</p>
          <p className="status-copy">{isProcessing ? progress : result ? `${result.selectedPoints.length} representative points selected` : imageReady ? "Review your photo, then generate points." : "Loading photo preview…"}</p>
        </div>
        <div className="toolbar-actions">
          <button className="quiet-button" type="button" onClick={onClear} disabled={isProcessing}>Replace</button>
          <button className="analyze-button" type="button" onClick={onAnalyze} disabled={isProcessing || !imageReady}>
            {isProcessing ? "Processing…" : result ? "Generate again" : "Generate constellation"}
          </button>
        </div>
      </div>
      <div className="image-frame">
        <div className="image-canvas">
          <img ref={imageRef} src={imageUrl} alt="Selected source" onLoad={onImageReady} onError={onImageError} />
          {maskUrl && <img className="debug-mask" src={maskUrl} alt="Detected subject mask" />}
          {result && <ConstellationOverlay points={result.selectedPoints} edges={result.edges} candidates={result.candidates} silhouette={result.silhouetteContour} debug={debug} />}
        </div>
        {isProcessing && <div className="processing-scrim" role="status"><span /></div>}
      </div>
      <p className="image-stage-note">{result ? "Constellation points are overlaid on the original image." : "This is the original image. No points are shown until you press Generate constellation."}</p>
      {result && <div className="point-summary"><span>Semantic landmarks take priority</span><span>{result.candidates.length} candidates considered</span></div>}
      <div className="analysis-controls">
        <label>Points <output>{pointCount}</output><input type="range" min="6" max="12" value={pointCount} onChange={(event) => onPointCountChange(Number(event.target.value))} disabled={!result || isProcessing} /></label>
        <label className="debug-toggle"><input type="checkbox" checked={debug} onChange={(event) => onDebugChange(event.target.checked)} /> Debug view</label>
      </div>
    </section>
  );
}
