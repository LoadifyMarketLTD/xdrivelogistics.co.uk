'use client';

import { useEffect, useRef, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';

const fieldStyle = {
  width: '100%',
  minHeight: '72px',
  border: '1px solid #cfd7e3',
  borderRadius: '4px',
  padding: '7px 8px',
  fontSize: '12px',
  boxSizing: 'border-box' as const,
  background: '#fff',
  color: '#172033',
  resize: 'vertical' as const,
};
const labelStyle = {
  display: 'grid',
  gap: '4px',
  color: '#334155',
  fontSize: '11px',
  lineHeight: '14px',
  fontWeight: 700,
  position: 'relative' as const,
};
const invalidFieldStyle = {
  border: '1px solid #dc2626',
  background: '#fffafa',
  boxShadow: '0 0 0 1px rgba(220,38,38,0.12)',
};
const validationMessageStyle = {
  color: '#b91c1c',
  fontSize: '10px',
  lineHeight: '13px',
  fontWeight: 700,
};

export const normalizeOperationalPostcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, '').trim();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};
const isFullUkPostcode = (value: string) => /^(GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2}) \d[A-Z]{2})$/i.test(normalizeOperationalPostcode(value));

export const operationalAddressSuggestionLabel = (address: string, postcode: string) => {
  const normalized = normalizeOperationalPostcode(postcode);
  return [address.trim(), normalized, 'GB'].filter(Boolean).join(', ');
};

export default function PostcodeAddressField({
  postcode,
  address,
  onAddress,
  onTown,
  onPostcodeResolved,
  error,
}: {
  postcode: string;
  address: string;
  onAddress: (value: string) => void;
  onTown?: (value: string) => void;
  onPostcodeResolved?: (value: string) => void;
  error?: string;
}) {
  const onAddressRef = useRef(onAddress);
  const onTownRef = useRef(onTown);
  const addressRef = useRef(address);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [towns,setTowns]=useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onAddressRef.current = onAddress;
  }, [onAddress]);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  useEffect(() => {
    const normalized = normalizeOperationalPostcode(postcode);
    setSuggestions([]);
    setTowns({});
    setOpen(false);

    if (postcode.replace(/\s/g, "").length < 3) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const token = readRouteAuthAccessToken();
        if (!token) return;

        const params = isFullUkPostcode(normalized) ? new URLSearchParams({postcode:normalized}) : new URLSearchParams({q:postcode.trim()});
        const response = await fetch(`/api/location/postcode-addresses?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) return;

        const payload = await response.json() as { suggestions?: unknown; towns?: Record<string,string>; configured?: boolean };
        if (payload.configured === false) return;

        const next = Array.isArray(payload.suggestions)
          ? payload.suggestions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];
        if (cancelled) return;

        setSuggestions(next);
        setTowns(payload.towns ?? {});
        if (isFullUkPostcode(normalized) && !addressRef.current.trim() && next.length === 1) {
          onAddressRef.current(next[0]);
          const confirmedTown=payload.towns?.[next[0]];
          if (confirmedTown) onTownRef.current?.(confirmedTown);
          setOpen(false);
        } else {
          setOpen(next.length > 0);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
    setTowns({});
          setOpen(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [postcode]);

  const query = address.trim().toLocaleLowerCase('en-GB');
  const visibleSuggestions = suggestions.filter((suggestion) => {
    const normalizedSuggestion = suggestion.toLocaleLowerCase('en-GB');
    if (normalizedSuggestion === query) return false;
    return !query || normalizedSuggestion.includes(query);
  });

  return (
    <label style={labelStyle}>Address *
      <textarea
        style={{ ...fieldStyle, ...(error ? invalidFieldStyle : {}) }}
        aria-invalid={error ? 'true' : undefined}
        value={address}
        placeholder={loading && !address ? 'Finding addresses…' : undefined}
        onFocus={() => {
          if (visibleSuggestions.length > 0) setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onAddress(event.target.value);
          if (suggestions.length > 0) setOpen(true);
        }}
      />
      {open && visibleSuggestions.length > 0 ? (
        <div
          role="listbox"
          aria-label="Addresses for postcode"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 40,
            marginTop: '2px',
            maxHeight: '240px',
            overflowY: 'auto',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            background: '#fff',
            boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
          }}
        >
          {visibleSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={false}
              style={{
                width: '100%',
                minHeight: '32px',
                border: 0,
                borderBottom: '1px solid #eef2f7',
                padding: '6px 8px',
                background: '#fff',
                color: '#172033',
                textAlign: 'left',
                fontSize: '12px',
                cursor: 'pointer',
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onAddress(suggestion);
                const found = suggestion.match(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i);
                if (found) onPostcodeResolved?.(normalizeOperationalPostcode(found[0]));
                const town=towns[suggestion];
                if(town) onTown?.(town);
                setOpen(false);
              }}
            >
              {operationalAddressSuggestionLabel(suggestion, postcode)}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <span style={validationMessageStyle}>{error}</span> : null}
    </label>
  );
}
