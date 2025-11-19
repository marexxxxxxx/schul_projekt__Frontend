"use client";

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup, Marker } from 'leaflet';

interface MapComponentProps {
  position: [number, number];
  zoom: number;
  markers: Array<{
    position: [number, number];
    type: 'location' | 'activity';
    address?: string;
    activity?: any;
    id?: string; // ID ist jetzt essenziell für das Mapping
  }>;
  activeMarkerId?: string | null; // Neue Prop für den Hover-Status
}

declare const L: any;

export default function MapComponent({ position, zoom, markers, activeMarkerId }: MapComponentProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Speichert Referenzen zu den einzelnen Markern für schnellen Zugriff per ID
  const markersMapRef = useRef<{ [key: string]: Marker }>({});

  // 1. Karte Initialisieren
  useEffect(() => {
    if (typeof window !== 'undefined' && mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, { 
        attributionControl: false, 
        zoomControl: false 
      }).setView(position, zoom);

      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CARTO'
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = layerGroup;
    }
  }, []);

  // 2. View Update
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(position, zoom, {
        animate: true,
        pan: { duration: 1 }
      });
    }
  }, [position, zoom]);

  // 3. Marker Logic (Erstellung & Mapping)
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;

    if (map && layerGroup && L) {
      // A. Alte Marker löschen
      layerGroup.clearLayers();
      markersMapRef.current = {}; // Referenz-Map leeren

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

      // C. Neue Marker erstellen
      markers.forEach((markerData) => {
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

        const marker = L.marker(markerData.position, {
          icon: markerData.type === 'location' ? LocationIcon : DefaultIcon
        });

        marker.bindPopup(popupContent);
        marker.addTo(layerGroup);

        // WICHTIG: Marker in die Referenz-Map speichern, wenn ID vorhanden
        if (markerData.id) {
          markersMapRef.current[markerData.id] = marker;
        }
      });
    }
  }, [markers]);

  // 4. Active Marker Logic (Reaktion auf Hover)
  useEffect(() => {
    // Reset Z-Index aller Marker (optional, aber sauberer)
    Object.values(markersMapRef.current).forEach((m: any) => {
        m.setZIndexOffset(0); 
        // Optional: m.closePopup(); wenn man will, dass nur einer offen ist
    });

    if (activeMarkerId && markersMapRef.current[activeMarkerId]) {
      const marker = markersMapRef.current[activeMarkerId];
      
      // Marker in den Vordergrund holen
      marker.setZIndexOffset(1000);
      
      // Popup öffnen
      marker.openPopup();
    } else {
      // Wenn kein Marker aktiv ist (Maus verlässt Karte), schließen wir alle Popups
      // mapRef.current?.closePopup(); // Einkommentieren, wenn Popups beim Verlassen schließen sollen
    }
  }, [activeMarkerId]);

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