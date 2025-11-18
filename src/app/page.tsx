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

// Error Handler Klassen
interface ActivityMappingError extends Error {
  code: string;
  field?: string;
  value?: any;
  index?: number;
}

class ActivityErrorHandler {
  private errors: ActivityMappingError[] = [];

  public mapActivities(data: any): { activities: Activity[]; errors: ActivityMappingError[]; hasErrors: boolean } {
    this.errors = [];

    try {
      this.validateDataStructure(data);
      if (this.errors.length > 0) {
        return { activities: [], errors: this.errors, hasErrors: true };
      }

      const mappedActivities: Activity[] = data.result.map((act: any, index: number) => 
        this.mapSingleActivity(act, index)
      ).filter((act: Activity | null): act is Activity => act !== null);

      return {
        activities: mappedActivities,
        errors: this.errors,
        hasErrors: this.errors.length > 0
      };

    } catch (error) {
      this.handleCriticalError(error as Error);
      return { activities: [], errors: this.errors, hasErrors: true };
    }
  }

  private validateDataStructure(data: any): void {
    if (!data) {
      this.logError('NO_DATA', 'Keine Daten erhalten');
      return;
    }

    if (data.status !== 'completed') {
      this.logError('INVALID_STATUS', `Unerwarteter Status: ${data.status}`, undefined, data.status);
    }

    if (!Array.isArray(data.result)) {
      this.logError('INVALID_RESULT_TYPE', 'Result ist kein Array', undefined, data.result);
    }
  }

  private mapSingleActivity(act: any, index: number): Activity | null {
    try {
      if (!act || typeof act !== 'object') {
        this.logError('INVALID_ACTIVITY_OBJECT', `Ungültiges Aktivitätsobjekt bei Index ${index}`, undefined, act);
        return null;
      }

      const validationErrors = this.validateActivityFields(act, index);
      if (validationErrors.length > 0) {
        return null;
      }

      return {
        title: this.safeGetString(act, ['name', 'title'], 'Unbenannte Aktivität', index),
        rating_average: this.safeGetNumber(act, 'rating_average', 0, index),
        rating_count: this.safeGetNumber(act, 'rating_count', 0, index),
        price_value: this.safeGetNumber(act, 'price_value', 0, index),
        price_currency: this.safeGetString(act, ['price_currency'], 'EUR', index),
        price_unit: this.safeGetString(act, ['price_unit'], 'Person', index),
        duration_min_hours: this.safeGetNumber(act, 'duration_min_hours', 0, index),
        activity_url: this.safeGetString(act, ['activity_url', 'url'], '#', index),
        // Verwende eine spezielle Methode für Bild-URLs mit besserer Validierung
        image_url: this.safeGetImageUrl(act, index),
      };

    } catch (error) {
      this.logError(
        'MAPPING_ERROR',
        `Fehler beim Mappen der Aktivität bei Index ${index}`,
        undefined,
        act,
        index,
        error as Error
      );
      return null;
    }
  }

