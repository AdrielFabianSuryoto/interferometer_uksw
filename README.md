# Interferometer Soft Neumorphic Dashboard

React + TypeScript + Vite + Tailwind CSS dashboard for reproducible interferometer acquisition review and FFT analysis.

## Run locally

```bash
npm install
npm run dev
```

## UI revision

This version uses a green-white Soft Neumorphic Premium interface inspired by the provided application reference:

- Large Interferometer header
- Main plot workspace with Signal Plot / FFT Plot mode
- Right-side System Setup, Motor Movement Summary, Filter Settings, and Audit Trail cards
- Bottom action bar for acquisition and export actions
- Soft raised/inset panels, rounded corners, clean academic visual tone

## Scientific integrity boundaries

The app intentionally does not include peak count, fringe count, signal peak detection controls, peak markers, peak tables, manual correction, editable result tables, or manual overrides.

All displayed scientific results are derived from mock raw data and processing parameters. Raw signal, filtered signal, FFT arrays, dominant frequency, and audit data are read-only from the UI perspective.

## Structure

```text
src/
  components/
    Header.tsx
    Sidebar.tsx
    SignalPlotCard.tsx
    FftPlotCard.tsx
    BottomActionBar.tsx
    SegmentedControl.tsx
    NeumorphicSelect.tsx
    StatusBadge.tsx
  lib/
    mockData.ts
    processing.ts
  App.tsx
  main.tsx
  types.ts
  index.css
```
