"use client";

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Search, Route, Loader2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { calculateRoute, type CalculateRouteOutput } from '@/ai/flows/calculate-route-between-locations';
import { ScrollArea } from '@/components/ui/scroll-area';

const Map = dynamic(() => import('@/components/map-component'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [markerPosition, setMarkerPosition] = useState<[number, number] | undefined>([51.5, -0.09]);
    const [markerPopup, setMarkerPopup] = useState<string>("A pretty CSS popup.<br> Easily customizable.");
    const [routeInfo, setRouteInfo] = useState<CalculateRouteOutput | null>(null);
    const [isSearching, startSearchTransition] = useTransition();
    const [isCalculating, startRouteCalculationTransition] = useTransition();
    const { toast } = useToast();
    
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) return;

        startSearchTransition(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1`);
                if (!response.ok) throw new Error('Failed to fetch from geocoding service.');
                
                const data = await response.json();
                if (data && data.length > 0) {
                    const { lat, lon, display_name } = data[0];
                    setMarkerPosition([parseFloat(lat), parseFloat(lon)]);
                    setMarkerPopup(display_name);
                    setRouteInfo(null);
                } else {
                    toast({ variant: "destructive", title: "Location not found", description: "Please try a different address." });
                }
            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Search Error", description: "An error occurred while searching." });
            }
        });
    };

    const handleCalculateRoute = () => {
        if (!markerPosition || !searchQuery) {
            toast({ variant: "destructive", title: "No destination", description: "Please search for a location first." });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                startRouteCalculationTransition(async () => {
                    try {
                        const result = await calculateRoute({
                            startLocation: "my current location",
                            endLocation: searchQuery
                        });
                        setRouteInfo(result);
                    } catch (error) {
                        console.error(error);
                        toast({ variant: "destructive", title: "Routing Error", description: "Could not calculate the route using AI." });
                    }
                });
            },
            (error) => {
                console.error(error);
                toast({ variant: "destructive", title: "Geolocation Error", description: "Could not get your current location. Please enable location services in your browser." });
            }
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-[400px_1fr] h-screen w-screen bg-background text-foreground overflow-hidden">
            <aside className="h-full flex flex-col border-r border-border bg-card/50">
                <div className="p-4">
                    <h1 className="text-2xl font-bold font-headline text-primary">GeoSearch</h1>
                    <p className="text-muted-foreground text-sm">Find places and plan your routes.</p>
                </div>

                <div className="p-4 border-b border-t">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <Input 
                            placeholder="Enter an address..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Address Search"
                        />
                        <Button type="submit" disabled={isSearching || !searchQuery} size="icon" aria-label="Search">
                            {isSearching ? <Loader2 className="animate-spin"/> : <Search />}
                        </Button>
                    </form>
                </div>
                
                <ScrollArea className="flex-grow">
                    <div className="p-4 space-y-4">
                        <Button onClick={handleCalculateRoute} disabled={!markerPosition || isCalculating || !searchQuery} className="w-full">
                            {isCalculating ? <Loader2 className="animate-spin mr-2"/> : <Route className="mr-2"/>}
                             Calculate Route
                         </Button>

                        {routeInfo && (
                             <Card className="shadow-md">
                                <CardHeader>
                                    <CardTitle>Route Details</CardTitle>
                                    <CardDescription>
                                        From your location to <span className="font-medium">{searchQuery}</span>.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <p>
                                        <strong className="text-foreground">Viability:</strong> 
                                        <span className={routeInfo.isViable ? "text-green-600" : "text-destructive"}>
                                            {routeInfo.isViable ? " Viable" : " Not Viable"}
                                        </span>
                                    </p>
                                    <div>
                                        <strong className="text-foreground block mb-1">Route:</strong>
                                        <p className="text-muted-foreground">{routeInfo.route}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
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
