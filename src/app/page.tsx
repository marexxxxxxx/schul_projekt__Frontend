"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Search, Loader2, MapPin } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from '@/lib/mock-data';
import ActivityCard from '@/components/activity-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Typen & Interfaces ---

export interface ActivityWithCoordinates extends Activity {
  coordinates?: { lat: number; lon: number };
  meeting_point?: [number, number];
}

export interface ActivityWithNullableImage extends Omit<ActivityWithCoordinates, 'image_url'> {
  image_url: string | null;
}

export interface ActivityMarker {
  position: [number, number];
  activity: ActivityWithNullableImage;
  type: 'activity';
  id: string; // Wichtig für das Mapping
}

export interface LocationMarker {
  position: [number, number];
  type: 'location';
  address: string;
  id: string;
}

export type MapMarker = ActivityMarker | LocationMarker;
type SearchMode = 'fastsearch' | 'deepsearch';

interface MapPosition {
  center: [number, number];
  zoom: number;
}

// --- Error Handler & Parser Class ---

class ActivityParser {
  public parseActivities(data: any): { activities: ActivityWithCoordinates[]; hasErrors: boolean } {
    try {
      if (!data || !data.result || !Array.isArray(data.result)) {
        return { activities: [], hasErrors: true };
      }

      const mappedActivities = data.result
        .map((act: any) => this.mapSingleActivity(act))
        .filter((act: ActivityWithCoordinates | null): act is ActivityWithCoordinates => act !== null);

      return { activities: mappedActivities, hasErrors: false };
    } catch (error) {
      console.error("Parsing Error:", error);
      return { activities: [], hasErrors: true };
    }
  }

  private mapSingleActivity(act: any): ActivityWithCoordinates | null {
    try {
      if (!act || typeof act !== 'object') return null;

      const activity: ActivityWithCoordinates = {
        title: this.safeGetString(act, ['name', 'title'], 'Unbenannte Aktivität'),
        rating_average: this.safeGetNumber(act, 'rating_average', 0),
        rating_count: this.safeGetNumber(act, 'rating_count', 0),
        price_value: this.safeGetNumber(act, 'price_value', 0),
        price_currency: this.safeGetString(act, ['price_currency'], 'EUR'),
        price_unit: this.safeGetString(act, ['price_unit'], 'Person'),
        duration_min_hours: this.safeGetNumber(act, 'duration_min_hours', 0),
        activity_url: this.safeGetString(act, ['activity_url', 'url'], '#'),
        image_url: this.safeGetImageUrl(act),
      };

      activity.coordinates = this.extractCoordinates(act);
      activity.meeting_point = this.extractMeetingPoint(act);

      return activity;
    } catch (error) {
      return null;
    }
  }

  private parseCoordValue(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private extractCoordinates(act: any): { lat: number; lon: number } | undefined {
    if (act.coordinates && typeof act.coordinates === 'object') {
      const lat = this.parseCoordValue(act.coordinates.lat || act.coordinates.latitude);
      const lon = this.parseCoordValue(act.coordinates.lon || act.coordinates.lng || act.coordinates.longitude);
      if (lat !== 0 && lon !== 0) return { lat, lon };
    }
    const flatLat = this.parseCoordValue(act.latitude || act.lat);
    const flatLon = this.parseCoordValue(act.longitude || act.lon || act.lng);
    if (flatLat !== 0 && flatLon !== 0) return { lat: flatLat, lon: flatLon };

    if (Array.isArray(act.meeting_point) && act.meeting_point.length >= 2) {
      const lat = this.parseCoordValue(act.meeting_point[0]);
      const lon = this.parseCoordValue(act.meeting_point[1]);
      if (lat !== 0 && lon !== 0) return { lat, lon };
    }
    return undefined;
  }

  private extractMeetingPoint(act: any): [number, number] | undefined {
    if (Array.isArray(act.meeting_point) && act.meeting_point.length >= 2) {
       const lat = this.parseCoordValue(act.meeting_point[0]);
       const lon = this.parseCoordValue(act.meeting_point[1]);
       if (lat !== 0 && lon !== 0) return [lat, lon];
    }
    return undefined;
  }

  private safeGetString(obj: any, keys: string[], def: string): string {
    for (const key of keys) if (obj[key]) return String(obj[key]).trim();
    return def;
  }
  private safeGetNumber(obj: any, key: string, def: number): number {
    const val = this.parseCoordValue(obj[key]); 
    return val === 0 ? def : val;
  }
  private safeGetImageUrl(obj: any): string | null {
    const val = obj['image_url'];
    if (!val || typeof val !== 'string') return null;
    if (val.includes('ranking_uuid=') || (val.includes('tour_img/') && !val.includes('http'))) return null; 
    return val;
  }
}

// --- Components ---

const Map = dynamic(() => import('@/components/map-component'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin mr-2" /> Karte wird geladen...
    </div>
});

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<SearchMode>('fastsearch');
    const [searchedAddress, setSearchedAddress] = useState<string | undefined>(undefined);
    const [activities, setActivities] = useState<ActivityWithNullableImage[]>([]);
    const [markers, setMarkers] = useState<MapMarker[]>([]);
    
