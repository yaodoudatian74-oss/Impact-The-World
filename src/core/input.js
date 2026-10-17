// Unified input: keyboard, mouse and touch feed one action model that the simulation reads.
// Presses are queued until a simulation tick consumes them, so no press is lost between ticks.

const KEYMAP = {
  KeyE: 'skill', KeyQ: 'burst', KeyF: 'interact', KeyR: 'mount', KeyH: 'potion',
  Digit1: 'switch1', Digit2: 'switch2', Digit3: 'switch3', Digit4: 'switch4',
  KeyM: 'map', KeyC: 'party', KeyJ: 'story', Escape: 'menu', Tab: 'map',
  Space: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash',
};
const HOLDMAP = { Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'down', KeyX: 'down', KeyV: 'down' };

// Gamepad button indices follow the W3C "standard" mapping, which Xbox, PlayStation, Switch Pro
// and most other pads use in Chromium, Firefox and Safari. The face buttons are named by position:
// bottom/right/left/top, so the labels on each controller family still line up.
export const PAD = {
  bottom: 0, right: 1, left: 2, top: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, ls: 10, rs: 11,
  up: 12, down: 13, dleft: 14, dright: 15, home: 16,
};
const PAD_COUNT = 17;
const STICK_DEADZONE = 0.18;
const LOOK_SPEED = 620; // pixels per second at full right-stick deflection, before sensitivity

// Radial dead zone: returns the stick vector rescaled so the edge reaches 1, plus its magnitude.
export function stick(x, y, dead = STICK_DEADZONE) {
  const m = Math.hypot(x, y);
  if (m < dead) return { x: 0, y: 0, m: 0 };
  const k = (m - dead) / (1 - dead) / m;
  return { x: x * k, y: y * k, m: Math.min(1, (m - dead) / (1 - dead)) };
}

