import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = searchParams.get('limit') || '5';

    if (!query || query.length < 3) {
      return NextResponse.json([]);
    }

    // Call Nominatim API from server-side
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=${limit}&countrycodes=us&q=${encodeURIComponent(query)}`;


    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'ReentryCapstoneApp/1.0',
      },
    });


    if (!response.ok) {
      console.error('Nominatim API error:', response.status, response.statusText);
      return NextResponse.json([]);
    }

    const data = await response.json();


    // Define the structure of Nominatim API response items
    interface NominatimItem {
      address: {
        house_number?: string;
        road?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
        country?: string;
      };
      display_name: string;
      lat: string;
      lon: string;
      place_id: string;
    }

    // Filter and sort results to prioritize addresses with house numbers
    const filteredResults = (data as NominatimItem[])
      .filter((item) => item.address && (item.address.road || item.address.city))
      .sort((a, b) => {
        const aHasNumber = !!a.address.house_number;
        const bHasNumber = !!b.address.house_number;
        if (aHasNumber && !bHasNumber) return -1;
        if (!aHasNumber && bHasNumber) return 1;
        return 0;
      })
      .slice(0, parseInt(limit));

    return NextResponse.json(filteredResults);
  } catch (error) {
    console.error('Geocoding suggestions API error:', error);
    return NextResponse.json([]);
  }
}
