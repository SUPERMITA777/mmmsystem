export async function testGeocode(q, loc) {
    console.log(`\nTesting Geocode Logic for: ${q} | Loc: ${loc}`);
    let queriesToTry = [];

    // Si hay localidades, construir búsquedas
    let localityStr = "";
    if (loc) {
        localityStr = loc.split(',').map(l => l.trim()).filter(Boolean)[0];
    }

    // 1. Try Exact
    queriesToTry.push(localityStr ? `${q}, ${localityStr}` : q);

    // 2. Try Fallback if it has " y ", " e ", " con "
    const intersectionMatch = q.match(/^(.*?)\s+(?:y|e|con)\s+(.*?)$/i);
    // Not using 'and' here, spanish intersections use Y mostly
    if (intersectionMatch) {
        const street1 = intersectionMatch[1].trim();
        queriesToTry.push(localityStr ? `${street1}, ${localityStr}` : street1);
    }

    for (const query of queriesToTry) {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=ar&limit=1`;
        console.log(`-> Fetching Nominatim: ${query}`);
        try {
            const r = await fetch(url);
            const d = await r.json();
            if (d.length > 0) {
                console.log(`   FOUND: ${d[0].lat}, ${d[0].lon} - ${d[0].display_name}`);
                return d[0];
            } else {
                console.log(`   NOT FOUND`);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

async function run() {
    await testGeocode("MONTEVIDEO Y VILLEGAS", "Florencio Varela");
    await testGeocode("MONTEVIDEO 123", "Florencio Varela");
    await testGeocode("SAN MARTIN Y BELGRANO", "Florencio Varela");
}
run();
