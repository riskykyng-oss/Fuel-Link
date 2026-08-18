import { useRef, useState } from "react";

import { Icon } from "./brand";
import { canUpload, uploadBreakdownPhoto, uploadGarageLogo, UploadError } from "../lib/storage";
import { useSession, useToast } from "../state";

/**
 * Small reusable photo control. Uploads to Firebase Storage when a project is
 * configured (see lib/firebase.ts); until then it still lets the user preview
 * an image so the flow can be demoed end to end.
 */
export function PhotoPicker({
  kind,
  onUploaded,
  label = "Attach a photo",
}: {
  kind: "breakdown" | "garage";
  onUploaded: (url: string | null) => void;
  label?: string;
}) {
  const { user } = useSession();
  const { notify } = useToast();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    if (!canUpload()) {
      notify("Preview only — Firebase Storage isn't configured yet.", "info");
      onUploaded(null);
      return;
    }
    setBusy(true);
    try {
      const url =
        kind === "breakdown"
          ? await uploadBreakdownPhoto(file, user?.id ?? 0)
          : await uploadGarageLogo(file, user?.id ?? 0);
      onUploaded(url);
      notify("Photo uploaded.");
    } catch (error) {
      notify(error instanceof UploadError ? error.message : "Upload failed.", "error");
      onUploaded(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-picker">
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void handle(e.target.files?.[0])}
      />
      {preview ? (
        <div className="photo-picker__preview">
          <img src={preview} alt="Attachment preview" />
          <div className="photo-picker__actions">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              {busy ? <span className="spinner" /> : "Replace"}
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setPreview(null);
                onUploaded(null);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <Icon name="plus" size={16} />
          {label}
        </button>
      )}
    </div>
  );
}
