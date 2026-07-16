# Web Teleprompter

> English | [中文](README.zh-CN.md)

**A teleprompter that scrolls by itself — so you can read your script while looking straight at the camera, with your hands free.**

💡 **What it is, in one sentence:** a free, browser-based teleprompter that automatically rolls your script either at a steady speed or by *following your voice* as you speak — perfect for live selling, online teaching, short-video voiceovers, and presentations.

🆓 **Free · No install · No sign-up** — just open it in a browser and start reading.

> 🔗 **[Live Demo](https://zhang-brook.github.io/web-teleprompter/)** &nbsp;·&nbsp; 💾 **[GitHub Repository](https://github.com/zhang-brook/web-teleprompter)**

---

## ✨ Why you'll love it (Highlights)

- **🎙️ Voice-following scroll** — Start talking and the script scrolls to the exact line you're reading and keeps it centered. It tolerates pauses, breaths, and even rephrasing, so you never touch the mouse or keyboard.
- **🔄 Turns to face you — flip & rotate any way** — Horizontal / vertical flip, plus one-tap 0° / 90° / 180° / 270° or any fine angle (0–359°). Whether your phone lies sideways, your prompter mirrors the text, or you read at an angle, the view rotates to face you.
- **📍 Reading line + you always know where you are** — A reference line marks exactly where you are; drag it to any comfortable height. As you read, the current word is highlighted and text you've already passed gently fades, so you never lose your place.
- **🖱️ Calm scrolling that never loses you** — Mouse-wheel scrolling is eased and capped per move, so it never jumps far away. You can also browse the script up/down before you even start.
- **🪟 Use it your way — flexible window modes** — Floating window (drag anywhere, resize from the corner), window-fullscreen (fills the screen), or browser-fullscreen (nothing but the script).
- **💾 Your setup is remembered** — Every setting auto-saves locally and survives refreshes; one-click JSON export/import keeps you seamless across devices and browsers.
- **📄 Drop a `.txt` to import** — Drag a `.txt` script file straight onto the page and it becomes your teleprompter content instantly — no copy-paste needed.

---

## 🚀 Get started in 3 steps

1. **Open the [Live Demo](https://zhang-brook.github.io/web-teleprompter/)** (or run it locally — see below). No account, no install.
2. **Paste or drag in your script** in the left panel.
3. **Hit Start** — pick *Fixed speed* (set a comfortable pace) or *Voice-following* (just start talking) and read naturally.

That's it. Everything else is optional tuning.

> Want to run it on your own machine? Requires **Node.js 22+**:
> ```sh
> pnpm install
> pnpm dev        # local dev preview
> pnpm build      # type-check + build to dist/
> ```
> Want your own hosted copy? The repo ships with a GitHub Actions workflow — push to `main` and it builds and publishes to GitHub Pages automatically.
> ⚠️ **Before your first deploy**: go to **Settings → Pages → Build and deployment → Source** and switch the deploy source to **GitHub Actions** manually, or the first Actions publish fails with `Create Pages site failed. Error: Resource not accessible by integration`.

---

## 📋 Full feature list

### Scrolling
- **Fixed-speed scroll** — Set your own speed (pixels/second) and pause / resume anytime.
- **Voice-following scroll** — Powered by the browser's built-in speech recognition: the script tracks where you are reading. It smartly re-aligns whether the engine returns an increment or a re-spoken phrase, so it never jumps back to the start.
- **Start / Stop**, with **Pause / Resume** while running.

### Reading aids
- **Reading line** — Your current position snaps to a highlighted reference line; drag it up/down right inside the floating window while presenting.
- **Read-position highlighting** — In both modes the word you're reading is highlighted and text you've already passed fades out, so your eyes always lock onto the right spot.
- **Eased wheel scroll** — Smooth, capped scrolling that feels calm and never disorients; works **even before you start**, so you can review the script by mouse or touch.
- **Touch / mouse drag to browse** — On mobile and desktop alike, just drag to look at context before or after.
- **Tune mouse-wheel sensitivity** — Adjust how far one wheel notch moves the text, so scrolling fits your habit instead of flying off.

### Layout & typography
- **Fonts** — 5 built-in fonts (system default / sans / serif / kai / monospace), one tap to switch.
- **Font size, text color, background color, line height** — Tune contrast and size to whatever is most comfortable.
- **Horizontal / vertical flip**.
- **Rotation** — Quick 0° / 90° / 180° / 270°, or any fine angle (0–359°) to fit any shooting or placement.
- **Break English words** — By default words wrap whole; enable it and a long word that doesn't fit at a line end can split across two lines instead of overflowing.

### Window & display
- **Floating window** — Drag the title bar (or the visible handle) to move, drag the bottom-right corner to resize, place it anywhere on screen.
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

## 🎯 Who it's for

- 🎤 **Streamers / live sellers** — Read to the camera while the script follows you.
- 👩‍🏫 **Teachers / trainers** — Record lessons or present online without fumbling the script.
- 🎬 **Short-video / voiceover creators** — Landscape, portrait, or mirrored placement all rotate to fit.
- 🗣️ **Speakers / presenters** — A clean fullscreen view makes you more confident on stage.
- 📝 Anyone who needs to read from a script but hates manually scrolling.

---

## ❓ Good to know

- **Voice following** relies on the browser's speech recognition. We recommend **Chrome / Edge** with **microphone permission** granted; some browsers or private modes may not support it (you'll be prompted to switch to fixed-speed mode).
- Settings are stored **locally in the current browser**; switching browsers or clearing site data loses them — back up important config with "Export config".
- The live demo takes effect once the repo enables GitHub Pages (auto-published on push to `main` by default).

---

<p align="center">Made with ❤️ as a free, open-source web app. ⭐ Star the <a href="https://github.com/zhang-brook/web-teleprompter">repo</a> if it helps you!</p>
