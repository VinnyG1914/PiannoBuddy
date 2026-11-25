/* PianoBuddy: tiny Standard MIDI File reader + melody extractor. */
(function () {
  "use strict";

  function Reader(buf) { this.d = new DataView(buf); this.p = 0; }
  Reader.prototype.u8 = function () { return this.d.getUint8(this.p++); };
  Reader.prototype.u16 = function () { var v = this.d.getUint16(this.p); this.p += 2; return v; };
  Reader.prototype.u32 = function () { var v = this.d.getUint32(this.p); this.p += 4; return v; };
  Reader.prototype.str = function (n) { var s = ""; for (var i = 0; i < n; i++) s += String.fromCharCode(this.u8()); return s; };
  Reader.prototype.vlq = function () { var v = 0, b; do { b = this.u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

  /* Returns {ppq, tempo (us per quarter), meter:[n,d], tracks:[{name, notes:[{tick, dur, midi, vel, ch}]}]} */
  function parse(buf) {
    var r = new Reader(buf);
    if (r.str(4) !== "MThd") throw new Error("This is not a MIDI file.");
    var hlen = r.u32();
    var format = r.u16(), ntr = r.u16(), div = r.u16();
    r.p = 8 + hlen;
    if (div & 0x8000) throw new Error("SMPTE-timed MIDI files are not supported.");
    var out = { ppq: div, tempo: 500000, meter: [4, 4], tracks: [], format: format };
    var tempoSet = false, meterSet = false;
    for (var t = 0; t < ntr && r.p < buf.byteLength; t++) {
      var id = r.str(4), len = r.u32(), end = r.p + len;
      if (id !== "MTrk") { r.p = end; continue; }
      var tick = 0, status = 0, name = "", open = {}, notes = [], program = null;
      while (r.p < end) {
        tick += r.vlq();
        var b = r.d.getUint8(r.p);
        if (b & 0x80) { status = b; r.p++; }
        if (status === 0xff) {
          var type = r.u8(), l = r.vlq(), s = r.p;
          if (type === 0x03 && !name) name = r.str(l);
          else if (type === 0x51 && !tempoSet) { out.tempo = (r.u8() << 16) | (r.u8() << 8) | r.u8(); tempoSet = true; }
          else if (type === 0x58 && !meterSet) { var nn = r.u8(), dd = r.u8(); out.meter = [nn, Math.pow(2, dd)]; meterSet = true; }
          r.p = s + l;
          if (type === 0x2f) break;
          status = 0;
        } else if (status === 0xf0 || status === 0xf7) {
          r.p += r.vlq(); status = 0;
        } else {
          var hi = status & 0xf0, ch = status & 0x0f;
          var a1 = r.u8(), a2 = (hi === 0xc0 || hi === 0xd0) ? 0 : r.u8();
          if (hi === 0x90 && a2 > 0) {
            var key = ch * 128 + a1;
            if (open[key]) { var o = open[key]; o.dur = tick - o.tick; notes.push(o); }
            open[key] = { tick: tick, dur: 0, midi: a1, vel: a2, ch: ch };
          } else if (hi === 0x80 || (hi === 0x90 && a2 === 0)) {
            var k2 = ch * 128 + a1;
            if (open[k2]) { open[k2].dur = tick - open[k2].tick; notes.push(open[k2]); delete open[k2]; }
          } else if (hi === 0xc0 && program === null) program = a1;
        }
      }
      r.p = end;
      Object.keys(open).forEach(function (k) { open[k].dur = Math.max(1, tick - open[k].tick); notes.push(open[k]); });
      notes.sort(function (x, y) { return x.tick - y.tick || y.midi - x.midi; });
      if (notes.length) {
        var drums = notes.every(function (n) { return n.ch === 9; });
        out.tracks.push({ name: name || ("Track " + (out.tracks.length + 1)), notes: notes, drums: drums, program: program });
      }
    }
    return out;
  }

  var SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function midiName(m) { return SHARP[m % 12] + (Math.floor(m / 12) - 1); }

  /* Build a PianoBuddy song from one track: top note of each chord, quantised, split into parts. */
  function toSong(midi, trackIdx, title, barsPerPart) {
    var tr = midi.tracks[trackIdx];
    var ppq = midi.ppq;
    var grid = 1 / 12; // quarter-beat twelfths: handles 16ths and triplets
    function q(beats) { return Math.round(beats / grid) * grid; }
    // monophonic: highest note at each onset
    var mono = [];
    tr.notes.forEach(function (n) {
      var t = q(n.tick / ppq);
      var last = mono[mono.length - 1];
      if (last && Math.abs(last.t - t) < 1e-6) { if (n.midi > last.midi) { last.midi = n.midi; last.d = n.dur / ppq; } return; }
      mono.push({ t: t, d: n.dur / ppq, midi: n.midi });
    });
    for (var i = 0; i < mono.length; i++) {
      var nx = mono[i + 1];
      var d = q(mono[i].d);
      if (d < 0.25) d = 0.25;
      if (nx && mono[i].t + d > nx.t) d = nx.t - mono[i].t;
      mono[i].d = Math.max(grid, d);
    }
    if (!mono.length) throw new Error("That track has no notes.");
    // fit into the playable range by octaves (C3..G5 preferred)
    var lo = Infinity, hi = -Infinity;
    mono.forEach(function (n) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); });
    var shift = 0;
    while (hi + shift > 79) shift -= 12;
    while (lo + shift < 48 && hi + shift + 12 <= 79) shift += 12;
    mono.forEach(function (n) {
      n.midi += shift;
      while (n.midi > 79) n.midi -= 12;
      while (n.midi < 48) n.midi += 12;
    });

    var meter = midi.meter || [4, 4];
    var barLen = meter[0] * 4 / meter[1];
    var start = Math.floor(mono[0].t / barLen) * barLen;
    var partLen = barLen * (barsPerPart || 8);
    var parts = [];
    mono.forEach(function (n) {
      var idx = Math.floor((n.t - start) / partLen);
      while (parts.length <= idx) parts.push([]);
      parts[idx].push(n);
    });
    var songParts = [];
    var cur = start; // global position; gaps from empty parts become a leading rest
    parts.forEach(function (list, pi) {
      if (!list.length) return;
      var pStart = start + pi * partLen;
      var toks = [];
      list.forEach(function (n) {
        if (n.t - cur > 1e-6) toks.push("R:" + fmt(n.t - cur));
        toks.push(midiName(n.midi) + ":" + fmt(n.d));
        cur = n.t + n.d;
      });
      // pad to the full part length so the next part starts on its bar
      if (pi < parts.length - 1 && pStart + partLen - cur > 1e-6) toks.push("R:" + fmt(pStart + partLen - cur));
      songParts.push({ name: "Part " + (songParts.length + 1), notes: toks.join(" ") });
    });
    var bpm = Math.round(60000000 / midi.tempo);
    return {
      id: "custom-" + Date.now().toString(36),
      title: title || tr.name || "My song",
      alt: "Imported MIDI · " + tr.name,
      origin: "My imports", flag: "note", region: "mine", level: 2,
      bpm: Math.max(40, Math.min(220, bpm)), meter: meter, key: "",
      source: "import", sourceNote: "Imported from a MIDI file (top note of each chord)",
      parts: songParts, custom: true
    };
  }

  function fmt(x) { var r = Math.round(x * 1000) / 1000; return String(r); }

  window.PBMidi = { parse: parse, toSong: toSong, midiName: midiName };
})();
