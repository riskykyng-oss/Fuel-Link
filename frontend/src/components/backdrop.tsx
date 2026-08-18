/**
 * Faint, blurred scene behind every auth surface. Rendered as sibling layers
 * (image → scrim) so the app's charcoal-teal shell keeps the spotlight.
 */
export function AuthBackdrop() {
  return (
    <>
      <div className="auth__bg" aria-hidden="true">
        <img src="/auth-bg.svg" alt="" />
      </div>
      <div className="auth__scrim" aria-hidden="true" />
    </>
  );
}
