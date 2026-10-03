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
    <>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <button className="add-image-button" type="button" onClick={chooseFile} disabled={disabled}>
        Add image
      </button>
    </>
  );
}
