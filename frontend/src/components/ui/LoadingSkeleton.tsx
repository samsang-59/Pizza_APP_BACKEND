interface Props {
  className?: string;
  lines?: number;
  label?: string;
}

/** Shimmer placeholder. Decorative; pair with a role="status" message. */
export function LoadingSkeleton({ className = 'h-4 w-full', lines = 1, label }: Props) {
  return (
    <div aria-hidden={label ? undefined : true} role={label ? 'status' : undefined} aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`animate-pulse rounded-md bg-gradient-to-r from-elevated via-[#18263c] to-elevated ${className} ${i > 0 ? 'mt-2' : ''}`}
        />
      ))}
    </div>
  );
}
