class AssessmentTimer {
  constructor(expiresAt, onTick, onExpire) {
    this.expiresAt = new Date(expiresAt).getTime();
    this.onTick = onTick;
    this.onExpire = onExpire;
    this._interval = null;
  }

  start() {
    this._tick();
    this._interval = setInterval(() => this._tick(), 1000);
  }

  _tick() {
    const remaining = this.expiresAt - Date.now();
    if (remaining <= 0) {
      clearInterval(this._interval);
      this.onTick({ minutes: 0, seconds: 0, remaining: 0 });
      this.onExpire();
      return;
    }
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    this.onTick({ minutes, seconds, remaining });
  }

  stop() { clearInterval(this._interval); }

  getDisplay() {
    const remaining = Math.max(0, this.expiresAt - Date.now());
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
