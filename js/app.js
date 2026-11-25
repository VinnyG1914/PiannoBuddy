/* PianoBuddy app */
(function () {
  "use strict";

  /* ================= utils ================= */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function load(key, def) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  function starsHtml(n, max) {
    var s = "";
    for (var i = 0; i < (max || 3); i++) s += i < n ? "★" : '<span class="off">★</span>';
    return '<span class="stars">' + s + "</span>";
  }

  function toast(msg, kind) {
    var t = el("div", "toast" + (kind ? " " + kind : ""), msg);
    $("toasts").appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 2600);
    setTimeout(function () { t.remove(); }, 3000);
  }

  var modalOnClose = null;
  function openModal(html, opts) {
    var m = $("modal");
    m.className = "modal" + (opts && opts.wide ? " wide" : "");
    m.innerHTML = html;
    $("modalBack").classList.remove("hidden");
    modalOnClose = opts && opts.onClose;
    return m;
  }
  function closeModal() {
    $("modalBack").classList.add("hidden");
    $("modal").innerHTML = "";
    var f = modalOnClose; modalOnClose = null;
    if (f) f();
  }
  function modalOpen() { return !$("modalBack").classList.contains("hidden"); }

  /* ================= music helpers ================= */
  var LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  var LETTER_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var SOLFEGE = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
  var COLORS = { C: "#ff6b6b", D: "#ffa94d", E: "#ffd43b", F: "#69db7c", G: "#38d9a9", A: "#4dabf7", B: "#b197fc" };
  var SHARP_SPELL = [["C", ""], ["C", "#"], ["D", ""], ["D", "#"], ["E", ""], ["F", ""], ["F", "#"], ["G", ""], ["G", "#"], ["A", ""], ["A", "#"], ["B", ""]];

  function parseName(s) {
    var m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
    if (!m) throw new Error("Bad note: " + s);
    var letter = m[1], acc = m[2] || "", oct = parseInt(m[3], 10);
    var midi = (oct + 1) * 12 + LETTER_SEMI[letter] + (acc === "#" ? 1 : acc === "b" ? -1 : 0);
    return { midi: midi, letter: letter, acc: acc, oct: oct, step: oct * 7 + LETTERS.indexOf(letter) };
  }
  function spellMidi(midi) {
    var sp = SHARP_SPELL[midi % 12], oct = Math.floor(midi / 12) - 1;
    return { midi: midi, letter: sp[0], acc: sp[1], oct: oct, step: oct * 7 + LETTERS.indexOf(sp[0]) };
  }
  function parseDur(s) {
    if (s.indexOf("/") >= 0) { var p = s.split("/"); return parseFloat(p[0]) / parseFloat(p[1]); }
    return parseFloat(s);
  }
  function accSym(a) { return a === "#" ? "♯" : a === "b" ? "♭" : ""; }
  function noteLabel(n) {
    var base = settings.names === "solfege" ? SOLFEGE[n.letter] : n.letter;
    return base + accSym(n.acc);
  }
  function isBlack(midi) { var p = midi % 12; return p === 1 || p === 3 || p === 6 || p === 8 || p === 10; }

  function buildModel(song) {
    var t = 0, notes = [], rests = [], parts = [], minDur = 1;
    song.parts.forEach(function (p, pi) {
      var start = t;
      p.notes.split(/\s+/).forEach(function (tok) {
        if (!tok || tok === "|") return;
        var bits = tok.split(":");
        var d = parseDur(bits[1] || "1");
        if (!(d > 0)) throw new Error("Bad duration in " + song.id + ": " + tok);
        if (bits[0] === "R") rests.push({ t: t, d: d });
        else {
          var n = parseName(bits[0]);
          n.t = t; n.d = d; n.part = pi; n.idx = notes.length; n.state = "pending";
          notes.push(n);
          if (d < minDur) minDur = d;
        }
        t += d;
      });
      parts.push({ name: p.name, start: start, end: t, bpm: p.bpm || song.bpm });
    });
    var meter = song.meter || [4, 4];
    var unit = 4 / meter[1];
    var barLen = meter[0] * unit;
    var groups = song.groups || (meter[1] === 8 && meter[0] % 3 === 0 ? repeat(3, meter[0] / 3) : repeat(1, meter[0]));
    var pickup = song.pickup || 0;
    var bars = [];
    for (var b = pickup > 0 ? pickup : barLen; b < t - 1e-6; b += barLen) bars.push(b);
    var clicks = [];
    for (var bs = pickup - barLen * 3; bs < t; bs += barLen) {
      var acc = bs;
      groups.forEach(function (g, gi) { clicks.push({ t: acc, accent: gi === 0 }); acc += g * unit; });
    }
    var lo = 999, hi = -1;
    notes.forEach(function (n) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); });
    return { song: song, notes: notes, rests: rests, parts: parts, total: t, meter: meter, barLen: barLen, unit: unit, bars: bars, clicks: clicks, lo: lo, hi: hi, minDur: minDur };
  }
  function repeat(v, n) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

  /* ================= computer keyboard mapping ================= */
  /* Main keyboard ("low manual"): white keys Z X C V B N M , . /
     black keys on the row above: A S D F G H J K L ; '  (each sits between two white keys,
     A is left of Z and ' is right of /). Unused black slots (e.g. F between E and F) stay silent.
     Songs that need more room continue upwards on Q W E R T Y U I O P [ ] with 1..0 - = as black keys.
     The first white key (Z) is chosen per song so the whole melody fits on the bottom rows. */
  var LOW_WHITE = ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"];
  var LOW_BLACK = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"];
  var HIGH_WHITE = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"];
  var HIGH_BLACK = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"];
  var CODE_LABEL = { Comma: ",", Period: ".", Semicolon: ";", Slash: "/", Quote: "'", BracketLeft: "[", BracketRight: "]", Equal: "=", Minus: "-" };
  function codeLabel(c) { return CODE_LABEL[c] || c.replace("Key", "").replace("Digit", ""); }

  function whitesFrom(w, n) { var a = []; while (a.length < n) { if (!isBlack(w)) a.push(w); w++; } return a; }
  function nextWhite(m) { m++; while (isBlack(m)) m++; return m; }
  function buildMap(w0) {
    var c2m = {}, m2c = {};
    function manual(whites, wcodes, bcodes) {
      whites.forEach(function (m, i) { c2m[wcodes[i]] = m; if (!(m in m2c)) m2c[m] = wcodes[i]; });
      for (var i = 0; i <= whites.length && i < bcodes.length; i++) {
        var b = i < whites.length ? whites[i] - 1 : whites[whites.length - 1] + 1;
        if (!isBlack(b)) continue;
        c2m[bcodes[i]] = b;
        if (!(b in m2c)) m2c[b] = bcodes[i];
      }
    }
    var low = whitesFrom(w0, LOW_WHITE.length);
    manual(low, LOW_WHITE, LOW_BLACK);
    var high = whitesFrom(nextWhite(low[low.length - 1]), HIGH_WHITE.length);
    manual(high, HIGH_WHITE, HIGH_BLACK);
    var lowHi = low[low.length - 1] + (isBlack(low[low.length - 1] + 1) ? 1 : 0);
    var lowLo = low[0] - (isBlack(low[0] - 1) ? 1 : 0);
    var hiTop = high[high.length - 1] + (isBlack(high[high.length - 1] + 1) ? 1 : 0);
    return { w0: w0, c2m: c2m, m2c: m2c, lowLo: lowLo, lowHi: lowHi, top: hiTop };
  }
  // pick the first white key so the melody fits the bottom two rows, preferring Z = C, then F, G, D, A, E, B
  function chooseStart(lo, hi) {
    var pref = [0, 5, 7, 2, 9, 4, 11], best = null;
    for (var w = lo - 16; w <= lo + 1; w++) {
      if (isBlack(w)) continue;
      var mp = buildMap(w);
      if (lo < mp.lowLo || hi > mp.top) continue;
      var onLow = 0, total = 0;
      if (cur.model) cur.model.notes.forEach(function (n) { total++; if (n.midi <= mp.lowHi && n.midi >= mp.lowLo) onLow++; });
      var allLow = hi <= mp.lowHi;
      var score = (allLow ? 1e6 : onLow * 100) - pref.indexOf(w % 12) * 10 - Math.abs(w - 60) * 0.01;
      if (!best || score > best.score) best = { w: w, score: score };
    }
    return best ? best.w : 60;
  }
  function keyForMidi(midi) {
    var c = cur.map && cur.map.m2c[midi];
    return c ? codeLabel(c) : "";
  }
  // phones/tablets without a keyboard: show note names only
  var touchOnly = window.matchMedia ? matchMedia("(hover: none) and (pointer: coarse)").matches : false;
  function keyLabelFor(midi) { return touchOnly ? "" : keyForMidi(midi); }
  function midiForCode(code) {
    var m = cur.map ? cur.map.c2m[code] : undefined;
    return m == null ? null : m;
  }
  function setStart(w0) { cur.base = w0; cur.map = buildMap(w0); }

  /* ================= flags ================= */
  var FLAGS = {
    romani: { glow: "rgba(40,110,255,.35)", svg: '<rect width="60" height="20" fill="#2a63c9"/><rect y="20" width="60" height="20" fill="#2e9e4f"/><g stroke="#e0262b" stroke-width="2" fill="none"><circle cx="30" cy="20" r="10"/><circle cx="30" cy="20" r="2.2" fill="#e0262b"/><path d="M30 10v20M20 20h20M23 13l14 14M37 13 23 27M26.2 10.8l7.6 18.4M33.8 10.8l-7.6 18.4M20.8 16.2l18.4 7.6M39.2 16.2l-18.4 7.6"/></g>' },
    mk: { glow: "rgba(255,180,0,.32)", svg: '<rect width="60" height="40" fill="#d20000"/><g fill="#ffe600"><path d="M30 20 0 0h9zM30 20 60 0h-9zM30 20 0 40h9zM30 20 60 40h-9zM30 20 26 0h8zM30 20 26 40h8zM30 20 0 16v8zM30 20 60 16v8z"/><circle cx="30" cy="20" r="7" stroke="#d20000" stroke-width="1.6"/></g>' },
    bg: { glow: "rgba(0,170,110,.3)", svg: '<rect width="60" height="14" fill="#fff"/><rect y="13" width="60" height="14" fill="#00966e"/><rect y="26.5" width="60" height="13.5" fill="#d62612"/>' },
    ru: { glow: "rgba(60,90,255,.3)", svg: '<rect width="60" height="14" fill="#fff"/><rect y="13" width="60" height="14" fill="#0039a6"/><rect y="26.5" width="60" height="13.5" fill="#d52b1e"/>' },
    il: { glow: "rgba(60,120,255,.28)", svg: '<rect width="60" height="40" fill="#fff"/><rect y="4" width="60" height="6" fill="#0038b8"/><rect y="30" width="60" height="6" fill="#0038b8"/><g fill="none" stroke="#0038b8" stroke-width="1.8"><path d="M30 11.5 37.4 24.3H22.6z"/><path d="M30 28.5 22.6 15.7H37.4z"/></g>' },
    it: { glow: "rgba(0,160,80,.3)", svg: '<rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ce2b37"/>' },
    en: { glow: "rgba(230,40,60,.28)", svg: '<rect width="60" height="40" fill="#fff"/><rect x="26" width="8" height="40" fill="#ce1124"/><rect y="16" width="60" height="8" fill="#ce1124"/>' },
    de: { glow: "rgba(255,200,0,.28)", svg: '<rect width="60" height="14" fill="#111"/><rect y="13" width="60" height="14" fill="#dd0000"/><rect y="26.5" width="60" height="13.5" fill="#ffce00"/>' },
    moon: { glow: "rgba(255,220,120,.3)", svg: '<defs><linearGradient id="nm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a6b"/><stop offset="1" stop-color="#3b1d5e"/></linearGradient></defs><rect width="60" height="40" fill="url(#nm)"/><path d="M35 8a12 12 0 1 0 6 21 10 10 0 1 1-6-21z" fill="#ffe08a"/><g fill="#fff"><circle cx="12" cy="10" r="1"/><circle cx="20" cy="28" r=".8"/><circle cx="50" cy="12" r="1.1"/><circle cx="9" cy="30" r=".7"/><circle cx="52" cy="31" r=".8"/></g>' },
    note: { glow: "rgba(46,196,255,.3)", svg: '<defs><linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b6cff"/><stop offset="1" stop-color="#2ec4ff"/></linearGradient></defs><rect width="60" height="40" fill="url(#ng)"/><path d="M26 9h16v6H30v13a5 5 0 1 1-4-4.9z" fill="#fff"/>' }
  };
  function flagHtml(key) {
    var f = FLAGS[key] || FLAGS.note;
    return '<div class="flag"><svg viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice">' + f.svg + "</svg></div>";
  }

  /* ================= state ================= */
  var settings = load("pb_settings", {});
  settings = Object.assign({ names: "letters", keyLabels: true, view: "both", metronome: false, loop: false, volume: 0.9, speed: { listen: 100, practice: 60, play: 80 } }, settings);
  var progress = load("pb_progress", {});
  var customSongs = load("pb_custom", []);
  function saveSettings() { save("pb_settings", settings); }
  function allSongs() { return window.PB_SONGS.concat(customSongs); }
  function songById(id) { var s = allSongs(); for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i]; return null; }

  var cur = { song: null, model: null, sel: 0, mode: "practice", base: 60, keys: {}, dispLo: 60, dispHi: 79 };
  var run = null; // active session

  function partKey(sel) { return sel < 0 ? "all" : String(sel); }
  function getProg(songId, sel) {
    var s = progress[songId] || {};
    return s[partKey(sel)] || { listen: false, practice: 0, play: 0, best: 0 };
  }
  function setProg(songId, sel, patch) {
    var s = progress[songId] || (progress[songId] = {});
    var p = s[partKey(sel)] || { listen: false, practice: 0, play: 0, best: 0 };
    if (patch.listen) p.listen = true;
    if (patch.practice != null) p.practice = Math.max(p.practice, patch.practice);
    if (patch.play != null) p.play = Math.max(p.play, patch.play);
    if (patch.best != null) p.best = Math.max(p.best, patch.best);
    s[partKey(sel)] = p;
    save("pb_progress", progress);
  }

  /* ================= library ================= */
  var filter = "all";
  function renderLibrary() {
    var q = $("searchInput").value.trim().toLowerCase();
    var grid = $("songGrid");
    grid.innerHTML = "";
    var list = allSongs().filter(function (s) {
      if (filter !== "all" && s.region !== filter) return false;
      if (!q) return true;
      return (s.title + " " + (s.alt || "") + " " + (s.origin || "")).toLowerCase().indexOf(q) >= 0;
    });
    if (filter === "all" && !q) {
      var fc = el("button", "card free-card");
      fc.innerHTML = '<div class="card-top"><div class="medal free-medal">🎹</div><div><h3>Free play</h3><div class="sub">No song, no score: just play</div></div></div>' +
        '<div class="card-mid"><span class="badge">Chords</span><span class="badge">Record &amp; play back</span><span class="badge">Save as a song</span></div>' +
        '<div class="card-bottom"><span class="small muted">Make up your own tunes</span><span class="go">Play ▶</span></div>';
      fc.addEventListener("click", function () { location.hash = "#/free"; });
      grid.appendChild(fc);
    }
    if (!list.length) {
      grid.appendChild(el("div", "muted", filter === "mine" ? "No imports yet. Use <b>Import MIDI</b> to add any song from a .mid file." : "No songs match your search."));
      return;
    }
    list.forEach(function (s) {
      var card = el(s.comingSoon ? "div" : "button", "card" + (s.comingSoon ? " soon" : ""));
      card.style.setProperty("--glow", (FLAGS[s.flag] || FLAGS.note).glow);
      var badges = "";
      if (s.comingSoon) badges += '<span class="badge soon">Coming soon</span>';
      else if (s.source === "sheet") badges += '<span class="badge sheet" title="' + esc(s.sourceNote) + '">✓ From sheet music</span>';
      else if (s.source === "memory") badges += '<span class="badge memory" title="' + esc(s.sourceNote) + '">From memory · check by ear</span>';
      else if (s.source === "import") badges += '<span class="badge mine">My import</span>';
      else badges += '<span class="badge">Classic</span>';
      var lvl = '<span class="badge level" title="Difficulty">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= s.level ? "on" : "") + '"></i>'; }).join("") + "</span>";
      var bottom;
      if (s.comingSoon) bottom = '<div class="muted small">' + esc(s.sourceNote) + "</div>";
      else {
        var n = s.parts.length, learned = 0, starSum = 0;
        for (var i = 0; i < n; i++) { var p = getProg(s.id, i); if (p.play >= 2) learned++; starSum += p.play; }
        var all = getProg(s.id, -1);
        var pct = Math.round(100 * (starSum + all.play) / (3 * (n + 1)));
        bottom = '<div class="progress" title="' + pct + '% complete"><div style="transform:scaleX(' + pct / 100 + ')"></div></div>' +
          '<span class="small muted">' + learned + "/" + n + " parts</span>" + (all.play ? starsHtml(all.play) : "");
      }
      card.innerHTML =
        '<div class="card-top">' + flagHtml(s.flag) + '<div><h3>' + esc(s.title) + '</h3><div class="sub">' + esc(s.alt || "") + (s.origin ? " · " + esc(s.origin) : "") + "</div></div></div>" +
        '<div class="card-mid">' + badges + lvl + (s.parts ? '<span class="badge">' + s.parts.length + " parts</span>" : "") + "</div>" +
        '<div class="card-bottom">' + bottom + "</div>";
      if (s.custom) {
        var del = el("button", "del", "✕");
        del.title = "Remove this import";
        del.addEventListener("click", function (e) { e.stopPropagation(); confirmDelete(s); });
        card.appendChild(del);
      }
      if (!s.comingSoon) card.addEventListener("click", function () { location.hash = "#/song/" + s.id; });
      grid.appendChild(card);
    });
  }
  function confirmDelete(s) {
    var m = openModal('<h3>Remove “' + esc(s.title) + '”?</h3><p>This deletes the imported song and its progress from this device.</p><div class="modal-actions"><button class="btn" data-a="no">Keep it</button><button class="btn danger" data-a="yes">Remove</button></div>');
    m.querySelector('[data-a=no]').onclick = closeModal;
    m.querySelector('[data-a=yes]').onclick = function () {
      customSongs = customSongs.filter(function (x) { return x.id !== s.id; });
      save("pb_custom", customSongs);
      delete progress[s.id]; save("pb_progress", progress);
      closeModal(); renderLibrary(); toast("Removed");
    };
  }

  /* ================= song view ================= */
  function openSong(id) {
    var s = songById(id);
    if (!s || s.comingSoon) { location.hash = "#/"; return; }
    stopRun(true);
    var model;
    try { model = buildModel(s); } catch (e) { toast("Could not read this song: " + esc(e.message), "bad"); location.hash = "#/"; return; }
    leaveFree();
    cur.song = s; cur.model = model;
    setStart(chooseStart(model.lo, model.hi));
    var last = load("pb_last_" + s.id, null);
    cur.sel = last && last.sel != null && last.sel < model.parts.length ? last.sel : 0;
    cur.mode = last && last.mode ? last.mode : "listen";
    showView("song");
    $("topTitle").textContent = s.title;
    $("songFlag").innerHTML = flagHtml(s.flag);
    $("songTitle").textContent = s.title;
    var meta = [];
    if (s.alt) meta.push(esc(s.alt));
    if (s.origin) meta.push(esc(s.origin));
    if (s.key) meta.push(esc(s.key));
    meta.push(model.meter[0] + "/" + model.meter[1]);
    meta.push(s.bpm + " bpm");
    if (s.source === "memory") meta.push('<span style="color:#ffe2a3">written from memory: tell me if a note sounds wrong</span>');
    else if (s.sourceNote) meta.push(esc(s.sourceNote));
    $("songMeta").innerHTML = meta.join(" · ");
    renderParts();
    setMode(cur.mode, true);
    applyView();
    layoutStage();
    renderCoach();
    resetIdle();
    maybeRotateTip();
  }

  function renderParts() {
    var box = $("partChips");
    box.innerHTML = "";
    var parts = cur.model.parts.slice();
    parts.forEach(function (p, i) { box.appendChild(partChip(i, "Part " + (i + 1), p.name)); });
    box.appendChild(partChip(-1, "Everything", "Whole song"));
  }
  function partChip(sel, label, name) {
    var p = getProg(cur.song.id, sel);
    var b = el("button", "part" + (cur.sel === sel ? " active" : ""));
    b.innerHTML = '<div class="pn">' + esc(label) + '</div><div class="pt">' + esc(name) + '</div><div class="ps"><span title="Practice stars">🐢 ' + starsHtml(p.practice) + '</span><span title="Play stars">🎯 ' + starsHtml(p.play) + "</span></div>";
    b.addEventListener("click", function () { selectPart(sel); });
    return b;
  }
  function selectPart(sel) {
    if (run && run.running) stopRun(true);
    cur.sel = sel;
    rememberLast();
    renderParts();
    var chip = $("partChips").children[sel < 0 ? cur.model.parts.length : sel];
    if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    renderCoach();
    resetIdle();
  }
  function rememberLast() { save("pb_last_" + cur.song.id, { sel: cur.sel, mode: cur.mode }); }

  function setMode(mode, silent) {
    if (run && run.running && !silent) stopRun(true);
    cur.mode = mode;
    Array.prototype.forEach.call($("modeSeg").children, function (b) { b.classList.toggle("active", b.getAttribute("data-mode") === mode); });
    var sp = settings.speed[mode] || 100;
    $("speedRange").value = sp;
    updateSpeedLabel();
    if (!silent) { rememberLast(); resetIdle(); }
  }
  function updateSpeedLabel() {
    var v = +$("speedRange").value;
    $("speedVal").textContent = v + "%";
    $("speedRange").style.setProperty("--p", ((v - 30) / 90 * 100) + "%");
  }

  function selRange(sel) {
    var m = cur.model;
    if (sel < 0) return { start: 0, end: m.total, name: "Whole song", bpm: m.parts[0].bpm };
    var p = m.parts[sel];
    return { start: p.start, end: p.end, name: p.name, bpm: p.bpm };
  }

  function suggestion() {
    var s = cur.song, n = cur.model.parts.length;
    for (var i = 0; i < n; i++) {
      var p = getProg(s.id, i);
      var nm = "<b>Part " + (i + 1) + "</b>";
      if (!p.listen && p.practice < 1) return { sel: i, mode: "listen", speed: 100, ico: "👂", text: "Start by listening to " + nm + " so you know how it goes." };
      if (p.practice < 2) return { sel: i, mode: "practice", speed: settings.speed.practice || 60, ico: "🐢", text: "Practise " + nm + " slowly. The notes wait for you." };
      if (p.play < 2) return { sel: i, mode: "play", speed: Math.max(70, settings.speed.play || 80), ico: "🎯", text: "Now play " + nm + " in time and earn 2 stars." };
    }
    var all = getProg(s.id, -1);
    if (all.play < 2) return { sel: -1, mode: "play", speed: 85, ico: "🏆", text: "All parts learned! Play the <b>whole song</b>." };
    if (all.play < 3) return { sel: -1, mode: "play", speed: 100, ico: "🔥", text: "Go for 3 stars on the whole song at full speed." };
    return { sel: -1, mode: "play", speed: 110, ico: "🌟", text: "You've mastered it! Try 110% speed, or pick a new song." };
  }
  function renderCoach() {
    var sg = suggestion();
    var c = $("coach");
    c.innerHTML = '<span class="coach-ico">' + sg.ico + '</span><span class="coach-text">' + sg.text + '</span><button class="btn primary">Let\u2019s go</button>';
    c.querySelector("button").onclick = function () {
      if (run && run.running) stopRun(true);
      cur.sel = sg.sel; renderParts();
      setMode(sg.mode, true);
      $("speedRange").value = sg.speed; updateSpeedLabel();
      settings.speed[sg.mode] = sg.speed; saveSettings();
      rememberLast();
      startRun();
    };
  }

  /* ================= stage layout & piano ================= */
  var fall = { cv: null, ctx: null, W: 0, H: 0, dpr: 1 };
  var sheet = { cv: null, ctx: null, W: 0, H: 0, dpr: 1 };
  var keyGeo = {}; // midi -> {x, w, black}

  function applyView() {
    var st = $("stage");
    st.classList.remove("view-notes", "view-sheet", "view-both");
    st.classList.add("view-" + settings.view);
    $("viewTogLabel").textContent = { both: "Notes + Sheet", notes: "Falling notes", sheet: "Sheet music" }[settings.view];
    $("metroTog").classList.toggle("on", !!settings.metronome);
    $("loopTog").classList.toggle("on", !!settings.loop);
  }

  function layoutStage() {
    if (!cur.model) return;
    var pianoEl = $("piano");
    var W = pianoEl.clientWidth || window.innerWidth;
    var m = cur.model, lo = m.lo, hi = m.hi;
    if (cur.free) { lo = cur.map.lowLo; hi = W >= 1000 ? cur.map.top : cur.map.lowHi; }
    var dLo, dHi;
    if (W >= 1000) { dLo = Math.min(lo, cur.map.lowLo); dHi = Math.max(hi, hi > cur.map.lowHi ? Math.min(cur.map.top, hi + 4) : cur.map.lowHi); }
    else if (W >= 620) { dLo = lo - 3; dHi = hi + 3; }
    else { dLo = lo - 1; dHi = hi + 1; }
    if (isBlack(dLo)) dLo--;
    if (isBlack(dHi)) dHi++;
    cur.dispLo = dLo; cur.dispHi = dHi;
    var whites = 0;
    for (var k = dLo; k <= dHi; k++) if (!isBlack(k)) whites++;
    var ww = W / whites, bw = ww * 0.62;
    keyGeo = {};
    pianoEl.innerHTML = "";
    cur.keys = {};
    var wi = 0;
    for (var midi = dLo; midi <= dHi; midi++) {
      var black = isBlack(midi), x, w;
      if (!black) { x = wi * ww; w = ww; wi++; }
      else { x = wi * ww - bw / 2; w = bw; }
      keyGeo[midi] = { x: x, w: w, black: black };
      var sp = spellMidi(midi);
      // prefer the song's own spelling (e.g. Bb instead of A#)
      var songSp = null;
      for (var j = 0; j < m.notes.length; j++) if (m.notes[j].midi === midi) { songSp = m.notes[j]; break; }
      var nm = songSp || sp;
      var key = el("div", "key " + (black ? "black" : "white") + (midi >= lo && midi <= hi ? " inrange" : " outrange"));
      key.style.left = x + "px";
      key.style.width = (black ? w : w - 1) + "px";
      key.style.setProperty("--kc", COLORS[nm.letter]);
      key.setAttribute("data-midi", midi);
      var kl = keyLabelFor(midi);
      key.innerHTML = (kl ? '<span class="kl">' + esc(kl) + "</span>" : "") + '<span class="nl">' + esc(noteLabel(nm)) + (nm.letter === "C" && !nm.acc ? nm.oct : "") + "</span>";
      pianoEl.appendChild(key);
      cur.keys[midi] = key;
    }
    sizeCanvas(fall, $("fallCanvas"));
    sizeCanvas(sheet, $("sheetCanvas"));
  }
  function sizeCanvas(o, cv) {
    o.cv = cv; o.ctx = cv.getContext("2d");
    var r = cv.parentNode.getBoundingClientRect();
    o.dpr = Math.min(window.devicePixelRatio || 1, 2);
    o.W = Math.max(1, r.width); o.H = Math.max(1, r.height);
    cv.width = Math.round(o.W * o.dpr); cv.height = Math.round(o.H * o.dpr);
    o.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  }

  /* ================= input ================= */
  var held = {}; // midi -> count
  var pointerKeys = {}; // pointerId -> midi

  function press(midi) {
    PBAudio.noteOn(midi, 0.85);
    held[midi] = (held[midi] || 0) + 1;
    var k = cur.keys[midi];
    if (k) { k.classList.add("down", "lit"); }
    if (cur.free) freePress(midi);
    judgePress(midi);
  }
  function release(midi) {
    if (!held[midi]) return;
    held[midi]--;
    if (held[midi] > 0) return;
    delete held[midi];
    PBAudio.noteOff(midi);
    var k = cur.keys[midi];
    if (k) k.classList.remove("down", "lit");
    if (cur.free) freeRelease(midi);
  }
  function flashWrong(midi) {
    var k = cur.keys[midi];
    if (!k) return;
    k.classList.remove("wrong"); void k.offsetWidth; k.classList.add("wrong");
    setTimeout(function () { k.classList.remove("wrong"); }, 300);
  }

  function setupInput() {
    document.addEventListener("keydown", function (e) {
      unlockAudio();
      var tag = (e.target && e.target.tagName) || "";
      var typing = tag === "INPUT" && e.target.type !== "range" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.code === "Escape") {
        if (modalOpen()) { closeModal(); return; }
        if (run && run.running) { stopRun(true); return; }
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (modalOpen()) return;
      if (!cur.song || $("songView").classList.contains("hidden")) return;
      if (cur.free && (e.code === "ArrowRight" || e.code === "ArrowLeft")) {
        e.preventDefault(); shiftOctave(e.code === "ArrowRight" ? 1 : -1); return;
      }
      if (cur.free && (e.code === "Space" || e.code === "Enter")) { e.preventDefault(); return; }
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        toggleRun();
        return;
      }
      if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
        e.preventDefault();
        var n = cur.model.parts.length;
        var order = []; for (var i = 0; i < n; i++) order.push(i); order.push(-1);
        var pos = order.indexOf(cur.sel) + (e.code === "ArrowRight" ? 1 : -1);
        selectPart(order[(pos + order.length) % order.length]);
        return;
      }
      var midi = midiForCode(e.code);
      if (midi == null) return;
      e.preventDefault();
      if (e.repeat) return;
      press(midi);
    });
    document.addEventListener("keyup", function (e) {
      var midi = midiForCode(e.code);
      if (midi != null && cur.song) release(midi);
    });
    window.addEventListener("blur", function () { Object.keys(held).forEach(function (m) { held[m] = 1; release(+m); }); });

    var pianoEl = $("piano");
    function keyAt(x, y) {
      var t = document.elementFromPoint(x, y);
      while (t && t !== pianoEl && !t.getAttribute("data-midi")) t = t.parentNode;
      return t && t !== pianoEl && t.getAttribute ? +t.getAttribute("data-midi") : null;
    }
    pianoEl.addEventListener("pointerdown", function (e) {
      unlockAudio();
      e.preventDefault();
      var m = keyAt(e.clientX, e.clientY);
      if (m == null) return;
      pointerKeys[e.pointerId] = m;
      press(m);
    });
    pianoEl.addEventListener("pointermove", function (e) {
      if (!(e.pointerId in pointerKeys)) return;
      var m = keyAt(e.clientX, e.clientY);
      if (m == null || m === pointerKeys[e.pointerId]) return;
      release(pointerKeys[e.pointerId]);
      pointerKeys[e.pointerId] = m;
      press(m);
    });
    function up(e) {
      if (!(e.pointerId in pointerKeys)) return;
      release(pointerKeys[e.pointerId]);
      delete pointerKeys[e.pointerId];
    }
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    pianoEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  var audioUnlocked = false, samplesReady = false;
  function unlockAudio() {
    if (!audioUnlocked) {
      audioUnlocked = true;
      PBAudio.ensure();
      if (samplesReady) PBAudio.load();
    } else PBAudio.ensure();
  }

  /* ================= session engine ================= */
  var PERFECT = 0.1, GOOD = 0.22; // seconds

  function startRun() {
    unlockAudio();
    if (!cur.model) return;
    stopRun(true);
    var r = selRange(cur.sel);
    var m = cur.model;
    var notes = m.notes.filter(function (n) { return n.t >= r.start - 1e-6 && n.t < r.end - 1e-6; });
    notes.forEach(function (n) { n.state = "pending"; n.err = 0; });
    var countIn = m.barLen >= 2 ? m.barLen : m.barLen * 2;
    var runStart = r.start - countIn;
    var clicks = m.clicks.filter(function (c) { return c.t >= runStart - 1e-6 && c.t < r.end - 1e-6; });
    var countClicks = clicks.filter(function (c) { return c.t < r.start - 1e-6; }).length;
    run = {
      mode: cur.mode, sel: cur.sel, start: r.start, end: r.end, name: r.name,
      beat: runStart, runStart: runStart, speed: (+$("speedRange").value) / 100,
      notes: notes, clicks: clicks, ci: 0, countClicks: countClicks, li: 0,
      running: true, paused: false, waiting: false, waitSince: 0,
      hits: 0, mistakes: 0, perfect: 0, good: 0, miss: 0, wrong: 0, combo: 0, maxCombo: 0,
      effects: [], lastFrame: performance.now()
    };
    settings.speed[cur.mode] = Math.round(run.speed * 100); saveSettings();
    $("idleCard").classList.add("hidden");
    $("startIco").textContent = "❚❚"; $("startLabel").textContent = "Pause";
    $("hudMode").textContent = { listen: "👂 LISTEN", practice: "🐢 PRACTICE", play: "🎯 PLAY" }[run.mode] + " · " + (cur.sel < 0 ? "Whole song" : "Part " + (cur.sel + 1));
    updateHud();
  }

  function toggleRun() {
    if (!run || !run.running) { startRun(); return; }
    run.paused = !run.paused;
    if (run.paused) { PBAudio.allOff(); $("startIco").textContent = "▶"; $("startLabel").textContent = "Resume"; showCount(""); }
    else { run.lastFrame = performance.now(); $("startIco").textContent = "❚❚"; $("startLabel").textContent = "Pause"; }
  }

  function stopRun(silent) {
    if (run) { run.running = false; PBAudio.allOff(); }
    run = null;
    $("startIco").textContent = "▶"; $("startLabel").textContent = "Start";
    $("hint").classList.add("hidden");
    showCount("");
    clearTargets();
    Object.keys(cur.keys).forEach(function (k) { if (!held[k]) cur.keys[k].classList.remove("lit", "down"); });
    void silent;
    if (cur.song) resetIdle();
  }

  function bpmAt(beat) {
    var ps = cur.model.parts;
    for (var i = 0; i < ps.length; i++) if (beat < ps[i].end) return ps[Math.max(0, i)].bpm;
    return ps[ps.length - 1].bpm;
  }
  function beatsPerSec(beat) { return bpmAt(Math.max(beat, run ? run.start : 0)) / 60 * (run ? run.speed : 1); }

  function nextPending() {
    for (var i = 0; i < run.notes.length; i++) if (run.notes[i].state === "pending") return run.notes[i];
    return null;
  }

  var lastCount = null;
  function showCount(txt) {
    var c = $("countdown");
    if (txt === lastCount) return;
    lastCount = txt;
    if (!txt) { c.classList.add("hidden"); return; }
    c.textContent = txt;
    c.classList.remove("hidden", "pop"); void c.offsetWidth; c.classList.add("pop");
  }

  function step(now) {
    if (!run || !run.running || run.paused) return;
    var dt = Math.min(0.1, (now - run.lastFrame) / 1000);
    run.lastFrame = now;
    var bps = beatsPerSec(run.beat);
    var adv = dt * bps;
    if (run.mode === "practice" && run.beat >= run.start - 1e-6) {
      var tgt = nextPending();
      if (tgt && run.beat + adv >= tgt.t) {
        if (!run.waiting) { run.waiting = true; run.waitSince = now; }
        run.beat = tgt.t;
      } else { run.waiting = false; run.beat += adv; }
    } else run.beat += adv;

    // clicks (count-in always, then metronome if on)
    while (run.ci < run.clicks.length && run.clicks[run.ci].t <= run.beat) {
      var c = run.clicks[run.ci];
      var counting = run.ci < run.countClicks;
      if (counting || settings.metronome) PBAudio.click(c.accent);
      if (counting) showCount(String(run.countClicks - run.ci));
      run.ci++;
    }
    if (run.beat >= run.start - 0.02) showCount("");

    if (run.mode === "listen") {
      while (run.li < run.notes.length && run.notes[run.li].t <= run.beat) {
        var n = run.notes[run.li];
        var durSec = n.d / bps;
        PBAudio.noteOn(n.midi, 0.78, durSec * 0.95);
        n.state = "hit";
        lightKey(n.midi, durSec * 0.9);
        addEffect(n, "");
        run.li++;
      }
    } else if (run.mode === "play") {
      var win = GOOD * bps;
      run.notes.forEach(function (n2) {
        if (n2.state === "pending" && n2.t + win < run.beat) {
          n2.state = "miss"; run.miss++; run.combo = 0; addEffect(n2, "Miss");
        }
      });
    }

    // targets & hint
    updateTargets(now);
    updateHud();

    var done = run.beat >= run.end + 0.25;
    if (run.mode === "practice") done = !nextPending() && run.beat >= run.end - 1e-6;
    if (run.mode === "practice" && !nextPending()) run.beat = Math.min(run.beat, run.end);
    if (done) finishRun();
  }

  function judgePress(midi) {
    if (!run || !run.running || run.paused) return;
    if (run.mode === "listen") return;
    if (run.beat < run.start - 0.6) return; // still counting in
    if (run.mode === "practice") {
      var t = nextPending();
      if (!t) return;
      var ahead = t.t - run.beat;
      if (t.midi === midi && ahead <= 1.01) {
        t.state = "hit"; run.hits++; run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo);
        addEffect(t, run.combo >= 5 && run.combo % 5 === 0 ? run.combo + " in a row!" : "✓");
      } else if (ahead <= 1.01) {
        run.mistakes++; run.combo = 0; flashWrong(midi);
      }
      return;
    }
    // play mode
    var bps = beatsPerSec(run.beat), best = null, bestErr = 1e9;
    run.notes.forEach(function (n) {
      if (n.state !== "pending" || n.midi !== midi) return;
      var err = Math.abs(n.t - run.beat) / bps;
      if (err < bestErr) { bestErr = err; best = n; }
    });
    if (best && bestErr <= GOOD) {
      if (bestErr <= PERFECT) { best.state = "perfect"; run.perfect++; addEffect(best, "Perfect!"); }
      else { best.state = "good"; run.good++; addEffect(best, "Good"); }
      run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo);
    } else {
      run.wrong++; run.combo = 0; flashWrong(midi);
    }
  }

  var targetMidi = null;
  function clearTargets() {
    if (targetMidi != null && cur.keys[targetMidi]) cur.keys[targetMidi].classList.remove("target");
    targetMidi = null;
  }
  function updateTargets(now) {
    var want = null;
    if (run.mode === "practice" && run.beat >= run.start - 1.01) {
      var t = nextPending();
      if (t && t.t - run.beat <= 1.01) want = t;
    }
    var wm = want ? want.midi : null;
    if (wm !== targetMidi) {
      clearTargets();
      if (wm != null && cur.keys[wm]) cur.keys[wm].classList.add("target");
      targetMidi = wm;
    }
    var h = $("hint");
    if (want && run.waiting) {
      var kl = keyLabelFor(want.midi);
      var html = 'Next note <b style="color:' + COLORS[want.letter] + '">' + esc(noteLabel(want)) + "</b>" + (kl ? " · press <kbd>" + esc(kl) + "</kbd>" : " · tap the glowing key");
      if (h.innerHTML !== html) h.innerHTML = html;
      h.classList.remove("hidden");
    } else h.classList.add("hidden");
  }

  var litTimers = {};
  function lightKey(midi, sec) {
    var k = cur.keys[midi];
    if (!k) return;
    k.classList.add("lit");
    clearTimeout(litTimers[midi]);
    litTimers[midi] = setTimeout(function () { if (!held[midi]) k.classList.remove("lit"); }, Math.max(80, sec * 1000));
  }

  function addEffect(n, text) {
    if (!run) return;
    if (n.state !== "miss") burst(n.midi, performance.now());
    run.effects.push({ midi: n.midi, color: COLORS[n.letter], text: text, born: performance.now(), good: n.state !== "miss" });
    if (run.effects.length > 40) run.effects.shift();
  }

  function updateHud() {
    if (!run) return;
    var pct = clamp((run.beat - run.start) / (run.end - run.start), 0, 1);
    $("hudBar").style.transform = "scaleX(" + pct + ")";
    var s = "";
    var total = run.notes.length;
    if (run.mode === "practice") {
      var done = run.notes.filter(function (n) { return n.state === "hit"; }).length;
      s = stat("Notes", done + "/" + total) + stat("Mistakes", run.mistakes) + stat("Streak", run.combo);
    } else if (run.mode === "play") {
      var judged = run.perfect + run.good + run.miss;
      var acc = judged ? Math.round(100 * (run.perfect + 0.7 * run.good) / judged) : 100;
      s = stat("Accuracy", acc + "%") + stat("Combo", run.combo) + stat("Perfect", run.perfect);
    } else s = stat("Speed", Math.round(run.speed * 100) + "%");
    var hs = $("hudStats");
    if (hs.innerHTML !== s) hs.innerHTML = s;
  }
  function stat(k, v) { return '<span class="stat">' + k + "<b>" + v + "</b></span>"; }

  function finishRun() {
    var r = run;
    r.running = false;
    PBAudio.allOff();
    clearTargets();
    $("hint").classList.add("hidden");
    var songId = cur.song.id, total = r.notes.length || 1;
    var res = { mode: r.mode, stars: 0, score: 0 };
    if (r.mode === "listen") {
      setProg(songId, r.sel, { listen: true });
    } else if (r.mode === "practice") {
      var q = total / (total + r.mistakes);
      res.score = Math.round(q * 100);
      res.stars = q >= 0.95 ? 3 : q >= 0.8 ? 2 : 1;
      setProg(songId, r.sel, { listen: true, practice: res.stars });
    } else {
      var acc = (r.perfect + 0.7 * r.good) / total - Math.min(0.15, r.wrong * 0.01);
      acc = clamp(acc, 0, 1);
      res.score = Math.round(acc * 100);
      res.stars = acc >= 0.9 ? 3 : acc >= 0.75 ? 2 : acc >= 0.5 ? 1 : 0;
      // slow tempo caps the stars so 3 stars means you can really play it
      if (r.speed < 0.7 && res.stars > 2) res.stars = 2;
      setProg(songId, r.sel, { listen: true, play: res.stars, best: res.score });
    }
    renderParts();
    renderCoach();
    if (settings.loop && r.mode !== "listen") {
      toast((r.mode === "play" ? res.score + "% · " : "") + "★".repeat(res.stars) + " · again!", res.stars >= 2 ? "good" : "");
      setTimeout(function () { if (cur.song && songById(songId) === cur.song && !modalOpen()) startRun(); }, 1300);
      run = null;
      return;
    }
    if (settings.loop && r.mode === "listen") {
      setTimeout(function () { if (cur.song && !modalOpen()) startRun(); }, 900);
      run = null; return;
    }
    run = null;
    $("startIco").textContent = "▶"; $("startLabel").textContent = "Start";
    PBAudio.chime(res.stars >= 2 || r.mode === "listen");
    showResults(r, res);
  }

  function showResults(r, res) {
    var nextSel = r.sel >= 0 && r.sel < cur.model.parts.length - 1 ? r.sel + 1 : -1;
    var html;
    if (r.mode === "listen") {
      html = '<h3>Got the tune? 👂</h3><p>Now play it yourself. In <b>Practice</b> the notes wait for you, so take your time.</p>' +
        '<div class="modal-actions"><button class="btn" data-a="again">Listen again</button><button class="btn primary" data-a="practice">🐢 Practise it</button></div>';
    } else {
      var title = res.stars === 3 ? "Brilliant!" : res.stars === 2 ? "Great job!" : res.stars === 1 ? "Good start!" : "Keep going!";
      var tip = "";
      if (r.mode === "practice") tip = res.stars >= 2 ? "Ready for the real thing: try <b>Play</b> mode." : "Practise it once more. Fewer wrong keys means more stars.";
      else if (res.stars < 2) tip = "Slow the speed down a little, or go back to Practice for this part.";
      else if (r.speed < 0.7) tip = "To get 3 stars, play at 70% speed or faster.";
      else if (nextSel >= 0) tip = "On to the next part!";
      else tip = r.sel < 0 ? "You played the whole song!" : "Now try the whole song.";
      var grid = r.mode === "practice"
        ? '<div class="rg good"><b>' + r.hits + '</b><span>Notes</span></div><div class="rg bad"><b>' + r.mistakes + '</b><span>Wrong keys</span></div><div class="rg ok"><b>' + r.maxCombo + "</b><span>Best streak</span></div>"
        : '<div class="rg good"><b>' + r.perfect + '</b><span>Perfect</span></div><div class="rg ok"><b>' + r.good + '</b><span>Good</span></div><div class="rg bad"><b>' + r.miss + '</b><span>Missed</span></div><div class="rg"><b>' + r.maxCombo + "</b><span>Best combo</span></div>";
      var stars = "";
      for (var i = 0; i < 3; i++) stars += '<span class="' + (i < res.stars ? "on" : "") + '">★</span>';
      var nextBtn = "";
      if (r.mode === "practice" && res.stars >= 2) nextBtn = '<button class="btn primary" data-a="play">🎯 Play it</button>';
      else if (r.mode === "play" && res.stars >= 2 && nextSel >= 0) nextBtn = '<button class="btn primary" data-a="next">Next part ▶</button>';
      else if (r.mode === "play" && res.stars >= 2 && r.sel >= 0) nextBtn = '<button class="btn primary" data-a="whole">Whole song ▶</button>';
      html = "<h3>" + title + '</h3><div class="result-stars">' + stars + '</div><div class="result-score">' + res.score + '%</div><div class="result-sub">' + esc(r.mode === "practice" ? "Practice" : "Play") + " · " + esc(r.sel < 0 ? "Whole song" : "Part " + (r.sel + 1) + " · " + r.name) + " · " + Math.round(r.speed * 100) + '% speed</div>' +
        '<div class="result-grid">' + grid + "</div><p style=\"text-align:center;margin-top:14px\">" + tip + '</p><div class="modal-actions"><button class="btn" data-a="close">Close</button><button class="btn" data-a="again">↻ Try again</button>' + nextBtn + "</div>";
    }
    var m = openModal(html);
    function on(a, f) { var b = m.querySelector('[data-a="' + a + '"]'); if (b) b.onclick = f; }
    on("close", closeModal);
    on("again", function () { closeModal(); startRun(); });
    on("practice", function () { closeModal(); setMode("practice"); startRun(); });
    on("play", function () { closeModal(); setMode("play"); startRun(); });
    on("next", function () { closeModal(); selectPart(nextSel); setMode("practice"); });
    on("whole", function () { closeModal(); selectPart(-1); setMode("play"); });
  }

  function resetIdle() {
    var card = $("idleCard");
    if (!cur.model) return;
    if (cur.free) {
      card.innerHTML = "<h4>🎹 Free play</h4><p>No notes to follow, just play. Hold keys for long notes, press several for chords.</p>" +
        '<div class="keys-hint kb-only">White keys <kbd>Z</kbd> … <kbd>/</kbd> · black keys <kbd>A</kbd> … <kbd>\'</kbd> · higher up on <kbd>Q</kbd> … <kbd>]</kbd><br><kbd>←</kbd> <kbd>→</kbd> move an octave</div>' +
        '<div class="keys-hint touch-only">Tap the keys below.</div>';
      card.classList.remove("hidden");
      $("hudMode").textContent = "🎹 FREE PLAY";
      $("hudBar").style.transform = "scaleX(0)";
      $("hudStats").innerHTML = "";
      return;
    }
    var r = selRange(cur.sel);
    var modeTxt = {
      listen: ["👂 Listen", "The app plays this part so you can hear the melody."],
      practice: ["🐢 Practice", "Take your time: each note waits until you press the right key. Wrong keys only cost stars."],
      play: ["🎯 Play", "The notes keep moving. Hit each one as it reaches the line for Perfect or Good."]
    }[cur.mode];
    var keys = [], seen = {};
    cur.model.notes.forEach(function (n) {
      if (n.t < r.start - 1e-6 || n.t >= r.end - 1e-6 || seen[n.midi]) return;
      seen[n.midi] = 1; keys.push(n);
    });
    keys.sort(function (a, b) { return a.midi - b.midi; });
    var keyHtml = keys.map(function (n) { var k = keyForMidi(n.midi); return k ? "<kbd>" + esc(k) + "</kbd>" : ""; }).join("");
    card.innerHTML = "<h4>" + modeTxt[0] + " · " + esc(cur.sel < 0 ? "Whole song" : "Part " + (cur.sel + 1) + ": " + r.name) + "</h4><p>" + modeTxt[1] + "</p>" +
      '<div class="keys-hint kb-only">Keys in this part: ' + keyHtml + "<br>Press <kbd>Space</kbd> or <b>Start</b>.</div>" +
      '<div class="keys-hint touch-only">Tap <b>Start</b>, then tap the glowing keys.</div>';
    card.classList.remove("hidden");
    $("hudMode").textContent = "READY";
    $("hudBar").style.transform = "scaleX(0)";
    $("hudStats").innerHTML = "";
    cur.model.notes.forEach(function (n) { n.state = "pending"; });
  }

  /* ================= rendering ================= */
  function viewBeat() {
    if (run) return run.beat;
    var r = selRange(cur.sel);
    return r.start - 1;
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function drawFall(now) {
    var o = fall, c = o.ctx;
    if (!c || !cur.model) return;
    if (cur.free) { drawRising(now); return; }
    var W = o.W, H = o.H;
    c.clearRect(0, 0, W, H);
    var beat = viewBeat();
    var bpm = bpmAt(Math.max(beat, run ? run.start : selRange(cur.sel).start));
    var speed = run ? run.speed : (+$("speedRange").value) / 100;
    var pxPerSec = clamp(H * 0.6, 150, 340);
    var ppb = pxPerSec * 60 / (bpm * speed);
    var hitY = H - 3;

    // lanes
    c.fillStyle = "rgba(255,255,255,0.025)";
    for (var m = cur.dispLo; m <= cur.dispHi; m++) {
      var g = keyGeo[m];
      if (g && isBlack(m)) c.fillRect(g.x, 0, g.w, H);
    }
    c.strokeStyle = "rgba(255,255,255,0.05)"; c.lineWidth = 1;
    for (var m2 = cur.dispLo; m2 <= cur.dispHi; m2++) {
      var g2 = keyGeo[m2];
      if (g2 && !g2.black && (m2 % 12 === 0 || m2 % 12 === 5)) { c.beginPath(); c.moveTo(g2.x + 0.5, 0); c.lineTo(g2.x + 0.5, H); c.stroke(); }
    }
    // bar lines
    var visBeats = H / ppb;
    cur.model.bars.forEach(function (b) {
      if (b < beat - 0.1 || b > beat + visBeats) return;
      var y = hitY - (b - beat) * ppb;
      c.strokeStyle = "rgba(160,150,255,0.18)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    });

    // hit line glow
    var grd = c.createLinearGradient(0, hitY - 34, 0, hitY);
    grd.addColorStop(0, "rgba(242,193,78,0)"); grd.addColorStop(1, "rgba(242,193,78,0.22)");
    c.fillStyle = grd; c.fillRect(0, hitY - 34, W, 34);
    var gl = c.createLinearGradient(0, 0, W, 0);
    gl.addColorStop(0, "rgba(242,193,78,0.2)"); gl.addColorStop(0.5, "rgba(255,226,150,1)"); gl.addColorStop(1, "rgba(242,193,78,0.2)");
    c.fillStyle = gl; c.fillRect(0, hitY - 1.5, W, 2.5);

    var sel = selRange(cur.sel);
    var labelSize = clamp(Math.round((keyGeo[cur.model.lo] ? keyGeo[cur.model.lo].w : 30) * 0.42), 11, 20);
    cur.model.notes.forEach(function (n) {
      if (n.t + n.d < beat - 0.5 || n.t > beat + visBeats + 0.1) return;
      var g = keyGeo[n.midi];
      if (!g) return;
      var inSel = n.t >= sel.start - 1e-6 && n.t < sel.end - 1e-6;
      var yBottom = hitY - (n.t - beat) * ppb;
      var yTop = hitY - (n.t + n.d - beat) * ppb;
      var h = Math.max(12, yBottom - yTop - 3);
      var w = g.black ? g.w : g.w * 0.84;
      var x = g.x + (g.w - w) / 2;
      var col = COLORS[n.letter];
      var y = yBottom - h;
      var alpha = !inSel ? 0.22 : n.state === "miss" ? 0.4 : n.state !== "pending" ? 0.5 : 1;
      gem(c, x, y, w, h, n.state === "miss" ? "#6b6680" : col, alpha, n.state === "pending" && inSel && yBottom > hitY - 60);
      c.save();
      if (!inSel) c.globalAlpha = 0.3;
      // labels
      if (h >= 18 && w >= 16) {
        var kl = settings.keyLabels ? keyLabelFor(n.midi) : "";
        c.fillStyle = "rgba(20,14,40,0.92)";
        c.textAlign = "center"; c.textBaseline = "alphabetic";
        var cx = x + w / 2, by = yBottom - 6;
        if (kl && h >= 34) {
          c.font = "800 " + labelSize + "px Segoe UI, system-ui, sans-serif";
          c.fillText(kl, cx, by - Math.round(labelSize * 0.85));
          c.font = "700 " + Math.round(labelSize * 0.66) + "px Segoe UI, system-ui, sans-serif";
          c.fillText(noteLabel(n), cx, by);
        } else {
          c.font = "800 " + Math.round(labelSize * 0.8) + "px Segoe UI, system-ui, sans-serif";
          c.fillText(kl || noteLabel(n), cx, by);
        }
      }
      c.restore();
    });

    // effects
    if (run) {
      run.effects = run.effects.filter(function (e) { return now - e.born < 700; });
      run.effects.forEach(function (e) {
        var g = keyGeo[e.midi];
        if (!g) return;
        var a = (now - e.born) / 700;
        var cx = g.x + g.w / 2;
        c.save();
        c.globalAlpha = 1 - a;
        c.strokeStyle = e.good ? e.color : "#ff5c7a";
        c.lineWidth = 3;
        c.beginPath(); c.arc(cx, hitY - 4, 8 + a * 34, Math.PI, 2 * Math.PI); c.stroke();
        if (e.text) {
          c.fillStyle = e.good ? "#fff" : "#ff8fa3";
          c.font = "800 15px Segoe UI, system-ui, sans-serif";
          c.textAlign = "center";
          c.fillText(e.text, cx, hitY - 30 - a * 30);
        }
        c.restore();
      });
    }
    drawSparks(c, now);
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)); }
    return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")";
  }

  function drawSheet() {
    var o = sheet, c = o.ctx;
    if (!c || !cur.model || settings.view === "notes" || cur.free) return;
    var W = o.W, H = o.H;
    c.clearRect(0, 0, W, H);
    var gap = clamp(Math.round(H / 15), 8, 15);
    var minStep = 99;
    cur.model.notes.forEach(function (n) { if (n.step < minStep) minStep = n.step; });
    var belowRoom = Math.max(gap * 2.4, (30 - minStep) * gap / 2 + gap * 1.9);
    var showKeys = settings.keyLabels && !touchOnly;
    var bottomY = Math.round(Math.min(H * 0.5 + gap * 2.2, H - 2 - belowRoom - (showKeys ? gap * 2.1 : gap * 0.3))) + 0.5;
    var topY = bottomY - 4 * gap;
    var labelsY = bottomY + belowRoom;
    var beat = viewBeat();
    var ppb = gap * (cur.model.minDur < 0.5 ? 10.5 : 7.5);
    var playX = Math.round(Math.max(120, W * 0.26));
    function X(t) { return playX + (t - beat) * ppb; }
    function Y(stepN) { return bottomY - (stepN - 30) * gap / 2; }
    var ink = "#1d1a33";

    // staff
    c.strokeStyle = "rgba(29,26,51,0.55)"; c.lineWidth = 1;
    for (var i = 0; i < 5; i++) { c.beginPath(); c.moveTo(0, topY + i * gap); c.lineTo(W, topY + i * gap); c.stroke(); }

    var sel = selRange(cur.sel);
    // bar lines
    c.strokeStyle = "rgba(29,26,51,0.7)"; c.lineWidth = 1.2;
    cur.model.bars.forEach(function (b) {
      var x = X(b) - gap * 0.6;
      if (x < -5 || x > W + 5) return;
      c.beginPath(); c.moveTo(Math.round(x) + 0.5, topY); c.lineTo(Math.round(x) + 0.5, bottomY); c.stroke();
    });
    var endX = X(cur.model.total) - gap * 0.4;
    if (endX > 0 && endX < W) { c.fillStyle = ink; c.fillRect(endX - 1, topY, 1.5, 4 * gap); c.fillRect(endX + 3, topY, 3.5, 4 * gap); }

    // selection shading
    var sx0 = X(sel.start) - gap, sx1 = X(sel.end) - gap;
    c.fillStyle = "rgba(139,108,255,0.07)";
    c.fillRect(sx0, topY - gap * 2.5, sx1 - sx0, gap * 9);

    // rests
    cur.model.rests.forEach(function (r) {
      var x = X(r.t);
      if (x < -20 || x > W + 20) return;
      drawRest(c, x, topY, gap, r.d, ink);
    });

    // notes
    var tgt = run && run.mode === "practice" ? nextPending() : null;
    cur.model.notes.forEach(function (n) {
      var x = X(n.t);
      if (x < -30 || x > W + 30) return;
      var inSel = n.t >= sel.start - 1e-6 && n.t < sel.end - 1e-6;
      var col = ink;
      if (!inSel) col = "rgba(29,26,51,0.3)";
      else if (n.state === "miss") col = "#e0435f";
      else if (n.state === "hit" || n.state === "perfect" || n.state === "good") col = "#18a565";
      else if (tgt === n || (!run && n === firstInSel(sel)) || (run && run.mode !== "practice" && Math.abs(n.t - beat) < 0.25 && n.state === "pending")) col = "#6a4cff";
      drawNote(c, x, Y(n.step), n, gap, col);
      // labels below staff
      if (inSel) {
        c.textAlign = "center"; c.textBaseline = "alphabetic";
        c.font = "700 " + Math.round(gap * 1.15) + "px Segoe UI, system-ui, sans-serif";
        c.fillStyle = shade(COLORS[n.letter], -0.35);
        var ly = labelsY;
        c.fillText(noteLabel(n), x, ly);
        if (settings.keyLabels) {
          var kl = keyLabelFor(n.midi);
          if (kl) {
            var ky = ly + gap * 0.5, kw = Math.max(gap * 1.6, c.measureText(kl).width + 8), kh = gap * 1.5;
            c.fillStyle = "rgba(29,26,51,0.08)";
            roundRect(c, x - kw / 2, ky, kw, kh, 4); c.fill();
            c.fillStyle = "#3b3866";
            c.font = "800 " + Math.round(gap * 1.05) + "px Segoe UI, system-ui, sans-serif";
            c.fillText(kl, x, ky + kh - gap * 0.38);
          }
        }
      }
    });

    // clef band
    var band = c.createLinearGradient(0, 0, playX * 0.55, 0);
    band.addColorStop(0, "rgba(251,248,241,1)"); band.addColorStop(0.75, "rgba(251,248,241,0.95)"); band.addColorStop(1, "rgba(251,248,241,0)");
    c.fillStyle = band; c.fillRect(0, 0, playX * 0.55, H);
    c.strokeStyle = "rgba(29,26,51,0.55)"; c.lineWidth = 1;
    for (var j = 0; j < 5; j++) { c.beginPath(); c.moveTo(0, topY + j * gap); c.lineTo(gap * 6.5, topY + j * gap); c.stroke(); }
    c.fillStyle = ink;
    c.font = Math.round(gap * 6.6) + "px 'Segoe UI Symbol', 'Apple Symbols', 'Noto Music', 'Bravura', serif";
    c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.fillText("\uD834\uDD1E", gap * 0.5, bottomY + gap * 1.25);
    c.font = "800 " + Math.round(gap * 1.9) + "px Georgia, 'Times New Roman', serif";
    c.textAlign = "center";
    c.fillText(String(cur.model.meter[0]), gap * 5.2, topY + gap * 1.75);
    c.fillText(String(cur.model.meter[1]), gap * 5.2, topY + gap * 3.75);

    // playhead
    c.fillStyle = "rgba(106,76,255,0.85)";
    c.fillRect(playX - gap * 0.75 - 1, topY - gap * 2.2, 2, gap * 8.4);
    c.fillStyle = "rgba(106,76,255,0.12)";
    c.fillRect(playX - gap * 0.75 - 7, topY - gap * 2.2, 14, gap * 8.4);
  }
  function firstInSel(sel) {
    var ns = cur.model.notes;
    for (var i = 0; i < ns.length; i++) if (ns[i].t >= sel.start - 1e-6) return ns[i];
    return null;
  }

  function noteShape(d) {
    // returns {hollow, stem, flags, dot, trip}
    var trip = Math.abs(d * 3 - Math.round(d * 3)) < 0.02 && Math.abs(d * 2 - Math.round(d * 2)) > 0.02;
    if (trip) return { hollow: false, stem: true, flags: d < 0.5 ? 1 : 0, dot: false, trip: true, whole: false };
    if (d >= 4) return { hollow: true, stem: false, flags: 0, dot: d >= 6, whole: true };
    if (d >= 2) return { hollow: true, stem: true, flags: 0, dot: d >= 3 };
    if (d >= 1) return { hollow: false, stem: true, flags: 0, dot: d >= 1.5 };
    if (d >= 0.5) return { hollow: false, stem: true, flags: 1, dot: d >= 0.75 };
    return { hollow: false, stem: true, flags: 2, dot: false };
  }

  function drawNote(c, x, y, n, gap, col) {
    var sh = noteShape(n.d);
    var rx = gap * 0.68, ry = gap * 0.5;
    c.strokeStyle = col; c.fillStyle = col;
    // ledger lines
    c.lineWidth = 1.2;
    var s;
    for (s = 28; s >= n.step; s -= 2) { var ly = bottomYOf(y, n.step, gap, s); c.beginPath(); c.moveTo(x - rx * 1.6, ly); c.lineTo(x + rx * 1.6, ly); c.stroke(); }
    for (s = 40; s <= n.step; s += 2) { var ly2 = bottomYOf(y, n.step, gap, s); c.beginPath(); c.moveTo(x - rx * 1.6, ly2); c.lineTo(x + rx * 1.6, ly2); c.stroke(); }
    // head
    c.save();
    c.translate(x, y); c.rotate(-0.35);
    c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    if (sh.hollow) { c.lineWidth = sh.whole ? 2.4 : 1.8; c.stroke(); } else c.fill();
    c.restore();
    // accidental
    if (n.acc) {
      c.font = Math.round(gap * 1.9) + "px 'Segoe UI Symbol', 'Apple Symbols', serif";
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(accSym(n.acc), x - rx * 2.3, y + (n.acc === "b" ? -gap * 0.25 : 0));
    }
    // stem + flags
    if (sh.stem) {
      var up = n.step < 34;
      var sx = up ? x + rx * 0.92 : x - rx * 0.92;
      var len = gap * 3.4;
      var ey = up ? y - len : y + len;
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(sx, y + (up ? -1 : 1)); c.lineTo(sx, ey); c.stroke();
      for (var f = 0; f < sh.flags; f++) {
        var fy = ey + (up ? f * gap * 0.8 : -f * gap * 0.8);
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(sx, fy);
        c.bezierCurveTo(sx + gap * 0.3, fy + (up ? gap * 0.9 : -gap * 0.9), sx + gap * 1.3, fy + (up ? gap * 1.1 : -gap * 1.1), sx + gap * 0.9, fy + (up ? gap * 2.1 : -gap * 2.1));
        c.stroke();
      }
      if (sh.trip) {
        c.font = "italic 700 " + Math.round(gap * 1.1) + "px Georgia, serif";
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("3", sx, up ? ey - gap * 0.8 : ey + gap * 0.8);
      }
    }
    if (sh.dot) { c.beginPath(); c.arc(x + rx * 1.7, y - ((n.step % 2 === 0) ? gap * 0.5 : 0), gap * 0.18, 0, Math.PI * 2); c.fill(); }
  }
  function bottomYOf(y, step, gap, s) { return y - (s - step) * gap / 2; }

  function drawRest(c, x, topY, gap, d, col) {
    c.fillStyle = col; c.strokeStyle = col;
    var midY = topY + 2 * gap;
    if (d >= 4) { c.fillRect(x - gap * 0.6, topY + gap, gap * 1.2, gap * 0.5); return; }
    if (d >= 2) { c.fillRect(x - gap * 0.6, midY - gap * 0.5, gap * 1.2, gap * 0.5); if (d >= 3) { c.beginPath(); c.arc(x + gap, midY - gap * 0.3, gap * 0.16, 0, 7); c.fill(); } return; }
    if (d >= 1) {
      c.lineWidth = gap * 0.28; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath();
      c.moveTo(x - gap * 0.2, midY - gap * 1.4);
      c.lineTo(x + gap * 0.35, midY - gap * 0.7);
      c.lineTo(x - gap * 0.25, midY);
      c.lineTo(x + gap * 0.3, midY + gap * 0.7);
      c.quadraticCurveTo(x - gap * 0.6, midY + gap * 0.5, x, midY + gap * 1.4);
      c.stroke();
      c.lineCap = "butt";
      if (d >= 1.5) { c.beginPath(); c.arc(x + gap * 0.9, midY - gap * 0.5, gap * 0.16, 0, 7); c.fill(); }
      return;
    }
    // eighth / sixteenth
    var flags = d >= 0.5 ? 1 : 2;
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x + gap * 0.45, midY - gap * 0.9); c.lineTo(x - gap * 0.1, midY + gap * 1.1); c.stroke();
    for (var i = 0; i < flags; i++) {
      var yy = midY - gap * 0.8 + i * gap * 0.75;
      c.beginPath(); c.arc(x - gap * 0.25, yy, gap * 0.22, 0, 7); c.fill();
      c.beginPath(); c.moveTo(x - gap * 0.25, yy + gap * 0.1); c.quadraticCurveTo(x + gap * 0.1, yy + gap * 0.2, x + gap * 0.45 - i * gap * 0.2, yy - gap * 0.15); c.stroke();
    }
  }

  function frame(now) {
    try {
      step(now);
      if (!$("songView").classList.contains("hidden")) { drawFall(now); drawSheet(); }
    } catch (e) {
      if (window.console) console.error(e);
    }
    requestAnimationFrame(frame);
  }

  /* ================= free play ================= */
  var FREE_BPM = 90;
  var ribbons = []; // {midi, color, t0, t1}
  var sparks = [];  // {x, y, vx, vy, born, color}
  var rec = { on: false, start: 0, notes: [], open: {}, timers: [], playing: false };
  var freeCount = 0, metroTimer = null;

  function openFree() {
    stopRun(true);
    stopPlayback();
    cur.free = true;
    cur.song = { id: "__free", title: "Free play", flag: "note", bpm: FREE_BPM, meter: [4, 4], parts: [{ name: "Free play", notes: "R:4" }] };
    cur.model = buildModel(cur.song);
    cur.sel = 0;
    setStart(settings.freeStart || 60);
    showView("song");
    $("songView").classList.add("free-mode");
    $("stage").classList.add("free");
    $("topTitle").textContent = "Free play";
    $("songFlag").innerHTML = flagHtml("note");
    $("songTitle").textContent = "Free play";
    $("songMeta").textContent = "Play anything you like. Record it, play it back, or save it as a song to practise.";
    applyView();
    layoutStage();
    updateFreeBar();
    freeCount = 0;
    resetIdle();
  }
  function leaveFree() {
    if (!cur.free) return;
    cur.free = false;
    stopPlayback();
    if (rec.on) toggleRecord();
    stopMetro();
    ribbons = []; sparks = [];
    $("songView").classList.remove("free-mode");
    $("stage").classList.remove("free");
  }
  function shiftOctave(dir) {
    var w = cur.base + dir * 12;
    if (w < 36 || w > 72) { toast(dir > 0 ? "That's the highest it goes" : "That's the lowest it goes"); return; }
    Object.keys(held).forEach(function (m) { held[m] = 1; release(+m); });
    setStart(w);
    settings.freeStart = w; saveSettings();
    layoutStage();
    updateFreeBar();
  }
  function updateFreeBar() {
    var sp = spellMidi(cur.base);
    $("octLabel").innerHTML = "<kbd>Z</kbd> = " + esc(noteLabel(sp)) + sp.oct;
    $("recBtn").classList.toggle("recording", rec.on);
    $("recLabel").textContent = rec.on ? "Stop" : "Record";
    var has = rec.notes.length > 0 && !rec.on;
    $("playBackBtn").disabled = !has;
    $("saveTuneBtn").disabled = !has;
    $("playBackLabel").textContent = rec.playing ? "Stop" : "Play back";
    $("recInfo").textContent = rec.on ? "Recording… play your tune" : has ? rec.notes.length + " notes recorded" : "";
    $("freeMetro").classList.toggle("on", !!metroTimer);
  }

  function freePress(midi) {
    var now = performance.now();
    ribbons.push({ midi: midi, color: COLORS[spellMidi(midi).letter], t0: now, t1: null });
    if (ribbons.length > 120) ribbons.shift();
    burst(midi, now);
    freeCount++;
    if (freeCount === 1) $("idleCard").classList.add("hidden");
    if (rec.on) {
      rec.open[midi] = rec.notes.length;
      rec.notes.push({ midi: midi, t: (now - rec.start) / 1000, d: 0.25 });
    }
  }
  function freeRelease(midi) {
    var now = performance.now();
    for (var i = ribbons.length - 1; i >= 0; i--) if (ribbons[i].midi === midi && ribbons[i].t1 == null) { ribbons[i].t1 = now; break; }
    if (rec.on && rec.open[midi] != null) {
      var n = rec.notes[rec.open[midi]];
      n.d = Math.max(0.08, (now - rec.start) / 1000 - n.t);
      delete rec.open[midi];
    }
  }
  function burst(midi, now) {
    var g = keyGeo[midi];
    if (!g) return;
    var col = COLORS[spellMidi(midi).letter];
    for (var i = 0; i < 9; i++) {
      var a = Math.PI + Math.random() * Math.PI;
      sparks.push({ x: g.x + g.w / 2, y: fall.H - 4, vx: Math.cos(a) * (40 + Math.random() * 90), vy: Math.sin(a) * (80 + Math.random() * 140), born: now, color: col });
    }
    if (sparks.length > 220) sparks.splice(0, sparks.length - 220);
  }

  function toggleRecord() {
    if (!rec.on) {
      stopPlayback();
      rec.on = true; rec.start = performance.now(); rec.notes = []; rec.open = {};
    } else {
      rec.on = false;
      var now = performance.now();
      Object.keys(rec.open).forEach(function (m) { var n = rec.notes[rec.open[m]]; n.d = Math.max(0.08, (now - rec.start) / 1000 - n.t); });
      rec.open = {};
      if (rec.notes.length) {
        var t0 = rec.notes[0].t;
        rec.notes.forEach(function (n) { n.t -= t0; });
        toast("Recorded " + rec.notes.length + " notes", "good");
      }
    }
    if ($("freeBar")) updateFreeBar();
  }
  function playBack() {
    if (rec.playing) { stopPlayback(); updateFreeBar(); return; }
    unlockAudio();
    rec.playing = true;
    var start = performance.now() + 150, last = 0;
    rec.notes.forEach(function (n) {
      last = Math.max(last, n.t + n.d);
      rec.timers.push(setTimeout(function () {
        PBAudio.noteOn(n.midi, 0.8, n.d);
        lightKey(n.midi, n.d);
        var now = performance.now();
        ribbons.push({ midi: n.midi, color: COLORS[spellMidi(n.midi).letter], t0: now, t1: now + n.d * 1000 });
        burst(n.midi, now);
      }, start - performance.now() + n.t * 1000));
    });
    rec.timers.push(setTimeout(function () { rec.playing = false; rec.timers = []; updateFreeBar(); }, 300 + (last * 1000)));
    updateFreeBar();
  }
  function stopPlayback() {
    rec.timers.forEach(clearTimeout); rec.timers = [];
    if (rec.playing) PBAudio.allOff();
    rec.playing = false;
  }
  function saveTune() {
    var m = openModal('<h3>Save your tune</h3><p>It becomes a song in <b>My imports</b>, split into parts, so you can practise it like any other song.</p>' +
      '<div class="form-row"><label>Name</label><input class="input" id="tuneName" value="My tune"></div>' +
      '<div class="modal-actions"><button class="btn" data-a="no">Cancel</button><button class="btn primary" data-a="ok">Save</button></div>');
    var inp = m.querySelector("#tuneName"); inp.select();
    m.querySelector("[data-a=no]").onclick = closeModal;
    m.querySelector("[data-a=ok]").onclick = function () {
      var spb = 60 / FREE_BPM, ppq = 480;
      var fake = { ppq: ppq, tempo: Math.round(spb * 1e6), meter: [4, 4], tracks: [{ name: "Free play", notes: rec.notes.map(function (n) { return { tick: Math.round(n.t / spb * ppq), dur: Math.max(60, Math.round(n.d / spb * ppq)), midi: n.midi }; }) }] };
      try {
        var song = PBMidi.toSong(fake, 0, inp.value.trim() || "My tune", 4);
        song.alt = "Recorded in Free play";
        buildModel(song);
        customSongs.push(song); save("pb_custom", customSongs);
        closeModal();
        toast("Saved “" + esc(song.title) + "”", "good");
        location.hash = "#/song/" + song.id;
      } catch (e) { toast("Couldn't save: " + esc(e.message), "bad"); }
    };
  }
  function toggleMetro() {
    if (metroTimer) stopMetro();
    else {
      unlockAudio();
      var beat = 0;
      metroTimer = setInterval(function () { PBAudio.click(beat % 4 === 0); beat++; }, 60000 / FREE_BPM);
    }
    updateFreeBar();
  }
  function stopMetro() { if (metroTimer) { clearInterval(metroTimer); metroTimer = null; } }

  function drawRising(now) {
    var o = fall, c = o.ctx, W = o.W, H = o.H;
    c.clearRect(0, 0, W, H);
    var v = clamp(H * 0.45, 120, 260) / 1000; // px per ms
    var hitY = H - 3;
    // soft lanes
    c.fillStyle = "rgba(255,255,255,0.022)";
    for (var m = cur.dispLo; m <= cur.dispHi; m++) { var g0 = keyGeo[m]; if (g0 && g0.black) c.fillRect(g0.x, 0, g0.w, H); }
    var grd = c.createLinearGradient(0, hitY - 30, 0, hitY);
    grd.addColorStop(0, "rgba(242,193,78,0)"); grd.addColorStop(1, "rgba(242,193,78,0.25)");
    c.fillStyle = grd; c.fillRect(0, hitY - 30, W, 30);
    ribbons = ribbons.filter(function (r) { return r.t1 == null || hitY - (now - r.t1) * v > -20; });
    ribbons.forEach(function (r) {
      var g = keyGeo[r.midi];
      if (!g) return;
      var top = hitY - (now - r.t0) * v;
      var bottom = r.t1 == null ? hitY : hitY - (now - r.t1) * v;
      if (r.t1 != null && r.t1 > now) bottom = hitY;
      var w = g.black ? g.w : g.w * 0.8, x = g.x + (g.w - w) / 2;
      var h = Math.max(8, bottom - top);
      gem(c, x, bottom - h, w, h, r.color, r.t1 == null || r.t1 > now ? 1 : 0.85, true);
    });
    drawSparks(c, now);
  }
  function drawSparks(c, now) {
    sparks = sparks.filter(function (s) { return now - s.born < 650; });
    sparks.forEach(function (s) {
      var t = (now - s.born) / 1000;
      var x = s.x + s.vx * t, y = s.y + s.vy * t + 160 * t * t;
      c.globalAlpha = Math.max(0, 1 - t / 0.65);
      c.fillStyle = s.color;
      c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill();
    });
    c.globalAlpha = 1;
  }
  // a note drawn as a polished gem: gradient body, glossy highlight, soft glow
  function gem(c, x, y, w, h, col, alpha, glow) {
    c.save();
    c.globalAlpha = alpha;
    if (glow) { c.shadowColor = col; c.shadowBlur = 16; }
    var gr = c.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, shade(col, -0.25)); gr.addColorStop(0.45, shade(col, 0.18)); gr.addColorStop(1, shade(col, -0.35));
    c.fillStyle = gr;
    roundRect(c, x, y, w, h, Math.min(9, w / 3));
    c.fill();
    c.shadowBlur = 0;
    c.globalAlpha = alpha * 0.55;
    var hl = c.createLinearGradient(0, y, 0, y + Math.min(h, 26));
    hl.addColorStop(0, "rgba(255,255,255,0.75)"); hl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = hl;
    roundRect(c, x + 3, y + 2, w - 6, Math.min(h - 4, 22), Math.min(7, w / 4));
    c.fill();
    c.globalAlpha = alpha;
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1;
    roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, Math.min(9, w / 3));
    c.stroke();
    c.restore();
  }

  /* ================= views & router ================= */
  function showView(v) {
    $("libraryView").classList.toggle("hidden", v !== "library");
    $("songView").classList.toggle("hidden", v !== "song");
    if (v === "library") { $("topTitle").textContent = ""; renderLibrary(); }
  }
  function route() {
    var h = location.hash || "#/";
    var m = /^#\/song\/(.+)$/.exec(h);
    if (modalOpen()) closeModal();
    if (m) openSong(decodeURIComponent(m[1]));
    else if (h === "#/free") openFree();
    else { stopRun(true); leaveFree(); cur.song = null; showView("library"); }
  }

  /* ================= MIDI import ================= */
  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var midi;
      try { midi = PBMidi.parse(reader.result); } catch (e) { toast("Couldn't read that file: " + esc(e.message), "bad"); return; }
      var tracks = midi.tracks.map(function (t, i) { return { t: t, i: i }; }).filter(function (x) { return !x.t.drums; });
      if (!tracks.length) { toast("No melody tracks in that file.", "bad"); return; }
      // default: the track with the highest average pitch among the busier tracks
      var maxN = Math.max.apply(null, tracks.map(function (x) { return x.t.notes.length; }));
      var pick = tracks.filter(function (x) { return x.t.notes.length >= maxN * 0.25; }).sort(function (a, b) { return avg(b.t) - avg(a.t); })[0];
      var chosen = pick.i;
      var title = file.name.replace(/\.(mid|midi)$/i, "").replace(/[_-]+/g, " ");
      var html = '<h3>Import a MIDI song</h3><p>Pick the track that has the tune. I\u2019ll keep the top note of each chord and split it into parts you can learn one at a time.</p>' +
        '<div class="form-row"><label>Song name</label><input class="input" id="impTitle" value="' + esc(title) + '"></div>' +
        '<div class="form-row"><label>Melody track</label><div class="track-list" id="impTracks"></div></div>' +
        '<div class="form-row"><label>Part length</label><select class="input" id="impBars"><option value="4">4 bars (short parts)</option><option value="8" selected>8 bars</option><option value="16">16 bars (long parts)</option></select></div>' +
        '<div class="modal-actions"><button class="btn" data-a="cancel">Cancel</button><button class="btn" data-a="hear">👂 Preview track</button><button class="btn primary" data-a="ok">Import</button></div>';
      var m = openModal(html);
      var list = m.querySelector("#impTracks");
      tracks.forEach(function (x) {
        var lo = 127, hi = 0;
        x.t.notes.forEach(function (n) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); });
        var b = el("button", "track" + (x.i === chosen ? " active" : ""), '<span class="tn">' + esc(x.t.name) + '</span><span class="ti">' + x.t.notes.length + " notes · " + PBMidi.midiName(lo) + "–" + PBMidi.midiName(hi) + "</span>");
        b.onclick = function () { chosen = x.i; Array.prototype.forEach.call(list.children, function (c) { c.classList.remove("active"); }); b.classList.add("active"); };
        list.appendChild(b);
      });
      m.querySelector('[data-a=cancel]').onclick = closeModal;
      m.querySelector('[data-a=hear]').onclick = function () {
        unlockAudio();
        var notes = midi.tracks[chosen].notes.slice(0, 24), t0 = notes.length ? notes[0].tick : 0, spb = midi.tempo / 1e6;
        notes.forEach(function (n) { setTimeout(function () { PBAudio.noteOn(n.midi, 0.7, n.dur / midi.ppq * spb); }, (n.tick - t0) / midi.ppq * spb * 1000); });
      };
      m.querySelector('[data-a=ok]').onclick = function () {
        try {
          var song = PBMidi.toSong(midi, chosen, m.querySelector("#impTitle").value.trim(), +m.querySelector("#impBars").value);
          buildModel(song);
          customSongs.push(song);
          save("pb_custom", customSongs);
          closeModal();
          toast("Imported “" + esc(song.title) + "”", "good");
          location.hash = "#/song/" + song.id;
        } catch (e) { toast("Import failed: " + esc(e.message), "bad"); }
      };
    };
    reader.readAsArrayBuffer(file);
  }
  function avg(t) { var s = 0; t.notes.forEach(function (n) { s += n.midi; }); return s / Math.max(1, t.notes.length); }

  /* ================= help & settings ================= */
  function openHelp() {
    var used = {}, needsHigh = !!cur.free;
    var savedMap = cur.map, savedBase = cur.base;
    if (!cur.song) setStart(60);
    if (cur.model) cur.model.notes.forEach(function (n) { used[n.midi] = 1; if (n.midi > cur.map.lowHi) needsHigh = true; });
    // physical rows of a UK/US keyboard; unmapped keys are left as gaps
    var PHYS = [
      { codes: HIGH_BLACK, off: 0, high: true },
      { codes: HIGH_WHITE, off: 22, high: true },
      { gap: true, high: true },
      { codes: LOW_BLACK, off: 11 },
      { codes: LOW_WHITE, off: 33 }
    ];
    var map = PHYS.filter(function (rw) { return needsHigh || !rw.high; }).map(function (rw) {
      if (rw.gap) return '<div style="height:8px"></div>';
      return '<div class="kbrow" style="margin-left:' + rw.off + 'px">' + rw.codes.map(function (code) {
        var midi = midiForCode(code);
        if (midi == null) return '<div class="kbk gap"></div>';
        var sp = spellMidi(midi);
        return '<div class="kbk ' + (isBlack(midi) ? "b" : "w") + (used[midi] ? " used" : "") + '" title="' + sp.letter + accSym(sp.acc) + sp.oct + '">' + esc(codeLabel(code)) + "<small>" + esc(noteLabel(sp)) + "</small></div>";
      }).join("") + "</div>";
    }).join("");
    var startName = noteLabel(spellMidi(cur.base)) + spellMidi(cur.base).oct;
    cur.map = savedMap; cur.base = savedBase;
    var html = '<h3>How to play</h3>' +
      '<p>Your computer keyboard is a piano. The bottom row <kbd>Z</kbd> … <kbd>/</kbd> is the <b>white keys</b> and the row above it, <kbd>A</kbd> … <kbd>\'</kbd>, is the <b>black keys</b>, sitting between the white keys just like on a real piano.' + (cur.model && cur.model.notes.length ? " Keys with a ring are used in this song." : "") + "</p>" +
      '<div class="kbmap">' + map + "</div>" +
      '<p class="small">' + (cur.free ? "Use the octave buttons (or <kbd>←</kbd> <kbd>→</kbd>) to move the whole keyboard up or down. " : "Each song moves the keyboard so its melody fits these two rows; here <kbd>Z</kbd> is " + esc(startName) + ". ") +
      (needsHigh ? "The top rows (Q W E… and 1 2 3…) carry on higher for the few notes that don't fit. " : "") + "On a phone or tablet, just tap the keys on screen.</p>" +
      '<div class="settings-list">' +
      '<div class="setting"><div><div class="st">1 · 👂 Listen</div><div class="sd">Hear one part played for you.</div></div></div>' +
      '<div class="setting"><div><div class="st">2 · 🐢 Practice</div><div class="sd">Slow, and every note waits for you. The key to press glows.</div></div></div>' +
      '<div class="setting"><div><div class="st">3 · 🎯 Play</div><div class="sd">In time, with Perfect/Good scoring and stars. 3 stars needs 70% speed or more.</div></div></div>' +
      '<div class="setting"><div><div class="st">Shortcuts</div><div class="sd"><kbd>Space</kbd> start / pause · <kbd>Esc</kbd> stop · <kbd>←</kbd> <kbd>→</kbd> previous / next part</div></div></div>' +
      "</div>" +
      '<div class="modal-actions"><button class="btn primary" data-a="close">Got it</button></div>';
    var m = openModal(html, { wide: true });
    m.querySelector("[data-a=close]").onclick = closeModal;
  }

  function openSettings() {
    var html = '<h3>Settings</h3><div class="settings-list">' +
      '<div class="setting"><div><div class="st">Note names</div><div class="sd">How notes are named on keys and sheet music.</div></div><div class="seg" id="setNames"><button data-v="letters">C D E</button><button data-v="solfege">Do Re Mi</button></div></div>' +
      '<div class="setting"><div><div class="st">Keyboard letters on notes</div><div class="sd">Show which computer key to press.</div></div><button class="tog" id="setKeys"></button></div>' +
      '<div class="setting"><div><div class="st">Volume</div><div class="sd" id="sndStatus"></div></div><input type="range" id="setVol" min="0" max="100" step="5"></div>' +
      '<div class="setting"><div><div class="st">Reset progress</div><div class="sd">Clears all stars on this device.</div></div><button class="btn danger" id="setReset">Reset…</button></div>' +
      '</div><div class="modal-actions"><button class="btn primary" data-a="close">Done</button></div>';
    var m = openModal(html);
    function refresh() {
      Array.prototype.forEach.call(m.querySelectorAll("#setNames button"), function (b) { b.classList.toggle("active", b.getAttribute("data-v") === settings.names); });
      var k = m.querySelector("#setKeys");
      k.textContent = settings.keyLabels ? "On" : "Off"; k.classList.toggle("on", settings.keyLabels);
      m.querySelector("#sndStatus").textContent = PBAudio.hasSamples() ? "Real grand piano sound loaded." : (audioUnlocked ? "Loading piano sound… (using a simple synth until it's ready)" : "Piano sound loads when you first play.");
    }
    Array.prototype.forEach.call(m.querySelectorAll("#setNames button"), function (b) {
      b.onclick = function () { settings.names = b.getAttribute("data-v"); saveSettings(); refresh(); if (cur.song) { layoutStage(); resetIdle(); } };
    });
    m.querySelector("#setKeys").onclick = function () { settings.keyLabels = !settings.keyLabels; saveSettings(); refresh(); };
    var vol = m.querySelector("#setVol");
    vol.value = Math.round(settings.volume * 100);
    vol.style.setProperty("--p", vol.value + "%");
    vol.oninput = function () { settings.volume = vol.value / 100; vol.style.setProperty("--p", vol.value + "%"); PBAudio.setVolume(settings.volume); saveSettings(); };
    m.querySelector("#setReset").onclick = function () {
      var row = m.querySelector("#setReset").parentNode;
      row.innerHTML = '<div><div class="st">Delete all stars?</div><div class="sd">This can\u2019t be undone.</div></div><div style="display:flex;gap:8px"><button class="btn" id="rsNo">Cancel</button><button class="btn danger" id="rsYes">Delete</button></div>';
      row.querySelector("#rsNo").onclick = function () { closeModal(); openSettings(); };
      row.querySelector("#rsYes").onclick = function () {
        progress = {}; save("pb_progress", progress);
        closeModal(); toast("Progress cleared");
        if (cur.song) { renderParts(); renderCoach(); } else renderLibrary();
      };
    };
    m.querySelector("[data-a=close]").onclick = closeModal;
    refresh();
  }

  var rotateShown = false;
  function maybeRotateTip() {
    if (rotateShown) return;
    var touch = matchMedia("(hover: none)").matches;
    if (!touch || window.innerWidth > window.innerHeight) return;
    var whites = 0;
    for (var k = cur.dispLo; k <= cur.dispHi; k++) if (!isBlack(k)) whites++;
    if (whites <= 9) return;
    rotateShown = true;
    var t = $("rotateTip");
    t.classList.remove("hidden");
    setTimeout(function () { t.classList.add("hidden"); }, 4500);
  }

  /* ================= init ================= */
  function init() {
    setupInput();
    $("homeBtn").onclick = function () { location.hash = "#/"; };
    $("helpBtn").onclick = openHelp;
    $("settingsBtn").onclick = openSettings;
    $("searchInput").addEventListener("input", renderLibrary);
    Array.prototype.forEach.call($("filterChips").children, function (b) {
      b.onclick = function () {
        filter = b.getAttribute("data-filter");
        Array.prototype.forEach.call($("filterChips").children, function (x) { x.classList.toggle("active", x === b); });
        renderLibrary();
      };
    });
    $("importBtn").onclick = function () { $("midiFile").value = ""; $("midiFile").click(); };
    $("freeBtn").onclick = function () { location.hash = "#/free"; };
    $("octDown").onclick = function () { shiftOctave(-1); this.blur(); };
    $("octUp").onclick = function () { shiftOctave(1); this.blur(); };
    $("recBtn").onclick = function () { unlockAudio(); toggleRecord(); this.blur(); };
    $("playBackBtn").onclick = function () { playBack(); this.blur(); };
    $("saveTuneBtn").onclick = function () { saveTune(); this.blur(); };
    $("freeMetro").onclick = function () { toggleMetro(); this.blur(); };
    $("midiFile").onchange = function () { if (this.files && this.files[0]) importFile(this.files[0]); };
    Array.prototype.forEach.call($("modeSeg").children, function (b) {
      b.onclick = function () { setMode(b.getAttribute("data-mode")); b.blur(); };
    });
    $("speedRange").addEventListener("input", function () {
      updateSpeedLabel();
      settings.speed[cur.mode] = +this.value; saveSettings();
      if (run) run.speed = (+this.value) / 100;
    });
    $("startBtn").onclick = function () { toggleRun(); this.blur(); };
    $("viewTog").onclick = function () {
      settings.view = { both: "notes", notes: "sheet", sheet: "both" }[settings.view];
      saveSettings(); applyView(); layoutStage(); this.blur();
    };
    $("metroTog").onclick = function () { settings.metronome = !settings.metronome; saveSettings(); applyView(); this.blur(); toast(settings.metronome ? "Metronome on" : "Metronome off"); };
    $("loopTog").onclick = function () { settings.loop = !settings.loop; saveSettings(); applyView(); this.blur(); toast(settings.loop ? "Loop on: the part repeats" : "Loop off"); };
    $("modalBack").addEventListener("pointerdown", function (e) { if (e.target === this) closeModal(); });
    document.addEventListener("pointerdown", unlockAudio, { capture: true });
    var rt = null;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (cur.song) layoutStage(); }, 120); });
    window.addEventListener("hashchange", route);
    PBAudio.setVolume(settings.volume);

    // samples load in the background so the page shows at once
    var sc = document.createElement("script");
    sc.src = "js/samples.js";
    sc.onload = function () { samplesReady = true; if (audioUnlocked) PBAudio.load(); };
    document.body.appendChild(sc);

    route();
    requestAnimationFrame(frame);
    window.PB = { cur: cur, get run() { return run; }, settings: settings, buildModel: buildModel, startRun: startRun, press: press, release: release };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
