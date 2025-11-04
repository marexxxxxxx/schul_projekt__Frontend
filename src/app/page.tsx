"use client";

import { useState, useTransition, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Search, Loader2 } from 'lucide-react';
import Image from 'next/image';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fuerteventuraActivities, Activity } from '@/lib/mock-data';
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
    const [markerPopup, setMarkerPopup] = useState<string | undefined>(undefined);
    const [isSearching, startSearchTransition] = useTransition();
    const { toast } = useToast();

    const performSearch = (query: string) => {
        if (!query) return;

        startSearchTransition(async () => {
            setActivities([]);
            setSearchedAddress(undefined);
            setMarkerPosition(undefined);
            setMarkerPopup(undefined);

            if (query.toLowerCase().trim() === 'fuerteventura') {
                setActivities(fuerteventuraActivities);
                setMarkerPosition([28.3587, -14.0537]);
                setMarkerPopup("Fuerteventura");
                setSearchedAddress("Fuerteventura, Spanien");
                return;
            }

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`);
                if (!response.ok) throw new Error('Fehler beim Abrufen vom Geocoding-Dienst.');
                
                const data = await response.json();
                if (data && data.length > 0) {
                    const { lat, lon, display_name } = data[0];
                    setMarkerPosition([parseFloat(lat), parseFloat(lon)]);
                    setMarkerPopup(display_name);
                    setSearchedAddress(display_name);
                } else {
                    toast({ variant: "destructive", title: "Standort nicht gefunden", description: "Bitte versuchen Sie eine andere Adresse." });
                }
            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Suchfehler", description: "Während der Suche ist ein Fehler aufgetreten." });
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
                                        <Button type="submit" disabled={isSearching || !searchQuery} aria-label="Search" className="px-5">
                                            {isSearching ? <Loader2 className="animate-spin h-5 w-5"/> : <Search className="h-6 w-6" />}
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
                    markerPopup={markerPopup}
                />
                
                {(searchedAddress || activities.length > 0 || isSearching) && (
                    <aside className="absolute top-24 right-4 w-[720px] z-10">
                        <Card className="bg-card/30 shadow-lg backdrop-blur-sm max-h-[calc(100vh-7rem)] overflow-y-auto">
                            <CardHeader>
                                <CardTitle>{isSearching ? "Suche..." : (activities.length > 0 ? "Top-Aktivitäten in Fuerteventura" : "Gesuchte Adresse")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isSearching ? (
                                    <div className="flex items-center justify-center p-8 gap-2">
                                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                        <span className="text-lg">Suche läuft...</span>
                                    </div>
                                ) : (
                                    <>
                                        {activities.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-4">
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
