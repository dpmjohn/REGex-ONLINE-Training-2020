import { Star } from "@phosphor-icons/react";

export function StarRating({ count = 0, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5" data-testid={`stars-${count}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          weight={i <= count ? "fill" : "regular"}
          className={i <= count ? "text-accent" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}
