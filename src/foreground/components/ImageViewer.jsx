import { useMemo } from "react";
import { SKY_SPAN } from "../../constellations/placeInSky";
import { EDGE_THRESHOLD } from "../vision/canny";
import { POINT_COUNT } from "../vision/config";
import ConstellationOverlay from "./ConstellationOverlay";

/** Tints the detected subject so the segmentation can be checked by eye. */
function createMaskUrl(analysis) {
  if (!analysis) return null;
  const canvas = document.createElement("canvas");
  canvas.width = analysis.width;
  canvas.height = analysis.height;
  const context = canvas.getContext("2d");
  const output = context.createImageData(analysis.width, analysis.height);
  analysis.mask.forEach((inside, i) => {
    output.data.set([108, 230, 255, inside ? 120 : 0], i * 4);
  });
  context.putImageData(output, 0, 0);
  return canvas.toDataURL();
}

function statusText({ isProcessing, progress, constellation, analysis, imageReady }) {
  if (isProcessing) return progress;
  if (constellation) return `${constellation.points.length} stars \u00b7 ${analysis.label}`;
  return imageReady ? "Review your photo, then generate the constellation." : "Loading photo preview\u2026";
}

export default function ImageViewer({
  imageUrl, imageReady, onImageReady, onImageError,
  analysis, edges, constellation, isProcessing, progress,
  onAnalyze, onClear, onPlace, onMovePoint, onResetPoints,
  choosing, onChoosingChange, onChooseSubject,
  debug, onDebugChange, pointCount, onPointCountChange,
  spanDeg, onSpanDegChange, edgeThreshold, onEdgeThresholdChange,
}) {
  const showMask = debug || choosing;
  const maskUrl = useMemo(() => (showMask ? createMaskUrl(analysis) : null), [showMask, analysis]);

  // Position of the tap as a fraction of the photo.
  const handleChoose = (event) => {
    if (!choosing) return;
    const box = event.currentTarget.getBoundingClientRect();
    onChooseSubject({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height });
  };

  return (
    <section className="image-workspace" aria-label="Image analysis workspace">
      <div className="workspace-toolbar">
        <div>
          <p className="eyebrow">{constellation ? "Constellation preview" : "Source preview"}</p>
          <p className="status-copy">{statusText({ isProcessing, progress, constellation, analysis, imageReady })}</p>
        </div>
        <div className="toolbar-actions">
          <button className="quiet-button" type="button" onClick={onClear} disabled={isProcessing}>Replace</button>
          <button className="quiet-button" type="button" onClick={() => onChoosingChange(!choosing)} disabled={isProcessing || !imageReady}>
            {choosing ? "Cancel" : "Choose subject"}
          </button>
          <button className="analyze-button" type="button" onClick={onAnalyze} disabled={isProcessing || !imageReady}>
            {isProcessing ? "Processing\u2026" : analysis ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>
      <div className="image-frame">
        <div className={choosing ? "image-canvas choosing" : "image-canvas"} onClick={handleChoose}>
          <img src={imageUrl} alt="Selected source" onLoad={onImageReady} onError={onImageError} />
          {maskUrl && <img className="debug-mask" src={maskUrl} alt="Detected subject mask" />}
          {constellation && <ConstellationOverlay constellation={constellation} analysis={analysis} edges={edges} debug={debug} onMovePoint={choosing ? undefined : onMovePoint} />}
        </div>
        {isProcessing && <div className="processing-scrim" role="status"><span /></div>}
      </div>
      {choosing && <p className="image-stage-note">Tap the subject you want turned into a constellation.</p>}
      {!choosing && analysis?.confidence.low && (
        <p className="image-stage-note">
          Not sure which object is the subject. {analysis.confidence.reason} Use "Choose subject" and tap it to be exact.
        </p>
      )}
      {analysis?.warning && <p className="image-stage-note">{analysis.warning}</p>}
      {debug && constellation && !choosing && (
        <p className="image-stage-note">
          Drag any star to move it.
          {onResetPoints && <button className="quiet-button" type="button" onClick={onResetPoints}>Reset stars</button>}
        </p>
      )}
      <div className="analysis-controls">
        <div className="analysis-sliders">
          <label>
            Stars <output>{pointCount}</output>
            <input
              type="range"
              min={POINT_COUNT.min}
              max={POINT_COUNT.max}
              value={pointCount}
              onChange={(event) => onPointCountChange(Number(event.target.value))}
            />
          </label>
          <label>
            Size <output>{spanDeg}°</output>
            <input
              type="range"
              min={SKY_SPAN.min}
              max={SKY_SPAN.max}
              value={spanDeg}
              onChange={(event) => onSpanDegChange(Number(event.target.value))}
            />
          </label>
          <label>
            Threshold <output>{edgeThreshold}</output>
            <input
              type="range"
              min={EDGE_THRESHOLD.min}
              max={EDGE_THRESHOLD.max}
              value={edgeThreshold}
              onChange={(event) => onEdgeThresholdChange(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="analysis-actions">
          <label className="debug-toggle">
            <input type="checkbox" checked={debug} onChange={(event) => onDebugChange(event.target.checked)} /> Debug
          </label>
          <button className="analyze-button" type="button" onClick={onPlace} disabled={!constellation || isProcessing}>Place on the sky</button>
        </div>
      </div>
    </section>
  );
}
