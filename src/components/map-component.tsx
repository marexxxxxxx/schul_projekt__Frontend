"use client";

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker, LatLngExpression } from 'leaflet';

// Leaflet is loaded from a CDN, so we need to declare the 'L' global variable.
declare const L: any;

type MapComponentProps = {
  position: LatLngExpression;
  zoom: number;
  markerPosition?: LatLngExpression;
  markerPopup?: string;
};

export default function MapComponent({ position, zoom, markerPosition, markerPopup }: MapComponentProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (typeof window !== 'undefined' && mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(position, zoom);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [position, zoom]);

  // Update marker and view
  useEffect(() => {
    if (mapRef.current && markerPosition) {
      // Update map view to the new marker position
      mapRef.current.setView(markerPosition, 15, {
        animate: true,
        pan: {
          duration: 1
        }
      });

      // Create or update marker
      if (markerRef.current) {
        markerRef.current.setLatLng(markerPosition);
      } else {
        markerRef.current = L.marker(markerPosition).addTo(mapRef.current);
      }
      
      // Bind popup if provided
      if (markerPopup) {
        markerRef.current.bindPopup(markerPopup).openPopup();
      }
    }
  }, [markerPosition, markerPopup]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-lg shadow-md z-0" aria-label="Interactive map" role="application" />;
}
