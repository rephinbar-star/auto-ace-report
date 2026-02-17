

## Force Mobile Layout Fallback

### Problem
The mobile-specific layout (e.g., vertical price assessment bars) relies on Tailwind's `md:` CSS breakpoint (768px). If a device reports an incorrect viewport width or the media query doesn't trigger as expected, users see the desktop layout on a mobile device.

### Solution
Add a JavaScript-based mobile detection fallback that applies a CSS class to force the mobile layout, even when the CSS media query doesn't fire correctly.

### How It Works

1. **Enhance `useIsMobile` hook** (`src/hooks/use-mobile.tsx`)
   - Keep the existing media query check
   - Add a secondary check using `navigator.userAgent` to detect mobile devices (iOS, Android, etc.)
   - If either check returns true, the hook returns `true`

2. **Apply a body-level CSS class** (`src/pages/Report.tsx`)
   - Import `useIsMobile` in the Report page
   - When `isMobile` is true, add a `force-mobile` class to the report wrapper
   - This class will override `md:` breakpoints for the critical sections

3. **Add CSS overrides** (`src/index.css`)
   - Define `.force-mobile` rules that mirror what `md:hidden` / `hidden md:block` do, ensuring the mobile layout is shown regardless of what the CSS media query resolves to
   - Target the specific sections: price assessment bar, depreciation table, and any other mobile-specific layouts

### Key Sections Affected
- Price Assessment: vertical bar layout vs. horizontal gradient
- Depreciation Table: scrollable narrow layout
- Any other `md:hidden` / `hidden md:block` pairs in Report.tsx

### Technical Details

**`src/hooks/use-mobile.tsx`** -- add user-agent sniffing:
```typescript
const UA_MOBILE = /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i;

// Return true if EITHER media query OR user-agent says mobile
const isMobileUA = UA_MOBILE.test(navigator.userAgent);
setIsMobile(window.innerWidth < MOBILE_BREAKPOINT || isMobileUA);
```

**`src/pages/Report.tsx`** -- apply class to wrapper:
```tsx
const isMobile = useIsMobile();
// ...
<div className={cn("...", isMobile && "force-mobile")}>
```

**`src/index.css`** -- force overrides:
```css
.force-mobile .desktop-only { display: none !important; }
.force-mobile .mobile-only { display: block !important; }
```

Then in Report.tsx, replace the raw `md:hidden` / `hidden md:block` pairs on the price assessment section with `desktop-only` / `mobile-only` utility classes so the JS override can take effect.

### Minimal Risk
- Desktop users are unaffected (user-agent won't match, width will be >= 768)
- Existing CSS breakpoints still work as primary detection
- JS check is purely additive -- it can only force mobile, never force desktop