  /**
   * Spezielle Methode für Bild-URLs mit erweiterter Validierung
   */
  private safeGetImageUrl(obj: any, index: number): string | null {
    const keys = ['image_url'];
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          // Erweiterte Validierung für Bild-URLs
          if (this.isValidImageUrl(trimmed)) {
            return trimmed;
          } else {
            this.logError('INVALID_IMAGE_URL', `Ungültige Bild-URL: ${trimmed}`, key, trimmed, index);
            return null;
          }
        }
        // Fallback: Konvertierung zu String und Validierung
        const strValue = String(value).trim();
        if (this.isValidImageUrl(strValue)) {
          return strValue;
        } else {
          this.logError('INVALID_IMAGE_URL', `Ungültige Bild-URL: ${strValue}`, key, strValue, index);
          return null;
        }
      }
    }
    return null; // Kein Bild statt leerem String
  }

  /**
   * Erweiterte URL-Validierung für Bilder
   */
  private isValidImageUrl(url: string): boolean {
    if (!url) return false;
    
    // Überprüfe auf bekannte ungültige Muster
    if (url.includes('ranking_uuid=') || 
        url.includes('tour_img/') && !url.includes('cdn.getyourguide.com')) {
      return false;
    }

    // Überprüfe, ob die URL mit http:// oder https:// beginnt
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private validateActivityFields(act: any, index: number): string[] {
    const fieldErrors: string[] = [];

    if (!this.hasAnyProperty(act, ['name', 'title'])) {
      this.logError('MISSING_TITLE', 'Aktivität hat keinen Titel', 'title', undefined, index);
      fieldErrors.push('title');
    }

    const url = act.activity_url || act.url;
    if (url && url !== '#' && !this.isValidUrl(url)) {
      this.logError('INVALID_URL', `Ungültige URL: ${url}`, 'activity_url', url, index);
      fieldErrors.push('activity_url');
    }

    if (act.rating_average !== undefined && (act.rating_average < 0 || act.rating_average > 5)) {
      this.logError('INVALID_RATING', `Rating außerhalb des gültigen Bereichs: ${act.rating_average}`, 'rating_average', act.rating_average, index);
    }

    return fieldErrors;
  }

  private safeGetString(obj: any, keys: string[], defaultValue: string, index: number): string {
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string') {
          return value.trim() || defaultValue;
        }
        return String(value).trim() || defaultValue;
      }
    }
    return defaultValue;
  }

  private safeGetNumber(obj: any, key: string, defaultValue: number, index: number): number {
    const value = obj[key];
    
    if (value === undefined || value === null) {
      return defaultValue;
    }

    const num = Number(value);
    if (isNaN(num)) {
      this.logError('INVALID_NUMBER', `Ungültiger Zahlenwert für ${key}: ${value}`, key, value, index);
      return defaultValue;
    }

    return num;
  }

  private hasAnyProperty(obj: any, keys: string[]): boolean {
    return keys.some(key => obj[key] !== undefined && obj[key] !== null && obj[key] !== '');
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private logError(
    code: string,
    message: string,
    field?: string,
    value?: any,
    index?: number,
    originalError?: Error
  ): void {
    const error: ActivityMappingError = {
      name: 'ActivityMappingError',
      code,
      message: originalError ? `${message} (Original: ${originalError.message})` : message,
      field,
      value,
      index
    };

    this.errors.push(error);

    const logMessage = `[${code}] ${message} ${field ? `Field: ${field}` : ''} ${index !== undefined ? `Index: ${index}` : ''}`;
    
    if (code.startsWith('INVALID_') || code === 'MAPPING_ERROR') {
      console.warn('⚠️', logMessage, value || '');
    } else {
      console.error('❌', logMessage, originalError || '');
    }
  }

  private handleCriticalError(error: Error): void {
    this.logError('CRITICAL_ERROR', 'Kritischer Fehler beim Verarbeiten der Aktivitäten', undefined, undefined, undefined, error);
  }

  public getErrorStats(): { total: number; byCode: Record<string, number>; byField: Record<string, number> } {
    const byCode: Record<string, number> = {};
    const byField: Record<string, number> = {};

    this.errors.forEach(error => {
      byCode[error.code] = (byCode[error.code] || 0) + 1;
      if (error.field) {
        byField[error.field] = (byField[error.field] || 0) + 1;
      }
    });

    return {
      total: this.errors.length,
      byCode,
      byField
    };
  }
}

const Map = dynamic(() => import('@/components/map-component'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
});

// Aktualisiere den Activity Type um null für image_url zu erlauben
interface ActivityWithNullableImage extends Omit<Activity, 'image_url'> {
  image_url: string | null;
}

