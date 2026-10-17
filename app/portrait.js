(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PortraitAnimator = factory().PortraitAnimator;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  class PortraitAnimator {
    constructor({ images, draw, random = Math.random, schedule = (callback,delay) => setTimeout(callback,delay), cancel = handle => clearTimeout(handle), visible = () => true }) {
      this.images = images; this.draw = draw; this.random = random; this.schedule = schedule; this.cancel = cancel; this.visible = visible;
      this.timers = new Set(); this.expression = 'normal'; this.paused = false;
    }
    later(callback, delay) {
      const handle = this.schedule(() => { this.timers.delete(handle); callback(); }, delay);
      this.timers.add(handle); return handle;
    }
    clear() { for (const handle of this.timers) this.cancel(handle); this.timers.clear(); }
    frame(id) { this.draw(this.images[id] || this.images.normal, id); }
    show(id) {
      this.clear(); this.expression = this.images[id] ? id : 'normal'; this.frame(this.expression);
      if (this.expression === 'normal') this.arm();
    }
    arm() {
      if (this.paused || !this.visible() || !this.images['blink-closed']) return;
      this.later(() => this.blink(), 3000 + Math.floor(this.random() * 3000));
    }
    blink(allowDouble = true) {
      if (this.expression !== 'normal' || this.paused || !this.visible()) return;
      this.frame(this.images['blink-half']?'blink-half':'blink-closed');
      this.later(() => this.frame('blink-closed'), 50);
      this.later(() => this.frame(this.images['blink-half']?'blink-half':'blink-closed'), 140);
      this.later(() => {
        this.frame('normal');
        if (allowDouble && this.random() < 0.15) this.later(() => this.blink(false), 130);
        else this.arm();
      }, 190);
    }
    pause() { this.paused = true; this.clear(); this.frame(this.expression); }
    resume() { this.paused = false; this.show(this.expression); }
    dispose() { this.clear(); }
  }
  return { PortraitAnimator };
});
