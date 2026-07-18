# Web Teleprompter

> English | [中文](README.zh-CN.md)

**A teleprompter that scrolls by itself — so you can read your script while looking straight at the camera, with your hands free.**

💡 **What it is, in one sentence:** a free, browser-based teleprompter that automatically rolls your script either at a steady speed or by *following your voice* as you speak — perfect for live selling, online teaching, short-video voiceovers, and presentations.

🆓 **Free · No install · No sign-up** — just open it in a browser and start reading.

> 🔗 **[Live Demo](https://zhang-brook.github.io/web-teleprompter/)** &nbsp;·&nbsp; 💾 **[GitHub Repository](https://github.com/zhang-brook/web-teleprompter)**

---

## ✨ Why you'll love it (Highlights)

- **🎙️ Voice-following scroll** — Start talking and the script scrolls to the exact line you're reading and keeps it centered. It tolerates pauses, breaths, and even rephrasing, and *auto-resumes* after a silence, so you never touch the mouse or keyboard.
- **🛡️ Smart language check before you start** — Before voice mode begins, it scans your script and warns you if it's a mix of languages or doesn't match the selected recognition language. A dialog shows the detected language breakdown (with percentages) so you can pick the right one — no embarrassing misreads mid-take.
- **🔄 Turns to face you — flip & rotate any way** — Horizontal / vertical flip, plus one-tap 0° / 90° / 180° / 270° or any fine angle (0–359°). Whether your phone lies sideways, your prompter mirrors the text, or you read at an angle, the view rotates to face you.
- **📍 Reading line + you always know where you are** — A reference line marks exactly where you are; drag it to any comfortable height (even mid-presentation). As you read, the current word is highlighted and text you've already passed gently fades, so you never lose your place.
- **🖱️ Calm scrolling that never loses you** — Mouse-wheel scrolling is eased and capped per move, so it never jumps far away. You can also browse the script up/down before you even start.
- **🪟 Use it your way — flexible window modes** — Floating window (drag anywhere, resize from the corner), window-fullscreen (fills the screen), browser-fullscreen (nothing but the script), or fullscreen-floating (a floating teleprompter over a clean black fullscreen — perfect for presenting).
- **📐 Typography that fits your eyes** — Tune font size, **line spacing (1.0–3.0)**, **letter spacing (0–20px)**, font, and text/background color; one tap also cleans up repeated blank lines so the script stays tidy and easy to read.
- **💾 Your setup is remembered** — Every setting auto-saves locally and survives refreshes; one-click JSON export/import keeps you seamless across devices and browsers.
- **📄 Drop a `.txt` to import** — Drag a `.txt` script file straight onto the page and it becomes your teleprompter content instantly — no copy-paste needed.
- **🌐 Built for the world** — Interface in 简体中文 / 繁體中文 / English; speech recognition in 10 languages (see below).

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
- **Fixed-speed scroll** — Set your own speed (10–400 px/s) and pause / resume anytime.
- **Voice-following scroll** — Powered by the browser's built-in speech recognition: the script tracks where you are reading. It smartly re-aligns whether the engine returns an increment or a re-spoken phrase, so it never jumps back to the start, and it silently restarts after a breath or silence to keep following.
- **Start / Stop**, with **Pause / Resume** while running.
- **Live recognition read-back** — While voice-following, the words currently being heard are echoed at the bottom of the prompter, so you get instant visual confirmation the mic is working.

### Voice recognition
- **Pick your recognition language** — 10 built-in options: 简体中文（普通话）、繁體中文（國語）、English (US)、English (UK)、日本語、한국어、Français、Deutsch、Español、Русский.
- **Smart start check** — If the script is a mix of languages, or its language doesn't match the selected one, a dialog appears with a per-language percentage breakdown. Choose **Go back & pick language** to fix it, or **Continue anyway** if you know better.
- **Loading indicator** — A spinner shows while the speech engine is warming up, so you always know it's preparing.

### Reading aids
- **Reading line** — Your current position snaps to a highlighted reference line; drag it up/down right inside the floating window while presenting. You can also set its exact height (5%–95% from the top) in the settings panel.
- **Read-position highlighting** — In both modes the word you're reading is highlighted and text you've already passed fades out, so your eyes always lock onto the right spot.
- **Eased wheel scroll** — Smooth, capped scrolling that feels calm and never disorients; works **even before you start**, so you can review the script by mouse or touch.
- **Touch / mouse drag to browse** — On mobile and desktop alike, just drag to look at context before or after.
- **Tune mouse-wheel sensitivity** — Adjust how far one wheel notch moves the text (10–300 px), so scrolling fits your habit instead of flying off.

### Layout & typography
- **Fonts** — 5 built-in fonts (system default / sans / serif / kai / monospace), one tap to switch.
- **Font size, text color, background color** — Tune size and contrast to whatever is most comfortable for your shoot.
- **Line spacing & letter spacing** — Adjust line height (1.0–3.0) and letter spacing (0–20px) so the script is comfortable to read at any distance.
- **Horizontal / vertical flip**.
- **Rotation** — Quick 0° / 90° / 180° / 270°, or any fine angle (0–359°) to fit any shooting or placement.
- **Break English words** — By default words wrap whole; enable it and a long word that doesn't fit at a line end can split across two lines instead of overflowing.
- **Remove consecutive blank lines** — On by default; collapses repeated blank lines so you keep at most one between sections and the script stays tidy.

### Window & display
- **Floating window** — Grab the title bar or the visible semi-transparent handle to move, drag the bottom-right corner to resize, place it anywhere on screen.
- **Window-fullscreen** — Fills the main area without being squeezed by the settings panel.
- **Browser-fullscreen** — Uses the real fullscreen API; hide every distraction, only the script remains.
- **Fullscreen-floating** — Enter browser fullscreen but show the teleprompter as a floating window on a clean black background — great for presenting on a distraction-free stage.
- **Theme** — Dark / Light / Follow system, auto-matching your OS.
- **Auto-hide settings after start** — Enters a clean reading view; on desktop the panel can be collapsed/expanded anytime.
- **Responsive by design** — Adapts to phone, tablet, and desktop; on narrow screens the settings panel becomes a slide-in drawer so the teleprompter never gets pushed off-screen.

### Script & settings
- **Type your script** — Right in the settings panel text box.
- **Drop a `.txt` to import** — Drag a text file onto the page.
- **Local auto-save** — All settings persist in the browser; refresh or reopen without losing them.
- **Export / import config (JSON)** — Back up settings or migrate between devices.
- **One-click reset to defaults**.

### Languages & interface
- **Interface** in 简体中文 / 繁體中文 / English, switchable from the top bar.
- **Speech recognition** in 10 languages (listed above). Note: the browser can only recognize one language at a time, so keep your script in a single language per take.

---

## 🎯 Who it's for

- 🎤 **Streamers / live sellers** — Read to the camera while the script follows you.
- 👩‍🏫 **Teachers / trainers** — Record lessons or present online without fumbling the script.
- 🎬 **Short-video / voiceover creators** — Landscape, portrait, or mirrored placement all rotate to fit.
- 🗣️ **Speakers / presenters** — A clean fullscreen view makes you more confident on stage.
- 📝 Anyone who needs to read from a script but hates manually scrolling.

---

## ❓ Good to know

- **Voice following** relies on the browser's speech recognition. We recommend **Chrome / Edge** with **microphone permission** granted; some browsers or private modes may not support it (you'll be prompted to switch to fixed-speed mode). On desktop Chrome/Edge it runs smoothly; behavior on some mobile browsers' speech engines may vary.
- Settings are stored **locally in the current browser**; switching browsers or clearing site data loses them — back up important config with "Export config".
- The live demo takes effect once the repo enables GitHub Pages (auto-published on push to `main` by default).

---

<p align="center">Made with ❤️ as a free, open-source web app. ⭐ Star the <a href="https://github.com/zhang-brook/web-teleprompter">repo</a> if it helps you!</p>
