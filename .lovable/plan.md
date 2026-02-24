

# URL Copy & Paste Tutorial

## Overview
Create a new `URLTutorial` component -- a 4-step animated walkthrough (matching the style of `ScreenshotTutorial`) that teaches users how to copy a listing URL from a marketplace site and paste it into CarWise.

## Steps Illustrated

1. **Find Your Listing** -- Browser mockup showing a car listing on a marketplace site (Cars.com, CarGurus, etc.) with the address bar highlighted
2. **Copy the URL** -- Animate tapping/clicking the address bar, the URL text becoming selected (highlighted), and a "Copy" action appearing with a confirmation
3. **Paste into CarWise** -- Show the CarWise URL input field, animate a tap/click on it, then a "Paste" action filling in the URL with a success effect
4. **Auto-Imported Details** -- Reuse the same staggered field-reveal pattern from `ScreenshotTutorial` Step 4, showing year, make, model, price populating automatically

## Technical Approach

### New File
- `src/components/analysis/URLTutorial.tsx` -- Follows the same architecture as `ScreenshotTutorial.tsx`: same Dialog wrapper, progress bar, dots, Back/Next/Got it navigation, auto-advance timer, and `AnimatePresence` transitions

### Integration
- Import `URLTutorial` in `VehicleInputStep.tsx`
- Replace the existing `showHelpVideo` state usage (line 1034) to open the new `URLTutorial` instead of whatever `showHelpVideo` currently does
- Add `<URLTutorial open={showHelpVideo} onClose={() => setShowHelpVideo(false)} />` in the render

### Animation Details per Step

**Step 1 -- Find Your Listing:**
- Same browser-chrome mockup as `ScreenshotTutorial` Step 1 (traffic lights, address bar, fake listing content)
- Address bar subtly pulses to draw attention

**Step 2 -- Copy the URL:**
- Browser address bar mockup; animated finger/cursor taps the address bar
- URL text gets a highlight/selection effect (blue background)
- A "Copied!" tooltip or toast animates in with a checkmark

**Step 3 -- Paste into CarWise:**
- Mockup of the CarWise input field (matching the real UI style)
- Animated cursor/finger taps the input
- URL text "types in" with a quick animation
- "Import from URL" button pulses

**Step 4 -- Auto-Imported Details:**
- Identical pattern to `ScreenshotTutorial`'s `StepExtracted` -- staggered reveal of Year, Make/Model, Price, Mileage fields with green checkmarks

### Changes to Existing Files
- `VehicleInputStep.tsx`: Add import for `URLTutorial`, render it using the existing `showHelpVideo` state, and optionally make the trigger button slightly more prominent (matching the "How do I do this?" style with an animated icon)
