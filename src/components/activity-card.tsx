// components/activity-card.tsx
"use client";

import { useState } from 'react';
import { ExternalLink, Star, Clock, Euro } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity } from '@/lib/mock-data';

interface ActivityCardProps {
  activity: Activity;
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer bg-card/50 backdrop-blur-sm"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Bild mit Fallback */}
      <div className="relative h-48 bg-muted overflow-hidden">
        {!imageError ? (
          <img
            src={activity.image_url}
            alt={activity.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="text-4xl mb-2">🏞️</div>
              <p className="text-sm">Bild nicht verfügbar</p>
            </div>
          </div>
        )}
        
        {/* Rating Badge */}
        <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-medium">
            {activity.rating_average.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({activity.rating_count})
          </span>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Titel */}
          <h3 className="font-semibold text-lg line-clamp-2 leading-tight">
            {activity.title}
          </h3>

          {/* Preis und Dauer */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Euro className="h-4 w-4" />
              <span>
                {activity.price_value === 0 ? 'Kostenlos' : 
                 `${activity.price_value} ${activity.price_currency}/${activity.price_unit}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{activity.duration_min_hours}h</span>
            </div>
          </div>

          {/* Erweiterte Informationen */}
          {isExpanded && (
            <div className="space-y-2 pt-2 border-t border-border/50 animate-in fade-in-50">
              <p className="text-sm text-muted-foreground">
                Entdecken Sie diese einzigartige Erfahrung in Ihrer Region.
              </p>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2"
                asChild
              >
                <a 
                  href={activity.activity_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Mehr erfahren
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          )}

          {/* Collapsed State */}
          {!isExpanded && (
            <div className="pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Mehr Details
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}