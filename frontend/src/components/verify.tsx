import { useEffect, useState } from "react";

import { Field, TopBar } from "./ui";
import { AuthBackdrop } from "./backdrop";
import { api, ApiError, type CodeVerifyResponse } from "../lib/api";

/**
 * The 6-digit SMS verification step. Handles request, resend throttling and
 * verification; the server enforces attempts and expiry. In mock SMS mode the
 * generated code is shown on screen so the whole flow works without a phone.
 */
export function VerifyCodeCard({
  phone,
  purpose,
  onVerified,
  onCancel,
  onAlreadyVerified,
  title = "Verify your number",
}: {
  phone: string;
  purpose: "signup" | "reset";
  onVerified: (res: CodeVerifyResponse) => void;
  onCancel?: () => void;
  /** Called when the server reports the number is already verified. */
  onAlreadyVerified?: () => void;
  title?: string;
}) {
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function request() {
    setBusy(true);
    setError(null);
    api
      .requestCode(phone, purpose)
      .then((res) => {
        setDevCode(res.dev_code);
        setResendIn(res.resend_after_s);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 409 && purpose === "signup") {
          onAlreadyVerified?.();
          return;
        }
        setError(err instanceof ApiError ? err.message : "Could not send the code.");
      })
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, purpose]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  async function verify() {
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code we sent.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onVerified(await api.verifyCode(phone, code.trim(), purpose));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen--standalone">
      <AuthBackdrop />
      {onCancel && <TopBar title={title} onBack={onCancel} />}
      <div className="pad stack">
        <div>
          <p className="eyebrow">Step · verify</p>
          <h1>{title}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            We texted a 6-digit code to <span className="data acid">{phone}</span>. Enter it to
            continue.
          </p>
        </div>

        {devCode && (
          <div className="tile">
            <p className="eyebrow">Development mode</p>
            <p className="small muted">SMS is mocked — your code is shown here:</p>
            <p className="data" style={{ fontSize: 28, letterSpacing: "0.4em" }}>
              {devCode}
            </p>
          </div>
        )}

        <Field
          label="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          inputMode="numeric"
          autoComplete="one-time-code"
          style={{ fontFamily: "var(--data)", fontSize: 24, letterSpacing: "0.5em" }}
        />

        {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}

        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy || code.trim().length !== 6}
          onClick={verify}
        >
          {busy ? <span className="spinner" /> : "Verify"}
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--block"
          disabled={busy || resendIn > 0}
          onClick={request}
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
