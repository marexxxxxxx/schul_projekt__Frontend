"use client";

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';

// Wir definieren die Interfaces hier erneut oder importieren sie aus page.tsx
// Damit es standalone funktioniert, habe ich sie hier kurz definiert:
interface MapComponentProps {
  position: [number, number];
  zoom: number;
  markers: Array<{
    position: [number, number];
    type: 'location' | 'activity';
    address?: string;
    activity?: any;
    id?: string;
  }>;
}

declare const L: any;

export default function MapComponent({ position, zoom, markers }: MapComponentProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // 1. Karte Initialisieren
  useEffect(() => {
    if (typeof window !== 'undefined' && mapContainerRef.current && !mapRef.current) {
      // Karte erstellen
      const map = L.map(mapContainerRef.current, { 
        attributionControl: false, 
        zoomControl: false 
      }).setView(position, zoom);

      mapRef.current = map;

      // Kacheln laden (CartoDB wie in deinem Snippet)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CARTO'
      }).addTo(map);

      // LayerGroup für Marker erstellen (Wichtig für sauberes Löschen)
      const layerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = layerGroup;
    }
  }, []); // Leeres Array -> Nur beim Mounten

  // 2. View Update (Wenn sich Center ändert)
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(position, zoom, {
        animate: true,
        pan: { duration: 1 }
      });
    }
  }, [position, zoom]);

  // 3. Marker Logic (Das Herzstück)
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;

    if (map && layerGroup && L) {
      // A. Alte Marker löschen
      layerGroup.clearLayers();

      // B. Icons definieren
      const DefaultIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      });

      const LocationIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      });

      // C. Neue Marker iterieren und hinzufügen
      markers.forEach((markerData) => {
        // Popup HTML String bauen (Native Leaflet braucht HTML Strings, kein JSX)
        let popupContent = '';
        
        if (markerData.type === 'location') {
          popupContent = `
            <div style="font-family: sans-serif;">
              <strong style="font-size: 14px;">📍 Dein Ziel</strong><br/>
              <span style="color: #666; font-size: 12px;">${markerData.address || ''}</span>
            </div>
          `;
        } else {
          const act = markerData.activity;
          const imgHtml = act?.image_url 
            ? `<img src="${act.image_url}" style="width:100%; height:100px; object-fit:cover; margin-top:5px; border-radius:4px;" />` 
            : '';
            
          popupContent = `
            <div style="font-family: sans-serif; min-width: 180px;">
              <strong style="font-size: 14px; display:block; margin-bottom:4px;">${act?.title || 'Aktivität'}</strong>
              <span style="font-size: 12px;">Preis: <b>${act?.price_value || 0} ${act?.price_currency || 'EUR'}</b></span>
              ${imgHtml}
              <a href="${act?.activity_url || '#'}" target="_blank" style="display:block; margin-top:5px; color: #2563eb; font-size: 11px;">Zum Angebot →</a>
            </div>
          `;
        }

        // Marker erstellen
        const marker = L.marker(markerData.position, {
          icon: markerData.type === 'location' ? LocationIcon : DefaultIcon
        });

        // Popup binden
        marker.bindPopup(popupContent);

        // Zur LayerGroup hinzufügen
        marker.addTo(layerGroup);
      });
    }
  }, [markers]); // Führt diesen Block aus, wenn sich das markers-Array ändert

  return (
    <div 
      ref={mapContainerRef} 
      className="h-full w-full rounded-lg shadow-md z-0 relative" 
      style={{ isolation: 'isolate' }} 
      aria-label="Interactive map" 
      role="application" 
    />
  );
}