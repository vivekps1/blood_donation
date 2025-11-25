import { useEffect, useRef } from 'react';

export default function MapPicker({
  lat,
  lng,
  zoom = 15,
  height = 300,
  onChange,
}: {
  lat?: number | null;
  lng?: number | null;
  zoom?: number;
  height?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const key = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!key) {
      console.warn('VITE_GOOGLE_MAPS_API_KEY is not set; MapPicker cannot render');
      return;
    }

    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).google && (window as any).google.maps) return resolve();
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
      });
    };

    let mounted = true;
    loadScript().then(() => {
      if (!mounted) return;
      if (!mapRef.current) return;
      const google = (window as any).google;
      // If lat/lng are missing, fall back to a reasonable default (India center)
      const defaultLat = 20.5937;
      const defaultLng = 78.9629;
      const initialLatLng = new google.maps.LatLng(
        typeof lat === 'number' && !Number.isNaN(lat) ? lat : defaultLat,
        typeof lng === 'number' && !Number.isNaN(lng) ? lng : defaultLng
      );
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: initialLatLng,
        zoom: zoom,
      });
      markerRef.current = new google.maps.Marker({
        position: initialLatLng,
        map: mapInstanceRef.current,
        draggable: true,
      });

      // clicking on map moves marker
      google.maps.event.addListener(mapInstanceRef.current, 'click', function (event: any) {
        const clickedLat = event.latLng.lat();
        const clickedLng = event.latLng.lng();
        markerRef.current.setPosition({ lat: clickedLat, lng: clickedLng });
        onChange(clickedLat, clickedLng);
      });

      // dragging marker updates coords
      google.maps.event.addListener(markerRef.current, 'dragend', function () {
        const p = markerRef.current.getPosition();
        onChange(p.lat(), p.lng());
      });

      // If lat/lng props change externally, update map
      if (lat != null && lng != null) {
        try {
          const pos = new google.maps.LatLng(lat, lng);
          markerRef.current.setPosition(pos);
          mapInstanceRef.current.setCenter(pos);
        } catch (e) {}
      }
    }).catch((err) => {
      console.warn('Failed to load Google Maps', err);
    });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // update marker if lat/lng props change
    if (!markerRef.current) return;
    if (typeof lat === 'number' && typeof lng === 'number') {
      markerRef.current.setPosition({ lat, lng });
      if (mapInstanceRef.current) mapInstanceRef.current.setCenter({ lat, lng });
    }
  }, [lat, lng]);

  return (
    <div className="w-full">
      <div ref={mapRef} style={{ width: '100%', height: `${height}px` }} />
    </div>
  );
}
