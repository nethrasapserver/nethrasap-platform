/* Four white trust cards under the buy box — icons and labels are lifted
   verbatim from the owner-approved mockup (docs/mockups/pdp-sample.html).
   Server component; pure static markup. */
export function TrustBadges() {
  return (
    <div className="trust-grid" aria-label="Quality assurances">
      <div>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        CDSCO-verified
      </div>
      <div>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2v20M4 6l16 12M20 6L4 18" />
          <path d="M12 2l-2 3h4zM12 22l-2-3h4z" />
        </svg>
        GDP cold chain
      </div>
      <div>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 21V10l6 3V10l6 3V10l6 3v8z" />
          <path d="M3 21h18" />
          <path d="M7 21v-4h3v4M14 21v-4h3v4" />
        </svg>
        GMP facility
      </div>
      <div>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
        </svg>
        Easy returns
      </div>
    </div>
  );
}
