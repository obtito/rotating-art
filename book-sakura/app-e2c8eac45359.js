(() => {
  'use strict';

  const stage = document.querySelector('[data-stage]');
  const art = document.querySelector('[data-art]');
  const range = document.getElementById('rotation-angle');
  const angleOutput = document.querySelector('[data-angle]');
  const state = document.querySelector('[data-state]');
  const turnButton = document.querySelector('[data-turn]');
  const autoButton = document.querySelector('[data-auto]');
  const fullscreenButton = document.querySelector('[data-fullscreen]');
  const loadState = document.querySelector('[data-load]');
  const message = document.querySelector('[data-message]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const FULL_TURN_MS = 80000;
  const HALF_TURN_MS = 3200;
  let angle = 180;
  let automatic = !reducedMotion.matches;
  let ready = false;
  let animation = null;
  let drag = null;
  let frame = 0;
  let lastTime = null;
  let lastDisplayAngle = -1;
  let messageTimer = 0;

  const normalize = value => ((value % 360) + 360) % 360;

  function draw() {
    const normalized = normalize(angle);
    const displayAngle = Math.round(normalized) % 360;
    art.style.transform = 'rotate(' + angle + 'deg)';
    if (displayAngle !== lastDisplayAngle) {
      range.value = String(displayAngle);
      angleOutput.value = displayAngle + '°';
      range.setAttribute('aria-valuetext', displayAngle + '度');
      lastDisplayAngle = displayAngle;
    }

    const text = normalized < .2 || normalized > 359.8
      ? '礼服人物'
      : Math.abs(normalized - 180) < .2
        ? '书页与鲤鱼'
        : '缓缓旋转';
    if (state.textContent !== text) state.textContent = text;
  }

  function updateAutomaticButton() {
    autoButton.textContent = automatic ? '暂停自动' : '继续自动';
    autoButton.setAttribute('aria-pressed', String(automatic));
  }

  function schedule() {
    if (!frame && ready && !document.hidden && (automatic || animation)) {
      frame = window.requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    frame = 0;
    if (!ready || document.hidden) {
      lastTime = null;
      return;
    }

    const elapsed = lastTime === null ? 0 : Math.max(0, now - lastTime);
    lastTime = now;
    if (animation) {
      animation.elapsed += elapsed;
      const progress = Math.min(1, animation.elapsed / HALF_TURN_MS);
      const eased = progress * progress * (3 - 2 * progress);
      angle = animation.from + (animation.target - animation.from) * eased;
      if (progress === 1) {
        angle = animation.target;
        animation = null;
      }
    } else if (automatic) {
      angle -= elapsed * 360 / FULL_TURN_MS;
    }
    draw();
    schedule();
    if (!automatic && !animation) lastTime = null;
  }

  function pauseForManualInput() {
    automatic = false;
    animation = null;
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    updateAutomaticButton();
  }

  function endDrag(event) {
    if (!drag || (event && drag.id !== event.pointerId)) return;
    const pointerId = drag.id;
    drag = null;
    stage.classList.remove('is-dragging');
    if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
  }

  turnButton.addEventListener('click', () => {
    if (!ready) return;
    endDrag();
    pauseForManualInput();
    const target = angle - 180;
    if (reducedMotion.matches) {
      angle = target;
      draw();
      return;
    }
    animation = { from: angle, target, elapsed: 0 };
    schedule();
  });

  autoButton.addEventListener('click', () => {
    if (!ready) return;
    endDrag();
    automatic = !automatic;
    animation = null;
    lastTime = null;
    updateAutomaticButton();
    if (!automatic) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    } else {
      schedule();
    }
  });

  range.addEventListener('input', () => {
    endDrag();
    pauseForManualInput();
    angle = Number(range.value);
    draw();
  });

  function pointerAngle(event) {
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    return Math.hypot(x, y) < 14 ? null : Math.atan2(y, x) * 180 / Math.PI;
  }

  stage.addEventListener('pointerdown', event => {
    if (!ready || drag || event.button !== 0) return;
    pauseForManualInput();
    drag = { id: event.pointerId, last: pointerAngle(event) };
    stage.classList.add('is-dragging');
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const current = pointerAngle(event);
    if (current === null) {
      drag.last = null;
      return;
    }
    if (drag.last !== null) {
      let delta = current - drag.last;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      angle += delta;
      draw();
    }
    drag.last = current;
  });

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('lostpointercapture', endDrag);

  document.addEventListener('visibilitychange', () => {
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    if (document.hidden) endDrag();
    else schedule();
  });

  function preferenceChanged() {
    if (!reducedMotion.matches) return;
    if (animation) angle = animation.target;
    pauseForManualInput();
    draw();
  }
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', preferenceChanged);
  else reducedMotion.addListener(preferenceChanged);

  function showMessage(text) {
    window.clearTimeout(messageTimer);
    message.textContent = text;
    message.hidden = false;
    messageTimer = window.setTimeout(() => { message.hidden = true; }, 4000);
  }

  const fullscreenAvailable = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  fullscreenButton.hidden = !fullscreenAvailable;
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      showMessage('暂时无法进入全屏');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    fullscreenButton.textContent = active ? '退出全屏' : '全屏';
    fullscreenButton.setAttribute('aria-pressed', String(active));
  });

  function imageReady() {
    if (ready || !art.naturalWidth) return;
    ready = true;
    loadState.hidden = true;
    turnButton.disabled = false;
    autoButton.disabled = false;
    range.disabled = false;
    lastTime = null;
    draw();
    schedule();
  }

  function imageFailed() {
    ready = false;
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    loadState.hidden = false;
    loadState.classList.add('is-error');
    loadState.textContent = '画面暂时未能加载，请刷新重试。';
    turnButton.disabled = true;
    autoButton.disabled = true;
    range.disabled = true;
  }

  art.addEventListener('load', imageReady);
  art.addEventListener('error', imageFailed);
  updateAutomaticButton();
  draw();
  if (art.complete) {
    if (art.naturalWidth) imageReady();
    else imageFailed();
  }
})();
