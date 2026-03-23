// Input handling — mouse/touch for direction, dedicated boost controls
export class Input {
  constructor() {
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.direction = 0;
    this.boosting = false;
    this.active = false;
    this.isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0) || window.innerWidth <= 1024;

    this._bindEvents();

    if (this.isMobile) {
      this._createMobileControls();
    }
  }

  _bindEvents() {
    // === MOUSE (Desktop) ===
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this._updateDirection();
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.boosting = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.boosting = false;
    });

    // === KEYBOARD ===
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.boosting = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.boosting = false;
      }
    });

    // === TOUCH (Mobile) ===
    // We now rely on the joystick in _createMobileControls for mobile steering.
    // We just keep this preventDefault block for the general document to prevent zooming during gameplay.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());
  }

  _createMobileControls() {
    // Target the new console wrappers
    const boostWrapper = document.getElementById('boost-wrapper');
    const joystickWrapper = document.getElementById('joystick-wrapper');
    if (!boostWrapper || !joystickWrapper) return;

    // === HAPTICS ===
    this.vibrate = (ms = 10) => {
      if ('vibrate' in navigator) navigator.vibrate(ms);
    };

    // Create boost button for mobile
    const boostBtn = document.createElement('div');
    boostBtn.id = 'mobile-boost-btn';
    boostBtn.innerHTML = `
      <div class="boost-btn-inner">
        <span class="boost-icon">⚡</span>
        <span class="boost-label">BOOST</span>
      </div>
    `;
    boostWrapper.appendChild(boostBtn);

    const handleBoostStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.boosting = true;
      this.vibrate(15);
      boostBtn.classList.add('active');
    };

    const handleBoostEnd = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.boosting = false;
      boostBtn.classList.remove('active');
    };

    boostBtn.addEventListener('touchstart', handleBoostStart, { passive: false });
    boostBtn.addEventListener('touchend', handleBoostEnd, { passive: false });
    boostBtn.addEventListener('touchcancel', handleBoostEnd);

    // === START/SELECT BUTTON EXTERNAL WIRING ===
    const startBtn = document.getElementById('start-btn');
    const selectBtn = document.getElementById('select-btn');
    
    if (startBtn) {
      startBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.vibrate(20);
        // Simulate clicking the main play button if it's visible
        const playBtn = document.getElementById('play-btn');
        if (playBtn && playBtn.offsetParent !== null) {
          playBtn.click();
        }
      });
    }

    if (selectBtn) {
      selectBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.vibrate(10);
        // Maybe toggle leaderboard or something in future
        console.log('SELECT pressed');
      });
    }

    // Create Virtual Joystick inside wrapper
    const joystickZone = document.createElement('div');
    joystickZone.id = 'joystick-zone';
    joystickWrapper.appendChild(joystickZone);

    const joystickBase = document.createElement('div');
    joystickBase.className = 'joystick-base';
    joystickBase.innerHTML = '<div class="joystick-stick"></div>';
    joystickZone.appendChild(joystickBase);

    const stick = joystickBase.querySelector('.joystick-stick');
    
    let activeTouchId = null;
    const maxRadius = 35; // Max distance stick can drift

    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (activeTouchId === null) {
          activeTouchId = t.identifier;
          this._handleJoystickMove(t, joystickBase, stick, maxRadius);
          break;
        }
      }
    }, { passive: false });

    joystickZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (activeTouchId === null) return;
      
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === activeTouchId) {
          this._handleJoystickMove(t, joystickBase, stick, maxRadius);
        }
      }
    }, { passive: false });

    const stopTouch = (e) => {
      if (activeTouchId === null) return;
      for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === activeTouchId) {
          activeTouchId = null;
          stick.style.transform = `translate(0px, 0px)`;
        }
      }
    };
    
    joystickZone.addEventListener('touchend', stopTouch);
    joystickZone.addEventListener('touchcancel', stopTouch);
  }

  _handleJoystickMove(touch, base, stick, maxRadius) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    let nx = dx;
    let ny = dy;
    
    if (dist > maxRadius) {
      nx = (dx / dist) * maxRadius;
      ny = (dy / dist) * maxRadius;
    }
    
    stick.style.transform = `translate(${nx}px, ${ny}px)`;
    
    if (dist > 5) {
      // Invert Y to match game world mapping (+Y = UP)
      this.direction = Math.atan2(-ny, nx);
    }
  }

  show() {
    const consoleEl = document.getElementById('mobile-console');
    if (consoleEl && this.isMobile) consoleEl.style.display = 'flex';
  }

  hide() {
    const consoleEl = document.getElementById('mobile-console');
    if (consoleEl) consoleEl.style.display = 'none';
  }

  _updateDirection() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    // Desktop mouse: invert Y to match game world mapping (+Y = UP)
    this.direction = Math.atan2(cy - this.mouseY, this.mouseX - cx);
  }

  getState() {
    return {
      direction: this.direction,
      boosting: this.boosting,
    };
  }
}
