import React, { useEffect, useRef } from 'react';

const PlacesAutocomplete = React.memo(function PlacesAutocomplete({ value, onSelect, placeholder }: { value?: string; onSelect: (payload: { address: string; lat?: number; lng?: number }) => void; placeholder?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const key = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.places) return resolve();
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
      });
    };

    let autocomplete: any;

    loadScript().then(() => {
      if (!inputRef.current) return;
      // @ts-ignore
      autocomplete = new (window as any).google.maps.places.Autocomplete(inputRef.current, { types: ['geocode'] });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const address = place.formatted_address || place.name || inputRef.current?.value || '';
        const lat = place.geometry?.location ? place.geometry.location.lat() : undefined;
        const lng = place.geometry?.location ? place.geometry.location.lng() : undefined;
        onSelectRef.current({ address, lat, lng });
      });
    }).catch((err) => {
      console.warn('Failed to load Google Maps script', err);
    });

    return () => {
      if (autocomplete && autocomplete.removeListener) {
        try { autocomplete.removeListener('place_changed'); } catch (e) {}
      }
    };
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onSelect({ address: e.target.value })}
      placeholder={placeholder || 'Search location'}
      className="border p-2 rounded"
    />
  );
});

export default PlacesAutocomplete;
