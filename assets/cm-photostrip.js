import { Component } from '@theme/component';

/**
 * @typedef {Object} CmPhotostripRefs
 * @property {HTMLElement} strip
 * @property {HTMLElement} flash
 * @property {HTMLElement[]} [frames]
 */

/**
 * Photobooth print animation + mobile-friendly auto-scroll for Four Frames.
 * @extends {Component<CmPhotostripRefs>}
 */
class CmPhotostrip extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {boolean} */
  #hasPlayed = false;

  /** @type {number[]} */
  #timeouts = [];

  /** @type {number | null} */
  #autoScrollRaf = null;

  /** @type {number | null} */
  #resumeTimeout = null;

  /** @type {number | null} */
  #fallbackTimeout = null;

  /** @type {boolean} */
  #autoScrollPaused = false;

  /** @type {boolean} */
  #autoScrollEnabled = false;

  /** @type {number} */
  #lastTimestamp = 0;

  connectedCallback() {
    super.connectedCallback();

    this.#bindScrollInteractions();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.#revealAll();
      return;
    }

    // Hide frames only when JS is ready to animate them in.
    this.classList.add('is-enhanced');

    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.#play();
            this.#observer?.disconnect();
            this.#observer = null;
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );

    this.#observer.observe(this);

    // Theme editor / late layout: never leave frames invisible.
    this.#fallbackTimeout = window.setTimeout(() => {
      if (!this.#hasPlayed) {
        this.#revealAll();
        this.#startAutoScroll();
      }
    }, 2500);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#clearTimeouts();
    this.#stopAutoScroll();
    this.#unbindScrollInteractions();

    if (this.#fallbackTimeout !== null) {
      window.clearTimeout(this.#fallbackTimeout);
      this.#fallbackTimeout = null;
    }
  }

  #clearTimeouts() {
    for (const id of this.#timeouts) {
      window.clearTimeout(id);
    }
    this.#timeouts = [];
  }

  #revealAll() {
    this.#hasPlayed = true;
    this.classList.add('is-ready');
    this.classList.remove('is-enhanced');

    for (const frame of this.#getFrames()) {
      frame.classList.add('is-printed');
      frame.classList.remove('is-flashing');
    }
  }

  /** @returns {HTMLElement[]} */
  #getFrames() {
    const fromRefs = this.refs.frames;

    if (Array.isArray(fromRefs) && fromRefs.length > 0) {
      return fromRefs.filter((frame) => frame instanceof HTMLElement);
    }

    if (fromRefs instanceof HTMLElement) return [fromRefs];

    return Array.from(this.querySelectorAll('[data-cm-frame]'));
  }

  /** @returns {HTMLElement | null} */
  #getStrip() {
    const fromRefs = this.refs.strip;
    if (fromRefs instanceof HTMLElement) return fromRefs;
    return this.querySelector('.cm-photostrip__track');
  }

  #play() {
    if (this.#hasPlayed) return;

    const frames = this.#getFrames();
    if (frames.length === 0) {
      this.#revealAll();
      return;
    }

    this.#hasPlayed = true;
    this.classList.add('is-ready');

    if (this.#fallbackTimeout !== null) {
      window.clearTimeout(this.#fallbackTimeout);
      this.#fallbackTimeout = null;
    }

    const flash = this.refs.flash instanceof HTMLElement ? this.refs.flash : null;
    const delayBetween = Number(this.dataset.frameDelay || 780);
    const flashMs = Number(this.dataset.flashDuration || 160);
    const printMs = 480;

    for (const [index, frame] of frames.entries()) {
      const startAt = index * delayBetween;

      this.#timeouts.push(
        window.setTimeout(() => {
          this.classList.add('is-flashing');
          flash?.classList.add('is-on');
          frame.classList.add('is-flashing');

          this.#timeouts.push(
            window.setTimeout(() => {
              this.classList.remove('is-flashing');
              flash?.classList.remove('is-on');
              frame.classList.remove('is-flashing');
              frame.classList.add('is-printed');
              this.#scrollFrameIntoView(frame);
            }, flashMs)
          );
        }, startAt)
      );
    }

    const autoScrollAt = frames.length * delayBetween + flashMs + printMs + 400;
    this.#timeouts.push(
      window.setTimeout(() => {
        this.#startAutoScroll();
      }, autoScrollAt)
    );
  }

  /**
   * @param {HTMLElement} frame
   */
  #scrollFrameIntoView(frame) {
    const strip = this.#getStrip();
    if (!strip) return;

    const canScroll = strip.scrollWidth > strip.clientWidth + 8;
    if (!canScroll) return;

    const stripRect = strip.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const nextLeft = strip.scrollLeft + (frameRect.left - stripRect.left) - 20;

    strip.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: 'smooth',
    });
  }

  #bindScrollInteractions() {
    const strip = this.#getStrip();
    if (!strip) return;

    strip.addEventListener('pointerdown', this.#handleUserInteract, { passive: true });
    strip.addEventListener('touchstart', this.#handleUserInteract, { passive: true });
    strip.addEventListener('wheel', this.#handleUserInteract, { passive: true });
    strip.addEventListener('keydown', this.#handleUserInteract);
  }

  #unbindScrollInteractions() {
    const strip = this.#getStrip();
    if (!strip) return;

    strip.removeEventListener('pointerdown', this.#handleUserInteract);
    strip.removeEventListener('touchstart', this.#handleUserInteract);
    strip.removeEventListener('wheel', this.#handleUserInteract);
    strip.removeEventListener('keydown', this.#handleUserInteract);
  }

  #handleUserInteract = () => {
    if (!this.#autoScrollEnabled) return;
    this.#pauseAutoScroll();
  };

  #pauseAutoScroll() {
    this.#autoScrollPaused = true;
    this.#stopAutoScrollLoop();

    if (this.#resumeTimeout !== null) {
      window.clearTimeout(this.#resumeTimeout);
    }

    this.#resumeTimeout = window.setTimeout(() => {
      this.#autoScrollPaused = false;
      this.#startAutoScrollLoop();
    }, 2800);
  }

  #startAutoScroll() {
    const strip = this.#getStrip();
    if (!strip) return;
    if (strip.scrollWidth <= strip.clientWidth + 8) return;

    this.#autoScrollEnabled = true;
    this.#autoScrollPaused = false;
    this.classList.add('is-auto-scrolling');
    this.#startAutoScrollLoop();
  }

  #startAutoScrollLoop() {
    if (this.#autoScrollRaf !== null || this.#autoScrollPaused || !this.#autoScrollEnabled) return;

    this.#lastTimestamp = 0;
    this.#autoScrollRaf = window.requestAnimationFrame(this.#tickAutoScroll);
  }

  #stopAutoScrollLoop() {
    if (this.#autoScrollRaf === null) return;
    window.cancelAnimationFrame(this.#autoScrollRaf);
    this.#autoScrollRaf = null;
    this.#lastTimestamp = 0;
  }

  #stopAutoScroll() {
    this.#autoScrollEnabled = false;
    this.#autoScrollPaused = false;
    this.classList.remove('is-auto-scrolling');
    this.#stopAutoScrollLoop();

    if (this.#resumeTimeout !== null) {
      window.clearTimeout(this.#resumeTimeout);
      this.#resumeTimeout = null;
    }
  }

  /**
   * @param {number} timestamp
   */
  #tickAutoScroll = (timestamp) => {
    this.#autoScrollRaf = null;

    if (!this.#autoScrollEnabled || this.#autoScrollPaused) return;

    const strip = this.#getStrip();
    if (!strip) return;

    const maxScroll = strip.scrollWidth - strip.clientWidth;
    if (maxScroll <= 8) {
      this.#stopAutoScroll();
      return;
    }

    if (!this.#lastTimestamp) {
      this.#lastTimestamp = timestamp;
    }

    const delta = Math.min(32, timestamp - this.#lastTimestamp);
    this.#lastTimestamp = timestamp;

    const pixels = (delta / 1000) * 28;
    let next = strip.scrollLeft + pixels;

    if (next >= maxScroll - 0.5) {
      next = 0;
    }

    strip.scrollLeft = next;
    this.#autoScrollRaf = window.requestAnimationFrame(this.#tickAutoScroll);
  };
}

if (!customElements.get('cm-photostrip')) {
  customElements.define('cm-photostrip', CmPhotostrip);
}
