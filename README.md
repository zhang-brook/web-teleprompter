# Web Teleprompter

Turn your script into a teleprompter that scrolls **by itself**: it follows your voice as you speak, or rolls at a steady, fixed speed. Perfect for live selling, online teaching, short-video voiceovers, presentations — anything where you need to read from a script without touching the mouse.

No install. No sign-up. Just open it in a browser and start reading.

> 🔗 [Live Demo](https://zhang-brook.github.io/web-teleprompter/) &nbsp;·&nbsp; 💾 [GitHub Repository](https://github.com/zhang-brook/web-teleprompter)

---

## ✨ Highlights

- **🎙️ Voice-following scroll** — Start talking and the script automatically scrolls to the line you're reading and keeps it centered. It tolerates pauses, breaths, and even rephrasing, so your hands stay free the whole time.
- **🔄 Rotate & flip any way you need** — Horizontal / vertical flip, plus one-tap 0° / 90° / 180° / 270° or any fine angle (0–359°). Whether your phone lies sideways, your prompter mirrors the text, or you read at an angle, the view turns to face you.
- **📏 Reading line + eased wheel scroll** — A reference line marks exactly where you are; drag it to any comfortable height. Mouse-wheel scrolling is eased and capped per move, so it never jumps far away and loses your place. You can also browse the script up/down before you even start.
- **🪟 Flexible window modes** — Floating window (drag anywhere, resize from the corner), window-fullscreen (fills the area), or browser-fullscreen (nothing but the script on screen).
- **💾 Settings auto-save + import/export** — Every setting is stored locally and survives refreshes; one-click JSON export/import keeps you seamless across devices and browsers.
- **📄 Drop a .txt to import** — Drag a `.txt` script file straight onto the page and it becomes your teleprompter content instantly — no copy-paste needed.

---

## 🚀 Quick Start

- **Use online** — Just open the demo link above. Nothing to install.
- **Run locally** (Node.js 22+ required):
  ```sh
  pnpm install
  pnpm dev        # local dev preview
  pnpm build      # type-check + build to dist/
  ```
- **Deploy your own GitHub Pages** — The repo ships with a GitHub Actions workflow. Push to the `main` branch and it builds and publishes automatically, no extra setup.

---

## 📋 Feature List

### Scrolling
- **Fixed-speed scroll** — Set your own speed (pixels/second) and pause / resume anytime.
- **Voice-following scroll** — Powered by the browser's speech recognition: the script tracks where you are reading. It smartly re-aligns whether the engine returns an increment or a re-spoken phrase, so it never jumps back to the start.
- **Start / Stop**, with **Pause / Resume** while running.

### Reading aids
- **Reading line** — Your current position snaps to a highlighted reference line; drag it up/down right inside the floating window while presenting.
- **Eased wheel scroll** — Smooth, capped scrolling that feels calm and never disorients; works **even before you start**, so you can review the script by mouse or touch.
- **Touch / mouse drag to browse** — On mobile and desktop alike, just drag to look at context before or after.

### Layout & typography
- **Fonts** — 5 built-in fonts (system default / sans / serif / kai / monospace), one tap to switch.
- **Font size, text color, background color, line height** — Tune contrast and size to whatever is most comfortable.
- **Horizontal / vertical flip**.
- **Rotation** — Quick 0° / 90° / 180° / 270°, or any fine angle (0–359°) to fit any shooting or placement.
- **Break English words** — By default words wrap whole; enable it and a long word that doesn't fit at a line end can split across two lines instead of overflowing.

### Window & display
- **Floating window** — Drag the title bar to move, drag the bottom-right corner to resize, place it anywhere on screen.
- **Window-fullscreen** — Fills the main area without being squeezed by the settings panel.
- **Browser-fullscreen** — Uses the real fullscreen API; hide every distraction, only the script remains.
- **Theme** — Dark / Light / Follow system, auto-matching your OS.
- **Auto-hide settings after start** — Enters a clean reading view; on desktop the panel can be collapsed/expanded anytime.

### Script & settings
- **Type your script** — Right in the settings panel text box.
- **Drop a `.txt` to import** — Drag a text file onto the page.
- **Local auto-save** — All settings persist in the browser; refresh or reopen without losing them.
- **Export / import config (JSON)** — Back up settings or migrate between devices.
- **One-click reset to defaults**.

---

## 🎯 Who It's For

- 🎤 **Streamers / live sellers** — Read to the camera while the script follows you.
- 👩‍🏫 **Teachers / trainers** — Record lessons or present online without fumbling the script.
- 🎬 **Short-video / voiceover creators** — Landscape, portrait, or mirrored placement all rotate to fit.
- 🗣️ **Speakers / presenters** — A clean fullscreen view makes you more confident on stage.
- 📝 Anyone who needs to read from a script but hates manually scrolling.

---

## ❓ Notes

- **Voice following** relies on the browser's speech recognition. We recommend **Chrome / Edge** with **microphone permission** granted; some browsers or private modes may not support it (you'll be prompted to switch to fixed-speed mode).
- Settings are stored **locally in the current browser**; switching browsers or clearing site data loses them — back up important config with "Export config".
- The live demo takes effect once the repo enables GitHub Pages (auto-published on push to `main` by default).
