import React from 'react';
import { openProvider } from './launch.js';
import { listApps, loadTargets, saveTargets } from './appList.js';

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

const GLYPH_PROPS = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { sel: 0, toast: '', payOpen: false, payOut: false, payTx: 0, payTy: 0, dragX: 0, dragging: false, done: false, swipeX: 0, swiping: false, k: 1, targets: loadTargets(), pickOpen: false, pickSlot: 0, apps: [], appsLoading: false, q: '' };
    this.outTimer = null;
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
    this.onResize = () => this.setState({ k: Math.min(window.innerWidth / 390, window.innerHeight / 844) || 1 });
  }

  componentDidMount() {
    this.onResize();
    window.addEventListener('resize', this.onResize);
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
      if (this.state.payOpen || this.state.pickOpen) return;
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
      if (Math.abs(v) > 0.35) dir = v > 0 ? 1 : -1;
      else if (Math.abs(dy) > h * 0.15) dir = dy > 0 ? 1 : -1;
      this.animateTo(clamp(start + dir) * h, 1250);
    };
    this.onWheel = (e) => {
      if (this.state.pickOpen) return;
      e.preventDefault();
      if (this.state.payOpen) return;
      const now = performance.now();
      const gap = now - this.lastWheel;
      this.lastWheel = now;
      if (this.animating) return;
      if (this.wheelLocked && gap < 140) return;
      if (Math.abs(e.deltaY) < 4) return;
      const h = H();
      const cur = Math.round(sc.scrollTop / h);
      this.wheelLocked = true;
      this.animateTo(clamp(cur + (e.deltaY > 0 ? 1 : -1)) * h, 1250);
    };
    this.onScroll = () => {
      if (this.animating || this.touching) return;
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
    window.removeEventListener('resize', this.onResize);
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
    const norm = 1 - Math.pow(2, -10);
    const t0 = performance.now();
    this.animating = true;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = (1 - Math.pow(2, -10 * t)) / norm;
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
      ty = Math.round((rr.top + 372 * k - (cr.top + cr.height / 2)) / k);
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
    this.setState({ dragging: false, done: true, dragX: 320 });
    setTimeout(async () => {
      this.closePay();
      const msg = await openProvider(idx, this.state.targets[idx]);
      if (msg) this.showToast(msg);
    }, 600);
  }

  showToast(msg) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.setState({ toast: '' });
    setTimeout(() => this.setState({ toast: msg }), 20);
    this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 2400);
  }

  async openPicker() {
    this.setState({ pickOpen: true, pickSlot: this.state.sel, q: '', appsLoading: !this.state.apps.length });
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

  assignApp(app) {
    const t = this.state.targets.slice();
    t[this.state.pickSlot] = app ? { pkg: app.package, label: app.label } : null;
    saveTargets(t);
    this.setState({ targets: t });
  }

  // scale/zoom to scale pointer deltas from screen px to layout px
  px(v) { return v / (this.state.k || 1); }

  renderVals() {
    const st = this.state;
    const sel = st.sel || 0;
    const P = this.P;
    const self = this;
    const paying = !!st.payOpen;
    const dx = st.dragX || 0;
    const prog = Math.min(1, dx / 150);
    const sx = st.swipeX || 0;
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
          else if (st.done) tr = 'translate .55s cubic-bezier(.5,0,.9,.4),opacity .5s ease,rotate .55s ease';
        } else {
          extra = 'opacity:0;translate:' + (o * 44) + 'px 0;pointer-events:none;';
        }
      } else if (st.payOut && front) {
        tr = 'transform .8s cubic-bezier(.2,.8,.2,1),opacity .6s ease,translate 0s,rotate 0s';
      } else if (st.swiping) {
        if (front) extra = 'translate:' + Math.round(sx * 0.8) + 'px 0;rotate:' + (sx * 0.04).toFixed(2) + 'deg;';
        tr = 'transform .9s cubic-bezier(.2,.8,.2,1),opacity .6s ease,translate 0s,rotate 0s';
      }
      return {
        domId: 'wc-card-' + i,
        name: p.name, sub: p.sub, lite: p.lite, glow: p.glow, glyph: p.glyph, subOp: front ? 0.85 : 0,
        aria: p.name + (front ? ', selected. Press to pay' : ', bring to front'),
        faceShadow: 'inset 0 0 0 1px ' + p.edge + ',inset 0 1px 0 rgba(255,255,255,.4)' + (paying && front ? ',0 0 ' + Math.round(26 + prog * 50) + 'px ' + Math.round(-2 + prog * 10) + 'px ' + p.glow : ''),
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
          self.setState({ dragX: Math.max(0, Math.min(260, self.px(e.clientX - self.drag.x0))) });
        },
        up: () => {
          if (!self.drag) return;
          self.drag = null;
          if ((self.state.dragX || 0) > 130) self.finishPay();
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
        self.setState({ swipeX: Math.max(-140, Math.min(140, dx0)) });
      },
      up: () => {
        const w = self.sw;
        self.sw = null;
        if (!w || !w.active) return;
        const d = self.state.swipeX || 0;
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
      name: p.name, glyph: p.glyph, lite: p.lite,
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
      name: p.name, glyph: p.glyph, gA: p.gA, gB: p.gB, lite: p.lite,
      on: i === sel,
      status: (st.targets[i] ? '→ ' + st.targets[i].label : (i === sel ? 'Default' : 'Tap to make default')),
      bg: i === sel ? 'linear-gradient(145deg,' + p.gA + ',rgba(255,255,255,.05))' : 'linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.07))',
      edge: i === sel ? p.lite : 'rgba(255,255,255,.2)',
      ring: i === sel ? p.lite : 'rgba(255,255,255,.3)',
      fill: i === sel ? p.lite : 'transparent',
      tick: i === sel ? 1 : 0,
      pick: () => self.setState({ sel: i })
    }));
    const q = (st.q || '').trim().toLowerCase();
    const shown = (st.apps || []).filter((a) => !q || a.label.toLowerCase().includes(q));
    return {
      cards, tiles, radios, sw, shown,
      spotColor: P[sel].glow,
      rootCls: paying ? 'wc-paying' : '',
      turnCls: paying ? 'wc-pin' : (st.payOut ? 'wc-pout' : ''),
      payTx: st.payTx || 0,
      payTy: st.payTy || 0,
      progressPct: Math.round(prog * 100),
      hintStyle: 'opacity:' + (paying ? 1 : 0) + ';visibility:' + (paying ? 'visible' : 'hidden') + ';transition:opacity .6s ease ' + (paying ? '1.1s' : '0s') + ',visibility 0s linear ' + (paying ? '0s' : '.6s') + ';',
      cancelPay: () => self.closePay(),
      selColor: P[sel].lite,
      ctaLabel: 'Open ' + ((st.targets[sel] && st.targets[sel].label) || P[sel].name),
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
      <div className="wc-blob" style={css(pos + ';width:' + size + 'px;height:' + size + 'px;background:radial-gradient(closest-side,rgba(0,0,0,0) 46%,' + color + ' 60%,rgba(0,0,0,0) 100%);opacity:' + op + ';--dur:' + dur + 's;--del:' + del + 's;--bx:' + bx + 'px;--by:' + by + 'px;--by2:' + by2 + 'px')} />
    );
    const Glyph = ({ d, size, stroke, sw, extra }) => (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...GLYPH_PROPS} stroke={stroke} strokeWidth={sw} style={extra}><path d={d} /></svg>
    );
    return (
      <div id="fit" style={{ transform: 'translate(-50%,-50%) scale(' + k + ')' }}>
        <div id="wc-root" className={'wc-root ' + v.rootCls} style={css("position:relative;width:390px;height:844px;overflow:hidden;background:linear-gradient(180deg,#02050F,#000 70%);font-family:'DM Sans',system-ui,sans-serif;color:#F2F4FF")}>
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
              <div className="wc-page" style={css('height:100%;box-sizing:border-box;padding:56px 24px 124px;display:flex;flex-direction:column;align-items:center')}>
                <div className="wc-rise wc-outbound" style={css('--ox:0px;--oy:-90px;--amp:50px;align-self:stretch;display:flex;align-items:center;justify-content:space-between;min-height:44px;padding-left:52px')}>
                  <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:15px")}>Pay Hub</span>
                  <span style={css('font-size:13px;font-weight:500;color:#9AA0B8')}>Galaxy A57</span>
                </div>

                <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px')}>
                  <div style={css('position:relative;width:340px;height:250px;box-sizing:border-box;padding-right:48px;padding-top:40px;perspective:1100px;display:flex;align-items:center;justify-content:center')}>
                    <div id="wc-stage" className="wc-float" style={css('position:relative;width:268px;height:170px;transform-style:preserve-3d')}>
                      <div className={'wc-turn ' + v.turnCls} style={css('position:absolute;inset:0;transform-style:preserve-3d;--tx:' + v.payTx + 'px;--ty:' + v.payTy + 'px')}>
                        {v.cards.map((c) => (
                          <button key={c.domId} id={c.domId} type="button" aria-label={c.aria} onClick={c.pick} onPointerDown={c.down} onPointerMove={c.move} onPointerUp={c.up} onPointerCancel={c.up} onKeyDown={c.key} style={css('position:absolute;inset:0;padding:0;border:0;background:none;text-align:left;color:#F2F4FF;' + c.style)}>
                            <div style={css('position:absolute;inset:0;border-radius:22px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,0) 42%),linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.03)),rgba(10,12,18,.66);box-shadow:' + c.faceShadow + ';transition:box-shadow .5s ease')}>
                              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 90% at 0% 0%,' + c.glow + ',rgba(0,0,0,0) 62%)' }} />
                              <div style={css('position:absolute;inset:0;box-sizing:border-box;padding:16px 20px 18px;display:flex;flex-direction:column;justify-content:space-between')}>
                                <div style={css('display:flex;justify-content:space-between;align-items:center')}>
                                  <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:18px")}>{c.name}</span>
                                  <Glyph d={c.glyph} size={24} stroke={c.lite} sw={1.9} />
                                </div>
                                <span style={css('font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:' + c.lite + ';opacity:' + c.subOp)}>{c.sub}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="wc-rise wc-outbound" style={css('--ox:0px;--oy:150px;--amp:120px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center')}>
                    <h1 style={css("margin:0;font-family:'Sora',system-ui,sans-serif;font-weight:700;font-size:32px;line-height:1.15;letter-spacing:-.02em;text-wrap:balance")}>One place to pay</h1>
                    <div role="group" aria-label="Choose a payment app" style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:342px')}>
                      {v.tiles.map((t) => (
                        <button key={t.name} type="button" aria-pressed={t.on} aria-label={t.name} onClick={t.pick} className="wc-tap" style={css('aspect-ratio:1/1;border:0;border-radius:24px;box-sizing:border-box;padding:14px;background:' + t.bg + ';color:#F2F4FF;-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;text-align:left;' + t.style)}>
                          <Glyph d={t.glyph} size={30} stroke={t.lite} sw={2} />
                          <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:700;font-size:15px;line-height:1.1")}>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="wc-bob wc-outbound" aria-hidden="true" style={css('--ox:0px;--oy:110px;position:absolute;left:0;right:0;bottom:104px;color:#9AA0B8;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase')}>
                  <Glyph d="M6 15l6-6 6 6" size={16} stroke="currentColor" sw={2} />
                </div>
              </div>
            </section>

            <section id="wc-default" className="wc-snap">
              <div className="wc-page" style={css('position:relative;height:100%;box-sizing:border-box;padding:96px 20px 150px;display:flex;flex-direction:column;justify-content:center')}>
                <button type="button" aria-label="Choose apps to open" onClick={() => this.openPicker()} className="wc-tap" style={css('position:absolute;right:20px;bottom:142px;height:48px;padding:0 18px;border-radius:24px;border:0;display:flex;align-items:center;gap:8px;background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.14));-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);color:#FFFFFF;font-weight:700;font-size:14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45),inset 0 1px 0 rgba(255,255,255,.65)')}>
                  <Glyph d="M4 6h16M4 12h16M4 18h10" size={18} stroke="currentColor" sw={2.2} />
                  Choose apps
                </button>
                <div className="wc-rise" style={css('--amp:90px;display:flex;flex-direction:column;gap:14px')}>
                  <h2 style={css("margin:0 4px;font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:24px;letter-spacing:-.01em")}>Default app</h2>
                  <p style={css('margin:0 4px 8px;font-size:15px;line-height:1.45;color:#9AA0B8')}>The main button opens this one first.</p>
                  <div role="radiogroup" aria-label="Default payment app" style={css('display:flex;flex-direction:column;gap:12px')}>
                    {v.radios.map((d) => (
                      <button key={d.name} type="button" role="radio" aria-checked={d.on} onClick={d.pick} className="wc-tap" style={css('display:flex;align-items:center;gap:14px;min-height:72px;box-sizing:border-box;padding:12px 16px;border-radius:22px;border:0;background:' + d.bg + ';color:#F2F4FF;text-align:left;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:inset 0 0 0 1px ' + d.edge + ',inset 0 1px 0 rgba(255,255,255,.35)')}>
                        <div aria-hidden="true" style={css('width:40px;height:40px;border-radius:12px;background:linear-gradient(145deg,' + d.gA + ',' + d.gB + ');color:' + d.lite + ';box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),inset 0 1px 0 rgba(255,255,255,.45);display:flex;align-items:center;justify-content:center;flex:none')}>
                          <Glyph d={d.glyph} size={22} stroke="currentColor" sw={2} />
                        </div>
                        <div style={css('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}>
                          <span style={css('font-size:17px;font-weight:700;line-height:1.2')}>{d.name}</span>
                          <span style={css('font-size:14px;font-weight:500;color:#9AA0B8;line-height:1.3')}>{d.status}</span>
                        </div>
                        <div aria-hidden="true" style={css('width:28px;height:28px;border-radius:50%;box-sizing:border-box;border:2px solid ' + d.ring + ';background:' + d.fill + ';display:flex;align-items:center;justify-content:center;flex:none')}>
                          <Glyph d="M5 12l5 5L19 7" size={16} stroke="#05060A" sw={3.2} extra={{ opacity: d.tick }} />
                        </div>
                      </button>
                    ))}
                  </div>
                  <p style={css('margin:6px 4px 0;font-size:13px;line-height:1.45;color:#9AA0B8')}>Balances and history stay inside each app.</p>
                </div>
              </div>
            </section>
          </div>

          <div aria-hidden="true" className="wc-outbound" style={css('--ox:70px;--oy:0px;position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px')}>
            <div className="wc-dot wc-d1" style={css('height:22px;opacity:1')} />
            <div className="wc-dot wc-d2" />
          </div>

          <button type="button" aria-label="Back" onClick={v.back} className="wc-outbound" style={css('--ox:-70px;--oy:-70px;position:absolute;left:16px;top:50px;width:44px;height:44px;border-radius:22px;border:0;background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(255,255,255,.2));-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);color:#FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5),inset 0 1px 0 rgba(255,255,255,.7)')}>
            <Glyph d="M15 5l-7 7 7 7" size={22} stroke="currentColor" sw={2.2} />
          </button>

          <div style={css('position:absolute;left:0;right:0;top:568px;display:flex;flex-direction:column;align-items:center;gap:14px;' + v.hintStyle)}>
            <div aria-hidden="true" style={css('width:240px;height:6px;border-radius:3px;background:rgba(255,255,255,.16);overflow:hidden')}>
              <div style={{ height: '100%', width: v.progressPct + '%', borderRadius: 3, background: v.selColor }} />
            </div>
            <div style={css('display:flex;align-items:center;gap:8px;color:#E6E9F5;font-size:15px;font-weight:500')}>
              Swipe the card right to pay
              <svg className="wc-nudge" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" {...GLYPH_PROPS} stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6" /></svg>
            </div>
            <button type="button" onClick={v.cancelPay} className="wc-tap" style={css('min-height:44px;padding:0 24px;border-radius:22px;border:0;background:rgba(255,255,255,.2);color:#FFFFFF;font-weight:700;font-size:15px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),inset 0 1px 0 rgba(255,255,255,.55)')}>Cancel</button>
          </div>


          <div className={'wc-sheet' + (this.state.pickOpen ? ' on' : '')} onClick={() => this.setState({ pickOpen: false })}>
            <div className="wc-sheet-panel" onClick={(e) => e.stopPropagation()} style={css('box-sizing:border-box;height:640px;padding:20px 16px 24px;border-radius:28px 28px 0 0;background:linear-gradient(180deg,rgba(40,60,120,.55),rgba(8,12,28,.9));-webkit-backdrop-filter:blur(24px) saturate(1.5);backdrop-filter:blur(24px) saturate(1.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 0 0 1px rgba(255,255,255,.14);display:flex;flex-direction:column;gap:12px')}>
              <div style={css('display:flex;align-items:center;justify-content:space-between')}>
                <span style={css("font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:18px")}>Open on swipe</span>
                <button type="button" onClick={() => this.setState({ pickOpen: false })} className="wc-tap" style={css('height:40px;padding:0 18px;border-radius:20px;border:0;background:rgba(255,255,255,.2);color:#fff;font-weight:700;font-size:14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4)')}>Done</button>
              </div>
              <div style={css('display:flex;gap:8px')}>
                {v.radios.map((d, i) => (
                  <button key={d.name} type="button" onClick={() => this.setState({ pickSlot: i })} className="wc-tap" style={css('flex:1;min-width:0;border:0;border-radius:16px;padding:10px 8px;text-align:left;color:#F2F4FF;background:' + (this.state.pickSlot === i ? 'linear-gradient(145deg,' + d.gA + ',rgba(255,255,255,.08))' : 'rgba(255,255,255,.08)') + ';box-shadow:inset 0 0 0 ' + (this.state.pickSlot === i ? '1.5px ' + d.lite : '1px rgba(255,255,255,.2)'))}>
                    <div style={css('font-size:12px;font-weight:700;opacity:.8')}>{d.name}</div>
                    <div style={css('font-size:13px;font-weight:700;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{this.state.targets[i] ? this.state.targets[i].label : '預設'}</div>
                  </button>
                ))}
              </div>
              <input value={this.state.q} onChange={(e) => this.setState({ q: e.target.value })} placeholder="Search apps" style={css("height:42px;border-radius:14px;border:0;padding:0 14px;background:rgba(255,255,255,.1);color:#fff;font-size:15px;outline:none;font-family:'DM Sans',system-ui,sans-serif;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)")} />
              <div className="wc-applist" style={css('flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px')}>
                <button type="button" onClick={() => this.assignApp(null)} className="wc-tap" style={css('display:flex;align-items:center;gap:12px;min-height:52px;border:0;border-radius:14px;padding:6px 10px;background:rgba(255,255,255,.06);color:#9AA0B8;text-align:left;font-size:15px;font-weight:500')}>使用預設 App</button>
                {this.state.appsLoading && <div style={css('padding:16px;color:#9AA0B8;font-size:14px')}>Loading…</div>}
                {v.shown.map((a) => {
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

          {v.hasToast && (
            <div role="status" className="wc-toast" style={css('position:absolute;left:20px;right:20px;bottom:108px;display:flex;justify-content:center;pointer-events:none')}>
              <span style={css('background:#171A24;color:#F2F4FF;font-size:13px;font-weight:500;padding:10px 16px;border-radius:18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);text-align:center')}>{v.toast}</span>
            </div>
          )}

          <div className="wc-outbound" style={css('--ox:0px;--oy:130px;position:absolute;left:0;right:0;bottom:0;padding:48px 20px 28px')}>
            <button type="button" onClick={v.openSel} className="wc-tap" style={css("width:100%;height:56px;border-radius:28px;border:0;background:linear-gradient(145deg,rgba(255,255,255,.95),rgba(226,232,255,.78));-webkit-backdrop-filter:blur(22px) saturate(1.6);backdrop-filter:blur(22px) saturate(1.6);color:#05060A;font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:16px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.9),inset 0 1px 0 #FFFFFF,0 0 22px -6px " + v.selColor)}>
              {v.ctaLabel}
              <Glyph d="M7 17L17 7M9 7h8v8" size={18} stroke="currentColor" sw={2.4} />
            </button>
          </div>
        </div>
      </div>
    );
  }
}