// Suchmodus Typ
type SearchMode = 'fastsearch' | 'deepsearch' | 'none';

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<SearchMode>('none');
    const [searchedAddress, setSearchedAddress] = useState<string | undefined>(undefined);
    const [activities, setActivities] = useState<ActivityWithNullableImage[]>([]);
    const [markerPosition, setMarkerPosition] = useState<[number, number] | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, startSearchTransition] = useTransition();
    const { toast } = useToast();

    // Fastsearch Funktion
    const performFastSearch = (query: string) => {
        console.log("🚀 Fastsearch gestartet für:", query);
        
        startSearchTransition(async () => {
            setActivities([]);
            setSearchedAddress(undefined);
            setMarkerPosition(undefined);
            setIsLoading(true);

            // Geocoding Teil (gleich für beide Modi)
            try {
                const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`);
                if (!geoResponse.ok) throw new Error('Fehler beim Abrufen vom Geocoding-Dienst.');

                const geoData = await geoResponse.json();
                if (geoData && geoData.length > 0) {
                    const { lat, lon, display_name } = geoData[0];
                    setMarkerPosition([parseFloat(lat), parseFloat(lon)]);
                    setSearchedAddress(display_name);
                } else {
                    toast({ variant: "destructive", title: "Standort nicht gefunden", description: "Bitte versuchen Sie eine andere Adresse." });
                    setIsLoading(false);
                    return;
                }
            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Fehler beim Geocoding", description: "Die Adresse konnte nicht gefunden werden." });
                setIsLoading(false);
                return;
            }

            // Fastsearch Backend-Suche
            try {
                const searchResponse = await fetch(`http://127.0.0.1:8000/location/${encodeURIComponent(query)}?search_mode=fastsearch`, {
                    method: 'GET',
                });
                
                if (!searchResponse.ok) throw new Error('Fehler bei der Fastsearch-Anfrage an den Backend-Service.');

                const { job_id } = await searchResponse.json();
                const eventSource = new EventSource(`http://127.0.0.1:8000/stream/${job_id}`);

                eventSource.onopen = () => {
                    console.log("🚀 Fastsearch SSE connection established.");
                };

                eventSource.onmessage = (event) => {
                    console.log("🚀 Fastsearch SSE message received:", event.data);
                    
                    try {
                        const data = JSON.parse(event.data);
                        console.log("🚀 Fastsearch parsed SSE data:", data);

                        if (data.result && typeof data.result === 'string') {
                            try {
                                const parsedResult = JSON.parse(data.result);
                                console.log("🚀 Fastsearch parsed result:", parsedResult);
                                
                                if (parsedResult.status === 'in progress') {
                                    console.log("🚀 Fastsearch job is in progress.");
                                    return;
                                }

                                if (parsedResult.status === 'completed' && Array.isArray(parsedResult.result)) {
                                    const errorHandler = new ActivityErrorHandler();
                                    const result = errorHandler.mapActivities(parsedResult);
                                    
                                    if (result.hasErrors) {
                                        console.warn(`🚀 Fastsearch: Aktivitäten wurden mit ${result.errors.length} Fehlern verarbeitet:`);
                                        console.table(errorHandler.getErrorStats().byCode);
                                    }

                                    const mappedActivities = result.activities as ActivityWithNullableImage[];
                                    console.log("🚀 Fastsearch successfully mapped activities:", mappedActivities.length);
                                    
                                    setActivities(mappedActivities);
                                    setIsLoading(false);
                                    eventSource.close();
                                    console.log("🚀 Fastsearch EventSource connection closed.");
                                    
                                    toast({
                                        variant: "default",
                                        title: "Fastsearch abgeschlossen",
                                        description: `${mappedActivities.length} Aktivitäten gefunden`
                                    });
                                } else if (parsedResult.status === 'failed' || parsedResult.status === 'FAILED' || parsedResult.status === 'error') {
                                    toast({ 
                                        variant: "destructive", 
                                        title: "Fastsearch fehlgeschlagen", 
                                        description: parsedResult.message || "Die Fastsearch ist fehlgeschlagen." 
                                    });
                                    setIsLoading(false);
                                    eventSource.close();
                                }
                            } catch (innerParseError) {
                                console.error("🚀 Fehler beim Parsen des Fastsearch result-Strings:", innerParseError);
                            }
                        } else {
                            console.error("🚀 Unerwartetes Fastsearch Datenformat");
                        }
                    } catch (parseError) {
                        console.error("🚀 Fehler beim Parsen der Fastsearch SSE-Nachricht:", parseError);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error("🚀 Fastsearch SSE Verbindungsfehler:", error);
                    toast({ 
                        variant: "destructive", 
                        title: "Fastsearch Verbindungsfehler", 
                        description: "Die Verbindung zum Server wurde unterbrochen." 
                    });
                    setIsLoading(false);
                    eventSource.close();
                };

            } catch (error) {
                console.error("🚀 Fastsearch Fehler:", error);
                toast({ 
                    variant: "destructive", 
                    title: "Fastsearch Fehler", 
                    description: "Die Verbindung zum Server konnte nicht hergestellt werden." 
                });
                setIsLoading(false);
            }
        });
    };

    // Deepsearch Funktion
    const performDeepSearch = (query: string) => {
        console.log("🔍 Deepsearch gestartet für:", query);
        
        startSearchTransition(async () => {
            setActivities([]);
            setSearchedAddress(undefined);
            setMarkerPosition(undefined);
            setIsLoading(true);

            // Geocoding Teil (gleich für beide Modi)
            try {
                const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`);
                if (!geoResponse.ok) throw new Error('Fehler beim Abrufen vom Geocoding-Dienst.');

                const geoData = await geoResponse.json();
                if (geoData && geoData.length > 0) {
                    const { lat, lon, display_name } = geoData[0];
                    setMarkerPosition([parseFloat(lat), parseFloat(lon)]);
                    setSearchedAddress(display_name);
                } else {
                    toast({ variant: "destructive", title: "Standort nicht gefunden", description: "Bitte versuchen Sie eine andere Adresse." });
                    setIsLoading(false);
                    return;
                }
            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Fehler beim Geocoding", description: "Die Adresse konnte nicht gefunden werden." });
                setIsLoading(false);
                return;
            }

            // Deepsearch Backend-Suche
            try {
                const searchResponse = await fetch(`http://127.0.0.1:8000/create_data/${encodeURIComponent(query)}?search_mode=deepsearch`, {
                    method: 'GET',
                });
                
                if (!searchResponse.ok) throw new Error('Fehler bei der Deepsearch-Anfrage an den Backend-Service.');

                const { job_id } = await searchResponse.json();
                const eventSource = new EventSource(`http://127.0.0.1:8000/stream/${job_id}`);

                eventSource.onopen = () => {
                    console.log("🔍 Deepsearch SSE connection established.");
                };

                eventSource.onmessage = (event) => {
                    console.log("🔍 Deepsearch SSE message received:", event.data);
                    
                    try {
                        const data = JSON.parse(event.data);
                        console.log("🔍 Deepsearch parsed SSE data:", data);

                        if (data.result && typeof data.result === 'string') {
                            try {
                                const parsedResult = JSON.parse(data.result);
                                console.log("🔍 Deepsearch parsed result:", parsedResult);
                                
                                if (parsedResult.status === 'in progress') {
                                    console.log("🔍 Deepsearch job is in progress.");
                                    return;
                                }

                                if (parsedResult.status === 'completed' && Array.isArray(parsedResult.result)) {
                                    const errorHandler = new ActivityErrorHandler();
                                    const result = errorHandler.mapActivities(parsedResult);
                                    
                                    if (result.hasErrors) {
                                        console.warn(`🔍 Deepsearch: Aktivitäten wurden mit ${result.errors.length} Fehlern verarbeitet:`);
                                        console.table(errorHandler.getErrorStats().byCode);
                                    }

                                    const mappedActivities = result.activities as ActivityWithNullableImage[];
                                    console.log("🔍 Deepsearch successfully mapped activities:", mappedActivities.length);
                                    
                                    setActivities(mappedActivities);
                                    setIsLoading(false);
                                    eventSource.close();
                                    console.log("🔍 Deepsearch EventSource connection closed.");
                                    
                                    toast({
                                        variant: "default",
                                        title: "Deepsearch abgeschlossen",
                                        description: `${mappedActivities.length} Aktivitäten gefunden`
                                    });
                                } else if (parsedResult.status === 'failed' || parsedResult.status === 'FAILED' || parsedResult.status === 'error') {
                                    toast({ 
                                        variant: "destructive", 
                                        title: "Deepsearch fehlgeschlagen", 
                                        description: parsedResult.message || "Die Deepsearch ist fehlgeschlagen." 
                                    });
                                    setIsLoading(false);
                                    eventSource.close();
                                }
                            } catch (innerParseError) {
                                console.error("🔍 Fehler beim Parsen des Deepsearch result-Strings:", innerParseError);
                            }
                        } else {
                            console.error("🔍 Unerwartetes Deepsearch Datenformat");
                        }
                    } catch (parseError) {
                        console.error("🔍 Fehler beim Parsen der Deepsearch SSE-Nachricht:", parseError);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error("🔍 Deepsearch SSE Verbindungsfehler:", error);
                    toast({ 
                        variant: "destructive", 
                        title: "Deepsearch Verbindungsfehler", 
                        description: "Die Verbindung zum Server wurde unterbrochen." 
                    });
                    setIsLoading(false);
                    eventSource.close();
                };

            } catch (error) {
                console.error("🔍 Deepsearch Fehler:", error);
                toast({ 
                    variant: "destructive", 
                    title: "Deepsearch Fehler", 
                    description: "Die Verbindung zum Server konnte nicht hergestellt werden." 
                });
                setIsLoading(false);
            }
        });
    };

    // Fallback-Suche wenn nichts ausgewählt ist
    const performDefaultSearch = (query: string) => {
        console.log("ℹ️ Standard-Suche gestartet (kein Modus ausgewählt) für:", query);
        
        // Zeige einen Toast, dass der Benutzer einen Modus auswählen soll
        toast({
            variant: "destructive",
            title: "Suchmodus nicht ausgewählt",
            description: "Bitte wählen Sie zwischen Fastsearch und Deepsearch aus.",
            duration: 5000
        });

        // Optional: Automatisch auf Fastsearch fallen lassen
        // console.log("ℹ️ Fallback auf Fastsearch...");
        // setSearchMode('fastsearch');
        // performFastSearch(query);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!searchQuery.trim()) {
            toast({
                variant: "destructive",
                title: "Suchfeld leer",
                description: "Bitte geben Sie eine Adresse ein.",
            });
            return;
        }

        // Entscheide welche Suchfunktion aufgerufen wird basierend auf searchMode
        switch (searchMode) {
            case 'fastsearch':
                performFastSearch(searchQuery);
                break;
            case 'deepsearch':
                performDeepSearch(searchQuery);
                break;
            case 'none':
            default:
                performDefaultSearch(searchQuery);
                break;
        }
    };

    const showLoader = isSearching || isLoading;

    // Funktion um Suchmodus anzuzeigen
    const getSearchModeDisplayName = (mode: SearchMode): string => {
        switch (mode) {
            case 'fastsearch': return 'Schnellsuche';
            case 'deepsearch': return 'Tiefensuche';
            case 'none': return 'Kein Modus ausgewählt';
            default: return 'Unbekannt';
        }
    };

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
                                        <Select value={searchMode} onValueChange={(value: SearchMode) => setSearchMode(value)}>
                                            <SelectTrigger className="w-[160px]">
                                                <SelectValue placeholder="Suchmodus wählen" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fastsearch">🚀 Fastsearch</SelectItem>
                                                <SelectItem value="deepsearch">🔍 Deepsearch</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            placeholder="Adresse eingeben..."
                                            value={searchQuery}
                                            onChange={handleInputChange}
                                            aria-label="Address-Suche"
                                            autoComplete="off"
                                            className="flex-1"
                                        />
                                        <Button type="submit" disabled={showLoader || !searchQuery} aria-label="Search" className="px-5">
                                            {showLoader ? <Loader2 className="animate-spin h-5 w-5"/> : <Search className="h-6 w-6" />}
                                        </Button>
                                    </form>
                                </div>
                            </div>
                            {searchMode === 'none' && (
                                <p className="text-sm text-amber-600 mt-2 text-center">
                                    ⚠️ Bitte wählen Sie einen Suchmodus aus
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Map
                    position={[51.1657, 10.4515]}
                    zoom={6}
                    markerPosition={markerPosition}
                />

                {(searchedAddress || activities.length > 0 || showLoader) && (
                    <aside className="absolute top-24 right-4 w-[360px] z-10">
                        <Card className="bg-card/30 shadow-lg backdrop-blur-sm max-h-[calc(100vh-7rem)] overflow-y-auto">
                            <CardHeader>
                                <CardTitle>
                                    {showLoader 
                                        ? `Suche... (${getSearchModeDisplayName(searchMode)})` 
                                        : (activities.length > 0 
                                            ? `Aktivitäten in ${searchQuery}`
                                            : "Dein Urlaubsziel:"
                                          )
                                    }
                                </CardTitle>
                                {activities.length > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Modus: {getSearchModeDisplayName(searchMode)} • {activities.length} Ergebnisse
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent>
                                {showLoader ? (
                                    <div className="flex items-center justify-center p-8 gap-2">
                                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                        <div className="text-center">
                                            <span className="text-lg block">
                                                {searchMode === 'fastsearch' && '🚀 Schnellsuche läuft...'}
                                                {searchMode === 'deepsearch' && '🔍 Tiefensuche läuft...'}
                                                {searchMode === 'none' && 'Suche wird vorbereitet...'}
                                            </span>
                                            <span className="text-sm text-muted-foreground block mt-1">
                                                {searchMode === 'deepsearch' && 'Dies kann etwas länger dauern...'}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {activities.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-4">
                                                {activities.map((activity, index) => (
                                                    <ActivityCard 
                                                        key={index} 
                                                        activity={activity as Activity}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4">
                                                <p className="mb-2">{searchedAddress}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Suchmodus: {getSearchModeDisplayName(searchMode)}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                )}
            </main>
        </div>
    );
}