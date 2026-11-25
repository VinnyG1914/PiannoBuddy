# PianoBuddy

Learn melodies on your computer keyboard (or by tapping on a phone), one small part at a time.

## Use it on the laptop
Double-click `index.html`. It opens in your browser and works offline. Nothing to install.

## Use it on the iPhone
Publish it the same way as Team Quiz, on GitHub Pages:
1. Create a new repository (e.g. `pianobuddy`), then Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
2. Add file → Upload files → drag in **the contents of this folder**: `index.html`, `icon-180.png`, `css/` and `js/`.
   Leave out `tools/`, which is only for testing.
3. Open `https://<your-username>.github.io/pianobuddy/` in Safari → Share → **Add to Home Screen**.
   It then opens full screen like an app.

Turn the phone sideways for bigger keys. If you hear nothing, check the volume; on older iOS the silent switch also mutes it.
Progress (stars) is stored per device and per site, so the laptop and the phone each keep their own.

## How to learn a song
1. 👂 **Listen** to Part 1.
2. 🐢 **Practice** it slowly. Every note waits for you, and the key to press glows.
3. 🎯 **Play** it in time for stars (3 stars needs 70% speed or more).
4. Move to the next part, then play the **Whole song**.

The "Let's go" box on each song always suggests the next step.

## Keys
- Upper rows: `Q W E R T Y U I O P [ ]` are white keys, with `2 3 5 6 7 9 0 =` as the black keys.
- Lower rows (one octave lower): `Z X C V B N M , . /` with `S D G H J L ;`.
- `Space` start/pause · `Esc` stop · `←` `→` change part.

## Songs
| Song | Source |
|---|---|
| Ederlezi / Đurđevdan | Brass Liberation lead sheet (trad. Roma) |
| Jovano Jovanke | Lead sheet (7/8) |
| Mesečina | Rude Mechanical Orchestra melody sheet |
| Kalinka | mfiles.co.uk piano score |
| Hava Nagila | capotastomusic.com easy piano score |
| Greensleeves, Ode to Joy, Für Elise (opening), Canon in D | standard melodies |
| Katyusha, Bella Ciao | written from memory: check by ear |
| Zajdi zajdi, Erghen Diado | coming soon (no trustworthy sheet found yet) |

**Import MIDI** adds any song from a `.mid` file: pick the melody track, and it is split into parts.

## Credits
Piano sound: Salamander Grand Piano by Alexander Holm, CC BY 3.0.

## Testing (developer)
- `python tools/check.py`: JS syntax check and checks that every song's bars add up.
- `python tools/ui_test.py`: headless Chromium run. A simulated player must get 3 stars in Practice and Play, and MIDI import is tested. Screenshots go to `tools/shots/`.
