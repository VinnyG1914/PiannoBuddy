/* PianoBuddy built-in songs (melody only).
   Notation: "NOTE:BEATS" tokens, BEATS in quarter notes (0.5 = eighth, 1/3 = triplet eighth).
   R = rest. "|" is a bar line, only for readability. Spell flats with b (Bb4), sharps with # (C#5).
   source: "sheet"  = transcribed from free sheet music (see sourceNote)
           "classic" = standard public-domain melody
           "memory"  = written from memory, check by ear
*/
window.PB_SONGS = [
  {
    id: "ederlezi", title: "Ederlezi", alt: "Đurđevdan", origin: "Romani · Balkans", flag: "romani",
    region: "balkan", level: 2, bpm: 92, meter: [4, 4], key: "D minor",
    source: "sheet", sourceNote: "Brass Liberation lead sheet (Trad. Roma, Bulgarian version)",
    parts: [
      { name: "Verse 1", notes: "R:1 A4:.5 Bb4:.5 C5:.5 Bb4:.5 A4:.5 G4:.5 | G4:.5 A4:1.5 G4:1/3 F4:1/3 G4:1/3 F4:1 | R:1 A4:.5 Bb4:.5 Bb4:1 Bb4:.5 G4:.5 | A4:1.5 Bb4:.5 G4:.25 F4:.25 G4:.5 F4:1" },
      { name: "Verse 2", notes: "R:1 A4:.5 Bb4:.5 Bb4:1 Bb4:.5 G4:.5 | A4:1.5 Bb4:.5 G4:.25 F4:.25 G4:.5 F4:1 | R:1 A4:.5 G4:.5 Bb4:.5 Bb4:.5 G4:1 | F4:.5 F4:2.5 R:1" },
      { name: "Chorus \u201cEderlezi\u201d", notes: "C5:3 Bb4:.25 C5:.25 Bb4:.25 A4:.25 | Bb4:3 R:1 | F4:1 A4:.5 A4:.5 G4:.5 F4:.5 E4:.5 E4:.5 | F4:1 E4:.5 F4:.5 A4:.5 A4:.5 G4:1 | F4:1 A4:.5 A4:.5 G4:.5 F4:.5 E4:.5 E4:.5 | D5:2 C5:.5 Bb4:.5 A4:.5 G4:.5 | R:1 C5:.5 Bb4:.5 A4:1 G4:1 | R:1 F4:.5 E4:.5 A4:.5 A4:.5 E4:1 | D4:.5 D4:2.5 R:1" },
      { name: "Chorus ending", notes: "C5:3 Bb4:.25 C5:.25 Bb4:.25 A4:.25 | Bb4:3 R:1 | F4:1 A4:.5 A4:.5 G4:.5 F4:.5 E4:.5 E4:.5 | F4:1 E4:.5 F4:.5 A4:.5 A4:.5 G4:1 | F4:1 A4:.5 A4:.5 G4:.5 F4:.5 E4:.5 E4:.5 | D5:4 | R:1 C5:.5 Bb4:.5 A4:1 G4:1 | R:1 C5:.5 Bb4:.5 A4:1 G4:1 | R:1 F4:.5 E4:.5 A4:.5 A4:.5 E4:1 | D4:.5 D4:2.5 R:1" }
    ]
  },
  {
    id: "jovano", title: "Jovano Jovanke", alt: "Јовано Јованке", origin: "North Macedonia", flag: "mk",
    region: "balkan", level: 3, bpm: 100, meter: [7, 8], groups: [3, 2, 2], key: "D minor",
    source: "sheet", sourceNote: "Lead sheet with chords (melody in 7/8)",
    parts: [
      { name: "\u201cJovano, Jovanke\u201d", notes: "C#5:1 E5:.5 D5:.5 C#5:.5 Bb4:.5 A4:.5 | A4:1.5 R:2 | E5:1 G5:.5 F5:.5 E5:.5 D5:.5 C#5:.25 D5:.25 | E5:1.5 R:2" },
      { name: "\u201cKraj Vardaro\u201d", notes: "F5:1 F5:.5 F5:1 F5:1 | F5:.5 E5:.5 F5:.5 G5:1 G5:.5 F5:.5 | E5:1 E5:.5 E5:1 E5:1 | E5:.5 D5:.5 E5:.5 F5:1 R:1" },
      { name: "\u201cSrce moje\u201d", notes: "D5:1 D5:.5 D5:1 E5:.5 F5:.5 | G5:1 F5:.5 E5:1 D5:1 | E5:.5 D5:.5 C#5:.5 D5:.5 C#5:.5 D5:.5 E5:.5 | C#5:1 E5:.5 D5:.5 C#5:.5 Bb4:.5 A4:.5 | A4:1.5 R:2" }
    ]
  },
  {
    id: "mesecina", title: "Mesečina", alt: "Месечина \u00b7 G. Bregović", origin: "Balkans \u00b7 film \u201cUnderground\u201d", flag: "moon",
    region: "balkan", level: 3, bpm: 116, meter: [4, 4], key: "F minor",
    source: "sheet", sourceNote: "Rude Mechanical Orchestra melody sheet (one octave lower here)",
    parts: [
      { name: "Intro \u201cMesečina\u201d", notes: "C4:1.5 C4:.5 B3:1 C4:1 | C5:1.5 C5:.5 Bb4:1 Ab4:1 | G4:.5 Ab4:.5 Bb4:1 R:2 | G4:.5 Ab4:.5 Bb4:1 R:2 | Bb4:1.5 Bb4:.5 A4:1 Bb4:1 | C5:1.5 Bb4:.5 Ab4:1 G4:1 | Ab4:.5 Bb4:.5 C5:1 R:2 | Ab4:.5 Bb4:.5 C5:1 R:2" },
      { name: "Theme A", notes: "F4:1.5 F4:.5 G4:1 Ab4:1 | Bb4:1.5 B4:.5 C5:.5 Bb4:.5 Ab4:.5 G4:.5 | F4:1.5 F4:.5 G4:1 Ab4:1 | Bb4:1.5 B4:.5 C5:.5 Bb4:.5 Ab4:.5 G4:.5 | E5:1.5 C5:.5 Db5:1 C5:1 | Db5:.5 C5:.5 Bb4:.5 Ab4:.5 G4:.5 F4:.5 E4:.5 G4:.5 | E5:1.5 C5:.5 Db5:1 C5:1 | R:4" },
      { name: "Theme B", notes: "E5:1.5 C5:.5 Db5:1 C5:1 | Db5:.5 C5:.5 Bb4:.5 Ab4:.5 G4:.5 F4:.5 E4:.5 G4:.5 | E5:1.5 C5:.5 Db5:1 C5:1 | R:4 | E5:1.5 C5:.5 Db5:1 C5:1 | Bb4:1 Ab4:1 G4:1 F4:1 | E4:4" },
      { name: "Brass chorus", notes: "B4:.5 C5:.5 C5:.5 C5:.5 C5:1 C5:.5 C5:.5 | B4:.5 C5:.5 Db5:.5 B4:.5 C5:2 | B4:.5 C5:.5 Db5:.5 B4:.5 C5:.5 Ab4:.5 Bb4:.5 G4:.5 | Ab4:.5 F4:.5 G4:.5 E4:.5 F4:.5 Gb4:.5 G4:.5 Ab4:.5 | A4:.5 Bb4:.5 Bb4:.5 Bb4:.5 Bb4:1 Bb4:.5 Bb4:.5 | A4:.5 Bb4:.5 C5:.5 A4:.5 Bb4:2 | R:1 Bb4:1 C5:1 Db5:1 | E5:1.5 C5:.5 Db5:1 C5:1" }
    ]
  },
  {
    id: "kalinka", title: "Kalinka", alt: "Калинка", origin: "Russia", flag: "ru",
    region: "world", level: 1, bpm: 132, meter: [4, 4], pickup: 2, key: "A minor",
    source: "sheet", sourceNote: "mfiles.co.uk piano score (I. P. Larionov, arr. J. Paterson)",
    parts: [
      { name: "Chorus 1", notes: "E5:2 | D5:2 B4:1 C5:1 | D5:2 B4:1 C5:1 | D5:2 C5:1 B4:1 | A4:2 E5:1 E5:1 | D5:1.5 C5:.5 B4:1 C5:1 | D5:2 B4:1 C5:1 | D5:2 C5:1 B4:1 | A4:2 E5:1 E5:1" },
      { name: "Chorus 2", notes: "D5:2 B4:1 C5:1 | D5:2 B4:1 C5:1 | D5:2 C5:1 B4:1 | A4:2 E5:1 E5:1 | D5:1.5 C5:.5 B4:1 C5:1 | D5:2 B4:1 C5:1 | D5:2 C5:1 B4:1 | A4:2 G4:2" },
      { name: "Slow verse", bpm: 88, notes: "E5:1 G5:1 F5:1 E5:.5 D5:.5 | C5:2 G4:2 | E5:1 G5:1 F5:1 E5:.5 D5:.5 | C5:2 G4:2 | A4:3 B4:1 | D5:1 C5:1 B4:1 A4:1 | G4:2 G4:2 | G4:4" },
      { name: "Slow verse ending", bpm: 88, notes: "E5:1 G5:1 F5:1 E5:.5 D5:.5 | C5:2 G4:2 | E5:1 G5:1 F5:1 E5:.5 D5:.5 | C5:2 G4:2 | A4:3 B4:1 | D5:1 C5:1 B4:1 A4:1 | G5:2 F5:2 | E5:4" }
    ]
  },
  {
    id: "katyusha", title: "Katyusha", alt: "Катюша \u00b7 M. Blanter", origin: "Russia", flag: "ru",
    region: "world", level: 2, bpm: 104, meter: [4, 4], key: "G minor",
    source: "sheet", sourceNote: "Checked against the IMSLP score by C. Ferrari (CC BY-SA 4.0)",
    parts: [
      { name: "\u201cRastsvetali yabloni\u201d", notes: "G4:1.5 A4:.5 Bb4:1.5 G4:.5 | Bb4:.5 Bb4:.5 A4:.5 G4:.5 A4:1 D4:1 | A4:1.5 Bb4:.5 C5:1.5 A4:.5 | C5:.5 C5:.5 Bb4:.5 A4:.5 G4:2" },
      { name: "\u201cVykhodila na bereg\u201d", notes: "D5:1 G5:1 F5:1 G5:.5 F5:.5 | Eb5:1 D5:.5 C5:.5 D5:1 G4:1 | R:.5 Eb5:1 C5:.5 D5:1.5 Bb4:.5 | A4:.5 D4:.5 Bb4:.5 A4:.5 G4:2" }
    ]
  },
  {
    id: "hava", title: "Hava Nagila", alt: "הבה נגילה", origin: "Israel · Jewish trad.", flag: "il",
    region: "world", level: 2, bpm: 116, meter: [4, 4], key: "A minor (E freygish)",
    source: "sheet", sourceNote: "capotastomusic.com easy piano score (arr. P. Edvinsson)",
    parts: [
      { name: "\u201cHava nagila\u201d", notes: "E4:1 E4:1 R:.5 G#4:.5 F4:.5 E4:.5 | G#4:1 G#4:1 R:.5 B4:.5 A4:.5 G#4:.5 | A4:1 A4:1 R:.5 C5:.5 B4:.5 A4:.5 | G#4:1 F4:1/3 E4:1/3 F4:1/3 G#4:2 | E4:1 E4:1 R:.5 G#4:.5 F4:.5 E4:.5 | G#4:1 G#4:1 R:.5 B4:.5 A4:.5 G#4:.5 | A4:1 A4:1 R:.5 C5:.5 B4:.5 A4:.5 | G#4:1 F4:1/3 E4:1/3 F4:1/3 E4:2" },
      { name: "\u201cHava neranena\u201d", notes: "G#4:.5 G#4:1 F4:.5 E4:.5 E4:.5 E4:1 | F4:.5 F4:1 E4:.5 D4:.5 D4:.5 D4:1 | D4:1 F4:.5 E4:.5 D4:.5 D4:.5 B4:1 | G#4:1 F4:1/3 E4:1/3 F4:1/3 G#4:2 | G#4:.5 G#4:1 F4:.5 E4:.5 E4:.5 E4:1 | F4:.5 F4:1 E4:.5 D4:.5 D4:.5 D4:1 | D4:1 F4:.5 E4:.5 D4:.5 D4:.5 B4:1 | G#4:1 F4:1/3 E4:1/3 F4:1/3 E4:2" },
      { name: "\u201cUru achim\u201d", notes: "A4:2 A4:2 | A4:1 A4:1 A4:1 A4:1 | A4:1/3 A4:1/3 A4:1/3 C5:.5 B4:.5 A4:.5 C5:.5 B4:.5 A4:.5 | A4:1/3 A4:1/3 A4:1/3 C5:.5 B4:.5 A4:.5 C5:.5 B4:.5 A4:.5 | B4:1/3 B4:1/3 B4:1/3 D5:.5 C5:.5 B4:.5 D5:.5 C5:.5 B4:.5 | B4:1/3 B4:1/3 B4:1/3 D5:.5 C5:.5 B4:.5 D5:.5 C5:.5 B4:.5 | B4:1/3 B4:1/3 B4:1/3 E5:1 B4:1/3 B4:1/3 B4:1/3 E5:.5 E4:.5 | E4:.5 E4:.5 C5:.5 B4:.5 A4:2" }
    ]
  },
  {
    id: "bellaciao", title: "Bella Ciao", alt: "Italian folk song", origin: "Italy", flag: "it",
    region: "world", level: 1, bpm: 120, meter: [4, 4], pickup: 1.5, key: "A minor",
    source: "sheet", sourceNote: "irish-folk-songs.com melody sheet (one octave lower here)",
    parts: [
      { name: "\u201cUna mattina\u201d", notes: "E4:.5 A4:.5 B4:.5 | C5:.5 A4:2 E4:.5 A4:.5 B4:.5 | C5:.5 A4:2 E4:.5 A4:.5 B4:.5 | C5:1 B4:.5 A4:.5 C5:1 B4:.5 A4:.5 | E5:1 E5:1 E5:.5" },
      { name: "\u201cE ho trovato l'invasor\u201d", notes: "E5:.5 D5:.5 E5:.5 | F5:.5 F5:2 F5:.5 E5:.5 D5:.5 | F5:.5 E5:2 E5:.5 D5:.5 C5:.5 | B4:1 E5:1 C5:1 B4:1 | A4:2.5" }
    ]
  },
  {
    id: "greensleeves", title: "Greensleeves", alt: "English folk song", origin: "England", flag: "en",
    region: "world", level: 2, bpm: 104, meter: [3, 4], pickup: 1, key: "A minor",
    source: "classic", sourceNote: "Traditional melody",
    parts: [
      { name: "Verse 1", notes: "A4:1 | C5:2 D5:1 | E5:1.5 F5:.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:.5 B4:1 | C5:2 A4:1 | A4:1.5 G#4:.5 A4:1 | B4:2 G#4:1 | E4:2" },
      { name: "Verse 2", notes: "A4:1 | C5:2 D5:1 | E5:1.5 F5:.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:.5 B4:1 | C5:1.5 B4:.5 A4:1 | G#4:1.5 F#4:.5 G#4:1 | A4:3" },
      { name: "Chorus 1", notes: "G5:3 | G5:1.5 F#5:.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:.5 B4:1 | C5:2 A4:1 | A4:1.5 G#4:.5 A4:1 | B4:2 G#4:1 | E4:3" },
      { name: "Chorus 2", notes: "G5:3 | G5:1.5 F#5:.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:.5 B4:1 | C5:1.5 B4:.5 A4:1 | G#4:1.5 F#4:.5 G#4:1 | A4:3" }
    ]
  },
  {
    id: "odetojoy", title: "Ode to Joy", alt: "L. van Beethoven", origin: "Germany", flag: "de",
    region: "world", level: 1, bpm: 100, meter: [4, 4], key: "C major",
    source: "classic", sourceNote: "Symphony No. 9 theme",
    parts: [
      { name: "Line 1", notes: "E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | E4:1.5 D4:.5 D4:2" },
      { name: "Line 2", notes: "E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | D4:1.5 C4:.5 C4:2" },
      { name: "Line 3", notes: "D4:1 D4:1 E4:1 C4:1 | D4:1 E4:.5 F4:.5 E4:1 C4:1 | D4:1 E4:.5 F4:.5 E4:1 D4:1 | C4:1 D4:1 G3:2" },
      { name: "Line 4", notes: "E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | D4:1.5 C4:.5 C4:2" }
    ]
  },
  {
    id: "furelise", title: "Für Elise", alt: "L. van Beethoven (opening)", origin: "Germany", flag: "de",
    region: "world", level: 2, bpm: 66, meter: [3, 8], groups: [3], pickup: .5, key: "A minor",
    source: "classic", sourceNote: "Opening theme, right hand",
    parts: [
      { name: "Phrase 1", notes: "E5:.25 D#5:.25 | E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 | A4:.5 R:.25 C4:.25 E4:.25 A4:.25 | B4:.5 R:.25 E4:.25 G#4:.25 B4:.25 | C5:.5 R:.25 E4:.25 E5:.25 D#5:.25" },
      { name: "Phrase 2", notes: "E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 | A4:.5 R:.25 C4:.25 E4:.25 A4:.25 | B4:.5 R:.25 E4:.25 C5:.25 B4:.25 | A4:1.5" }
    ]
  },
  {
    id: "canon", title: "Canon in D", alt: "J. Pachelbel (melody)", origin: "Germany", flag: "de",
    region: "world", level: 2, bpm: 72, meter: [4, 4], key: "D major",
    source: "classic", sourceNote: "Famous violin line, one octave lower",
    parts: [
      { name: "Long notes", notes: "F#4:2 E4:2 | D4:2 C#4:2 | B3:2 A3:2 | B3:2 C#4:2" },
      { name: "Walking down", notes: "D4:1 C#4:1 B3:1 A3:1 | G3:1 F#3:1 G3:1 E3:1" },
      { name: "Flowing line", notes: "D4:.5 F#4:.5 A4:.5 G4:.5 F#4:.5 D4:.5 F#4:.5 E4:.5 | D4:.5 B3:.5 D4:.5 A4:.5 G4:.5 B4:.5 A4:.5 G4:.5" }
    ]
  },
  {
    id: "zajdi", title: "Zajdi, zajdi", alt: "Зајди, зајди · A. Sarievski", origin: "North Macedonia", flag: "mk",
    region: "balkan", level: 2, comingSoon: true,
    sourceNote: "I couldn't find a sheet I trust yet. Import a MIDI file, or send me a sheet and I'll add it."
  },
  {
    id: "erghen", title: "Erghen Diado", alt: "Ерген деда", origin: "Bulgaria", flag: "bg",
    region: "balkan", level: 3, comingSoon: true,
    sourceNote: "I couldn't find a sheet I trust yet. Import a MIDI file, or send me a sheet and I'll add it."
  }
];
