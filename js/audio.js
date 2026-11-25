/* PianoBuddy sound: real piano samples (Salamander) with a synth fallback. */
(function () {
  "use strict";

  var NOTE_INDEX = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

  var ctx = null, master = null, comp = null;
  var buffers = []; // [{midi, buffer}]
  var loading = null;
  var voices = {}; // midi -> {src, gain}
  var volume = 0.9;

  function nameToMidi(n) {
    var m = /^([A-G]#?)(-?\d)$/.exec(n);
    return (parseInt(m[2], 10) + 1) * 12 + NOTE_INDEX[m[1]];
  }

  function b64ToArrayBuffer(b64) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function decode(ab) {
    return new Promise(function (resolve, reject) {
      // Safari only supports the callback form reliably
      var p = ctx.decodeAudioData(ab, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* iOS 17+: ignore mute switch */ }
      ctx = new AC({ latencyHint: "interactive" });
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function load() {
    if (loading) return loading;
    if (!ensure()) return Promise.resolve(false);
    var src = window.PB_SAMPLES || {};
    var names = Object.keys(src);
    loading = Promise.all(names.map(function (n) {
      return decode(b64ToArrayBuffer(src[n])).then(function (buf) {
        buffers.push({ midi: nameToMidi(n), buffer: buf });
      }, function () { /* skip a bad sample */ });
    })).then(function () {
      buffers.sort(function (a, b) { return a.midi - b.midi; });
      return buffers.length > 0;
    });
    return loading;
  }

  function nearest(midi) {
    var best = null, bd = 1e9;
    for (var i = 0; i < buffers.length; i++) {
      var d = Math.abs(buffers[i].midi - midi);
      if (d < bd) { bd = d; best = buffers[i]; }
    }
    return best;
  }

  function stopVoice(v, when, fade) {
    try {
      v.gain.gain.cancelScheduledValues(when);
      v.gain.gain.setValueAtTime(v.gain.gain.value, when);
      v.gain.gain.setTargetAtTime(0, when, fade);
      v.src.stop(when + fade * 6);
    } catch (e) { /* already stopped */ }
  }

  /* Start a note. dur (seconds) optional: auto release after dur. Returns nothing. */
  function noteOn(midi, velocity, dur) {
    if (!ensure()) return;
    var t = ctx.currentTime;
    var vel = velocity == null ? 0.8 : velocity;
    if (voices[midi]) { stopVoice(voices[midi], t, 0.03); delete voices[midi]; }
    var g = ctx.createGain();
    g.connect(master);
    var src;
    var s = nearest(midi);
    if (s) {
      src = ctx.createBufferSource();
      src.buffer = s.buffer;
      src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.004);
      src.connect(g);
      src.start(t);
    } else {
      // synth fallback: soft piano-like tone
      var f = 440 * Math.pow(2, (midi - 69) / 12);
      src = ctx.createOscillator();
      src.type = "triangle";
      src.frequency.value = f;
      var o2 = ctx.createOscillator();
      o2.type = "sine"; o2.frequency.value = f * 2;
      var g2 = ctx.createGain(); g2.gain.value = 0.25;
      o2.connect(g2); g2.connect(g);
      src.connect(g);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.008);
      g.gain.setTargetAtTime(vel * 0.15, t + 0.01, 0.35);
      src.start(t); o2.start(t);
      var origStop = src.stop.bind(src);
      src.stop = function (w) { origStop(w); try { o2.stop(w); } catch (e) { /* ignore */ } };
    }
    var v = { src: src, gain: g };
    voices[midi] = v;
    src.onended = function () { if (voices[midi] === v) delete voices[midi]; };
    if (dur != null) {
      var off = t + Math.max(0.12, dur);
      stopVoice(v, off, 0.12);
    }
  }

  function noteOff(midi) {
    var v = voices[midi];
    if (!v || !ctx) return;
    stopVoice(v, ctx.currentTime, 0.12);
    delete voices[midi];
  }

  function allOff() { Object.keys(voices).forEach(function (k) { noteOff(+k); }); }

  function click(accent) {
    if (!ensure()) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.2, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.09);
  }

  function chime(good) {
    if (!ensure()) return;
    var t = ctx.currentTime;
    var notes = good ? [72, 76, 79, 84] : [64, 60];
    notes.forEach(function (m, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
      var s = t + i * 0.09;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.18, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5);
      o.connect(g); g.connect(master);
      o.start(s); o.stop(s + 0.55);
    });
  }

  function setVolume(v) { volume = v; if (master) master.gain.value = v; }

  window.PBAudio = {
    ensure: ensure, load: load, noteOn: noteOn, noteOff: noteOff, allOff: allOff,
    click: click, chime: chime, setVolume: setVolume,
    hasSamples: function () { return buffers.length > 0; },
    now: function () { return ctx ? ctx.currentTime : 0; }
  };
})();
