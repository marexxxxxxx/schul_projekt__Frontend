"use client";

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Search, Loader2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';

const Map = dynamic(() => import('@/components/map-component'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [markerPosition, setMarkerPosition] = useState<[number, number] | undefined>([51.5, -0.09]);
    const [markerPopup, setMarkerPopup] = useState<string>("Ein schönes CSS-Popup.<br> Leicht anpassbar.");
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
                } else {
                    toast({ variant: "destructive", title: "Standort nicht gefunden", description: "Bitte versuchen Sie eine andere Adresse." });
                }
            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Suchfehler", description: "Während der Suche ist ein Fehler aufgetreten." });
            }
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-[400px_1fr] h-screen w-screen bg-background text-foreground overflow-hidden">
            <aside className="h-full flex flex-col border-r border-border bg-card/50">
                <div className="p-4">
                    <h1 className="text-2xl font-bold font-headline text-primary">GeoSuche</h1>
                    <p className="text-muted-foreground text-sm">Orte finden und auf der Karte anzeigen.</p>
                </div>

                <div className="p-4 border-b border-t">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <Input 
                            placeholder="Adresse eingeben..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Address-Suche"
                        />
                        <Button type="submit" disabled={isSearching || !searchQuery} size="icon" aria-label="Search">
                            {isSearching ? <Loader2 className="animate-spin"/> : <Search />}
                        </Button>
                    </form>
                </div>
                
                <ScrollArea className="flex-grow">
                    <div className="p-4 space-y-4">
                      {/* Der Inhaltsbereich der Seitenleiste bleibt für zukünftige Erweiterungen erhalten */}
                    </div>
                </ScrollArea>
            </aside>

            <main className="h-full w-full p-4">
                <Map 
                    position={[51.505, -0.09]} 
                    zoom={13} 
                    markerPosition={markerPosition}
                    markerPopup={markerPopup}
                />
            </main>
        </div>
    );
}
