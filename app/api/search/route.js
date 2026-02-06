import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const artist = searchParams.get('artist');
  const album = searchParams.get('album');
  
  // Ta cle API directement integree
  const API_KEY = "5665d667ef7bf8f180a39ca8f06406f5";

  try {
    // CAS 1 : Infos detaillees (Tracklist + Wiki)
    if (artist && album) {
      const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${API_KEY}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`);
      const data = await res.json();
      return NextResponse.json(data.album || {});
    }

    // CAS 2 : Recherche utilisateur
    if (query) {
      const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(query)}&api_key=${API_KEY}&format=json`);
      const data = await res.json();
      const albums = data.results?.albummatches?.album || [];
      const formatted = albums.map(a => ({
        title: a.name,
        artist: a.artist,
        image: a.image[3]['#text'] || a.image[2]['#text'] || ""
      }));
      return NextResponse.json(formatted);
    }

    // CAS 3 : RECOMMANDATIONS (Top Albums Hip-Hop actuels)
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=tag.gettopalbums&tag=hip-hop&limit=60&api_key=${API_KEY}&format=json`);
    const data = await res.json();
    const albums = data.albums?.album || [];
    
    const formatted = albums.map(a => ({
      title: a.name,
      artist: a.artist.name,
      image: a.image[3]['#text'] || a.image[2]['#text'] || ""
    }));
    
    return NextResponse.json(formatted);

  } catch (error) {
    console.error("Erreur API:", error);
    return NextResponse.json({ error: "Erreur lors de la recuperation" }, { status: 500 });
  }
}