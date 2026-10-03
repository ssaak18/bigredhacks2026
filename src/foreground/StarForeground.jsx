import { useEffect, useRef, useState } from "react";
import ImageUploader from "./components/ImageUploader";
import ImageViewer from "./components/ImageViewer";
import { runVisionPipeline } from "./vision/runVisionPipeline";
import { disposeSegmentationWorker } from "./vision/segmentation";
import { createConstellationEdges, selectRepresentativePoints } from "./vision/selectPoints";
import "./StarForeground.css";

function waitForDecodedImage(image) {
  if (image?.complete && image.naturalWidth) return Promise.resolve();
  return new Promise((resolve, reject) => {
    image?.addEventListener("load", resolve, { once: true });
    image?.addEventListener("error", () => reject(new Error("This image could not be decoded.")), { once: true });
  });
}

/**
 * The foreground owns its complete upload-to-points workflow. It intentionally
 * knows nothing about the map and remains a transparent layer over it.
 */
export default function StarForeground() {
  const imageRef = useRef(null);
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pointCount, setPointCount] = useState(9);
  const [debug, setDebug] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => () => disposeSegmentationWorker(), []);

  const clearImage = () => {
    setFile(null);
    setImageUrl("");
    setResult(null);
    setProgress("");
    setError("");
    setImageReady(false);
  };

  const handleImageSelected = ({ file: nextFile, error: nextError }) => {
    setError(nextError || "");
    if (!nextFile) return;
    setFile(nextFile);
    setImageUrl(URL.createObjectURL(nextFile));
    setResult(null);
    setProgress("");
    setImageReady(false);
  };

  const analyzeImage = async () => {
    if (!file || !imageRef.current || !imageReady) {
      setError("Wait for the image preview to finish loading, then try again.");
      return;
    }
    setIsProcessing(true);
    setError("");
    setResult(null);
    try {
      await waitForDecodedImage(imageRef.current);
      const nextResult = await runVisionPipeline(file, imageRef.current, setProgress, pointCount);
      setResult(nextResult);
      setProgress("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The image could not be processed.");
      setProgress("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePointCountChange = (nextCount) => {
    setPointCount(nextCount);
    setResult((current) => {
      if (!current) return current;
      const selectedPoints = selectRepresentativePoints(current.candidates, { target: nextCount });
      return { ...current, selectedPoints, edges: createConstellationEdges(selectedPoints) };
    });
  };

  return (
    <div className="star-foreground" data-layer="foreground">
      <div className="foreground-panel">
        {!imageUrl ? (
          <ImageUploader disabled={isProcessing} onImageSelected={handleImageSelected} />
        ) : (
          <ImageViewer
            imageUrl={imageUrl}
            imageRef={imageRef}
            imageReady={imageReady}
            onImageReady={() => setImageReady(true)}
            onImageError={() => setError("This image could not be decoded. Choose another JPG, PNG, or WebP image.")}
            result={result}
            isProcessing={isProcessing}
            progress={progress}
            onAnalyze={analyzeImage}
            onClear={clearImage}
            debug={debug}
            onDebugChange={setDebug}
            pointCount={pointCount}
            onPointCountChange={handlePointCountChange}
          />
        )}
        {error && <p className="vision-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