// Gamepad family from the browser's device id, used only for button labels.
export function padFamily(id = '') {
  if (/054c|playstation|dualshock|dualsense|sony/i.test(id)) return 'playstation';
  if (/057e|nintendo|switch|pro controller|joy-con/i.test(id)) return 'nintendo';
  return 'xbox';
}
export const PAD_LABELS = {
  xbox: { bottom: 'A', right: 'B', left: 'X', top: 'Y' },
  playstation: { bottom: '×', right: '○', left: '□', top: '△' },
  nintendo: { bottom: 'B', right: 'A', left: 'Y', top: 'X' },
};

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
    // Gamepad state. Sticks are read every frame, buttons are edge-detected against the last frame.
    this.pad = null;          // connected gamepad, or null
    this.padPrev = [];
    this.padHeld = new Set();
    this.padMove = { x: 0, y: 0 };
    this.padNavDir = null;
    this.padNavWait = 0;
    this.padT = 0;
    this.padUi = null;        // { active(): bool, button(name), navigate(dx, dy), tab(dir) } set by the UI
    this.contextA = null;     // () => bool, true when A should interact instead of jump
    this.padUsed = false;
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
    return this.held.has(action) || this.padHeld.has(action);
  }

  setHeld(action, on) { if (on) this.held.add(action); else this.held.delete(action); }

  // Reads the first connected gamepad. Call once per animation frame.
  pollGamepad(now) {
    const dt = this.padT ? Math.min(0.05, (now - this.padT) / 1000) : 0;
    this.padT = now;
    // Embedded or permission-restricted pages can make getGamepads throw; that must never stall the game loop.
    let pads = [];
    try {
      pads = navigator.getGamepads ? navigator.getGamepads() : [];
      this.padBlocked = false;
    } catch {
      this.padBlocked = true;
    }
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) {
      if (this.pad) this.releasePad();
      this.pad = null;
      return;
    }
    if (!this.pad) this.padPrev = [];
    this.pad = pad;
    const cur = [];
    for (let i = 0; i < PAD_COUNT; i++) {
      const b = pad.buttons[i];
      cur[i] = !!b && (b.pressed || b.value > 0.5);
    }
    const down = (i) => cur[i] && !this.padPrev[i];
    const L = stick(pad.axes[0] || 0, pad.axes[1] || 0);
    const R = stick(pad.axes[2] || 0, pad.axes[3] || 0);
    if (cur.some(Boolean) || L.m > 0 || R.m > 0) this.padUsed = true;

    if (this.padUi?.active()) {
      // Menus and dialogue: sticks and the d-pad move focus, face buttons act on it.
      this.releasePad();
      let dir = null;
      if (cur[PAD.up]) dir = { x: 0, y: -1 };
      else if (cur[PAD.down]) dir = { x: 0, y: 1 };
      else if (cur[PAD.dleft]) dir = { x: -1, y: 0 };
      else if (cur[PAD.dright]) dir = { x: 1, y: 0 };
      else if (L.m > 0.6) dir = Math.abs(L.x) > Math.abs(L.y) ? { x: Math.sign(L.x), y: 0 } : { x: 0, y: Math.sign(L.y) };
      if (dir) {
        const same = this.padNavDir && this.padNavDir.x === dir.x && this.padNavDir.y === dir.y;
        this.padNavWait = same ? this.padNavWait - dt : 0.4;
        if (!same || this.padNavWait <= 0) {
          this.padUi.navigate(dir.x, dir.y);
          this.padNavWait = same ? 0.12 : this.padNavWait;
        }
        this.padNavDir = dir;
      } else this.padNavDir = null;
      if (down(PAD.bottom)) this.padUi.button('a');
      if (down(PAD.right)) this.padUi.button('b');
      if (down(PAD.left)) this.padUi.button('x');
      if (down(PAD.top)) this.padUi.button('y');
      if (down(PAD.lb)) this.padUi.tab(-1);
      if (down(PAD.rb)) this.padUi.tab(1);
      if (down(PAD.start)) this.padUi.button('start');
      if (down(PAD.select)) this.padUi.button('select');
    } else {
      // Gameplay: left stick moves, right stick looks, face buttons act.
      this.padNavDir = null;
      this.padMove = { x: L.x, y: -L.y };
      this.setPadHeld('attack', cur[PAD.rt]);
      this.setPadHeld('sprint', cur[PAD.ls]);
      this.setPadHeld('down', cur[PAD.lt]);
      this.look.dx += R.x * LOOK_SPEED * dt * this.sens;
      this.look.dy += R.y * LOOK_SPEED * dt * this.sens;
      if (down(PAD.bottom)) this.press(this.contextA?.() ? 'interact' : 'jump');
      if (down(PAD.right)) this.press('dash');
      if (down(PAD.left)) this.press('skill');
      if (down(PAD.top)) this.press('burst');
      if (down(PAD.rt)) this.press('attack');
      if (down(PAD.lb)) this.press('prevChar');
      if (down(PAD.rb)) this.press('nextChar');
      if (down(PAD.up)) this.press('potion');
      if (down(PAD.down)) this.press('mount');
      if (down(PAD.start)) this.press('menu');
      if (down(PAD.select)) this.press('map');
      if (down(PAD.rs)) this.press('party');
    }
    this.padPrev = cur;
  }

  // One-line status for the settings screen.
  padStatusText() {
    if (this.pad) return `検出: ${this.pad.id}`;
    if (this.padBlocked || window.top !== window.self) return '未検出（埋め込み表示ではブラウザがコントローラーを止めることがあります。新しいタブで開いてください）';
    return '未検出（接続後、コントローラーのボタンを1回押してください）';
  }

  setPadHeld(action, on) {
    if (on) this.padHeld.add(action); else this.padHeld.delete(action);
  }

  // Drops everything the pad was holding, e.g. when a menu opens over a held trigger.
  releasePad() {
    this.padHeld.clear();
    this.padMove = { x: 0, y: 0 };
    this.padNavDir = null;
  }

  // Movement vector in [-1, 1]^2: x = right, y = forward.
  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = this.touchMove.x + this.padMove.x, y = this.touchMove.y + this.padMove.y;
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
