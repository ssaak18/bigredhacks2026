import { useEffect, useMemo, useState } from "react";
import ImageUploader from "./components/ImageUploader";
import ImageViewer from "./components/ImageViewer";
import { analyzePhoto, disposeVisionWorker } from "./vision/client";
import { buildConstellation, toEuclideanDrawing } from "./vision/constellation";
import { POINT_COUNT } from "./vision/config";
import "./StarForeground.css";

/**
 * Upload -> analyze -> constellation workflow. Models run once per photo; the
 * star count only re-runs the cheap selection step. "Place in sky" hands the
 * result to the parent as a Euclidean drawing, plus the source photo and its
 * label, and otherwise knows nothing of the map.
 */
export default function StarForeground({ onConstellation, compact = false, hidden = false, onExpand }) {
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageReady, setImageReady] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [pointCount, setPointCount] = useState(POINT_COUNT.default);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [debug, setDebug] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const generated = useMemo(
    () => (analysis ? buildConstellation(analysis, pointCount) : null),
    [analysis, pointCount],
  );

  // Hand-moved stars (debug mode) belong to one generated constellation and are dropped with it.
  const [edits, setEdits] = useState({ base: null, moved: {} });
  const moved = edits.base === generated ? edits.moved : null;
  const constellation = useMemo(
    () => (generated && moved
      ? { ...generated, points: generated.points.map((point) => (moved[point.id] ? { ...point, ...moved[point.id] } : point)) }
      : generated),
    [generated, moved],
  );
  const movePoint = (id, position) => setEdits((previous) => ({
    base: generated,
    moved: { ...(previous.base === generated ? previous.moved : {}), [id]: position },
  }));
  const resetPoints = () => setEdits({ base: null, moved: {} });

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => () => disposeVisionWorker(), []);

  const clearImage = () => {
    setFile(null);
    setImageUrl("");
    setAnalysis(null);
    setProgress("");
    setError("");
    setImageReady(false);
    setChoosing(false);
  };

  const handleImageSelected = ({ file: nextFile, error: nextError }) => {
    setError(nextError || "");
    if (!nextFile) return;
    setFile(nextFile);
    setImageUrl(URL.createObjectURL(nextFile));
    setAnalysis(null);
    setProgress("");
    setImageReady(false);
    setChoosing(false);
  };

  // With a `point` the subject is whatever the user tapped; otherwise it is found automatically.
  const analyze = async (point) => {
    setIsProcessing(true);
    setChoosing(false);
    setError("");
    setAnalysis(null);
    try {
      setAnalysis(await analyzePhoto(file, { photoKey: imageUrl, point }, setProgress));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The image could not be processed.");
    } finally {
      setProgress("");
      setIsProcessing(false);
    }
  };

  const place = () => {
    const name = analysis.label.replace(/^./, (letter) => letter.toUpperCase());
    onConstellation?.(
      toEuclideanDrawing(constellation, { id: `photo-${analysis.label}`, name }),
      { file, label: analysis.label },
    );
  };

  const pickImage = (source) => {
    onExpand?.();
    handleImageSelected(source);
  };

  const showPanel = !hidden && !compact && Boolean(imageUrl);

  return (
    <div className="star-foreground" data-layer="foreground">
      <header className="lucky-header">
        <h1>Lucky Stars</h1>
        {!showPanel ? (
          <ImageUploader disabled={isProcessing} onImageSelected={pickImage} />
        ) : null}
      </header>
      {showPanel ? (
        <div className="foreground-panel">
          <ImageViewer
            imageUrl={imageUrl}
            imageReady={imageReady}
            onImageReady={() => setImageReady(true)}
            onImageError={() => setError("This image could not be decoded. Choose another JPG, PNG, or WebP image.")}
            analysis={analysis}
            constellation={constellation}
            isProcessing={isProcessing}
            progress={progress}
            onAnalyze={() => analyze()}
            choosing={choosing}
            onChoosingChange={setChoosing}
            onChooseSubject={analyze}
            onClear={clearImage}
            onPlace={place}
            onMovePoint={movePoint}
            onResetPoints={moved && Object.keys(moved).length ? resetPoints : null}
            debug={debug}
            onDebugChange={setDebug}
            pointCount={pointCount}
            onPointCountChange={setPointCount}
          />
          {error && <p className="vision-error" role="alert">{error}</p>}
        </div>
      ) : error ? (
        <p className="vision-error vision-error--float" role="alert">{error}</p>
      ) : null}
    </div>
  );
}
