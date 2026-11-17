/** HUD's Equal Housing Opportunity mark: a house with an equals sign. Free for any housing provider to use. */
export function EqualHousingLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Equal Housing Opportunity">
      <path d="M20 3 2 15.5V20h3.5v17h29V20H38v-4.5Z" fill="currentColor" />
      <path d="M12 19.5h16v4H12zM12 27h16v4H12z" fill="var(--eho-bg, #000)" />
    </svg>
  );
}
