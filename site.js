(() => {
  document.documentElement.classList.add('js');

  const menuButton = document.querySelector('.menu-button');
  const nav = document.getElementById('primary-nav');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
  }

  const cinematicHero = document.querySelector('[data-cinematic-hero]');
  const heroVideo = cinematicHero?.querySelector('[data-hero-video]');
  const inspectionSurface = cinematicHero?.querySelector('[data-inspection-surface]');
  const inspectionRange = cinematicHero?.querySelector('[data-inspection-range]');

  if (cinematicHero instanceof HTMLElement
    && heroVideo instanceof HTMLVideoElement
    && inspectionSurface instanceof HTMLElement
    && inspectionRange instanceof HTMLInputElement) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const compactViewport = window.matchMedia('(max-width: 900px)');
    const steps = [...cinematicHero.querySelectorAll('[data-dossier-stage]')];
    let videoDuration = 0;
    let targetProgress = 0;
    let renderedProgress = 0;
    let animationFrame = 0;
    let mediaFailed = false;

    const clampProgress = (value) => Math.min(1, Math.max(0, value));
    const labels = ['Buyer fit', 'Evidence', 'Release gate'];

    const updateInterface = (progress) => {
      const activeIndex = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2;
      steps.forEach((step, index) => {
        const active = index === activeIndex;
        step.classList.toggle('is-active', active);
        const body = step.querySelector('.dossier-stage__body');
        if (!(body instanceof HTMLElement)) return;
        if (active) body.setAttribute('aria-current', 'step');
        else body.removeAttribute('aria-current');
      });
      const percentage = Math.round(progress * 100);
      inspectionRange.value = String(percentage);
      inspectionRange.setAttribute('aria-valuetext', `${labels[activeIndex]}, ${percentage} percent`);
    };

    const markMediaFailure = () => {
      if (mediaFailed) return;
      mediaFailed = true;
      cinematicHero.classList.remove('cinematic-hero--interactive', 'cinematic-hero--has-input');
      cinematicHero.classList.add('cinematic-hero--media-failed', 'cinematic-hero--poster-only');
      heroVideo.pause();
      heroVideo.preload = 'none';
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const renderFrame = () => {
      animationFrame = 0;
      if (mediaFailed) return;
      if (!Number.isFinite(videoDuration) || videoDuration <= 0) return;
      renderedProgress += (targetProgress - renderedProgress) * 0.16;
      if (Math.abs(targetProgress - renderedProgress) < 0.0005) renderedProgress = targetProgress;
      const targetTime = renderedProgress * Math.max(videoDuration - 0.04, 0);
      try {
        if (!heroVideo.seeking && Math.abs(heroVideo.currentTime - targetTime) > 0.01) heroVideo.currentTime = targetTime;
      } catch {
        markMediaFailure();
        return;
      }
      if (renderedProgress !== targetProgress) animationFrame = window.requestAnimationFrame(renderFrame);
    };

    const scheduleFrame = () => {
      if (mediaFailed || !cinematicHero.classList.contains('cinematic-hero--interactive')) return;
      if (!animationFrame) animationFrame = window.requestAnimationFrame(renderFrame);
    };

    const setTarget = (value, recordInput = true) => {
      if (mediaFailed || !cinematicHero.classList.contains('cinematic-hero--interactive')) return;
      targetProgress = clampProgress(value);
      updateInterface(targetProgress);
      if (recordInput) cinematicHero.classList.add('cinematic-hero--has-input');
      scheduleFrame();
    };

    updateInterface(0);

    const shouldUsePoster = () => reducedMotion.matches || compactViewport.matches || !finePointer.matches;

    const readMetadata = () => {
      if (mediaFailed) return false;
      if (!Number.isFinite(heroVideo.duration) || heroVideo.duration <= 0) {
        if (heroVideo.readyState >= 1) markMediaFailure();
        return false;
      }
      videoDuration = heroVideo.duration;
      return true;
    };

    const disableInspection = () => {
      cinematicHero.classList.remove('cinematic-hero--interactive', 'cinematic-hero--has-input');
      cinematicHero.classList.add('cinematic-hero--poster-only');
      heroVideo.pause();
      heroVideo.preload = 'none';
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const enableInspection = () => {
      if (mediaFailed || shouldUsePoster() || heroVideo.readyState < 2 || !readMetadata()) return;
      heroVideo.pause();
      cinematicHero.classList.remove('cinematic-hero--poster-only');
      cinematicHero.classList.add('cinematic-hero--interactive');
      setTarget(targetProgress, false);
    };

    const syncPresentationMode = () => {
      if (mediaFailed || shouldUsePoster()) {
        disableInspection();
        return;
      }
      cinematicHero.classList.remove('cinematic-hero--poster-only');
      heroVideo.preload = 'auto';
      if (heroVideo.readyState >= 1) readMetadata();
      if (!mediaFailed) {
        if (heroVideo.readyState >= 2) enableInspection();
        else heroVideo.load();
      }
    };

    inspectionSurface.addEventListener('pointermove', (event) => {
      if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return;
      const bounds = inspectionSurface.getBoundingClientRect();
      if (bounds.width <= 0) return;
      setTarget((event.clientX - bounds.left) / bounds.width);
    }, { passive: true });

    inspectionRange.addEventListener('input', () => setTarget(Number(inspectionRange.value) / 100));
    heroVideo.addEventListener('seeked', scheduleFrame);
    heroVideo.addEventListener('error', markMediaFailure, { once: true });
    heroVideo.querySelector('source')?.addEventListener('error', markMediaFailure, { once: true });
    heroVideo.addEventListener('loadedmetadata', readMetadata);
    heroVideo.addEventListener('loadeddata', enableInspection);
    for (const mediaQuery of [reducedMotion, finePointer, compactViewport]) {
      mediaQuery.addEventListener('change', syncPresentationMode);
    }
    syncPresentationMode();
  }

  const form = document.getElementById('rfq-form');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const lane = params.get('lane');
  const category = document.getElementById('category');
  if (lane && category instanceof HTMLInputElement) category.value = lane.slice(0, 100);

  const output = document.getElementById('draft-output');
  const actions = document.getElementById('draft-actions');
  const feedback = document.getElementById('draft-feedback');
  const draftStateTitle = document.getElementById('draft-state-title');
  const formErrors = document.getElementById('form-errors');
  const submitButton = form.querySelector('button[type="submit"]');
  const requiredControls = [...form.querySelectorAll('[required]')];
  let draftText = '';

  const errorFor = (control) => document.getElementById(`${control.id}-error`);

  const clearFieldError = (control) => {
    control.removeAttribute('aria-invalid');
    const error = errorFor(control);
    if (error instanceof HTMLElement) error.hidden = true;
  };

  const showFieldError = (control) => {
    control.setAttribute('aria-invalid', 'true');
    const error = errorFor(control);
    if (error instanceof HTMLElement) error.hidden = false;
  };

  const invalidRequiredControls = () => requiredControls.filter((control) => !control.validity.valid);

  const updateErrorSummary = () => {
    if (!(formErrors instanceof HTMLElement)) return [];
    const invalidControls = invalidRequiredControls();
    if (invalidControls.length === 0) {
      formErrors.hidden = true;
      formErrors.textContent = '';
      return invalidControls;
    }
    const noun = invalidControls.length === 1 ? 'field' : 'fields';
    formErrors.textContent = `Complete ${invalidControls.length} required ${noun} before building the draft.`;
    formErrors.hidden = false;
    return invalidControls;
  };

  requiredControls.forEach((control) => {
    const eventName = control instanceof HTMLInputElement && control.type === 'checkbox' ? 'change' : 'input';
    control.addEventListener(eventName, () => {
      if (control.validity.valid) clearFieldError(control);
      else if (control.hasAttribute('aria-invalid')) showFieldError(control);
      if (formErrors instanceof HTMLElement && !formErrors.hidden) updateErrorSummary();
    });
  });

  function value(id, fallback = 'Not provided') {
    const field = document.getElementById(id);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return fallback;
    return field.value.trim() || fallback;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const invalidControls = invalidRequiredControls();
    if (invalidControls.length > 0) {
      requiredControls.forEach((control) => {
        if (control.validity.valid) clearFieldError(control);
        else showFieldError(control);
      });
      updateErrorSummary();
      formErrors?.focus();
      return;
    }
    requiredControls.forEach(clearFieldError);
    updateErrorSummary();
    draftText = [
      'PILOT SALES DISTRIBUTION — BUYER REQUEST DRAFT',
      'STATUS: NOT SUBMITTED / NOT AN ORDER',
      '',
      `Category or product: ${value('category')}`,
      `Target quantity: ${value('quantity')}`,
      `Delivery destination: ${value('destination')}`,
      `Needed by: ${value('timing')}`,
      `Condition and pack: ${value('condition')}`,
      `Target price basis: ${value('price')}`,
      `Freight preference: ${value('freight')}`,
      `Non-negotiable requirements: ${value('requirements')}`,
      '',
      'NEXT REVIEW: Confirm current quantity, location, condition, documentation, price basis, freight, timing, and authority before any outreach, order, or payment.',
    ].join('\n');
    output.textContent = draftText;
    output.hidden = false;
    actions.hidden = false;
    draftStateTitle.textContent = 'Draft ready — not submitted';
    feedback.textContent = 'Draft created locally. Nothing was transmitted.';
    if (submitButton instanceof HTMLButtonElement) submitButton.textContent = 'Update review draft';
    output.focus({ preventScroll: true });
    output.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  });

  document.getElementById('copy-draft')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      feedback.textContent = 'Draft copied. Review it before sharing.';
    } catch {
      feedback.textContent = 'Copy was unavailable. Select the draft text manually.';
    }
  });

  document.getElementById('download-draft')?.addEventListener('click', () => {
    const blob = new Blob([draftText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pilot-sales-buyer-request-draft.txt';
    link.click();
    URL.revokeObjectURL(url);
    feedback.textContent = 'Draft downloaded locally. It has not been submitted.';
  });
})();
