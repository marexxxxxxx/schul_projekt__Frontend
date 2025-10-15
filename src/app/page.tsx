"use client";

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Search, Loader2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Map = dynamic(() => import('@/components/map-component'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchedAddress, setSearchedAddress] = useState<string | undefined>(undefined);
    const [markerPosition, setMarkerPosition] = useState<[number, number] | undefined>(undefined);
    const [markerPopup, setMarkerPopup] = useState<string | undefined>(undefined);
    const [isSearching, startSearchTransition] = useTransition();
    const { toast } = useToast();
    
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) return;

        startSearchTransition(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1`);
                if (!response.ok) throw new Error('Fehler beim Abrufen vom Geocoding-Dienst.');
                
                const data = await response.json();
                if (data && data.length > 0) {
                    const { lat, lon, display_name } = data[0];
                    setMarkerPosition([parseFloat(lat), parseFloat(lon)]);
                    setMarkerPopup(display_name);
                    setSearchedAddress(display_name);
                } else {
                    setSearchedAddress(undefined);
                    setMarkerPosition(undefined);
                    toast({ variant: "destructive", title: "Standort nicht gefunden", description: "Bitte versuchen Sie eine andere Adresse." });
                }
            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Suchfehler", description: "Während der Suche ist ein Fehler aufgetreten." });
            }
        });
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
            <main className="flex-1 h-full relative">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-md">
                    <Card className="bg-card shadow-lg">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-center gap-4">
                                 <h1 className="text-2xl font-bold font-headline text-primary mr-4 whitespace-nowrap">GÖSA- Reisen</h1>
                                <form onSubmit={handleSearch} className="flex gap-2 w-full">
                                    <Input 
                                        placeholder="Adresse eingeben..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        aria-label="Address-Suche"
                                    />
                                    <Button type="submit" disabled={isSearching || !searchQuery} aria-label="Search" className="px-5">
                                        {isSearching ? <Loader2 className="animate-spin h-5 w-5"/> : <Search className="h-5 w-5" />}
                                    </Button>
                                </form>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Map 
                    position={[51.505, -0.09]} 
                    zoom={2} 
                    markerPosition={markerPosition}
                    markerPopup={markerPopup}
                />
                
                {searchedAddress && (
                    <aside className="absolute top-24 right-4 w-96 z-10">
                        <Card className="bg-card shadow-lg">
                            <CardHeader>
                                <CardTitle>Gesuchte Adresse</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isSearching ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="animate-spin h-5 w-5" />
                                        <span>Suche läuft...</span>
                                    </div>
                                ) : (
                                    <p>{searchedAddress}</p>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                )}
            </main>
        </div>
    );
}
