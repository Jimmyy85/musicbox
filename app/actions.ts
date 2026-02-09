"use server";

export async function getDeezerData(endpoint: string) {
  try {
    // Le serveur Vercel appelle Deezer directement (Pas de CORS ici)
    const response = await fetch(`https://api.deezer.com${endpoint}`, {
      cache: 'no-store' // On force la mise à jour à chaque fois
    });
    
    if (!response.ok) {
      return { data: [] };
    }
    
    return await response.json();
  } catch (error) {
    console.error("Erreur Serveur Deezer:", error);
    return { data: [] };
  }
}