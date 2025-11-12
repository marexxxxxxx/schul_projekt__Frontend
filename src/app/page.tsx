"use client";

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Search, Loader2 } from 'lucide-react';

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

const Map = dynamic(() => import('@/components/map-component'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

interface RawData {
  status?: string;
  result?: any;
  message?: string;
  type?: string;
  data?: any;
  cords?: any;
  job_id?: string;
  error?: string;
  [key: string]: any;
}

interface ProcessedActivity {
  id: string;
  activity: Activity;
  source: string;
  chunk?: number;
  timestamp: Date;
}

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchedAddress, setSearchedAddress] = useState<string | undefined>(undefined);
    const [activities, setActivities] = useState<ProcessedActivity[]>([]);
    const [markerPosition, setMarkerPosition] = useState<[number, number] | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, startSearchTransition] = useTransition();
    const [searchType, setSearchType] = useState("fast");
    const { toast } = useToast();
    
    // Neue States für Rohdaten und Debug-Informationen
    const [rawData, setRawData] = useState<RawData[]>([]);
    const [debugInfo, setDebugInfo] = useState<string[]>([]);
    const [currentEventSource, setCurrentEventSource] = useState<EventSource | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);

    const addDebugInfo = (message: string) => {
        console.log(message);
        setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const cleanupSearch = () => {
        if (currentEventSource) {
            currentEventSource.close();
            setCurrentEventSource(null);
        }
        setCurrentJobId(null);
    };

    const processActivityData = (data: any, source: string, chunk?: number): ProcessedActivity[] => {
        const processed: ProcessedActivity[] = [];
        
        if (Array.isArray(data)) {
            // Direktes Array von Aktivitäten
            data.forEach((item, index) => {
                processed.push({
                    id: `${source}-${chunk || 'direct'}-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    activity: {
                        title: item.name || item.title || 'Unbenannte Aktivität',
                        rating_average: item.rating_average || item.rating || 0,
                        rating_count: item.rating_count || 0,
                        price_value: item.price_value || item.price || 0,
                        price_currency: item.price_currency || 'EUR',
                        price_unit: item.price_unit || 'Person',
                        duration_min_hours: item.duration_min_hours || item.duration || 1,
                        activity_url: item.url || item.activity_url || '#',
                        image_url: item.image_url || item.image || 'https://via.placeholder.com/350x200',
                    },
                    source,
                    chunk,
                    timestamp: new Date()
                });
            });
        } else if (typeof data === 'object' && data !== null) {
            // Einzelnes Aktivitätsobjekt
            processed.push({
                id: `${source}-${chunk || 'single'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                activity: {
                    title: data.name || data.title || 'Unbenannte Aktivität',
                    rating_average: data.rating_average || data.rating || 0,
                    rating_count: data.rating_count || 0,
                    price_value: data.price_value || data.price || 0,
                    price_currency: data.price_currency || 'EUR',
                    price_unit: data.price_unit || 'Person',
                    duration_min_hours: data.duration_min_hours || data.duration || 1,
                    activity_url: data.url || data.activity_url || '#',
                    image_url: data.image_url || data.image || 'https://via.placeholder.com/350x200',
                },
                source,
                chunk,
                timestamp: new Date()
            });
        }
        
        return processed;
    };

    const performSearch = (query: string) => {
        if (!query) return;

        startSearchTransition(async () => {
            // Cleanup vorherige Suche
            cleanupSearch();
            
            setActivities([]);
            setSearchedAddress(undefined);
            setMarkerPosition(undefined);
            setRawData([]);
            setDebugInfo([]);
            setIsLoading(true);

            addDebugInfo(`=== NEUE SUCHE GESTARTET ===`);
            addDebugInfo(`Suchtyp: ${searchType}`);
            addDebugInfo(`Suchbegriff: ${query}`);

            try {
                // Geocoding
                addDebugInfo('Starte Geocoding...');
                const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`);
                addDebugInfo(`Geocoding Response Status: ${geoResponse.status}`);
                
                if (!geoResponse.ok) throw new Error('Fehler beim Abrufen vom Geocoding-Dienst.');

                const geoData = await geoResponse.json();
                addDebugInfo(`Geocoding Ergebnisse: ${geoData.length} Treffer`);
                
                if (geoData && geoData.length > 0) {
                    const { lat, lon, display_name } = geoData[0];
                    setMarkerPosition([parseFloat(lat), parseFloat(lon)]);
                    setSearchedAddress(display_name);
                    addDebugInfo(`Koordinaten gesetzt: ${lat}, ${lon}`);
                    addDebugInfo(`Adresse: ${display_name}`);
                } else {
                    toast({ variant: "destructive", title: "Standort nicht gefunden", description: "Bitte versuchen Sie eine andere Adresse." });
                    setIsLoading(false);
                    return;
                }
            } catch (error) {
                console.error(error);
                addDebugInfo(`Geocoding Fehler: ${error}`);
                toast({ variant: "destructive", title: "Fehler beim Geocoding", description: "Die Adresse konnte nicht gefunden werden." });
                setIsLoading(false);
                return;
            }

            // EventSource für SSE-Stream öffnen
            const endpoint = searchType === 'fast' ? 'get_location' : 'location';
            const url = `http://127.0.0.1:8000/${endpoint}/${encodeURIComponent(query)}`;
            
            addDebugInfo(`Öffne SSE-Stream: ${url}`);
            
            const eventSource = new EventSource(url);
            setCurrentEventSource(eventSource);

            eventSource.onopen = () => {
                addDebugInfo("✅ SSE-Verbindung hergestellt");
            };

            eventSource.onmessage = (event) => {
                addDebugInfo(`📨 SSE-Nachricht empfangen`);
                
                try {
                    const data = JSON.parse(event.data);
                    const dataWithTimestamp = { 
                        ...data, 
                        _received: new Date().toISOString(),
                        _searchType: searchType
                    };
                    
                    setRawData(prev => [...prev, { 
                        type: 'sse_message', 
                        data: dataWithTimestamp, 
                        timestamp: new Date().toISOString() 
                    }]);

                    // Job-ID speichern
                    if (data.job_id && !currentJobId) {
                        setCurrentJobId(data.job_id);
                        addDebugInfo(`🎯 Job-ID: ${data.job_id}`);
                    }

                    // Verarbeite verschiedene Nachrichtentypen
                    switch (data.status) {
                        case 'STARTED':
                            addDebugInfo(`🚀 Job gestartet`);
                            break;
                            
                        case 'PROCESSING':
                            addDebugInfo(`⚙️ ${data.message}`);
                            break;
                            
                        case 'COMPLETED':
                            addDebugInfo(`✅ Job abgeschlossen: ${data.message || 'Erfolgreich'}`);
                            setIsLoading(false);
                            eventSource.close();
                            break;
                            
                        case 'FAILED':
                            addDebugInfo(`❌ Job fehlgeschlagen: ${data.error}`);
                            toast({ 
                                variant: "destructive", 
                                title: "Fehler bei der Suche", 
                                description: data.error || "Die Suche ist fehlgeschlagen." 
                            });
                            setIsLoading(false);
                            eventSource.close();
                            break;
                    }

                    // Fastsearch: Koordinaten verarbeiten
                    if (searchType === 'fast' && data.type === 'location_data') {
                        addDebugInfo(`📍 Koordinaten-Daten erhalten`);
                        
                        // Verwende die activities aus der Nachricht, falls vorhanden
                        if (data.activities && Array.isArray(data.activities)) {
                            addDebugInfo(`🎯 ${data.activities.length} Aktivitäten von Fastsearch erhalten`);
                            
                            const newActivities = processActivityData(data.activities, 'fastsearch');
                            setActivities(newActivities);
                            setIsLoading(false);
                            eventSource.close();
                        } else {
                            // Fallback: Wenn keine Aktivitäten geliefert werden
                            addDebugInfo(`⚠️ Keine Aktivitäten in Fastsearch-Daten, verwende Fallback`);
                            const fallbackActivities = processActivityData([
                                {
                                    name: 'Beispielaktivität - Fastsearch',
                                    rating_average: 4.2,
                                    rating_count: 150,
                                    price_value: 35,
                                    price_currency: 'EUR',
                                    price_unit: 'Person',
                                    duration_min_hours: 1.5,
                                    url: '#',
                                    image_url: 'https://via.placeholder.com/350x200',
                                }
                            ], 'fastsearch');
                            setActivities(fallbackActivities);
                            setIsLoading(false);
                            eventSource.close();
                        }
                    }

                    // Deepsearch: Daten-Chunks verarbeiten
                    if (searchType === 'deep' && data.type === 'data_chunk' && data.data) {
                        addDebugInfo(`📦 Daten-Chunk #${data.chunk} erhalten mit ${data.data?.length || 0} Einträgen`);
                        
                        const newActivities = processActivityData(data.data, 'deepsearch', data.chunk);
                        if (newActivities.length > 0) {
                            addDebugInfo(`🎯 ${newActivities.length} Aktivitäten aus Chunk #${data.chunk} verarbeitet`);
                            setActivities(prev => [...prev, ...newActivities]);
                        }
                    }

                    // Direkte Aktivitäten-Daten (falls vorhanden)
                    if (data.result && Array.isArray(data.result)) {
                        addDebugInfo(`🎯 Direkte Ergebnisse erhalten: ${data.result.length} Aktivitäten`);
                        const newActivities = processActivityData(data.result, 'direct');
                        if (newActivities.length > 0) {
                            setActivities(prev => [...prev, ...newActivities]);
                        }
                    }

                    // Einzelne Aktivität
                    if (data.name || data.title) {
                        addDebugInfo(`🎯 Einzelne Aktivität erhalten`);
                        const newActivities = processActivityData(data, 'single');
                        if (newActivities.length > 0) {
                            setActivities(prev => [...prev, ...newActivities]);
                        }
                    }

                } catch (parseError) {
                    addDebugInfo(`❌ Parse-Fehler: ${parseError}`);
                    setRawData(prev => [...prev, { 
                        type: 'parse_error', 
                        data: event.data, 
                        timestamp: new Date().toISOString() 
                    }]);
                }
            };

            eventSource.onerror = (err) => {
                addDebugInfo(`❌ SSE-Fehler: ${JSON.stringify(err)}`);
                toast({ 
                    variant: "destructive", 
                    title: "Verbindungsfehler", 
                    description: "Die Verbindung zum Server wurde unterbrochen." 
                });
                setIsLoading(false);
                eventSource.close();
            };
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(searchQuery);
    };

    const showLoader = isSearching || isLoading;

    return (
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
            <main className="flex-1 h-full relative">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-xl">
                    <Card className="bg-card/30 shadow-lg backdrop-blur-sm">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-center gap-4">
                                <h1 className="text-2xl font-bold font-headline text-primary mr-4 whitespace-nowrap">GÖSA Reisen</h1>
                                <div className="w-full relative">
                                    <form onSubmit={handleSearch} className="flex gap-2 w-full">
                                        <Input
                                            placeholder="Adresse eingeben..."
                                            value={searchQuery}
                                            onChange={handleInputChange}
                                            aria-label="Address-Suche"
                                            autoComplete="off"
                                        />
                                        <Select value={searchType} onValueChange={setSearchType}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Search Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fast">Fastsearch</SelectItem>
                                                <SelectItem value="deep">Deepsearch</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button type="submit" disabled={showLoader || !searchQuery} aria-label="Search" className="px-5">
                                            {showLoader ? <Loader2 className="animate-spin h-5 w-5"/> : <Search className="h-6 w-6" />}
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Map
                    position={[51.1657, 10.4515]}
                    zoom={6}
                    markerPosition={markerPosition}
                />

                {(searchedAddress || activities.length > 0 || showLoader || rawData.length > 0) && (
                    <aside className="absolute top-24 right-4 w-[500px] z-10 max-h-[calc(100vh-7rem)] overflow-hidden">
                        <div className="flex flex-col gap-4 h-full">
                            {/* Aktivitäten Card */}
                            <Card className="bg-card/30 shadow-lg backdrop-blur-sm flex-1 overflow-y-auto">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>
                                            {showLoader ? "Suche..." : 
                                             activities.length > 0 ? `Aktivitäten (${activities.length})` : 
                                             "Dein Urlaubsziel:"}
                                        </span>
                                        {currentJobId && (
                                            <span className="text-xs text-muted-foreground font-normal">
                                                Job: {currentJobId.slice(0, 8)}...
                                            </span>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {showLoader ? (
                                        <div className="flex items-center justify-center p-8 gap-2">
                                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                            <span className="text-lg">Suche läuft...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {activities.length > 0 ? (
                                                <div className="grid grid-cols-1 gap-4">
                                                    {activities.map((processedActivity) => (
                                                        <div key={processedActivity.id} className="relative">
                                                            <ActivityCard activity={processedActivity.activity} />
                                                            <div className="absolute top-2 right-2 flex gap-1">
                                                                {processedActivity.chunk && (
                                                                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                                                        Chunk {processedActivity.chunk}
                                                                    </span>
                                                                )}
                                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                                    processedActivity.source === 'fastsearch' 
                                                                        ? 'bg-green-500 text-white' 
                                                                        : 'bg-purple-500 text-white'
                                                                }`}>
                                                                    {processedActivity.source}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-4 text-center text-muted-foreground">
                                                    <p className="mb-2">{searchedAddress}</p>
                                                    <p className="text-sm">Keine Aktivitäten gefunden.</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Debug Information Card */}
                            {(rawData.length > 0 || debugInfo.length > 0) && (
                                <Card className="bg-card/30 shadow-lg backdrop-blur-sm max-h-96 overflow-y-auto">
                                    <CardHeader>
                                        <CardTitle className="text-sm flex justify-between items-center">
                                            <span>Rohdaten & Debug-Info</span>
                                            <span className="text-xs font-normal text-muted-foreground">
                                                {rawData.length} Nachrichten
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Debug Log */}
                                        {debugInfo.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold mb-2 text-xs">Debug Log:</h4>
                                                <div className="bg-black/50 p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
                                                    {debugInfo.map((info, index) => (
                                                        <div key={index} className="mb-1">
                                                            {info.includes('✅') && <span className="text-green-400">{info}</span>}
                                                            {info.includes('❌') && <span className="text-red-400">{info}</span>}
                                                            {info.includes('🎯') && <span className="text-yellow-400">{info}</span>}
                                                            {info.includes('📨') && <span className="text-blue-400">{info}</span>}
                                                            {!info.includes('✅') && !info.includes('❌') && !info.includes('🎯') && !info.includes('📨') && 
                                                             <span className="text-gray-400">{info}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Raw Data */}
                                        {rawData.map((item, index) => (
                                            <div key={index} className="border-b pb-2 last:border-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h4 className="font-semibold text-xs">
                                                        {item.type === 'sse_message' && `SSE Message ${index + 1}`}
                                                        {item.type === 'parse_error' && '❌ Parse Error'}
                                                    </h4>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(item.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <pre className="text-xs bg-black/50 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                                                    {JSON.stringify(item.data, null, 2)}
                                                </pre>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </aside>
                )}
            </main>
        </div>
    );
}