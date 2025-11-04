"use client";

import type { Activity } from "@/lib/mock-data";
import { useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";

interface ActivityCardProps {
    activity: Activity;
}

export default function ActivityCard({ activity }: ActivityCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div 
            className="relative rounded-lg overflow-hidden shadow-lg cursor-pointer transition-all duration-300 ease-in-out"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <Image
                src={activity.image_url}
                alt={activity.title}
                width={350}
                height={200}
                className="w-full h-48 object-cover"
            />
            
            <div className={`absolute bottom-0 left-0 right-0 p-4 bg-black/50 backdrop-blur-sm transition-all duration-300 ease-in-out ${isExpanded ? 'bg-opacity-70' : 'bg-opacity-50'}`}>
                <h3 className="text-white font-bold text-md truncate">{activity.title}</h3>
                
                {isExpanded && (
                    <div className="text-white text-sm mt-2">
                        {activity.price_value && (
                            <p className="font-semibold">
                                {activity.price_currency}{activity.price_value.toFixed(2)} {activity.price_unit}
                            </p>
                        )}
                        {activity.rating_average && activity.rating_count && (
                             <div className="flex items-center gap-1 mt-1">
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                <span>{activity.rating_average.toFixed(1)} ({activity.rating_count} Bewertungen)</span>
                            </div>
                        )}
                        {activity.duration_min_hours && <p className="mt-1">Dauer: {activity.duration_min_hours} Stunden</p>}
                        <a href={activity.activity_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline mt-2 inline-block">
                            Mehr Details
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
