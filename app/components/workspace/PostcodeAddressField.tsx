'use client';

import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

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

const normalizePostcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, '').trim();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};
const isFullUkPostcode = (value: string) => /^(GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2}) \d[A-Z]{2})$/i.test(normalizePostcode(value));

export default function PostcodeAddressField({
  postcode,
  address,
  onAddress,
  error,
}: {
  postcode: string;
  address: string;
  onAddress: (value: string) => void;
  error?: string;
}) {
  const onAddressRef = useRef(onAddress);
  const addressRef = useRef(address);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onAddressRef.current = onAddress;
  }, [onAddress]);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  useEffect(() => {
    const normalized = normalizePostcode(postcode);
    setSuggestions([]);
    setOpen(false);

    if (!isSupabaseConfigured || !isFullUkPostcode(normalized)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const params = new URLSearchParams({ postcode: normalized });
        const response = await fetch(`/api/location/postcode-addresses?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) return;

        const payload = await response.json() as { suggestions?: unknown; configured?: boolean };
        if (payload.configured === false) return;

        const next = Array.isArray(payload.suggestions)
          ? payload.suggestions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];
        if (cancelled) return;

        setSuggestions(next);
        if (!addressRef.current.trim() && next.length === 1) {
          onAddressRef.current(next[0]);
          setOpen(false);
        } else {
          setOpen(next.length > 0);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
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
                setOpen(false);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <span style={validationMessageStyle}>{error}</span> : null}
    </label>
  );
}
