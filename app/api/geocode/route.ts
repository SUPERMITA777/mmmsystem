import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const format = searchParams.get('format') || 'jsonv2';
    const limit = searchParams.get('limit') || '1';
    const localidades = searchParams.get('localidades'); // comma-separated locality names

    if (lat && lon) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=${format}&lat=${lat}&lon=${lon}`;
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'MMMSystem/1.0', 'Accept-Language': 'es' } });
            const data = await response.json();
            return NextResponse.json(data);
        } catch (error) {
            console.error('Geocode API Error:', error);
            return NextResponse.json({ error: 'Failed to fetch from Nominatim' }, { status: 502 });
        }
    } else if (q) {
        let localityStr = "";
        if (localidades) {
            const locs = localidades.split(',').map(l => l.trim()).filter(Boolean);
            if (locs.length > 0) localityStr = locs[0];
        }

        let queriesToTry: string[] = [];

        // 1. Try Exact query
        let exactQuery = q;
        if (localityStr && !q.toLowerCase().includes(localityStr.toLowerCase())) {
            exactQuery = `${q}, ${localityStr}`;
        }
        queriesToTry.push(exactQuery);

        // 2. Try Fallback if it's an intersection or has " y ", " e ", " con "
        const intersectionMatch = q.match(/^(.*?)\s+(?:y|e|con)\s+(.*?)$/i);
        if (intersectionMatch) {
            const street1 = intersectionMatch[1].trim();
            queriesToTry.push(localityStr ? `${street1}, ${localityStr}` : street1);
        }

        for (const query of queriesToTry) {
            const url = `https://nominatim.openstreetmap.org/search?format=${format}&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1&countrycodes=ar`;
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'MMMSystem/1.0', 'Accept-Language': 'es' } });
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    return NextResponse.json(data);
                }
            } catch (error) {
                console.error('Geocode API Error on try:', query, error);
            }
        }

        // If all fail, return empty array to signify not found gracefully
        return NextResponse.json([]);
    } else {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
}
