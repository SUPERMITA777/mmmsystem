import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

function parseGoogleAddress(components: any[]) {
    let road = '';
    let house_number = '';
    let city = '';
    let town = '';

    for (const component of components) {
        if (component.types.includes('route')) road = component.long_name;
        if (component.types.includes('street_number')) house_number = component.long_name;
        if (component.types.includes('locality')) city = component.long_name;
        if (component.types.includes('sublocality')) town = component.long_name;
        if (component.types.includes('administrative_area_level_2') && !city) city = component.long_name;
    }

    return { road, house_number, city, town };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const localidades = searchParams.get('localidades');

    if (!GOOGLE_MAPS_API_KEY) {
        console.error('Missing GOOGLE_MAPS_API_KEY environment variable');
        return NextResponse.json({ error: 'Configuración incompleta: falta API Key de Google Maps' }, { status: 500 });
    }

    if (lat && lon) {
        // Reverse Geocoding
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}&language=es`;
        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                return NextResponse.json({
                    lat: result.geometry.location.lat.toString(),
                    lon: result.geometry.location.lng.toString(),
                    display_name: result.formatted_address,
                    address: parseGoogleAddress(result.address_components)
                });
            }
            return NextResponse.json({ error: 'No results found' }, { status: 404 });
        } catch (error) {
            console.error('Google Geocode API Error:', error);
            return NextResponse.json({ error: 'Failed to fetch from Google Maps' }, { status: 502 });
        }
    } else if (q) {
        // Search Geocoding
        let localityStr = "Florencio Varela, Argentina";
        if (localidades) {
            const locs = localidades.split(',').map(l => l.trim()).filter(Boolean);
            if (locs.length > 0) localityStr = `${locs[0]}, Argentina`;
        }

        // Google is much better at intersections, we just append the locality and country for precision
        const fullQuery = q.toLowerCase().includes('argentina') ? q : `${q}, ${localityStr}`;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullQuery)}&key=${GOOGLE_MAPS_API_KEY}&language=es&region=ar`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK') {
                const results = data.results.map((result: any) => ({
                    lat: result.geometry.location.lat.toString(),
                    lon: result.geometry.location.lng.toString(),
                    display_name: result.formatted_address,
                    address: parseGoogleAddress(result.address_components)
                }));
                return NextResponse.json(results);
            }
            return NextResponse.json([]);
        } catch (error) {
            console.error('Google Geocode API Error on query:', q, error);
            return NextResponse.json({ error: 'Failed to fetch from Google Maps' }, { status: 502 });
        }
    } else {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
}
