const API_KEY ="5665d667ef7bf8f180a39ca8f06406f5";

export const searchAlbums = async (query) => {
  if (!query) return [];
  
  const url = `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(query)}&api_key=${API_KEY}&format=json`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  // Si Last.fm renvoie une erreur (clé invalide, etc.)
  if (data.error) {
    console.error("Erreur Last.fm:", data.message);
    return [];
  }

  // Si on a bien des résultats
  if (data.results && data.results.albummatches && data.results.albummatches.album) {
    return data.results.albummatches.album.map((album) => ({
      title: album.name,
      artist: album.artist,
      image: album.image[3]["#text"] || album.image[2]["#text"],
    }));
  }

  return [];
};