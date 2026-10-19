'use client';

import { useEffect } from 'react';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';

const POSTCODE_OR_OUTCODE = /^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}|[A-Z]{1,2}\d[A-Z\d]?)$/;
const FULL_POSTCODE = /^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/;
const LOCATION_QUERY = /^[A-Z0-9][A-Z0-9 .,'&()/-]{1,79}$/i;
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

type GooglePrediction = { description?: string | null };
type GoogleAutocompleteService = {
  getPlacePredictions: (
    request: {
      input: string;
      componentRestrictions?: { country: string };
      types?: string[];
    },
    callback: (predictions: GooglePrediction[] | null, status: string) => void,
  ) => void;
};
type GoogleMapsWindow = Window & typeof globalThis & {
  google?: {
    maps?: {
      places?: {
        AutocompleteService: new () => GoogleAutocompleteService;
        PlacesServiceStatus?: { OK?: string };
      };
    };
  };
};

let googlePlacesPromise: Promise<GoogleAutocompleteService | null> | null = null;

function googlePlacesService() {
  if (!GOOGLE_MAPS_KEY || typeof window === 'undefined') return Promise.resolve<GoogleAutocompleteService | null>(null);
  const googleWindow = window as GoogleMapsWindow;
  const existing = googleWindow.google?.maps?.places?.AutocompleteService;
  if (existing) return Promise.resolve(new existing());
  if (googlePlacesPromise) return googlePlacesPromise;

  googlePlacesPromise = new Promise<GoogleAutocompleteService | null>((resolve) => {
    const finish = () => {
      const Service = (window as GoogleMapsWindow).google?.maps?.places?.AutocompleteService;
      resolve(Service ? new Service() : null);
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-xdrive-google-places]');
    if (existingScript) {
      existingScript.addEventListener('load', finish, { once: true });
      existingScript.addEventListener('error', () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.xdriveGooglePlaces = 'true';
    script.async = true;
    script.defer = true;
    const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
    if (nonce) script.nonce = nonce;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&libraries=places&v=weekly`;
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    document.head.appendChild(script);
  });
  return googlePlacesPromise;
}

async function lookupGooglePlaces(query: string) {
  const service = await googlePlacesService();
  if (!service) return [] as string[];
  return new Promise<string[]>((resolve) => {
    service.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: 'gb' },
        types: ['address'],
      },
      (predictions, status) => {
        if (!predictions?.length || status !== 'OK') {
          resolve([]);
          return;
        }
        const seen = new Set<string>();
        const suggestions = predictions
          .map((prediction) => prediction.description?.trim() ?? '')
          .filter((value) => {
            if (!value || seen.has(value.toLocaleLowerCase('en-GB'))) return false;
            seen.add(value.toLocaleLowerCase('en-GB'));
            return true;
          });
        resolve(suggestions);
      },
    );
  });
}

function compact(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function formattedPostcode(value: string) {
  const valueCompact = compact(value);
  return valueCompact.length > 3
    ? `${valueCompact.slice(0, -3)} ${valueCompact.slice(-3)}`
    : valueCompact;
}

function fieldContext(input: HTMLInputElement) {
  const label = input.closest('label');
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label') ?? '',
    input.getAttribute('autocomplete') ?? '',
    label?.textContent ?? '',
  ].join(' ').toLowerCase();
}

function isPostcodeField(input: HTMLInputElement) {
  const type = (input.type || 'text').toLowerCase();
  if (!['text', 'search'].includes(type) || input.disabled || input.readOnly) return false;
  if (input.dataset.postcodeLookup === 'off') return false;
  const context = fieldContext(input);
  return context.includes('postcode') || context.includes('outcode');
}

function isOperationalLocationField(input: HTMLInputElement) {
  const type = (input.type || 'text').toLowerCase();
  if (!['text', 'search'].includes(type) || input.disabled || input.readOnly) return false;
  if (input.dataset.postcodeLookup === 'off') return false;
  const context = fieldContext(input);
  if (context.includes('postcode') || context.includes('outcode')) return false;
  if (context.includes('enter location') || context.includes('town / postcode') || context.includes('town/postcode')) return true;
  if (context.includes('postcode / area') || context.includes('postcode / anywhere')) return true;
  return /(^|\s)(from:|to:|pickup|delivery)(\s|$)/.test(context);
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

function dropdownFor(input: HTMLInputElement) {
  const existing = input.parentElement?.querySelector<HTMLElement>(':scope > [data-xdrive-location-suggestions]');
  if (existing) return existing;

  const dropdown = document.createElement('div');
  dropdown.dataset.xdriveLocationSuggestions = 'true';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'Location suggestions');
  Object.assign(dropdown.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    top: '100%',
    zIndex: '80',
    marginTop: '2px',
    maxHeight: '240px',
    overflowY: 'auto',
    border: '1px solid #aebdce',
    borderRadius: '2px',
    background: '#fff',
    boxShadow: '0 8px 18px rgba(15,23,42,0.14)',
    display: 'none',
  });
  const parent = input.parentElement;
  if (parent) {
    const style = window.getComputedStyle(parent);
    if (style.position === 'static') parent.style.position = 'relative';
    parent.appendChild(dropdown);
  }
  return dropdown;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function renderSuggestions(input: HTMLInputElement, suggestions: string[], postcode: string) {
  const dropdown = dropdownFor(input);
  dropdown.replaceChildren();

  const normalizedPostcode = formattedPostcode(postcode);
  for (const suggestion of suggestions.slice(0, 12)) {
    const suggestionHasPostcode = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d?[A-Z]{0,2}\b/i.test(suggestion);
    const parts = suggestionHasPostcode ? [suggestion, 'GB'] : [suggestion, normalizedPostcode, 'GB'];
    const label = parts
      .filter(Boolean)
      .filter((value, index, all) => all.findIndex((candidate) => candidate.toUpperCase() === value.toUpperCase()) === index)
      .join(', ');

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.textContent = label;
    Object.assign(button.style, {
      width: '100%',
      minHeight: '30px',
      border: '0',
      borderBottom: '1px solid #e5e7eb',
      padding: '5px 8px',
      background: '#fff',
      color: '#172033',
      textAlign: 'left',
      font: 'inherit',
      cursor: 'pointer',
    });
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      setReactInputValue(input, label);
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(button);
  }
  dropdown.style.display = dropdown.childElementCount ? 'block' : 'none';
}

export default function OperationalPostcodeAreaResolver() {
  useEffect(() => {
    const timers = new WeakMap<HTMLInputElement, number>();
    const controllers = new WeakMap<HTMLInputElement, AbortController>();
    const areaCache = new Map<string, string>();
    const addressCache = new Map<string, string[]>();

    const resolve = (input: HTMLInputElement, immediate = false) => {
      const postcodeField = isPostcodeField(input);
      const locationField = isOperationalLocationField(input);
      if (!postcodeField && !locationField) return;

      const dedicated = input.parentElement?.querySelector<HTMLElement>(
        ':scope > .workspace-postcode-area, :scope > .driver-live-postcode-area',
      );
      if (dedicated && postcodeField) {
        input.parentElement?.querySelector<HTMLElement>(':scope > [data-xdrive-postcode-area-for]')?.remove();
        return;
      }

      const hint = postcodeField ? hintFor(input) : null;
      const rawValue = input.value.trim();
      const value = compact(rawValue);
      const previousTimer = timers.get(input);
      if (previousTimer) window.clearTimeout(previousTimer);
      controllers.get(input)?.abort();

      const dropdown = input.parentElement?.querySelector<HTMLElement>(':scope > [data-xdrive-location-suggestions]');
      if (dropdown) {
        dropdown.replaceChildren();
        dropdown.style.display = 'none';
      }
      const validLookup = postcodeField
        ? Boolean(value && POSTCODE_OR_OUTCODE.test(value))
        : Boolean(rawValue.length >= 2 && LOCATION_QUERY.test(rawValue));
      if (!validLookup) {
        if (hint) {
          hint.textContent = '';
          hint.hidden = true;
          hint.removeAttribute('data-state');
        }
        if (dropdown) dropdown.style.display = 'none';
        return;
      }

      const run = async () => {
        const controller = new AbortController();
        controllers.set(input, controller);

        if (locationField && value.length >= 2) {
          const cacheKey = rawValue.toLocaleLowerCase('en-GB');
          const cachedAddresses = addressCache.get(cacheKey);
          if (cachedAddresses?.length) {
            renderSuggestions(input, cachedAddresses, value);
          } else {
            try {
              const token = readRouteAuthAccessToken();
              if (token) {
                const params = FULL_POSTCODE.test(value)
                  ? new URLSearchParams({ postcode: formattedPostcode(value) })
                  : new URLSearchParams({ q: rawValue });
                const response = await fetch(`/api/location/postcode-addresses?${params.toString()}`, {
                  headers: { Authorization: `Bearer ${token}` },
                  cache: 'no-store',
                  signal: controller.signal,
                });
                const payload = await response.json().catch(() => ({})) as { suggestions?: unknown };
                let suggestions = Array.isArray(payload.suggestions)
                  ? payload.suggestions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                  : [];
                if (!suggestions.length && !controller.signal.aborted) {
                  suggestions = await lookupGooglePlaces(rawValue);
                }
                if (!controller.signal.aborted && suggestions.length) {
                  addressCache.set(cacheKey, suggestions);
                  renderSuggestions(input, suggestions, value);
                }
              }
            } catch (error) {
              if (!(error instanceof DOMException && error.name === 'AbortError')) {
                const activeDropdown = input.parentElement?.querySelector<HTMLElement>(':scope > [data-xdrive-location-suggestions]');
                if (activeDropdown) activeDropdown.style.display = 'none';
              }
            }
          }
        }

        if (locationField) return;
        if (!hint) return;

        const cachedArea = areaCache.get(value);
        if (cachedArea) {
          hint.textContent = cachedArea;
          hint.hidden = false;
          hint.dataset.state = 'resolved';
          return;
        }

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
          areaCache.set(value, payload.area);
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
      else timers.set(input, window.setTimeout(() => void run(), 260));
    };

    const scan = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        if ((isPostcodeField(input) || isOperationalLocationField(input)) && input.value.trim()) resolve(input, true);
      });
    };

    const onInput = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement) resolve(input);
    };
    const onBlur = (event: FocusEvent) => {
      const input = event.target;
      if (input instanceof HTMLInputElement) {
        resolve(input, true);
        window.setTimeout(() => {
          input.parentElement?.querySelector<HTMLElement>(':scope > [data-xdrive-location-suggestions]')?.style.setProperty('display', 'none');
        }, 140);
      }
    };
    const onFocus = (event: FocusEvent) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !isOperationalLocationField(input)) return;
      const rawValue = input.value.trim();
      const value = compact(rawValue);
      const suggestions = addressCache.get(rawValue.toLocaleLowerCase('en-GB'));
      if (suggestions?.length) renderSuggestions(input, suggestions, value);
    };

    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    document.addEventListener('blur', onBlur, true);
    document.addEventListener('focus', onFocus, true);
    scan();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node instanceof HTMLInputElement && (isPostcodeField(node) || isOperationalLocationField(node)) && node.value.trim()) resolve(node, true);
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
      document.removeEventListener('focus', onFocus, true);
    };
  }, []);

  return null;
}
