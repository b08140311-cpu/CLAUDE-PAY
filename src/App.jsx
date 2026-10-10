import React from 'react';
import { App as CapApp } from '@capacitor/app';
import { openProvider } from './launch.js';
import { listApps, listShortcuts, loadTargets, saveTargets } from './appList.js';
import { presetsFor } from './apps.js';

// "a:b;c:d" -> React style object
function css(str) {
  const o = {};
  if (!str) return o;
  str.split(';').forEach((d) => {
    const k = d.indexOf(':');
    if (k < 0) return;
    let p = d.slice(0, k).trim();
    const v = d.slice(k + 1).trim();
    if (!p) return;
    if (!p.startsWith('--')) {
      p = p.replace(/^-webkit-/, 'webkit-').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (p.startsWith('webkit')) p = 'W' + p.slice(1);
    }
    o[p] = v;
  });
  return o;
}

// ---- color theming ----
const hex2rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [6, 199, 85]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
const mix = (c, t, k) => c.map((v, i) => Math.round(v + (t[i] - v) * k));
const toHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
function derive(hex, base) {
  const c = hex2rgb(hex);
  return Object.assign({}, base, {
    color: hex, lite: toHex(mix(c, [255, 255, 255], 0.28)), glow: rgba(c, 0.38), edge: rgba(c, 0.5),
    gA: rgba(c, 0.72), gB: rgba(c, 0.3), rgb: c
  });
}
const SWATCHES = ['#06C755', '#FFD21F', '#0070E0', '#FF4D6D', '#B26BFF', '#19D3DA', '#FF8A1F', '#E8ECF8'];
// sparkle positions sit on a ring just outside the card edges: [left%, top%, delay ms, drift px]
const RING = [[-7, 18, 0, -10], [-9, 58, 160, -12], [-4, 92, 320, -8], [12, 108, 90, -6], [38, 112, 380, 4], [66, 110, 220, 8], [92, 106, 40, 10], [108, 70, 300, 12], [106, 30, 140, 10], [96, -10, 420, 8], [70, -14, 260, 4], [40, -12, 60, -4], [14, -9, 360, -8]];
const CARD_STYLES = ['Glass', 'Crystal', 'Matte', 'Steel'];
const DUST = [[8, 62, 0], [22, 20, 120], [36, 74, 240], [52, 30, 80], [66, 70, 300], [80, 24, 180], [14, 44, 360], [90, 56, 60], [44, 50, 420], [72, 40, 500]];
function lsGet(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

const GLYPH_PROPS = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { colors: (() => { const v = lsGet('mpay.colors.v1', null); return Array.isArray(v) && v.length === 3 ? v : [null, null, null]; })(), cardStyles: (() => { const v = lsGet('mpay.cardstyles.v1', null); return Array.isArray(v) && v.length === 3 ? v : [0, 0, 0]; })(), styleTicks: [0, 0, 0], dustIdx: -1, prev: null, colorOpen: -1, customOpen: false, customPane: 'main', customIdx: 0, splash:true, names:(()=>{try{const v=JSON.parse(localStorage.getItem('mpay.names.v1'));return Array.isArray(v)&&v.length===3?v:['LINE Pay','PX Pay','PayPal']}catch(e){return ['LINE Pay','PX Pay','PayPal']}})(), sel: 0, toast: '', payOpen: false, payOut: false, payTx: 0, payTy: 0, dragX: 0, dragging: false, done: false, flash: false, swipeX: 0, swiping: false, k: 1, H: 844, exitAsk: false, targets: loadTargets(), pickOpen: false, pickSlot: 0, shortcuts: [], scLoading: false, apps: [], appsLoading: false, q: '' };
    this.outTimer = null;
    this.splashTimer = null;
    this.sw = null;
    this.swiped = false;
    this.drag = null;
    this.toastTimer = null;
    this.raf = null;
    this.animating = false;
    this.lastTile = null;
    this.P = [
      { name: 'LINE Pay', sub: 'LINE Pay', color: '#06C755', lite: '#3FE88A', glow: 'rgba(6,199,85,.38)', edge: 'rgba(6,199,85,.5)', gA: 'rgba(6,199,85,.72)', gB: 'rgba(6,199,85,.30)', glyph: 'M6 8a6 6 0 0 1 0 8M10 5.5a10 10 0 0 1 0 13M14 3a14 14 0 0 1 0 18' },
      { name: 'PX Pay', sub: 'PX Pay', color: '#FFD21F', lite: '#FFD21F', glow: 'rgba(255,210,31,.32)', edge: 'rgba(255,210,31,.5)', gA: 'rgba(255,210,31,.66)', gB: 'rgba(255,210,31,.26)', glyph: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4v-2M14 18h2v2h-2z' },
      { name: 'PayPal', sub: 'PayPal', color: '#0070E0', lite: '#5AA2FF', glow: 'rgba(0,112,224,.45)', edge: 'rgba(90,162,255,.55)', gA: 'rgba(40,130,255,.76)', gB: 'rgba(40,130,255,.32)', glyph: 'M5 12h14M13 6l6 6-6 6' }
    ];
    this.onResize = () => {
      const k = (window.innerWidth / 390) || 1;
      this.setState({ k, H: Math.max(640, Math.round(window.innerHeight / k)) });
    };
  }

  componentDidMount() {
    this.onResize();
    this.splashTimer=setTimeout(()=>this.setState({splash:false}),1750);
    window.addEventListener('resize', this.onResize);
    try {
      CapApp.addListener('backButton', () => this.handleBack()).then((h) => { this.backHandle = h; }).catch(() => {});
    } catch (e) {}
    const sc = document.getElementById('wc-scroller');
    if (!sc) return;
    this.sc = sc;
    const H = () => sc.clientHeight || 844;
    const clamp = (i) => Math.max(0, Math.min(1, i));
    this.t0 = null;
    this.samples = [];
    this.lastWheel = 0;
    this.wheelLocked = false;
    this.touching = false;
    this.settleTimer = null;
    this.onTS = (e) => {
      if (this.state.payOpen || this.state.pickOpen || this.state.customOpen) return;
      this.touching = true;
      this.cancelAnim();
      const t = e.touches[0];
      this.t0 = { top: sc.scrollTop, x: t.clientX, y: t.clientY, axis: '' };
      this.samples = [{ y: t.clientY, t: performance.now() }];
    };
    this.onTM = (e) => {
      const w = this.t0;
      if (!w) return;
      const t = e.touches[0];
      if (!w.axis) {
        const ax = Math.abs(t.clientX - w.x), ay = Math.abs(t.clientY - w.y);
        if (ax < 6 && ay < 6) return;
        w.axis = ay >= ax ? 'v' : 'h';
      }
      if (w.axis !== 'v') return;
      if (e.cancelable) e.preventDefault();
      this.samples.push({ y: t.clientY, t: performance.now() });
      if (this.samples.length > 6) this.samples.shift();
      const k = this.state.k || 1;
      const h = H();
      const top = w.top - (t.clientY - w.y) / k;
      sc.scrollTop = Math.max(0, Math.min(h, top));
    };
    this.onTE = () => {
      this.touching = false;
      const w = this.t0;
      this.t0 = null;
      if (!w || w.axis !== 'v' || this.state.payOpen) return;
      const h = H();
      const start = Math.round(w.top / h);
      const dy = sc.scrollTop - w.top;
      const s = this.samples;
      let v = 0;
      if (s.length > 1) {
        const a = s[0], b = s[s.length - 1];
        v = (a.y - b.y) / Math.max(1, b.t - a.t);
      }
      let dir = 0;
      if (Math.abs(v) > 0.16) dir = v > 0 ? 1 : -1;
      else if (Math.abs(dy) > h * 0.10) dir = dy > 0 ? 1 : -1;
      this.animateTo(clamp(start + dir) * h, 1350);
    };
    this.onWheel = (e) => {
      if (this.state.pickOpen) return;
      e.preventDefault();
      if (this.state.customOpen) return;
      if (this.state.payOpen) return;
      const now = performance.now();
      const gap = now - this.lastWheel;
      this.lastWheel = now;
      if (this.animating || (this.wheelLocked && gap < 220)) return;
      if (Math.abs(e.deltaY) < 4) return;
      const h = H();
      const cur = Math.round(sc.scrollTop / h);
      this.wheelLocked = true;
      this.animateTo(clamp(cur + (e.deltaY > 0 ? 1 : -1)) * h, 1350);
    };
    this.onScroll = () => {
      if (this.animating || this.touching || this.state.customOpen) return;
      if (this.settleTimer) clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => {
        if (this.animating || this.touching) return;
        const h = H();
        const pos = sc.scrollTop;
        const near = clamp(Math.round(pos / h));
        if (Math.abs(pos - near * h) > 1) this.animateTo(near * h, 900);
      }, 110);
    };
    sc.addEventListener('scroll', this.onScroll, { passive: true });
    sc.addEventListener('touchstart', this.onTS, { passive: true });
    sc.addEventListener('touchmove', this.onTM, { passive: false });
    sc.addEventListener('touchend', this.onTE, { passive: true });
    sc.addEventListener('touchcancel', this.onTE, { passive: true });
    sc.addEventListener('wheel', this.onWheel, { passive: false });
  }

  componentWillUnmount() {
    try { if (this.backHandle) this.backHandle.remove(); } catch (e) {}
    window.removeEventListener('resize', this.onResize);
    if(this.splashTimer)clearTimeout(this.splashTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.outTimer) clearTimeout(this.outTimer);
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.cancelAnim();
    const sc = this.sc;
    if (sc) {
      sc.removeEventListener('scroll', this.onScroll);
      sc.removeEventListener('touchstart', this.onTS);
      sc.removeEventListener('touchmove', this.onTM);
      sc.removeEventListener('touchend', this.onTE);
      sc.removeEventListener('touchcancel', this.onTE);
      sc.removeEventListener('wheel', this.onWheel);
    }
  }

  cancelAnim() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.animating = false;
  }

  // exponential decay: fast start, long soft landing
  animateTo(top, dur) {
    const sc = this.sc;
    if (!sc) return;
    this.cancelAnim();
    const from = sc.scrollTop;
    const dist = top - from;
    if (Math.abs(dist) < 1) { sc.scrollTop = top; return; }
    const norm = 1 - Math.exp(-4.5);
    const t0 = performance.now();
    this.animating = true;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = (1 - Math.exp(-4.5 * t)) / norm;
      sc.scrollTop = from + dist * e;
      if (t < 1) {
        this.raf = requestAnimationFrame(step);
      } else {
        sc.scrollTop = top;
        this.animating = false;
        this.raf = null;
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  openPay(i) {
    let tx = 0, ty = 0;
    try {
      const el = document.getElementById('wc-stage');
      const root = document.getElementById('wc-root');
      const cr = el.getBoundingClientRect(), rr = root.getBoundingClientRect();
      const k = rr.width / 390 || 1;
      tx = Math.round((rr.left + rr.width / 2 - (cr.left + cr.width / 2)) / k);
      ty = Math.round((rr.top + this.state.H * 0.44 * k - (cr.top + cr.height / 2)) / k);
    } catch (e) {}
    if (this.outTimer) clearTimeout(this.outTimer);
    this.setState({ payOpen: true, payOut: false, payTx: tx, payTy: ty, dragX: 0, dragging: false, done: false });
  }

  closePay() {
    if (this.outTimer) clearTimeout(this.outTimer);
    this.drag = null;
    this.setState({ payOpen: false, payOut: true, dragX: 0, dragging: false, done: false });
    this.outTimer = setTimeout(() => this.setState({ payOut: false }), 760);
  }

  finishPay() {
    const idx = this.state.sel;
    this.drag = null;
    this.setState({ dragging: false, done: true, dragX: 320, flash: true });
    setTimeout(() => this.setState({ flash: false }), 1100);
    setTimeout(async () => {
      this.closePay();
      const msg = await openProvider(idx, this.state.targets[idx]);
      if (msg) this.showToast(msg);
    }, 340);
  }

  showToast(msg) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.setState({ toast: '' });
    setTimeout(() => this.setState({ toast: msg }), 20);
    this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 2400);
  }

  handleBack() {
    const st = this.state;
    if (st.exitAsk) { this.setState({ exitAsk: false }); return; }
    if (st.customOpen) { if (st.customPane !== 'main') this.setState({ customPane: 'main' }); else this.closeCustom(); return; }
    if (st.pickOpen) { this.setState({ pickOpen: false }); return; }
    if (st.payOpen) { this.closePay(); return; }
    const sc = this.sc || document.getElementById('wc-scroller');
    const h = (sc && sc.clientHeight) || st.H;
    if (sc && sc.scrollTop > h * 0.5) { this.animateTo(0, 1100); return; }
    this.setState({ exitAsk: true });
  }

  async openPicker() {
    this.setState({ pickOpen: true, pickSlot: this.state.sel, q: '', appsLoading: !this.state.apps.length });
    this.loadShortcuts((this.state.targets[this.state.sel] || {}).pkg);
    if (!this.state.apps.length) {
      try {
        const apps = await listApps();
        this.setState({ apps, appsLoading: false });
      } catch (e) {
        this.setState({ appsLoading: false });
        this.showToast('讀取 App 清單失敗');
      }
    }
  }

  async loadShortcuts(pkg) {
    if (!pkg) { this.setState({ shortcuts: [], scLoading: false }); return; }
    this.setState({ scLoading: true, shortcuts: [] });
    const slot = this.state.pickSlot;
    const found = await listShortcuts(pkg);
    const pre = presetsFor(pkg, slot);
    const ids = new Set(pre.map((x) => x.id));
    const list = pre.concat(found.filter((x) => !ids.has(x.id)));
    if ((this.state.targets[this.state.pickSlot] || {}).pkg === pkg) this.setState({ shortcuts: list, scLoading: false });
  }

  assignApp(app) {
    const t = this.state.targets.slice();
    t[this.state.pickSlot] = app ? { pkg: app.package, label: app.label, icon: app.icon || '', shortcut: null } : null;
    saveTargets(t);
    this.setState({ targets: t });
    this.loadShortcuts(app ? app.package : null);
  }

  assignShortcut(sc) {
    const t = this.state.targets.slice();
    const cur = t[this.state.pickSlot];
    if (!cur) return;
    t[this.state.pickSlot] = Object.assign({}, cur, { shortcut: sc });
    saveTargets(t);
    this.setState({ targets: t });
  }

  openCustom(i) {
    if (this.state.payOpen) return;
    this.setState({ sel: i, customOpen: true, customPane: 'main', customIdx: i });
  }

  closeCustom() { this.setState({ customOpen: false, customPane: 'main' }); }

  setColor(i, hex) {
    const c = this.state.colors.slice();
    c[i] = hex;
    lsSet('mpay.colors.v1', c);
    this.setState({ colors: c });
  }

  // style is stored per card; tapping the style a card already has does nothing (no remount, no gap)
  setCardStyle(i, n) {
    const cur = this.state.cardStyles[i] || 0;
    if (n === cur) return;
    const cs = this.state.cardStyles.slice();
    cs[i] = n;
    lsSet('mpay.cardstyles.v1', cs);
    const ticks = this.state.styleTicks.slice();
    ticks[i] += 1;
    if (this.dustTimer) clearTimeout(this.dustTimer);
    if (this.prevTimer) clearTimeout(this.prevTimer);
    this.setState({ cardStyles: cs, styleTicks: ticks, prev: { i, style: cur }, dustIdx: i });
    this.dustTimer = setTimeout(() => this.setState({ dustIdx: -1 }), 1500);
    this.prevTimer = setTimeout(() => this.setState({ prev: null }), 900);
  }

  renameCard(i,value){const names=[...this.state.names];names[i]=value.slice(0,24);try{localStorage.setItem('mpay.names.v1',JSON.stringify(names))}catch(e){}this.setState({names});}

  pickSlotTo(i) {
    this.setState({ pickSlot: i }, () => this.loadShortcuts((this.state.targets[i] || {}).pkg));
  }

  // coalesce high-frequency pointer updates to one setState per frame
  queue(patch) {
    this.pending = Object.assign(this.pending || {}, patch);
    if (this.pendRaf) return;
    this.pendRaf = requestAnimationFrame(() => {
      this.pendRaf = null;
      const pt = this.pending;
      this.pending = null;
      if (pt) this.setState(pt);
    });
  }

  // scale/zoom to scale pointer deltas from screen px to layout px
  px(v) { return v / (this.state.k || 1); }

  renderVals() {
    const st = this.state;
    const sel = st.sel || 0;
    const P = this.P.map((p, i) => (st.colors[i] ? derive(st.colors[i], p) : p));
    const self = this;
    const paying = !!st.payOpen;
    const dx = st.dragX || 0;
    const prog = Math.min(1, dx / 100);
    const sx = st.swipeX || 0;
    const look = (p, front, sN, ci) => {
      const rgb = p.rgb || hex2rgb(p.color);
      const W = [255, 255, 255], K = [0, 0, 0];
      let faceBg, face2 = '', faceShadow, fg = '#F2F4FF', sub = p.lite, ink = 'rgba(255,255,255,.55)', sparkle = false, tint = 0.55;
      if (sN === 1) {
        // sapphire-style faceted crystal
        const A = rgba(mix(rgb, W, 0.35), 0.34), B = rgba(mix(rgb, K, 0.5), 0.5), C = rgba(rgb, 0.4), D = rgba(mix(rgb, W, 0.65), 0.2);
        faceBg = toHex(mix(rgb, K, 0.62));
        face2 = 'conic-gradient(from 10deg at 26% 36%,' + A + ' 0 38deg,' + B + ' 38deg 92deg,' + C + ' 92deg 150deg,' + D + ' 150deg 215deg,' + B + ' 215deg 290deg,' + A + ' 290deg 360deg),'
          + 'conic-gradient(from 200deg at 74% 64%,' + D + ' 0 52deg,' + B + ' 52deg 118deg,' + A + ' 118deg 190deg,' + C + ' 190deg 262deg,' + D + ' 262deg 360deg)';
        faceShadow = 'inset 0 0 0 1px rgba(255,255,255,.4),inset 0 0 30px ' + rgba(rgb, 0.45) + ',0 0 14px -8px ' + p.lite;
        fg = '#F4F8FF'; sparkle = true; tint = 0.25;
      } else if (sN === 2) {
        // matte black with a glossy arc band
        faceBg = 'linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,0) 42%),' + toHex(mix(rgb, [10, 11, 14], 0.93));
        face2 = 'radial-gradient(150% 135% at 6% 125%,rgba(0,0,0,0) 55%,rgba(255,255,255,.05) 56.5%,rgba(0,0,0,.7) 60%,rgba(255,255,255,.26) 62.6%,rgba(0,0,0,0) 64.5%)';
        faceShadow = 'inset 0 0 0 1px rgba(255,255,255,.14),inset 0 1px 0 rgba(255,255,255,.3),inset 0 -12px 20px -12px rgba(0,0,0,.6),0 0 10px -7px ' + p.lite;
        fg = '#EDEFF5'; ink = 'rgba(255,255,255,.42)'; tint = 0.35;
      } else if (sN === 3) {
        // brushed steel, tinted by the card color
        faceBg = 'linear-gradient(120deg,#cdd2da 0%,#f4f6f9 26%,#b2b8c3 50%,#eef0f4 74%,#a1a8b4 100%)';
        face2 = 'linear-gradient(' + rgba(rgb, 0.18) + ',' + rgba(rgb, 0.18) + '),repeating-linear-gradient(92deg,rgba(255,255,255,.22) 0 1px,rgba(40,46,58,.07) 1px 3px)';
        faceShadow = 'inset 0 0 0 1px rgba(255,255,255,.75),inset 0 -10px 18px -10px rgba(0,0,0,.3),0 0 10px -7px ' + p.lite;
        fg = '#171B24'; sub = '#2A303C'; ink = 'rgba(28,34,46,.5)'; tint = 0.12;
      } else {
        // clear smoked glass with beveled edge
        faceBg = 'linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,0) 42%),' + toHex(mix(rgb, [8, 10, 16], 0.86));
        face2 = 'linear-gradient(112deg,rgba(255,255,255,0) 20%,rgba(255,255,255,.17) 29%,rgba(255,255,255,0) 37%),linear-gradient(112deg,rgba(255,255,255,0) 52%,rgba(255,255,255,.08) 60%,rgba(255,255,255,0) 68%)';
        faceShadow = 'inset 0 0 0 1.5px rgba(255,255,255,.6),inset 0 0 0 5px rgba(255,255,255,.07),inset 0 -9px 16px -8px rgba(255,255,255,.4),0 0 10px -6px ' + p.lite;
      }
      return { faceBg, face2, fg, subCol: sub, ink, sparkle, tint, faceShadow, glow: p.glow, styleKey: sN + '-' + st.styleTicks[ci], dust: st.dustIdx === ci };
    };
    const cards = P.map((p, i) => {
      const m = (i - sel + 3) % 3;
      const o = m === 0 ? 0 : (m === 1 ? 1 : -1);
      const front = o === 0;
      let extra = '';
      let tr = 'transform .9s cubic-bezier(.2,.8,.2,1),opacity .6s ease,translate .7s cubic-bezier(.2,.8,.2,1),rotate .5s ease';
      if (paying) {
        const E = 'cubic-bezier(.3,.1,.2,1)';
        tr = 'transform .7s ' + E + ',translate .7s ' + E + ',rotate .7s ' + E + ',opacity .4s ease';
        if (front) {
          extra = 'touch-action:none;cursor:grab;translate:' + dx + 'px 0;rotate:' + (dx * 0.03).toFixed(2) + 'deg;' + (st.done ? 'opacity:0;' : '');
          if (st.dragging) tr = 'none';
          else if (st.done) tr = 'translate .26s cubic-bezier(.4,0,1,.6),opacity .24s ease .04s,rotate .26s ease';
        } else {
          extra = 'opacity:0;translate:' + (o * 44) + 'px 0;pointer-events:none;';
        }
      } else if (st.payOut && front) {
        tr = 'transform .8s cubic-bezier(.2,.8,.2,1),opacity .6s ease,translate 0s,rotate 0s';
      } else if (st.swiping) {
        if (front) extra = 'translate:' + Math.round(sx * 0.8) + 'px 0;rotate:' + (sx * 0.04).toFixed(2) + 'deg;';
        tr = 'transform .9s cubic-bezier(.2,.8,.2,1),opacity .6s ease,translate 0s,rotate 0s';
      }
      const L = look(p, front, st.cardStyles[i], i);
      return {
        faceBg: L.faceBg, face2: L.face2, fg: L.fg, subCol: L.subCol, ink: L.ink, sparkle: L.sparkle, tint: L.tint, styleKey: L.styleKey, dust: L.dust, prev: (st.prev && st.prev.i === i ? look(p, front, st.prev.style, i) : null),
        domId: 'wc-card-' + i, idx: i,
        icon: (st.targets[i] && st.targets[i].icon) || '', name: st.names[i] || p.name, sub: p.sub, lite: p.lite, glow: p.glow, glyph: p.glyph, subOp: front ? 0.85 : 0,
        aria: p.name + (front ? ', selected. Press to pay' : ', bring to front'),
        faceShadow: L.faceShadow,
        glowOp: paying && front ? 0.35 + 0.65 * prog : 0,
        pick: () => {
          if (self.state.payOpen) return;
          self.sw = null;
          self.setState({ sel: i, swiping: false, swipeX: 0 });
          self.openPay(i);
        },
        down: (e) => {
          if (!self.state.payOpen || i !== self.state.sel) return;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
          self.drag = { x0: e.clientX };
          self.setState({ dragging: true });
        },
        move: (e) => {
          if (!self.drag) return;
          const dxv = Math.max(0, Math.min(260, self.px(e.clientX - self.drag.x0)));
          const now = performance.now();
          if (self.drag.t != null && now > self.drag.t) self.drag.v = (dxv - self.drag.lx) / (now - self.drag.t);
          self.drag.t = now; self.drag.lx = dxv; self.drag.dx = dxv;
          const el = document.getElementById('wc-card-' + i);
          if (el) { el.style.translate = dxv + 'px 0'; el.style.rotate = (dxv * 0.03).toFixed(2) + 'deg'; }
          const pr = Math.min(1, dxv / 100);
          const bar = document.getElementById('wc-prog'); if (bar) bar.style.width = Math.round(pr * 100) + '%';
          const gl = document.getElementById('wc-glow-' + i); if (gl) gl.style.opacity = (0.35 + 0.65 * pr).toFixed(2);
        },
        up: () => {
          if (!self.drag) return;
          const d = self.drag; self.drag = null;
          const dxNow = d.dx || 0;
          if (dxNow > 90 || (dxNow > 36 && (d.v || 0) > 0.6)) { self.setState({ dragX: dxNow }, () => self.finishPay()); }
          else self.setState({ dragging: false, dragX: 0 });
        },
        key: (e) => {
          if (!self.state.payOpen) return;
          if (e.key === 'ArrowRight') { e.preventDefault(); self.finishPay(); }
          if (e.key === 'Escape') self.closePay();
        },
        style: 'transform:translate3d(' + (o * 58) + 'px,' + (o ? -8 : 0) + 'px,' + (o ? -90 : 0) + 'px) scale(' + (o ? 0.9 : 1) + ');opacity:' + (o ? 0.94 : 1) + ';z-index:' + (front ? 3 : (o === 1 ? 2 : 1)) + ';transition:' + tr + ';' + extra
      };
    });
    const sw = {
      down: (e) => {
        if (self.state.payOpen) return;
        self.sw = { x0: e.clientX, y0: e.clientY, t0: performance.now(), active: false, id: e.pointerId };
      },
      move: (e) => {
        const w = self.sw;
        if (!w || self.state.payOpen) return;
        const dx0 = self.px(e.clientX - w.x0), dy0 = self.px(e.clientY - w.y0);
        if (!w.active) {
          if (Math.abs(dx0) > 8 && Math.abs(dx0) > Math.abs(dy0) * 1.2) {
            w.active = true;
            self.swiped = true;
            try { e.currentTarget.setPointerCapture(w.id); } catch (err) {}
            self.setState({ swiping: true });
          } else return;
        }
        self.queue({ swipeX: Math.max(-140, Math.min(140, dx0)) });
      },
      up: () => {
        const w = self.sw;
        self.sw = null;
        if (!w || !w.active) return;
        const d = (self.pending && self.pending.swipeX != null) ? self.pending.swipeX : (self.state.swipeX || 0);
        if (self.pendRaf) { cancelAnimationFrame(self.pendRaf); self.pendRaf = null; }
        self.pending = null;
        const v = d / Math.max(1, performance.now() - w.t0);
        let dir = 0;
        if (Math.abs(d) > 46 || Math.abs(v) > 0.5) dir = d < 0 ? 1 : -1;
        const patch = { swiping: false, swipeX: 0 };
        if (dir) patch.sel = (self.state.sel + dir + 3) % 3;
        self.setState(patch);
        setTimeout(() => { self.swiped = false; }, 80);
      }
    };
    const tiles = P.map((p, i) => ({
      icon: (st.targets[i] && st.targets[i].icon) || '',
      name: st.names[i] || p.name, glyph: p.glyph, lite: p.lite,
      bg: 'linear-gradient(145deg,' + p.gA + ',' + p.gB + ')',
      on: i === sel,
      style: i === sel
        ? 'opacity:1;transform:translateY(-4px);box-shadow:inset 0 0 0 1.5px ' + p.lite + ',inset 0 1px 0 rgba(255,255,255,.55),0 0 0 3px rgba(242,244,255,.9);'
        : 'opacity:.95;transform:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.38),inset 0 1px 0 rgba(255,255,255,.6);',
      pick: () => {
        if (self.state.payOpen) return;
        const now = performance.now();
        const dbl = self.lastTile && self.lastTile.i === i && now - self.lastTile.t < 380;
        self.lastTile = { i, t: now };
        self.setState({ sel: i, swiping: false, swipeX: 0 });
        if (dbl) { self.lastTile = null; self.openPay(i); }
      }
    }));
    const radios = P.map((p, i) => ({
      icon: (st.targets[i] && st.targets[i].icon) || '',
      color: p.color,
      name: st.names[i] || p.name, glyph: p.glyph, gA: p.gA, gB: p.gB, lite: p.lite,
      on: i === sel,
      status: (st.targets[i] ? '→ ' + st.targets[i].label + (st.targets[i].shortcut ? ' · ' + st.targets[i].shortcut.label : '') : (i === sel ? 'Default' : 'Tap to make default')),
      bg: i === sel ? 'linear-gradient(145deg,' + p.gA + ',rgba(255,255,255,.05))' : 'linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.07))',
      edge: i === sel ? p.lite : 'rgba(255,255,255,.2)',
      ring: i === sel ? p.lite : 'rgba(255,255,255,.3)',
      fill: i === sel ? p.lite : 'transparent',
      tick: i === sel ? 1 : 0,
      pick: () => self.openCustom(i)
    }));
    const pp = P[sel], prgb = pp.rgb || hex2rgb(pp.color);
    const preview = { name: st.names[sel] || pp.name, color: pp.color, lite: pp.lite, edge: pp.edge, hi: toHex(mix(prgb, [255, 255, 255], 0.35)), lo: toHex(mix(prgb, [0, 0, 0], 0.55)), soft: rgba(prgb, 0.3), grid: rgba(prgb, 0.14), light: lum(prgb) > 0.6 };
    const tci = st.customIdx || 0;
    const thumbs = CARD_STYLES.map((nm, n) => { const T = look(P[tci], true, n, tci); return { nm, n, bg: T.faceBg, ov: T.face2, sh: T.faceShadow, fg: T.fg, ink: T.ink, on: (st.cardStyles[tci] || 0) === n }; });
    const q = (st.q || '').trim().toLowerCase();
    const shown = (st.apps || []).filter((a) => !q || a.label.toLowerCase().includes(q));
    return {
      cards, tiles, radios, sw, shown, preview, thumbs,
      spotColor: P[sel].glow,
      rootCls: (paying ? 'wc-paying' : '') + (st.customOpen ? ' wc-custom' : ''),
      cface: (() => { const ci = st.customIdx || 0; const cp = P[ci]; const L2 = look(cp, true, st.cardStyles[ci], ci); return Object.assign({}, L2, { prev: (st.prev && st.prev.i === ci ? look(cp, true, st.prev.style, ci) : null), name: st.names[ci] || cp.name, sub: cp.sub, subOp: 0.85, glyph: cp.glyph, icon: (st.targets[ci] && st.targets[ci].icon) || '', idx: ci, color: cp.color, glowc: cp.glow }); })(),
      turnCls: paying ? 'wc-pin' : (st.payOut ? 'wc-pout' : ''),
      payTx: st.payTx || 0,
      payTy: st.payTy || 0,
      progressPct: Math.round(prog * 100),
      hintStyle: 'top:' + Math.round(st.H * 0.673) + 'px;opacity:' + (paying ? 1 : 0) + ';visibility:' + (paying ? 'visible' : 'hidden') + ';transition:opacity .6s ease ' + (paying ? '1.1s' : '0s') + ',visibility 0s linear ' + (paying ? '0s' : '.6s') + ';',
      cancelPay: () => self.closePay(),
      selColor: P[sel].lite,
      ctaLabel: 'Open ' + ((st.targets[sel] && (st.targets[sel].label + (st.targets[sel].shortcut ? ' · ' + st.targets[sel].shortcut.label : ''))) || P[sel].name),
      hasToast: !!st.toast,
      toast: st.toast,
      openSel: async () => {
        const msg = await openProvider(sel, self.state.targets[sel]);
        if (msg) self.showToast(msg);
      },
      back: () => {
        try {
          if (self.state.payOpen) { self.closePay(); return; }
          const sc = self.sc || document.getElementById('wc-scroller');
          const h = sc.clientHeight || 844;
          const idx = Math.round(sc.scrollTop / h);
          self.sc = sc;
          self.animateTo(Math.max(0, idx - 1) * h, 1000);
        } catch (e) {}
      }
    };
  }

  render() {
    const v = this.renderVals();
    const k = this.state.k || 1;
    const blob = (pos, size, color, op, dur, del, bx, by, by2) => (
      <div className="wc-blob" style={css(pos + ';width:' + size + 'px;height:' + size + 'px;background:radial-gradient(closest-side,rgba(0,0,0,0) 26%,' + color + ' 56%,rgba(0,0,0,0) 100%);opacity:' + op + ';--dur:' + dur + 's;--del:' + del + 's;--bx:' + bx + 'px;--by:' + by + 'px;--by2:' + by2 + 'px')} />
    );
    const Icon = ({ icon, d, size, stroke, sw, extra, radius }) => (icon
      ? <img src={icon} alt="" width={size} height={size} style={{ borderRadius: radius || Math.round(size * 0.24), flex: 'none', display: 'block' }} />
      : <Glyph d={d} size={size} stroke={stroke} sw={sw} extra={extra} />);
    const faceBody = (c, L, cls, extraKey) => (
      <div key={extraKey} className={cls} style={css('position:absolute;inset:0;border-radius:22px;overflow:hidden;background:' + L.faceBg + ';box-shadow:' + L.faceShadow + ';transition:box-shadow .5s ease;color:' + L.fg)}>
        {L.face2 && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: L.face2 }} />}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: L.tint, background: 'radial-gradient(110% 90% at 0% 0%,' + L.glow + ',rgba(0,0,0,0) 62%)' }} />
        <svg aria-hidden="true" viewBox="0 0 290 184" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }} fill="none">
          <defs>
            <linearGradient id="wcChip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9e6df" /><stop offset=".5" stopColor="#b9b4aa" /><stop offset="1" stopColor="#d8d4cb" /></linearGradient>
          </defs>
          <path d="M138 -4 C 196 34, 246 92, 296 112" stroke={L.ink} strokeWidth=".9" opacity=".8" />
          {[34, 44, 54, 64, 74, 84, 94].map((r) => <circle key={r} cx="296" cy="196" r={r} stroke={L.ink} strokeWidth=".6" opacity=".55" />)}
          <g transform="translate(22 68)">
            <rect width="36" height="28" rx="6" fill="url(#wcChip)" stroke="rgba(0,0,0,.35)" strokeWidth=".8" />
            <path d="M0 9h36M0 19h36M13 0v28M23 0v28" stroke="rgba(60,56,48,.55)" strokeWidth=".8" />
          </g>
          <g transform="translate(250 90)" stroke={L.ink} strokeWidth="1.6" strokeLinecap="round" opacity=".9">
            <path d="M0 -6a8 8 0 0 1 0 12" /><path d="M5 -10a13 13 0 0 1 0 20" /><path d="M10 -14a18 18 0 0 1 0 28" />
          </g>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <circle key={k} cx={26 + k * 11} cy="152" r="1.8" fill={L.ink} />)}
        </svg>
        {L.sparkle && [[70, 18, 0], [86, 56, 900], [38, 72, 1700]].map((q, k) => (
          <svg key={k} aria-hidden="true" className="wc-star" width="20" height="20" viewBox="-10 -10 20 20" style={{ position: 'absolute', left: q[0] + '%', top: q[1] + '%', animationDelay: q[2] + 'ms' }}><path d="M0 -9L1.6 -1.6L9 0L1.6 1.6L0 9L-1.6 1.6L-9 0L-1.6 -1.6Z" fill="#fff" /></svg>
        ))}
        <div style={css('position:absolute;inset:0;box-sizing:border-box;padding:16px 20px 18px')}>
          <div style={css('display:flex;justify-content:space-between;align-items:center')}>
            <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:20px;color:" + L.fg)}>{c.name}</span>
            <Icon icon={c.icon} d={c.glyph} size={c.icon ? 34 : 24} stroke={L.subCol} sw={1.9} />
          </div>
          <span style={css('position:absolute;right:20px;bottom:14px;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:' + L.subCol + ';opacity:' + c.subOp)}>{c.sub}</span>
        </div>
      </div>
    );
    const face = (c) => (
      <div style={css('position:absolute;inset:0')}>
        {c.prev && faceBody(c, c.prev, 'wc-face-out', 'prev-' + c.styleKey)}
        {faceBody(c, c, 'wc-face-in', c.styleKey)}
        {c.dust && RING.map((d, k) => <span key={k} className="wc-dust" style={css('left:' + d[0] + '%;top:' + d[1] + '%;--d:' + d[2] + 'ms;--dx:' + d[3] + 'px;background:' + c.subCol + ';box-shadow:0 0 8px 1px ' + c.subCol)} />)}
      </div>
    );
    const Glyph = ({ d, size, stroke, sw, extra }) => (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...GLYPH_PROPS} stroke={stroke} strokeWidth={sw} style={extra}><path d={d} /></svg>
    );
    return (
      <div id="fit" style={{ height: this.state.H, transform: 'translate(-50%,-50%) scale(' + k + ')' }}>
        <div id="wc-root" className={'wc-root ' + v.rootCls} style={css("--H:" + this.state.H + "px;position:relative;width:390px;height:100%;overflow:hidden;background:linear-gradient(180deg,#02050F,#000 70%);font-family:'DM Sans',system-ui,sans-serif;color:#F2F4FF")}>
          {this.state.splash && <div className="mpay-splash"><div className="mpay-wordmark">MPay<span>!</span></div><div className="mpay-signature">MADE TO MOVE</div></div>}
          <div aria-hidden="true" className="wc-bg" />
          <div aria-hidden="true" className="wc-liquid">
            {blob('left:-80px;top:60px', 300, '#1E5BFF', .55, 11, 0, 50, -40, 60)}
            {blob('right:-90px;top:200px', 280, '#2A8CFF', .45, 13, -6, -60, 50, -50)}
            {blob('left:30px;top:400px', 320, '#0B3BD6', .5, 12, -3, 40, -60, 50)}
            {blob('right:-70px;top:560px', 300, '#3AA0FF', .45, 14, -10, -50, -40, 60)}
            {blob('left:-100px;top:610px', 260, '#1A2FA0', .3, 15, -14, 60, -50, 40)}
            {blob('left:100px;top:-90px', 260, '#4D7CFF', .35, 12.5, -8, -40, 60, -30)}
          </div>

          <div aria-hidden="true" className="wc-spot" style={{ background: 'radial-gradient(closest-side,' + v.spotColor + ',rgba(0,0,0,0) 72%)' }} />

          <div id="wc-scroller" className="wc-scroll" style={css('position:absolute;inset:0;overflow-y:auto;overflow-x:hidden')}>
            <section id="wc-top" className="wc-snap" style={css('touch-action:pan-y')} onPointerDown={v.sw.down} onPointerMove={v.sw.move} onPointerUp={v.sw.up} onPointerCancel={v.sw.up}>
              <div className="wc-page" style={css('height:100%;box-sizing:border-box;padding:54px 24px 24px;display:flex;flex-direction:column;align-items:center')}>
                <div className="wc-rise wc-outbound" style={css('--ox:0px;--oy:-90px;--amp:50px;align-self:stretch;display:flex;align-items:center;justify-content:space-between;min-height:44px;padding-left:52px')}>
                  <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:15px")}>Pay Hub</span>
                  <span style={css('font-size:13px;font-weight:500;color:#9AA0B8')}>Galaxy A57</span>
                </div>

                <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(9px,2vh,18px)')}>
                  <div style={css('position:relative;width:360px;height:clamp(210px,32vh,272px);box-sizing:border-box;padding-right:40px;padding-top:40px;perspective:1100px;display:flex;align-items:center;justify-content:center')}>
                    <div id="wc-stage" className="wc-float" style={css('position:relative;width:290px;height:184px;transform-style:preserve-3d')}>
                      <div className={'wc-turn ' + v.turnCls} style={css('position:absolute;inset:0;transform-style:preserve-3d;--tx:' + v.payTx + 'px;--ty:' + v.payTy + 'px')}>
                        {v.cards.map((c) => (
                          <button key={c.domId} id={c.domId} type="button" aria-label={c.aria} onClick={c.pick} onPointerDown={c.down} onPointerMove={c.move} onPointerUp={c.up} onPointerCancel={c.up} onKeyDown={c.key} style={css('position:absolute;inset:0;padding:0;border:0;background:none;text-align:left;color:#F2F4FF;' + c.style)}>
                            <div id={'wc-glow-' + c.idx} aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 22, boxShadow: '0 0 64px 4px ' + c.glow, opacity: c.glowOp, transition: 'opacity .35s ease', pointerEvents: 'none' }} />
                            {face(c)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="wc-rise wc-outbound" style={css('--ox:0px;--oy:150px;--amp:120px;display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2vh,20px);text-align:center')}>
                    <h1 style={css("margin:0;font-family:'Sora',system-ui,sans-serif;font-weight:700;font-size:34px;line-height:1.15;letter-spacing:-.02em;text-wrap:balance")}>One place to pay</h1>
                    <div role="group" aria-label="Choose a payment app" style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:342px')}>
                      {v.tiles.map((t) => (
                        <button key={t.name} type="button" aria-pressed={t.on} aria-label={t.name} onClick={t.pick} className="wc-tap" style={css('aspect-ratio:1/1;border:0;border-radius:24px;box-sizing:border-box;padding:14px;background:' + t.bg + ';color:#F2F4FF;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;text-align:left;' + t.style)}>
                          <Icon icon={t.icon} d={t.glyph} size={t.icon ? 38 : 30} stroke={t.lite} sw={2} />
                          <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:700;font-size:15px;line-height:1.1")}>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="wc-bob wc-outbound" aria-hidden="true" style={css('--ox:0px;--oy:110px;position:absolute;left:0;right:0;bottom:18px;color:#9AA0B8;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase')}>
                  <Glyph d="M6 15l6-6 6 6" size={16} stroke="currentColor" sw={2} />
                </div>
              </div>
            </section>

            <section id="wc-default" className="wc-snap">
              <div className="wc-page" style={css('position:relative;height:100%;box-sizing:border-box;padding:96px 20px 150px;display:flex;flex-direction:column;justify-content:center')}>
                <div className="wc-outbound" style={css('--ox:90px;--oy:150px;position:absolute;right:20px;bottom:142px')}>
                <button type="button" aria-label="Choose apps to open" onClick={() => this.openPicker()} className="wc-tap" style={css('position:static;height:48px;padding:0 18px;border-radius:24px;border:0;display:flex;align-items:center;gap:8px;background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.14));color:#FFFFFF;font-weight:700;font-size:14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45),inset 0 1px 0 rgba(255,255,255,.65)')}>
                  <Glyph d="M4 6h16M4 12h16M4 18h10" size={18} stroke="currentColor" sw={2.2} />
                  Choose apps
                </button>
                </div>
                <div className="wc-rise" style={css('--amp:90px;display:flex;flex-direction:column;gap:14px')}>
                  <h2 className="wc-outbound" style={css("--ox:0px;--oy:-130px;margin:0 4px;font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:24px;letter-spacing:-.01em")}>Default app</h2>
                  <p className="wc-outbound" style={css('--ox:0px;--oy:-120px;margin:0 4px 8px;font-size:15px;line-height:1.45;color:#9AA0B8')}>The main button opens this one first.</p>
                  <div role="radiogroup" aria-label="Default payment app" style={css('display:flex;flex-direction:column;gap:12px')}>
                    {v.radios.map((d, i) => (
                      <div key={d.name} className="wc-outbound" style={css('--ox:0px;--oy:' + ((i - 1) * 120) + 'px')}>
                        <button type="button" role="radio" aria-checked={d.on} onClick={d.pick} className="wc-tap" style={css('width:100%;display:flex;align-items:center;gap:14px;min-height:72px;box-sizing:border-box;padding:12px 16px;border-radius:22px;border:0;background:' + d.bg + ';color:#F2F4FF;text-align:left;box-shadow:inset 0 0 0 1px ' + d.edge + ',inset 0 1px 0 rgba(255,255,255,.35)')}>
                          <div aria-hidden="true" style={css('width:40px;height:40px;border-radius:12px;background:linear-gradient(145deg,' + d.gA + ',' + d.gB + ');color:' + d.lite + ';box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),inset 0 1px 0 rgba(255,255,255,.45);display:flex;align-items:center;justify-content:center;flex:none')}>
                            <Icon icon={d.icon} d={d.glyph} size={d.icon ? 36 : 22} stroke="currentColor" sw={2} />
                          </div>
                          <div style={css('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}>
                            <span style={css('font-size:17px;font-weight:700;line-height:1.2')}>{d.name}</span>
                            <span style={css('font-size:14px;font-weight:500;color:#9AA0B8;line-height:1.3')}>{d.status}</span>
                          </div>
                          <div aria-hidden="true" style={css('width:12px;height:12px;border-radius:6px;background:' + d.color + ';box-shadow:0 0 12px -1px ' + d.color + ';flex:none')} />
                          <Glyph d="M9 6l6 6-6 6" size={18} stroke="#9AA0B8" sw={2.2} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="wc-outbound" style={css('--ox:0px;--oy:140px;margin:6px 4px 0;font-size:13px;line-height:1.45;color:#9AA0B8')}>Balances and history stay inside each app.</p>
                </div>
              </div>
            </section>
          </div>

          <div aria-hidden="true" className="wc-outbound" style={css('--ox:70px;--oy:0px;position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px')}>
            <div className="wc-dot wc-d1" style={css('height:22px;opacity:1')} />
            <div className="wc-dot wc-d2" />
          </div>

          <button type="button" aria-label="Back" onClick={v.back} className="wc-outbound" style={css('--ox:-70px;--oy:-70px;position:absolute;left:16px;top:50px;width:44px;height:44px;border-radius:22px;border:0;background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(255,255,255,.2));color:#FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5),inset 0 1px 0 rgba(255,255,255,.7)')}>
            <Glyph d="M15 5l-7 7 7 7" size={22} stroke="currentColor" sw={2.2} />
          </button>

          {this.state.flash && (
            <div aria-hidden="true" style={css('position:absolute;left:0;right:0;top:' + Math.round(this.state.H * 0.44) + 'px;height:0;pointer-events:none;z-index:20')}>
              <div className="wc-flash" style={{ background: 'radial-gradient(circle,#fff 0%,' + v.spotColor + ' 30%,rgba(0,0,0,0) 68%)' }} />
              <div className="wc-pop" style={{ borderColor: v.selColor }}><Glyph d="M5 12.5l4.2 4.2L19 7" size={30} stroke="#fff" sw={2.8} /></div>
            </div>
          )}
          <div style={css('position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:14px;' + v.hintStyle)}>
            <div aria-hidden="true" style={css('width:240px;height:6px;border-radius:3px;background:rgba(255,255,255,.16);overflow:hidden')}>
              <div id="wc-prog" style={{ height: '100%', width: v.progressPct + '%', borderRadius: 3, background: v.selColor }} />
            </div>
            <div style={css('display:flex;align-items:center;gap:8px;color:#E6E9F5;font-size:15px;font-weight:500')}>
              Swipe the card right to pay
              <svg className="wc-nudge" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" {...GLYPH_PROPS} stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6" /></svg>
            </div>
            <button type="button" onClick={v.cancelPay} className="wc-tap" style={css('min-height:44px;padding:0 24px;border-radius:22px;border:0;background:rgba(255,255,255,.2);color:#FFFFFF;font-weight:700;font-size:15px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),inset 0 1px 0 rgba(255,255,255,.55)')}>Cancel</button>
          </div>



          <div className={'wc-clayer' + (this.state.customOpen ? ' on' : '')} aria-hidden={!this.state.customOpen}>
            <button type="button" onClick={() => this.closeCustom()} className="wc-tap wc-cin" style={css('position:absolute;right:18px;top:52px;height:40px;padding:0 18px;border-radius:20px;border:0;background:rgba(255,255,255,.2);color:#fff;font-weight:700;font-size:14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),inset 0 1px 0 rgba(255,255,255,.55)')}>Done</button>

            <div className="wc-cin" onPointerDown={(e) => { this.cs = { x0: e.clientX }; }} onPointerUp={(e) => { const w = this.cs; this.cs = null; if (!w) return; const dx = this.px(e.clientX - w.x0); if (Math.abs(dx) > 40) this.setCardStyle(this.state.customIdx, ((this.state.cardStyles[this.state.customIdx] || 0) + (dx < 0 ? 1 : -1) + 4) % 4); }} style={css('touch-action:pan-y;position:absolute;left:0;right:0;top:' + Math.round(this.state.H * 0.15) + 'px;height:290px;perspective:1100px;display:flex;align-items:center;justify-content:center')}>
              <div className="wc-float" style={css('position:relative;width:290px;height:184px;transform-style:preserve-3d')}>
                <div className="wc-cspot" style={{ background: 'radial-gradient(closest-side,' + v.cface.glowc + ',rgba(0,0,0,0) 72%)' }} />
                <div style={css('position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(10deg) rotateY(-14deg) rotateZ(-2deg) scale(1.12)')}>
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 22, boxShadow: '0 0 70px 6px ' + v.cface.glowc, opacity: 0.55 }} />
                  <div style={css('position:absolute;inset:0')}>{face(v.cface)}</div>
                </div>
              </div>
              <div aria-hidden="true" className="wc-cshadow" style={{ background: 'radial-gradient(closest-side,' + v.cface.glowc + ',rgba(0,0,0,0))' }} />
            </div>

            <div className="wc-cin wc-cpanel" style={css('--cd:.34s;position:absolute;left:20px;right:20px;top:' + Math.round(this.state.H * 0.15 + 300) + 'px;display:flex;flex-direction:column;gap:12px')}>
              <div key={this.state.customPane} className="wc-face-in" style={css('display:flex;flex-direction:column;gap:12px')}>
                {this.state.customPane === 'main' && (
                  <>
                    <div style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:20px;text-align:center;margin-bottom:2px")}>{v.cface.name}</div>
                    <button type="button" onClick={() => this.setState({ customPane: 'color' })} className="wc-tap" style={css('display:flex;align-items:center;gap:14px;min-height:68px;padding:0 18px;border:0;border-radius:22px;color:#F2F4FF;text-align:left;background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.08));box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),inset 0 1px 0 rgba(255,255,255,.4)')}>
                      <span aria-hidden="true" style={css('width:34px;height:34px;border-radius:17px;flex:none;background:' + v.cface.color + ';box-shadow:inset 0 0 0 2px rgba(255,255,255,.85),0 0 16px -2px ' + v.cface.color)} />
                      <span style={css('flex:1;font-size:17px;font-weight:700')}>Color</span>
                      <Glyph d="M9 6l6 6-6 6" size={18} stroke="#9AA0B8" sw={2.2} />
                    </button>
                    <button type="button" onClick={() => this.setState({ customPane: 'style' })} className="wc-tap" style={css('display:flex;align-items:center;gap:14px;min-height:68px;padding:0 18px;border:0;border-radius:22px;color:#F2F4FF;text-align:left;background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.08));box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),inset 0 1px 0 rgba(255,255,255,.4)')}>
                      <span aria-hidden="true" style={css('width:34px;height:22px;border-radius:6px;flex:none;background:linear-gradient(135deg,' + v.preview.hi + ',' + v.preview.color + ' 45%,' + v.preview.lo + ');box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)')} />
                      <span style={css('flex:1;font-size:17px;font-weight:700')}>Card style<span style={css('display:block;font-size:13px;font-weight:500;color:#9AA0B8;margin-top:1px')}>{CARD_STYLES[this.state.cardStyles[this.state.customIdx] || 0]}</span></span>
                      <Glyph d="M9 6l6 6-6 6" size={18} stroke="#9AA0B8" sw={2.2} />
                    </button>
                  </>
                )}
                {this.state.customPane === 'color' && (
                  <>
                    <div style={css('display:flex;align-items:center;gap:10px')}>
                      <button type="button" aria-label="Back" onClick={() => this.setState({ customPane: 'main' })} className="wc-tap" style={css('width:40px;height:40px;border-radius:20px;border:0;background:rgba(255,255,255,.2);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4)')}><Glyph d="M15 5l-7 7 7 7" size={20} stroke="currentColor" sw={2.2} /></button>
                      <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:18px")}>Color</span>
                    </div>
                    <div style={css('display:grid;grid-template-columns:repeat(5,1fr);gap:12px;justify-items:center;padding:6px 2px')}>
                      {SWATCHES.map((h) => (
                        <button key={h} type="button" aria-label={h} onClick={() => this.setColor(v.cface.idx, h)} className="wc-tap" style={css('width:46px;height:46px;border-radius:23px;border:0;background:' + h + ';box-shadow:inset 0 0 0 ' + (v.cface.color.toLowerCase() === h.toLowerCase() ? '3px #fff' : '1px rgba(255,255,255,.4)') + ',0 0 16px -4px ' + h)} />
                      ))}
                      <label className="wc-tap" style={css('position:relative;width:46px;height:46px;border-radius:23px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5);background:conic-gradient(#f55,#fd3,#3e5,#3cf,#a5f,#f55);display:block')}>
                        <input type="color" value={v.cface.color} onChange={(e) => this.setColor(v.cface.idx, e.target.value)} aria-label="Custom color" style={css('position:absolute;inset:-8px;width:62px;height:62px;opacity:0;cursor:pointer')} />
                      </label>
                    </div>
                    <button type="button" onClick={() => this.setColor(v.cface.idx, null)} className="wc-tap" style={css('align-self:center;height:38px;padding:0 20px;border-radius:19px;border:0;background:rgba(255,255,255,.12);color:#E6E9F5;font-size:13px;font-weight:700;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)')}>Reset to default</button>
                  </>
                )}
                {this.state.customPane === 'style' && (
                  <>
                    <div style={css('display:flex;align-items:center;gap:10px')}>
                      <button type="button" aria-label="Back" onClick={() => this.setState({ customPane: 'main' })} className="wc-tap" style={css('width:40px;height:40px;border-radius:20px;border:0;background:rgba(255,255,255,.2);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4)')}><Glyph d="M15 5l-7 7 7 7" size={20} stroke="currentColor" sw={2.2} /></button>
                      <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:18px")}>Card style</span>
                    </div>
                    <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>
                      {v.thumbs.map((t) => (
                        <button key={t.nm} type="button" aria-pressed={t.on} onClick={() => this.setCardStyle(this.state.customIdx, t.n)} className="wc-tap" style={css('border:0;padding:0;background:none;color:#F2F4FF;display:flex;flex-direction:column;gap:7px;align-items:center')}>
                          <div style={css('position:relative;width:100%;aspect-ratio:1.6/1;border-radius:10px;overflow:hidden;background:' + t.bg + ';box-shadow:' + t.sh + (t.on ? ',0 0 0 2px rgba(242,244,255,.9)' : '') + ';color:' + t.fg)}>
                            {t.ov && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: t.ov }} />}
                            <span aria-hidden="true" style={css('position:absolute;left:14%;top:38%;width:20%;height:24%;border-radius:2px;background:linear-gradient(135deg,#e9e6df,#b9b4aa)')} />
                          </div>
                          <span style={css('font-size:12px;font-weight:700;color:' + (t.on ? '#FFFFFF' : '#9AA0B8'))}>{t.nm}</span>
                        </button>
                      ))}
                    </div>
                    <div style={css('text-align:center;font-size:12px;color:#9AA0B8')}>Swipe the card left or right, or tap a style</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={'wc-sheet' + (this.state.pickOpen ? ' on' : '')} onClick={() => this.setState({ pickOpen: false })}>
            <div className="wc-sheet-panel" onClick={(e) => e.stopPropagation()} style={css('box-sizing:border-box;height:640px;padding:20px 16px 24px;border-radius:28px 28px 0 0;background:linear-gradient(180deg,rgba(40,60,120,.55),rgba(8,12,28,.9));-webkit-backdrop-filter:blur(24px) saturate(1.5);backdrop-filter:blur(24px) saturate(1.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 0 0 1px rgba(255,255,255,.14);display:flex;flex-direction:column;gap:12px')}>
              <div style={css('display:flex;align-items:center;justify-content:space-between')}>
                <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:18px")}>Open on swipe</span>
                <button type="button" onClick={() => this.setState({ pickOpen: false })} className="wc-tap" style={css('height:40px;padding:0 18px;border-radius:20px;border:0;background:rgba(255,255,255,.2);color:#fff;font-weight:700;font-size:14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4)')}>Done</button>
              </div>
              <div style={css('display:flex;gap:8px')}>
                {v.radios.map((d, i) => (
                  <button key={d.name} type="button" onClick={() => this.pickSlotTo(i)} className="wc-tap" style={css('flex:1;min-width:0;border:0;border-radius:16px;padding:10px 8px;text-align:left;color:#F2F4FF;background:' + (this.state.pickSlot === i ? 'linear-gradient(145deg,' + d.gA + ',rgba(255,255,255,.08))' : 'rgba(255,255,255,.08)') + ';box-shadow:inset 0 0 0 ' + (this.state.pickSlot === i ? '1.5px ' + d.lite : '1px rgba(255,255,255,.2)'))}>
                    <div style={css('display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;opacity:.85')}>{d.icon ? <img src={d.icon} alt="" width="16" height="16" style={{ borderRadius: 4 }} /> : null}{d.name}</div>
                    <div style={css('font-size:13px;font-weight:700;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{this.state.targets[i] ? this.state.targets[i].label + (this.state.targets[i].shortcut ? ' · ' + this.state.targets[i].shortcut.label : '') : '預設'}</div>
                  </button>
                ))}
              </div>
              {this.state.targets[this.state.pickSlot] && (
                <div>
                  <div style={css('font-size:12px;font-weight:700;opacity:.7;margin:0 2px 6px')}>捷徑(長按 App 圖示會看到的功能)</div>
                  <div className="wc-applist" style={css('display:flex;gap:8px;overflow-x:auto;padding-bottom:2px')}>
                    {(() => {
                      const cur = this.state.targets[this.state.pickSlot];
                      const chip = (key, label, on, fn) => (
                        <button key={key} type="button" onClick={fn} className="wc-tap" style={css('flex:none;height:38px;padding:0 14px;border:0;border-radius:19px;color:#F2F4FF;font-size:13px;font-weight:700;white-space:nowrap;background:' + (on ? 'rgba(90,162,255,.32)' : 'rgba(255,255,255,.1)') + ';box-shadow:inset 0 0 0 ' + (on ? '1.5px #5AA2FF' : '1px rgba(255,255,255,.2)'))}>{label}</button>
                      );
                      return [chip('_app', '開啟 App', !cur.shortcut, () => this.assignShortcut(null))].concat(
                        this.state.shortcuts.map((sc) => chip(sc.id, sc.label, cur.shortcut && cur.shortcut.id === sc.id, () => this.assignShortcut(sc)))
                      );
                    })()}
                    {this.state.scLoading && <span style={css('align-self:center;color:#9AA0B8;font-size:13px')}>Loading…</span>}
                    {!this.state.scLoading && !this.state.shortcuts.length && <span style={css('align-self:center;color:#9AA0B8;font-size:12px;white-space:nowrap')}>沒有可讀取的捷徑</span>}
                  </div>
                </div>
              )}
              <div style={css('display:flex;align-items:center;gap:10px;padding:0 3px')}><label htmlFor="mpay-name" style={css('font-size:12px;color:#AEBBD5;white-space:nowrap')}>卡片名稱</label><input id="mpay-name" maxLength={24} value={this.state.names[this.state.pickSlot]} onChange={(e)=>this.renameCard(this.state.pickSlot,e.target.value)} placeholder="自訂卡片名稱" style={css('height:38px;min-width:0;flex:1;border-radius:12px;border:0;padding:0 12px;background:rgba(255,255,255,.1);color:#fff;font-size:14px;outline:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)')} /></div>
              <input value={this.state.q} onChange={(e) => this.setState({ q: e.target.value })} placeholder="Search apps" style={css("height:42px;border-radius:14px;border:0;padding:0 14px;background:rgba(255,255,255,.1);color:#fff;font-size:15px;outline:none;font-family:'DM Sans',system-ui,sans-serif;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)")} />
              <div className="wc-applist" style={css('flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px')}>
                <button type="button" onClick={() => this.assignApp(null)} className="wc-tap" style={css('display:flex;align-items:center;gap:12px;min-height:52px;border:0;border-radius:14px;padding:6px 10px;background:rgba(255,255,255,.06);color:#9AA0B8;text-align:left;font-size:15px;font-weight:500')}>使用預設 App</button>
                {this.state.appsLoading && <div style={css('padding:16px;color:#9AA0B8;font-size:14px')}>Loading…</div>}
                {this.state.pickOpen && v.shown.map((a) => {
                  const on = this.state.targets[this.state.pickSlot] && this.state.targets[this.state.pickSlot].pkg === a.package;
                  return (
                    <button key={a.package} type="button" onClick={() => this.assignApp(a)} className="wc-tap" style={css('display:flex;align-items:center;gap:12px;min-height:52px;border:0;border-radius:14px;padding:6px 10px;color:#F2F4FF;text-align:left;font-size:15px;font-weight:500;background:' + (on ? 'rgba(90,162,255,.28)' : 'rgba(255,255,255,.06)') + ';box-shadow:inset 0 0 0 ' + (on ? '1.5px #5AA2FF' : '1px rgba(255,255,255,.1)'))}>
                      {a.icon ? <img src={a.icon} alt="" width="36" height="36" style={{ borderRadius: 9, flex: 'none' }} /> : <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.14)', flex: 'none' }} />}
                      <span style={css('flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={'wc-sheet' + (this.state.exitAsk ? ' on' : '')} style={{ justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,8,.6)' }} onClick={() => this.setState({ exitAsk: false })}>
            <div onClick={(e) => e.stopPropagation()} style={css('width:300px;box-sizing:border-box;padding:22px 20px 18px;border-radius:26px;background:linear-gradient(145deg,rgba(60,90,170,.5),rgba(10,16,36,.94));box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 0 0 1px rgba(255,255,255,.16);display:flex;flex-direction:column;gap:16px;text-align:center')}>
              <div style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:18px")}>離開 Pay Hub?</div>
              <div style={css('display:flex;gap:10px')}>
                <button type="button" onClick={() => this.setState({ exitAsk: false })} className="wc-tap" style={css('flex:1;height:46px;border-radius:23px;border:0;background:rgba(255,255,255,.18);color:#fff;font-weight:700;font-size:15px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4)')}>留下</button>
                <button type="button" onClick={() => { try { CapApp.exitApp(); } catch (e) {} this.setState({ exitAsk: false }); }} className="wc-tap" style={css('flex:1;height:46px;border-radius:23px;border:0;background:linear-gradient(145deg,rgba(255,255,255,.95),rgba(226,232,255,.78));color:#05060A;font-weight:700;font-size:15px')}>離開</button>
              </div>
            </div>
          </div>

          {v.hasToast && (
            <div role="status" className="wc-toast" style={css('position:absolute;left:20px;right:20px;bottom:108px;display:flex;justify-content:center;pointer-events:none')}>
              <span style={css('background:#171A24;color:#F2F4FF;font-size:13px;font-weight:500;padding:10px 16px;border-radius:18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);text-align:center')}>{v.toast}</span>
            </div>
          )}


        </div>
      </div>
    );
  }
}
