export interface Activity {
  title: string;
  rating_average: number | null;
  rating_count: number | null;
  price_value: number | null;
  price_currency: string | null;
  price_unit: string | null;
  duration_min_hours?: number | null;
  booking_callout?: string | null;
  image_url: string;
  activity_url: string;
}

export const fuerteventuraActivities: Activity[] = [
    {
        title: 'Island Lobos by Speedboat',
        rating_average: 4.7,
        rating_count: 9,
        price_value: 95.0,
        price_currency: '€',
        price_unit: 'per person',
        duration_min_hours: 6.0,
        booking_callout: null,
        activity_url: 'https://www.getyourguide.com/fuerteventura-l419/island-lobos-lobos-by-speedboat-popcorn-beach-dunes-t520859/',
        image_url: 'https://cdn.getyourguide.com/img/tour/5a68a32e2c525.jpeg/87.jpg',
    },
    {
        title: 'From Caleta de Fuste: Explore Rural Fuerteventura Tour',
        rating_average: 4.6,
        rating_count: 45,
        price_value: 85.0,
        price_currency: '€',
        price_unit: 'per person',
        duration_min_hours: 3.0,
        booking_callout: 'Pickup available',
        activity_url: 'https://www.getyourguide.com/fuerteventura-l419/from-caleta-de-fuste-explore-rural-fuerteventura-tour-t528592/',
        image_url: 'https://cdn.getyourguide.com/img/tour/6468987b7a97b.jpeg/87.jpg',
    },
    {
        title: 'Fuerteventura: Island Tour by Minibus',
        rating_average: 4.8,
        rating_count: 626,
        price_value: 350.0,
        price_currency: '€',
        price_unit: 'group',
        duration_min_hours: 4.0,
        booking_callout: 'Pickup available',
        activity_url: 'https://www.getyourguide.com/fuerteventura-l419/fuerteventura-island-tour-by-minibus-t84333/',
        image_url: 'https://cdn.getyourguide.com/img/tour/641f09c10173b.jpeg/87.jpg',
    },
    {
        title: 'Fuerteventura: Island Tour by Minibus',
        rating_average: 5.0,
        rating_count: 38,
        price_value: 79.0,
        price_currency: '€',
        price_unit: 'per person',
        duration_min_hours: 7.0,
        booking_callout: '6 - 7 hours • Small group • Pickup available',
        activity_url: 'https://www.getyourguide.com/fuerteventura-l419/fuerteventura-island-tour-by-minibus-t84499/',
        image_url: 'https://cdn.getyourguide.com/img/tour/5886126e3fea5.jpeg/87.jpg',
    },
    {
        title: 'Fuerteventura North Full-Day Tour',
        rating_average: 4.6,
        rating_count: 564,
        price_value: 17.0,
        price_currency: '€',
        price_unit: 'per person',
        duration_min_hours: 5.0,
        booking_callout: '5 hours • Small group • Pickup available',
        activity_url: 'https://www.getyourguide.com/fuerteventura-l419/fuerteventura-north-full-day-tour-t58694/',
        image_url: 'https://cdn.getyourguide.com/img/tour/54059fb881cf77c457e092cddcc3d49f632cc7115d1278e3e45c22706a17443f.jpg/87.jpg'
    },
    {
        title: 'Fuerteventura Bike Rental Guide',
        rating_average: 4.9,
        rating_count: 5,
        price_value: 33.0,
        price_currency: '€',
        price_unit: 'per person',
        duration_min_hours: null,
        booking_callout: '1 day • Pickup available',
        activity_url: 'https://www.getyourguide.com/fuerteventura-l419/corralejo-e-bike-rental-with-map-to-popcorn-beach-t466091/',
        image_url: 'https://cdn.getyourguide.com/img/tour/44e5de720a22d494.jpeg/87.jpg',
    },
    {
        title: 'Las Palmas de Fuerteventura: Cofete Beach and Desert Safari',
        rating_average: 4.6,
        rating_count: 153,
        price_value: 85.0,
        price_currency: '€',
        price_unit: 'per person',
        duration_min_hours: 3.0,
        booking_callout: '4.6 out of 5 stars',
        activity_url: 'https://www.getyourguide.com/fuerteventura-l419/las-palmas-fuerteventura-cofete-beach-and-desert-safari-t528591/',
        image_url: 'https://cdn.getyourguide.com/img/tour/64689809b1acf.jpeg/87.jpg',
    },
    {
        title: 'From Fuerteventura Lanzarote Volcano and Wine Region Tour',
        rating_average: 4.4,
        rating_count: 1200,
        price_value: 74.0,
        price_currency: '€',
        price_unit: 'per person',
        duration_min_hours: 7.0,
        booking_callout: 'Pickup available',
        activity_url: 'https://www.getyourguide.com/fuerteventura-l419/from-fuerteventura-lanzarote-volcano-and-wine-region-tour-t86720/',
        image_url: 'https://cdn.getyourguide.com/img/tour/4c5e90a1548b176a.jpeg/87.jpg',
    },
];
