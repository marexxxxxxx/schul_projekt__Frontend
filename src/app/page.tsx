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

const Map = dynamic(() => import('@/components/map-component'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchedAddress, setSearchedAddress] = useState<string | undefined>(undefined);
    const [activities, setActivities] = useState<Activity[]>([]);
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

            try {
                const searchResponse = await fetch(`http://127.0.0.1:8000/get_location/${encodeURIComponent(query)}`, {
                    method: 'GET',
                });
                if (!searchResponse.ok) throw new Error('Fehler bei der Suchanfrage an den Backend-Service.');
                
                const { job_id } = await searchResponse.json();

                const eventSource = new EventSource(`http://127.0.0.1:8000/stream/${job_id}`);

                eventSource.onopen = () => {
                    console.log("SSE connection established.");
                };

                eventSource.onmessage = (event) => {
                    console.log("SSE message received:", event.data);
                    const data = JSON.parse(event.data);

                    if (data.status === 'in progress') {
                        console.log("Search job is in progress.");
                        return;
                    }

                    if (data.status === 'COMPLETED' && Array.isArray(data.result)) {
                        const mappedActivities: Activity[] = data.result.map((act: any) => ({
                            title: act.name || 'Unbenannte Aktivität',
                            rating_average: act.rating_average || 0,
                            rating_count: act.rating_count || 0,
                            price_value: act.price_value || 0,
                            price_currency: act.price_currency || 'EUR',
                            price_unit: act.price_unit || 'Person',
                            duration_min_hours: act.duration_min_hours || 0,
                            activity_url: act.url || '#',
                            image_url: 'https://via.placeholder.com/350x200',
                        }));
                        
                        setActivities(mappedActivities);
                        setIsLoading(false);
                        eventSource.close();
                        console.log("EventSource connection closed after receiving COMPLETED status.");
                    } else if (data.status === 'FAILED') {
                        toast({ variant: "destructive", title: "Fehler bei der Suche", description: "Die Suche nach Aktivitäten ist fehlgeschlagen." });
                        setIsLoading(false);
                        eventSource.close();
                    }
                };

                eventSource.onerror = (err) => {
                    console.error("EventSource failed:", err);
                    toast({ variant: "destructive", title: "Fehler beim Laden der Aktivitäten", description: "Die Verbindung zum Server wurde unterbrochen." });
                    setIsLoading(false);
                    eventSource.close();
                };

            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Backend-Fehler", description: "Es gab ein Problem beim Kontaktieren des Backends." });
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
                                                    <ActivityCard key={index} activity={activity} />
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
