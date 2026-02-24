

# Animated Screenshot Upload Walkthrough

## Overview
Build a reusable `ScreenshotTutorial` component that appears as a help overlay/modal on the Analyze page. It walks users through 3-4 animated steps showing how to screenshot a car listing and upload it to CarWise.

## Steps Illustrated

1. **Find Your Listing** -- Show a stylized mockup of a phone/browser with a car listing site (AutoTrader, CarGurus, etc.)
2. **Take a Screenshot** -- Animate a "screenshot capture" effect (flash overlay, device frame shrinking to a thumbnail)
3. **Upload to CarWise** -- Show the screenshot being "dragged" into the upload zone with a success checkmark
4. **Auto-Extracted Details** -- Show form fields magically populating (year, make, model, price, mileage)

## Technical Approach

### New Files
- `src/components/analysis/ScreenshotTutorial.tsx` -- The main walkthrough component with all 4 steps, auto-play/manual navigation, and Framer Motion animations

### Integration
- Add a small "How it works" help link/button below the upload zone in `VehicleInputStep.tsx` that opens the tutorial as a Dialog modal
- Uses existing `Dialog` from Radix and `framer-motion` for step transitions (both already installed)

### Animation Details
- Each step uses CSS-illustrated mockups (no real images needed -- styled divs resembling phone screens, browser windows, and app UI)
- `AnimatePresence` with slide/fade transitions between steps (matching the existing `OnboardingTour` pattern)
- Step 2 has a "flash" keyframe animation simulating a screenshot capture
- Step 3 animates a thumbnail image moving from one position into the drop zone
- Step 4 uses staggered `motion.div` to reveal extracted fields one by one
- Auto-advances every ~4 seconds with a progress bar, or user can click through manually

### UI Pattern
- Reuses the same navigation pattern as the existing `OnboardingTour` component (progress dots, Back/Next buttons, dismiss)
- Compact modal (max-w-md) that works on both desktop and mobile
- "Got it!" button on the final step to dismiss

