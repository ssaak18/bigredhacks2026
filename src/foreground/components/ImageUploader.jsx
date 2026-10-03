import { useRef } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUploader({ disabled, onImageSelected }) {
  const inputRef = useRef(null);

  const chooseFile = () => inputRef.current?.click();
  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onImageSelected({ error: "Choose a JPG, PNG, or WebP image." });
      return;
    }
    onImageSelected({ file });
  };

  return (
    <section className="upload-card" aria-label="Photo upload">
      <p className="eyebrow">Source photo</p>
      <h1>Turn a subject into a constellation.</h1>
      <p className="upload-copy">Your image is processed in this browser. Nothing is uploaded to a server.</p>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          // Permit choosing the same image again after replacing it.
          event.currentTarget.value = "";
        }}
      />
      <button className="upload-button" type="button" onClick={chooseFile} disabled={disabled}>
        Choose a photo
      </button>
      <p className="file-types">JPG, PNG, or WebP</p>
    </section>
  );
}
