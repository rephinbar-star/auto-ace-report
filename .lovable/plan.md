
# Style the "Marketplace" Header Navigation Link

## What Changes

A single file edit to `src/components/layout/Header.tsx` to make the "Marketplace" nav link visually distinct from the other navigation items.

## Approach

The `navigation` array drives both the desktop nav links and the mobile menu. The cleanest approach is to add an `accent` flag to the Marketplace entry and use it to conditionally apply different styling in both render locations.

## Specific Changes to `src/components/layout/Header.tsx`

**1. Update the `navigation` array** to mark the Marketplace link:
```tsx
const navigation = [
  { name: "Home", href: "/" },
  { name: "Marketplace", href: "/marketplace", accent: true },
  { name: "Sample Report", href: "/sample-report" },
  { name: "How It Works", href: "/how-it-works" },
  { name: "Pricing", href: "/pricing" },
];
```

**2. Desktop nav links** — replace the single `cn(...)` className with a conditional that applies blue + animation styles when `item.accent` is true:
```tsx
className={cn(
  "text-sm font-medium transition-colors hover:text-primary relative",
  item.accent
    ? "text-blue-500 font-semibold animate-[pulse_2.5s_ease-in-out_infinite] hover:text-blue-400"
    : location.pathname === item.href
      ? "text-primary"
      : "text-muted-foreground"
)}
```

A small "NEW" badge can also be added inline:
```tsx
{item.name}
{item.accent && (
  <span className="ml-1.5 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-500 ring-1 ring-blue-500/30">
    New
  </span>
)}
```

**3. Mobile menu links** — apply the same conditional styling to the mobile `Link` blocks so the treatment is consistent on all screen sizes.

## Visual Result

- The "Marketplace" link renders in **blue** (`text-blue-500`) with slightly bolder weight
- A gentle **pulse animation** draws the eye without being distracting (same `animate-[pulse_2.5s_ease-in-out_infinite]` pattern already used on the Beta badge in this file)
- A small **"New" badge** (matching the existing Beta badge style) appears next to the label
- All other nav links are completely unchanged
- Active/hover states still work correctly
