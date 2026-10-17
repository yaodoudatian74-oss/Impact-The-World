// Unified input: keyboard, mouse and touch feed one action model that the simulation reads.
// Presses are queued until a simulation tick consumes them, so no press is lost between ticks.

const KEYMAP = {
  KeyE: 'skill', KeyQ: 'burst', KeyF: 'interact', KeyR: 'mount', KeyH: 'potion',
  Digit1: 'switch1', Digit2: 'switch2', Digit3: 'switch3', Digit4: 'switch4',
  KeyM: 'map', KeyC: 'party', KeyJ: 'story', Escape: 'menu', Tab: 'map',
  Space: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash',
};
const HOLDMAP = { Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'down', KeyX: 'down', KeyV: 'down' };

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.queued = new Set();
    this.held = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.enabled = true;
    this.uiHandler = null; // receives menu-level actions (map, party, ...) even while paused
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.locked = false;
    this.sens = 1;
    this.drag = null;
    this.bind();
  }

  bind() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      const act = KEYMAP[e.code];
      if (act) this.press(act);
      const h = HOLDMAP[e.code];
      if (h) this.held.add(h);
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const h = HOLDMAP[e.code];
      if (h) this.held.delete(h);
    });
    addEventListener('blur', () => { this.keys.clear(); this.held.clear(); this.mouseAttack = false; });

    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // touch handled by the touch layer
      if (this.locked) {
        if (e.button === 0) { this.press('attack'); this.mouseAttack = true; }
        if (e.button === 2) this.press('dash');
        return;
      }
      this.drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button };
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (this.locked) {
        this.look.dx += e.movementX * this.sens;
        this.look.dy += e.movementY * this.sens;
        return;
      }
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.look.dx += dx * this.sens * 1.4;
      this.look.dy += dy * this.sens * 1.4;
    });
    c.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      if (this.locked) { if (e.button === 0) this.mouseAttack = false; return; }
      if (this.drag && this.drag.moved < 6 && this.drag.button === 0) {
        this.press('attack');
        if (this.wantsLock) this.requestLock();
      }
      this.drag = null;
    });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom += Math.sign(e.deltaY); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === c; if (!this.locked) this.mouseAttack = false; });
  }

  requestLock() {
    if (this.isTouch || this.locked || !this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.wantsLock = false; });
    } catch { this.wantsLock = false; }
  }

  exitLock() { if (this.locked) document.exitPointerLock?.(); }

  press(action) {
    if (this.uiHandler && this.uiHandler(action)) return;
    if (this.enabled) this.queued.add(action);
  }

  consume(action) {
    if (this.queued.has(action)) { this.queued.delete(action); return true; }
    return false;
  }

  isHeld(action) {
    if (!this.enabled) return false;
    if (action === 'attack' && this.mouseAttack) return true;
    return this.held.has(action);
  }

  setHeld(action, on) { if (on) this.held.add(action); else this.held.delete(action); }

  // Movement vector in [-1, 1]^2: x = right, y = forward.
  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = this.touchMove.x, y = this.touchMove.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  takeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = 0; this.look.dy = 0;
    return l;
  }

  takeZoom() { const z = this.zoom; this.zoom = 0; return z; }

  clearQueued() { this.queued.clear(); }
}
