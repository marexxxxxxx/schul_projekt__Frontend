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

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchedAddress, setSearchedAddress] = useState<string | undefined>(undefined);
    const [activities, setActivities] = useState<ActivityWithNullableImage[]>([]);
    const [markerPosition, setMarkerPosition] = useState<[number, number] | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, startSearchTransition] = useTransition();
    const { toast } = useToast();

    const performSearch = (query: string) => {
        if (!query) return;

        startSearchTransition(async () => {
            setActivities([]);
            setSearchedAddress(undefined);
            setMarkerPosition(undefined);
            setIsLoading(true);

            // Geocoding Teil
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

            // Backend-Suche Teil
            try {
                const searchResponse = await fetch(`http://127.0.0.1:8000/get_location/${encodeURIComponent(query)}`, {
                    method: 'GET',
                });
                
                if (!searchResponse.ok) throw new Error('Fehler bei der Suchanfrage an den Backend-Service. Get_location');

                const { job_id } = await searchResponse.json();
                const eventSource = new EventSource(`http://127.0.0.1:8000/stream/${job_id}`);

                eventSource.onopen = () => {
                    console.log("SSE connection established.");
                };

                eventSource.onmessage = (event) => {
                    console.log("SSE message received:", event.data);
                    
                    try {
                        const data = JSON.parse(event.data);
                        console.log("Parsed SSE data:", data);

                        // Das result-Feld ist ein JSON-String, der nochmal geparst werden muss
                        if (data.result && typeof data.result === 'string') {
                            try {
                                const parsedResult = JSON.parse(data.result);
                                console.log("Parsed result:", parsedResult);
                                
                                if (parsedResult.status === 'in progress') {
                                    console.log("Search job is in progress.");
                                    return;
                                }

                                if (parsedResult.status === 'completed' && Array.isArray(parsedResult.result)) {
                                    const errorHandler = new ActivityErrorHandler();
                                    const result = errorHandler.mapActivities(parsedResult);
                                    
                                    if (result.hasErrors) {
                                        console.warn(`Aktivitäten wurden mit ${result.errors.length} Fehlern verarbeitet:`);
                                        console.table(errorHandler.getErrorStats().byCode);
                                    }

                                    // Type assertion da wir wissen dass image_url nun null sein kann
                                    const mappedActivities = result.activities as ActivityWithNullableImage[];
                                    console.log("Successfully mapped activities:", mappedActivities.length);
                                    console.log("Activities with images:", mappedActivities.filter(a => a.image_url).length);
                                    
                                    setActivities(mappedActivities);
                                    setIsLoading(false);
                                    eventSource.close();
                                    console.log("EventSource connection closed after receiving COMPLETED status.");
                                } else if (parsedResult.status === 'failed' || parsedResult.status === 'FAILED' || parsedResult.status === 'error') {
                                    toast({ 
                                        variant: "destructive", 
                                        title: "Fehler bei der Suche", 
                                        description: parsedResult.message || "Die Suche nach Aktivitäten ist fehlgeschlagen." 
                                    });
                                    setIsLoading(false);
                                    eventSource.close();
                                }
                            } catch (innerParseError) {
                                console.error("Fehler beim Parsen des result-Strings:", innerParseError, "Raw result:", data.result);
                            }
                        } else {
                            console.error("Unerwartetes Datenformat: result ist kein String oder fehlt");
                        }
                    } catch (parseError) {
                        console.error("Fehler beim Parsen der SSE-Nachricht:", parseError, "Rohe Daten:", event.data);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error("SSE Verbindungsfehler:", error);
                    toast({ 
                        variant: "destructive", 
                        title: "Verbindungsfehler", 
                        description: "Die Verbindung zum Server wurde unterbrochen." 
                    });
                    setIsLoading(false);
                    eventSource.close();
                };

            } catch (error) {
                console.error(error);
                toast({ 
                    variant: "destructive", 
                    title: "Fehler bei der Suchanfrage", 
                    description: "Die Verbindung zum Server konnte nicht hergestellt werden." 
                });
                setIsLoading(false);
            }
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

                {(searchedAddress || activities.length > 0 || showLoader) && (
                    <aside className="absolute top-24 right-4 w-[360px] z-10">
                        <Card className="bg-card/30 shadow-lg backdrop-blur-sm max-h-[calc(100vh-7rem)] overflow-y-auto">
                            <CardHeader>
                                <CardTitle>{showLoader ? "Suche..." : (activities.length > 0 ? `Top-Aktivitäten in ${searchQuery}` : "Dein Urlaubsziel:")}</CardTitle>
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
                                                {activities.map((activity, index) => (
                                                    <ActivityCard 
                                                        key={index} 
                                                        activity={activity as Activity} // Type assertion für Kompatibilität
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="p-4">{searchedAddress}</p>
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