    // NEU: State für Hover-Interaktion
    const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, startSearchTransition] = useTransition();
    const { toast } = useToast();
    const eventSourceRef = useRef<EventSource | null>(null);

    const [mapPosition, setMapPosition] = useState<MapPosition>({
      center: [51.1657, 10.4515],
      zoom: 6
    });

    useEffect(() => {
      const germanyMarker: LocationMarker = {
        position: [51.1657, 10.4515],
        type: 'location',
        address: 'Deutschland',
        id: 'init-germany'
      };
      setMarkers([germanyMarker]);
      setSearchedAddress('Deutschland');

      return () => {
        if (eventSourceRef.current) eventSourceRef.current.close();
      };
    }, []);

    const updateMapPosition = useCallback((lat: number, lon: number, zoom: number = 13) => {
      setMapPosition({ center: [lat, lon], zoom });
    }, []);

    const performGeocoding = async (query: string): Promise<{lat: number, lon: number, address: string} | null> => {
      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
          { headers: { 'User-Agent': 'GOSA-Reisen/1.0' } }
        );
        if (!geoResponse.ok) throw new Error('Geocoding Error');
        const geoData = await geoResponse.json();
        if (geoData && geoData.length > 0) {
          return {
            lat: parseFloat(geoData[0].lat),
            lon: parseFloat(geoData[0].lon),
            address: geoData[0].display_name
          };
        }
        return null;
      } catch (error) {
        console.error("🌍 Geocoding-Fehler:", error);
        return null;
      }
    };

    const performSearch = async (query: string, mode: SearchMode) => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      setActivities([]);
      setSearchedAddress(undefined);
      setHoveredMarkerId(null); // Reset Hover
      setIsLoading(true);

      try {
        const geocodingResult = await performGeocoding(query);
        if (!geocodingResult) {
          toast({ variant: "destructive", title: "Nicht gefunden", description: "Adresse konnte nicht lokalisiert werden." });
          setIsLoading(false);
          return;
        }

        const { lat, lon, address } = geocodingResult;
        updateMapPosition(lat, lon, 13);
        
        const locationMarker: LocationMarker = {
          position: [lat, lon],
          type: 'location',
          address: address,
          id: `loc-${lat}-${lon}`
        };
        
        setMarkers([locationMarker]);
        setSearchedAddress(address);

        const endpoint = mode === 'fastsearch' ? `location/${encodeURIComponent(query)}` : `create_data/${encodeURIComponent(query)}`;
        const searchResponse = await fetch(`http://127.0.0.1:8000/${endpoint}?search_mode=${mode}`, { method: 'GET' });
        
        if (!searchResponse.ok) throw new Error('Backend Connection Error');
        const { job_id } = await searchResponse.json();
        
        const eventSource = new EventSource(`http://127.0.0.1:8000/stream/${job_id}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.result && typeof data.result === 'string') {
              const parsedResult = JSON.parse(data.result);
              if (parsedResult.status === 'completed' && Array.isArray(parsedResult.result)) {
                const parser = new ActivityParser();
                const { activities: mappedActivities } = parser.parseActivities(parsedResult);
                
                setActivities(mappedActivities as ActivityWithNullableImage[]);
                
                const newActivityMarkers: ActivityMarker[] = mappedActivities
                  .map((act, index) => {
                    let pos: [number, number] | undefined = undefined;
                    if (act.coordinates?.lat && act.coordinates?.lon) {
                      pos = [act.coordinates.lat, act.coordinates.lon];
                    } 
                    if (pos) {
                      // Konsistente ID-Generierung
                      return {
                        position: pos,
                        activity: act as ActivityWithNullableImage,
                        type: 'activity',
                        id: `act-${index}-${pos[0]}-${pos[1]}`
                      } as ActivityMarker;
                    }
                    return null;
                  })
                  .filter((m): m is ActivityMarker => m !== null);

                setMarkers(prev => {
                  const currentLocMarker = prev.find(m => m.type === 'location');
                  return [currentLocMarker || locationMarker, ...newActivityMarkers];
                });

                toast({ title: "Suche erfolgreich", description: `${mappedActivities.length} Ergebnisse gefunden.` });
                setIsLoading(false);
                eventSource.close();
              } else if (parsedResult.status === 'failed') {
                throw new Error(parsedResult.message || "Backend Error");
              }
            }
          } catch (e) {
            console.error("SSE Processing Error", e);
          }
        };

        eventSource.onerror = () => {
          if (eventSource.readyState !== EventSource.CLOSED) {
             setIsLoading(false);
             eventSource.close();
          }
        };
      } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Fehler", description: "Verbindung fehlgeschlagen." });
        setIsLoading(false);
      }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        const handler = performSearch(searchQuery, searchMode);
        startSearchTransition(async () => { await handler; });
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
            <main className="flex-1 h-full relative">
                {/* Suchleiste */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-xl px-4">
                    <Card className="bg-background/90 shadow-xl backdrop-blur-md border-primary/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-center gap-4">
                                <h1 className="text-xl font-bold text-primary hidden sm:block whitespace-nowrap">GÖSA</h1>
                                <form onSubmit={handleSearch} className="flex gap-2 w-full">
                                    <Select value={searchMode} onValueChange={(v: SearchMode) => setSearchMode(v)}>
                                        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Modus" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fastsearch">🚀 Fast</SelectItem>
                                            <SelectItem value="deepsearch">🔍 Deep</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input 
                                        placeholder="Wohin soll es gehen?" 
                                        value={searchQuery} 
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Button type="submit" disabled={isLoading || isSearching}>
                                        {isLoading ? <Loader2 className="animate-spin h-4 w-4"/> : <Search className="h-4 w-4" />}
                                    </Button>
                                </form>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Map Container mit Prop für aktive Marker */}
                <div className="absolute inset-0 z-0">
                   <Map
                        key={`map-${mapPosition.center[0]}-${mapPosition.center[1]}-${markers.length}`}
                        position={mapPosition.center}
                        zoom={mapPosition.zoom}
                        markers={markers}
                        // @ts-ignore - Map Component muss diese Prop in seinen Types aufnehmen
                        activeMarkerId={hoveredMarkerId} 
                    />
                </div>

                {/* Sidebar Results mit Hover Logik */}
                {(searchedAddress || activities.length > 0 || isLoading) && (
                    <aside className="absolute top-24 right-4 w-[360px] z-[999] max-w-[calc(100vw-2rem)]">
                        <Card className="bg-background/95 shadow-xl backdrop-blur-md border-muted max-h-[calc(100vh-8rem)] flex flex-col">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center justify-between">
                                    <span>{isLoading ? "Suche..." : (activities.length > 0 ? "Ergebnisse" : "Ort")}</span>
                                    {!isLoading && <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                      {markers.length} auf Karte
                                    </span>}
                                </CardTitle>
                                {searchedAddress && <p className="text-xs text-muted-foreground truncate">{searchedAddress}</p>}
                            </CardHeader>
                            <CardContent className="overflow-y-auto flex-1 p-4 pt-0 custom-scrollbar">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                                      <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                      <p className="text-sm text-muted-foreground">Durchsuche das Web...</p>
                                    </div>
                                ) : (
                                    activities.length > 0 ? (
                                        <div className="grid gap-4 pt-2">
                                            {activities.map((act, i) => {
                                                // ID Rekonstruktion passend zur Marker-Generierung
                                                let markerId: string | null = null;
                                                if (act.coordinates?.lat && act.coordinates?.lon) {
                                                    markerId = `act-${i}-${act.coordinates.lat}-${act.coordinates.lon}`;
                                                }

                                                return (
                                                    <div 
                                                        key={i}
                                                        onMouseEnter={() => markerId && setHoveredMarkerId(markerId)}
                                                        onMouseLeave={() => setHoveredMarkerId(null)}
                                                        className={`transition-all duration-200 rounded-lg ${
                                                            hoveredMarkerId === markerId ? 'ring-2 ring-primary bg-primary/5' : ''
                                                        }`}
                                                    >
                                                        <ActivityCard activity={act as Activity} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-muted-foreground">
                                            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                            <p>Keine Aktivitäten gefunden.</p>
                                        </div>
                                    )
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                )}
            </main>
        </div>
    );
}