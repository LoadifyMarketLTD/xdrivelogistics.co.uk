'use client';

import { useEffect } from 'react';

const POSTCODE_OR_OUTCODE = /^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}|[A-Z]{1,2}\d[A-Z\d]?)$/;

function compact(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function isPostcodeField(input: HTMLInputElement) {
  const type = (input.type || 'text').toLowerCase();
  if (!['text', 'search'].includes(type) || input.disabled || input.readOnly) return false;
  if (input.dataset.postcodeLookup === 'off') return false;

  const label = input.closest('label');
  const context = [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label') ?? '',
    input.getAttribute('autocomplete') ?? '',
    label?.textContent ?? '',
  ].join(' ').toLowerCase();

  return context.includes('postcode') || context.includes('outcode');
}

function hintFor(input: HTMLInputElement) {
  const dedicated = input.parentElement?.querySelector<HTMLElement>(
    ':scope > .workspace-postcode-area, :scope > .driver-live-postcode-area',
  );
  if (dedicated) {
    input.parentElement?.querySelector<HTMLElement>(':scope > [data-xdrive-postcode-area-for]')?.remove();
    return dedicated;
  }

  const existing = input.parentElement?.querySelector<HTMLElement>(
    ':scope > [data-xdrive-postcode-area-for]',
  );
  if (existing) return existing;

  const hint = document.createElement('span');
  hint.className = 'xdrive-postcode-area-hint';
  hint.dataset.xdrivePostcodeAreaFor = input.id || input.name || 'postcode';
  hint.setAttribute('aria-live', 'polite');
  hint.hidden = true;
  input.insertAdjacentElement('afterend', hint);
  return hint;
}

export default function OperationalPostcodeAreaResolver() {
  useEffect(() => {
    const timers = new WeakMap<HTMLInputElement, number>();
    const controllers = new WeakMap<HTMLInputElement, AbortController>();
    const cache = new Map<string, string>();

    const resolve = (input: HTMLInputElement, immediate = false) => {
      if (!isPostcodeField(input)) return;
      const dedicated = input.parentElement?.querySelector<HTMLElement>(
        ':scope > .workspace-postcode-area, :scope > .driver-live-postcode-area',
      );
      if (dedicated) {
        input.parentElement?.querySelector<HTMLElement>(':scope > [data-xdrive-postcode-area-for]')?.remove();
        return;
      }

      const hint = hintFor(input);
      const value = compact(input.value);
      const previousTimer = timers.get(input);
      if (previousTimer) window.clearTimeout(previousTimer);
      controllers.get(input)?.abort();

      if (!value || !POSTCODE_OR_OUTCODE.test(value)) {
        hint.textContent = '';
        hint.hidden = true;
        hint.removeAttribute('data-state');
        return;
      }

      const run = async () => {
        const cached = cache.get(value);
        if (cached) {
          hint.textContent = cached;
          hint.hidden = false;
          hint.dataset.state = 'resolved';
          return;
        }

        const controller = new AbortController();
        controllers.set(input, controller);
        hint.textContent = 'Identifying area…';
        hint.hidden = false;
        hint.dataset.state = 'loading';

        try {
          const response = await fetch(`/api/location/postcode-area?q=${encodeURIComponent(value)}`, {
            cache: 'no-store',
            signal: controller.signal,
          });
          const payload = await response.json().catch(() => ({})) as { area?: string; error?: string };
          if (controller.signal.aborted) return;
          if (!response.ok || !payload.area) {
            hint.textContent = '';
            hint.hidden = true;
            hint.dataset.state = 'unresolved';
            return;
          }
          cache.set(value, payload.area);
          hint.textContent = payload.area;
          hint.hidden = false;
          hint.dataset.state = 'resolved';
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          hint.textContent = '';
          hint.hidden = true;
          hint.dataset.state = 'unresolved';
        }
      };

      if (immediate) void run();
      else timers.set(input, window.setTimeout(() => void run(), 320));
    };

    const scan = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        if (isPostcodeField(input) && input.value.trim()) resolve(input, true);
      });
    };

    const onInput = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement) resolve(input);
    };
    const onBlur = (event: FocusEvent) => {
      const input = event.target;
      if (input instanceof HTMLInputElement) resolve(input, true);
    };

    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    document.addEventListener('blur', onBlur, true);
    scan();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node instanceof HTMLInputElement && isPostcodeField(node) && node.value.trim()) resolve(node, true);
            scan(node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onInput, true);
      document.removeEventListener('blur', onBlur, true);
    };
  }, []);

  return null;
}
