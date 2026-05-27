interface FieldErrorProps {
  message: string;
  className: string;
  iconColor?: string;
}

export function FieldError({ message, className, iconColor = "#d07070" }: FieldErrorProps) {
  return (
    <div className={className} role="alert">
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        aria-hidden
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <path d="M8 1L15 14H1Z" fill="none" stroke={iconColor} strokeWidth="1.5" />
        <line x1="8" y1="6" x2="8" y2="9.5" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.85" fill={iconColor} />
      </svg>
      {message}
    </div>
  );
}
