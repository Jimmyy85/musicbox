"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

// --- CONFIGURATION DESIGN ---
const COLORS = {
    bg: '#0a0c0f',
    surface: 'rgba(255, 255, 255, 0.03)',
    surfaceHighlight: 'rgba(255, 255, 255, 0.08)',
    accent: '#f97316',
    accentGlow: 'rgba(249, 115, 22, 0.4)',
    textMain: '#ffffff',
    textMuted: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.1)',
    success: '#22c55e'
};

const DEFAULT_IMG = "https://via.placeholder.com/300/1b2228/f97316?text=No+Cover";
const GENRES = ["Rap", "Pop", "Rock", "Electro", "R&B", "Jazz", "Metal", "Classique", "Variété"];

export default function Home() {
    // --- ETATS DE NAVIGATION ---
    const [activeTab, setActiveTab] = useState("discover");
    const [subTabActivity, setSubTabActivity] = useState("global");

    // --- ETATS DATA UTILISATEUR (MOI) ---
    const [ratedAlbums, setRatedAlbums] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [topFour, setTopFour] = useState([]);
    const [username, setUsername] = useState("Anonyme");
    const [following, setFollowing] = useState([]);

    // --- ETATS DATA VISITEUR (AUTRE PROFIL) ---
    const [viewedProfile, setViewedProfile] = useState(null);
    const [viewedProfileData, setViewedProfileData] = useState({ albums: [], stats: {} });

    // --- ETATS GLOBAUX ---
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [albumDetails, setAlbumDetails] = useState(null);
    const [communityComments, setCommunityComments] = useState([]);
    const [globalActivity, setGlobalActivity] = useState([]);
    const [trending, setTrending] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [query, setQuery] = useState("");

    // --- ETATS D'ACTION ---
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState("");
    const [selectedGenre, setSelectedGenre] = useState("Pop");
    const [replyTo, setReplyTo] = useState(null); // ID du commentaire auquel on répond
    const [replyText, setReplyText] = useState("");
    const [likedComments, setLikedComments] = useState([]);

    const audioRef = useRef(null);
    const [playingUri, setPlayingUri] = useState(null);

    // --- CHARGEMENT INITIAL ---
    useEffect(() => {
        const loadLocal = (key) => {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        };

        const savedData = loadLocal("musicbox-data");
        if (savedData) setRatedAlbums(savedData.map(a => ({ ...a, timestamp: a.timestamp || new Date().toISOString() })));

        const savedWatch = loadLocal("musicbox-watchlist");
        if (savedWatch) setWatchlist(savedWatch);

        const savedUser = localStorage.getItem("musicbox-user");
        if (savedUser) setUsername(savedUser);

        const savedTop = loadLocal("musicbox-top4");
        if (savedTop) setTopFour(savedTop);

        const savedLikes = loadLocal("musicbox-likes");
        if (savedLikes) setLikedComments(savedLikes);

        const savedFollowing = loadLocal("musicbox-following");
        if (savedFollowing) setFollowing(savedFollowing);

        fetch(`/api/search`).then(res => res.json()).then(data => setTrending(data.slice(0, 60))).catch(() => { });
        fetchGlobalActivity();
    }, []);

    // --- SAUVEGARDE AUTO ---
    useEffect(() => {
        localStorage.setItem("musicbox-user", username);
        localStorage.setItem("musicbox-watchlist", JSON.stringify(watchlist));
        localStorage.setItem("musicbox-data", JSON.stringify(ratedAlbums));
        localStorage.setItem("musicbox-top4", JSON.stringify(topFour));
        localStorage.setItem("musicbox-likes", JSON.stringify(likedComments));
        localStorage.setItem("musicbox-following", JSON.stringify(following));
    }, [username, watchlist, ratedAlbums, topFour, likedComments, following]);

    // --- RECHERCHE ---
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 2) fetch(`/api/search?query=${encodeURIComponent(query)}`).then(r => r.json()).then(setSearchResults);
            else setSearchResults([]);
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    // --- PROFIL VISITEUR ---
    const loadUserProfile = async (targetUsername) => {
        if (targetUsername === username) {
            setViewedProfile(null);
            setActiveTab("account");
            return;
        }
        const { data } = await supabase.from('comments').select('*').eq('username', targetUsername);
        if (data) {
            const fakeAlbums = data.map(c => ({
                title: c.album_id.split(' - ')[1] || "Album Inconnu",
                artist: c.album_id.split(' - ')[0] || "Artiste Inconnu",
                image: c.image || DEFAULT_IMG,
                userRating: c.rating,
                genre: "Pop"
            }));
            setViewedProfile({ username: targetUsername });
            setViewedProfileData({ albums: fakeAlbums });
            setActiveTab("account");
        }
    };

    const toggleFollow = () => {
        if (!viewedProfile) return;
        if (following.includes(viewedProfile.username)) {
            setFollowing(following.filter(u => u !== viewedProfile.username));
        } else {
            setFollowing([...following, viewedProfile.username]);
        }
    };

    // --- LOGIQUE DETAIL ALBUM ---
    useEffect(() => {
        if (selectedAlbum) {
            // Deezer Search pour les previews
            fetch(`https://api.deezer.com/search?q=${encodeURIComponent(selectedAlbum.artist + " " + selectedAlbum.title)}`)
                .then(res => res.json())
                .then(dzData => {
                    // On recupere la tracklist depuis Deezer c'est plus fiable pour les MP3
                    if (dzData.data && dzData.data.length > 0) {
                        // On fait une 2eme requete pour avoir la tracklist complète de l'album trouvé
                        fetch(`https://api.deezer.com/album/${dzData.data[0].album.id}/tracks`)
                            .then(r => r.json())
                            .then(tracksData => {
                                setAlbumDetails({ tracks: { track: tracksData.data } });
                            });
                    }
                })
                .catch(err => console.log("Erreur tracklist", err));

            fetchSupabaseComments(selectedAlbum);

            const existing = ratedAlbums.find(a => a.title === selectedAlbum.title);
            setRating(existing ? existing.userRating : 0);
            setReview(existing ? existing.userReview : "");
            setSelectedGenre(existing ? existing.genre : "Pop");
        }
    }, [selectedAlbum]);

    const fetchSupabaseComments = async (album) => {
        const { data } = await supabase.from('comments').select('*').eq('album_id', `${album.artist} - ${album.title}`).order('created_at', { ascending: false });
        if (data) setCommunityComments(data);
    };

    const fetchGlobalActivity = async () => {
        const { data } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(50);
        if (data) setGlobalActivity(data);
    };

    useEffect(() => { if (activeTab === "activity") fetchGlobalActivity(); }, [activeTab]);

    // --- ACTIONS ---
    const saveRating = async () => {
        if (rating === 0) return alert("Note obligatoire !");
        const albumData = { ...selectedAlbum, userRating: rating, userReview: review, genre: selectedGenre, timestamp: new Date().toISOString() };
        setRatedAlbums([albumData, ...ratedAlbums.filter(a => a.title !== selectedAlbum.title)]);
        setWatchlist(watchlist.filter(a => a.title !== selectedAlbum.title));

        await supabase.from('comments').insert([{
            album_id: `${selectedAlbum.artist} - ${selectedAlbum.title}`,
            username, content: review, rating, image: selectedAlbum.image || DEFAULT_IMG, likes: 0
        }]);

        fetchSupabaseComments(selectedAlbum);
        setReview("");
        alert("Avis publié !");
    };

    const saveReply = async (parentComment) => {
        if (!replyText.trim()) return;
        // On insère le commentaire avec le parent_id
        const { error } = await supabase.from('comments').insert([{
            album_id: `${selectedAlbum.artist} - ${selectedAlbum.title}`,
            username,
            content: replyText,
            rating: 0,
            parent_id: parentComment.id, // LIEN IMPORTANT
            image: selectedAlbum.image || DEFAULT_IMG,
            likes: 0
        }]);

        if (!error) {
            setReplyTo(null);
            setReplyText("");
            fetchSupabaseComments(selectedAlbum);
        } else {
            alert("Erreur envoi réponse");
        }
    };

    const playPreview = (url) => {
        if (!url) return alert("Pas d'extrait disponible pour ce titre");
        if (playingUri === url) { audioRef.current.pause(); setPlayingUri(null); }
        else { setPlayingUri(url); audioRef.current.src = url; audioRef.current.play(); }
    };

    const toggleWatchlist = (e, album) => {
        e.stopPropagation();
        if (watchlist.find(a => a.title === album.title)) setWatchlist(watchlist.filter(a => a.title !== album.title));
        else setWatchlist([...watchlist, album]);
    };

    const toggleTopFour = (a) => {
        if (topFour.find(x => x.title === a.title)) setTopFour(topFour.filter(x => x.title !== a.title));
        else if (topFour.length < 4) setTopFour([...topFour, a]);
        else alert("Ton Top 4 est plein.");
    };

    // --- DNA ---
    const generateDna = (albums) => {
        const counts = {};
        GENRES.forEach(g => counts[g] = 0);
        albums.forEach(a => { if (a.genre && counts[a.genre] !== undefined) counts[a.genre] += 1; else counts["Pop"] += 1; });
        return GENRES.map(g => ({ subject: g, A: counts[g], fullMark: albums.length || 1 }));
    };
    const currentDna = useMemo(() => generateDna(viewedProfile ? viewedProfileData.albums : ratedAlbums), [ratedAlbums, viewedProfile, viewedProfileData]);

    // --- DAILY DROP ---
    const dailyDrop = useMemo(() => {
        if (trending.length === 0) return null;
        const dayIndex = new Date().getDate() % trending.length;
        return trending[dayIndex];
    }, [trending]);

    // --- RENDER ---
    if (selectedAlbum) {
        const isTop = topFour.some(a => a.title === selectedAlbum.title);
        const inWatch = watchlist.some(a => a.title === selectedAlbum.title);
        const spotifyLink = `https://open.spotify.com/search/${encodeURIComponent(selectedAlbum.artist + " " + selectedAlbum.title)}`;
        const deezerLink = `https://www.deezer.com/search/${encodeURIComponent(selectedAlbum.artist + " " + selectedAlbum.title)}`;

        return (
            <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', color: 'white', fontFamily: 'Inter, sans-serif', paddingBottom: '100px' }}>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url(${selectedAlbum.image || DEFAULT_IMG})`, backgroundSize: 'cover', filter: 'blur(80px) brightness(0.3)', zIndex: 0 }} />
                <audio ref={audioRef} onEnded={() => setPlayingUri(null)} />

                {/* HEADER MODAL */}
                <header style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)', backgroundColor: 'rgba(10,12,15,0.8)', borderBottom: `1px solid ${COLORS.border}` }}>
                    <button onClick={() => { setSelectedAlbum(null); setPlayingUri(null); }} style={{ background: 'none', border: 'none', color: COLORS.accent, fontWeight: 'bold' }}>✕ FERMER</button>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={(e) => toggleWatchlist(e, selectedAlbum)} style={{ background: inWatch ? COLORS.accent : COLORS.surface, border: 'none', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>{inWatch ? "✓" : "+ LISTE"}</button>
                        <button onClick={() => toggleTopFour(selectedAlbum)} style={{ background: isTop ? COLORS.accent : COLORS.surface, border: 'none', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>{isTop ? "🏆" : "🏅 TOP"}</button>
                    </div>
                </header>

                <main style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', position: 'relative', zIndex: 1 }}>

                    {/* INFO ALBUM */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px', textAlign: 'center' }}>
                        <img src={selectedAlbum.image || DEFAULT_IMG} style={{ width: '250px', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', marginBottom: '20px' }} />
                        <h1 style={{ fontSize: '28px', fontWeight: '900', margin: 0, lineHeight: 1.1 }}>{selectedAlbum.title}</h1>
                        <p style={{ fontSize: '18px', color: COLORS.accent, margin: '5px 0 15px' }}>{selectedAlbum.artist}</p>

                        {/* BOUTONS STREAMING (RETOUR) */}
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <a href={spotifyLink} target="_blank" style={{ background: '#1DB954', color: 'black', padding: '8px 20px', borderRadius: '20px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px' }}>Spotify</a>
                            <a href={deezerLink} target="_blank" style={{ background: '#FEAA2D', color: 'black', padding: '8px 20px', borderRadius: '20px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px' }}>Deezer</a>
                        </div>
                    </div>

                    {/* TRACKLIST (RETOUR) */}
                    <div style={{ background: COLORS.surface, borderRadius: '20px', padding: '20px', marginBottom: '20px', border: `1px solid ${COLORS.border}` }}>
                        <h3 style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '15px', textTransform: 'uppercase' }}>Pistes & Extraits</h3>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {albumDetails?.tracks?.track ? (
                                albumDetails.tracks.track.map((t, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: '13px' }}>
                                        <span style={{ width: '80%' }}>{i + 1}. {t.title}</span>
                                        <button onClick={() => playPreview(t.preview)} style={{ background: 'none', border: 'none', color: playingUri === t.preview ? COLORS.accent : 'white', cursor: 'pointer' }}>
                                            {playingUri === t.preview ? "⏸" : "▶"}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p style={{ fontSize: '12px', color: COLORS.textMuted, fontStyle: 'italic' }}>Chargement des titres...</p>
                            )}
                        </div>
                    </div>

                    {/* ZONE DE NOTATION */}
                    <div style={{ background: COLORS.surface, padding: '20px', borderRadius: '20px', marginBottom: '20px', border: `1px solid ${COLORS.border}` }}>
                        <h3 style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '15px' }}>TA CRITIQUE</h3>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
                            {[1, 2, 3, 4, 5].map(s => <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', fontSize: '30px', color: rating >= s ? COLORS.accent : 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>★</button>)}
                        </div>
                        <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: `1px solid ${COLORS.border}`, marginBottom: '10px' }}>
                            {GENRES.map(g => <option key={g} value={g} style={{ color: 'black' }}>{g}</option>)}
                        </select>
                        <textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Ton avis..." style={{ width: '100%', height: '80px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '10px', color: 'white', padding: '10px', marginBottom: '10px' }} />
                        <button onClick={saveRating} style={{ width: '100%', background: COLORS.accent, border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', color: 'white' }}>PUBLIER</button>
                    </div>

                    {/* COMMUNAUTÉ & COMMENTAIRES (FIX RÉPONSE) */}
                    <div style={{ background: COLORS.surface, padding: '20px', borderRadius: '20px' }}>
                        <h3 style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '15px' }}>COMMUNAUTÉ</h3>

                        {/* Filtre uniquement les commentaires parents */}
                        {communityComments.filter(c => !c.parent_id).map((c, i) => (
                            <div key={i} style={{ marginBottom: '15px', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <b onClick={() => loadUserProfile(c.username)} style={{ color: COLORS.accent, cursor: 'pointer' }}>@{c.username}</b>
                                    <span style={{ fontSize: '10px', color: COLORS.textMuted }}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}</span>
                                </div>
                                <p style={{ fontSize: '14px', margin: '5px 0 10px', lineHeight: '1.4' }}>{c.content}</p>

                                {/* Actions Commentaire */}
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: COLORS.accent }}>{"★".repeat(c.rating)}</span>
                                    <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        {replyTo === c.id ? "ANNULER" : "RÉPONDRE"}
                                    </button>
                                </div>

                                {/* ZONE DE RÉPONSE (Conditionnelle et Visible) */}
                                {replyTo === c.id && (
                                    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', borderLeft: `3px solid ${COLORS.accent}` }}>
                                        <input
                                            autoFocus
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            placeholder={`Répondre à @${c.username}...`}
                                            style={{ width: '100%', background: 'black', border: 'none', color: 'white', padding: '10px', borderRadius: '5px', marginBottom: '5px' }}
                                        />
                                        <div style={{ textAlign: 'right' }}>
                                            <button onClick={() => saveReply(c)} style={{ background: COLORS.accent, border: 'none', borderRadius: '5px', padding: '5px 15px', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>ENVOYER</button>
                                        </div>
                                    </div>
                                )}

                                {/* Affichage des Réponses (Enfants) */}
                                {communityComments.filter(r => r.parent_id === c.id).map((r, j) => (
                                    <div key={j} style={{ marginLeft: '20px', marginTop: '10px', paddingLeft: '10px', borderLeft: `2px solid ${COLORS.border}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <b style={{ fontSize: '12px', color: COLORS.textMuted }}>@{r.username}</b>
                                        </div>
                                        <p style={{ fontSize: '13px', margin: '2px 0', color: '#ccc' }}>{r.content}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    // --- RENDER PRINCIPAL (HOME) ---
    return (
        <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>

            <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '60px', backgroundColor: 'rgba(10,12,15,0.9)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, borderBottom: `1px solid ${COLORS.border}` }}>
                <h1 style={{ color: 'white', fontSize: '14px', fontWeight: '900', letterSpacing: '6px' }}>MUSICBOX</h1>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 20px 140px' }}>

                {/* ONGLET DÉCOUVRIR */}
                {activeTab === "discover" && (
                    <div>
                        {dailyDrop && (
                            <div onClick={() => setSelectedAlbum(dailyDrop)} style={{ marginBottom: '30px', position: 'relative', height: '180px', borderRadius: '20px', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${COLORS.border}` }}>
                                <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${dailyDrop.image})`, backgroundSize: 'cover', filter: 'blur(20px) brightness(0.5)' }} />
                                <div style={{ position: 'absolute', inset: 0, padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <img src={dailyDrop.image} style={{ height: '140px', borderRadius: '10px', boxShadow: '0 10px 30px black' }} />
                                    <div>
                                        <span style={{ background: COLORS.accent, color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '10px', fontWeight: 'bold' }}>DAILY DROP</span>
                                        <h2 style={{ color: 'white', fontSize: '22px', margin: '10px 0 5px', fontWeight: 'bold' }}>{dailyDrop.title}</h2>
                                        <p style={{ color: 'white', opacity: 0.7 }}>{dailyDrop.artist}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '20px' }}>Tendances</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px' }}>
                            {trending.map((album, i) => (
                                <div key={i} style={{ cursor: 'pointer' }}>
                                    <div style={{ position: 'relative' }}>
                                        <img src={album.image || DEFAULT_IMG} onClick={() => setSelectedAlbum(album)} style={{ width: '100%', borderRadius: '12px' }} />
                                        <button onClick={(e) => toggleWatchlist(e, album)} style={{ position: 'absolute', top: 5, right: 5, background: watchlist.some(w => w.title === album.title) ? COLORS.accent : 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '25px', height: '25px' }}>{watchlist.some(w => w.title === album.title) ? "✓" : "+"}</button>
                                    </div>
                                    <p style={{ color: 'white', fontSize: '12px', marginTop: '5px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ONGLET ACTIVITÉ (L'ÉCLAIR) */}
                {activeTab === "activity" && (
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
                            <button onClick={() => setSubTabActivity('global')} style={{ background: subTabActivity === 'global' ? COLORS.surfaceHighlight : 'transparent', border: `1px solid ${subTabActivity === 'global' ? COLORS.accent : COLORS.border}`, color: 'white', padding: '8px 20px', borderRadius: '20px', fontSize: '12px' }}>🌍 Global & Amis</button>
                            <button onClick={() => setSubTabActivity('personal')} style={{ background: subTabActivity === 'personal' ? COLORS.surfaceHighlight : 'transparent', border: `1px solid ${subTabActivity === 'personal' ? COLORS.accent : COLORS.border}`, color: 'white', padding: '8px 20px', borderRadius: '20px', fontSize: '12px' }}>👤 Mon Activité</button>
                        </div>

                        {subTabActivity === 'global' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {globalActivity.map((act, i) => {
                                    const isFriend = following.includes(act.username);
                                    return (
                                        <div key={i} style={{ background: isFriend ? 'rgba(249, 115, 22, 0.05)' : COLORS.surface, padding: '15px', borderRadius: '16px', border: isFriend ? `1px solid ${COLORS.accent}66` : `1px solid ${COLORS.border}`, display: 'flex', gap: '15px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>{act.username[0]}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span onClick={() => loadUserProfile(act.username)} style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>@{act.username} {isFriend && <span style={{ fontSize: '9px', background: COLORS.accent, padding: '2px 5px', borderRadius: '5px' }}>AMI</span>}</span>
                                                    <span style={{ fontSize: '10px', color: COLORS.textMuted }}>{formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: fr })}</span>
                                                </div>
                                                <p style={{ fontSize: '13px', margin: '5px 0', color: '#ccc' }}>
                                                    a noté <b style={{ color: 'white' }}>{act.album_id.split(' - ')[1]}</b>
                                                    <span style={{ color: COLORS.accent, marginLeft: '5px' }}>{"★".repeat(act.rating)}</span>
                                                </p>
                                            </div>
                                            <img src={act.image || DEFAULT_IMG} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div>
                                {ratedAlbums.map((log, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '15px', padding: '15px', background: COLORS.surface, borderRadius: '16px', marginBottom: '10px', border: `1px solid ${COLORS.border}` }}>
                                        <img src={log.image} style={{ width: '50px', height: '50px', borderRadius: '8px' }} />
                                        <div>
                                            <b style={{ color: 'white', fontSize: '14px' }}>{log.title}</b>
                                            <p style={{ color: COLORS.accent, fontSize: '12px', margin: '2px 0' }}>{"★".repeat(log.userRating)}</p>
                                            <p style={{ color: COLORS.textMuted, fontSize: '10px' }}>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: fr })}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ONGLET COMPTE */}
                {activeTab === "account" && (
                    <section>
                        {viewedProfile && (
                            <button onClick={() => { setViewedProfile(null); setActiveTab("account"); }} style={{ marginBottom: '20px', background: 'none', border: 'none', color: COLORS.accent, fontWeight: 'bold' }}>← RETOUR À MON PROFIL</button>
                        )}

                        <div style={{ background: COLORS.surface, padding: '30px', borderRadius: '30px', border: `1px solid ${COLORS.border}`, textAlign: 'center', marginBottom: '30px' }}>
                            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: viewedProfile ? '#475569' : `linear-gradient(45deg, ${COLORS.accent}, #ec4899)`, margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '35px', color: 'white', fontWeight: 'bold', border: `4px solid ${COLORS.bg}` }}>
                                {(viewedProfile ? viewedProfile.username : username)[0].toUpperCase()}
                            </div>

                            {viewedProfile ? (
                                <h2 style={{ color: 'white', fontSize: '28px', margin: '0 0 10px 0' }}>@{viewedProfile.username}</h2>
                            ) : (
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '28px', fontWeight: 'bold', textAlign: 'center', width: '100%', outline: 'none' }} />
                            )}

                            {viewedProfile && (
                                <button onClick={toggleFollow} style={{ background: following.includes(viewedProfile.username) ? 'transparent' : 'white', color: following.includes(viewedProfile.username) ? 'white' : 'black', border: following.includes(viewedProfile.username) ? `1px solid ${COLORS.border}` : 'none', padding: '10px 30px', borderRadius: '25px', fontWeight: 'bold', fontSize: '14px', marginBottom: '20px' }}>
                                    {following.includes(viewedProfile.username) ? "ABONNÉ ✓" : "S'ABONNER"}
                                </button>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', margin: '20px 0' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ display: 'block', fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{viewedProfile ? 42 : following.length}</span>
                                    <span style={{ fontSize: '11px', color: COLORS.textMuted }}>ABONNEMENTS</span>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ display: 'block', fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{viewedProfile ? 128 : "0"}</span>
                                    <span style={{ fontSize: '11px', color: COLORS.textMuted }}>ABONNÉS</span>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ display: 'block', fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{viewedProfile ? viewedProfileData.albums.length : ratedAlbums.length}</span>
                                    <span style={{ fontSize: '11px', color: COLORS.textMuted }}>ALBUMS</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ height: '300px', background: COLORS.surface, borderRadius: '24px', padding: '20px', border: `1px solid ${COLORS.border}`, marginBottom: '30px' }}>
                            <h3 style={{ textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: COLORS.textMuted }}>ADN MUSICAL</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={currentDna}>
                                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                    <Radar name="User" dataKey="A" stroke={COLORS.accent} strokeWidth={3} fill={COLORS.accent} fillOpacity={0.3} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        <h3 style={{ fontSize: '14px', color: 'white', marginBottom: '15px' }}>Dernières écoutes</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
                            {(viewedProfile ? viewedProfileData.albums : ratedAlbums).map((a, i) => (
                                <div key={i} onClick={() => setSelectedAlbum(a)} style={{ cursor: 'pointer' }}>
                                    <img src={a.image || DEFAULT_IMG} style={{ width: '100%', borderRadius: '10px', marginBottom: '5px' }} />
                                    <p style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{a.title}</p>
                                    <p style={{ fontSize: '10px', color: COLORS.accent }}>{"★".repeat(a.userRating)}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {activeTab === "search" && (
                    <div>
                        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher..." autoFocus style={{ width: '100%', background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: '20px', borderRadius: '16px', color: 'white', fontSize: '18px', outline: 'none' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '20px', marginTop: '30px' }}>
                            {searchResults.map((album, i) => (
                                <div key={i} onClick={() => setSelectedAlbum(album)} style={{ cursor: 'pointer', textAlign: 'center' }}>
                                    <img src={album.image || DEFAULT_IMG} style={{ width: '100%', borderRadius: '12px' }} />
                                    <p style={{ color: 'white', fontSize: '13px', marginTop: '10px', fontWeight: 'bold' }}>{album.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </main>

            <nav style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '400px', height: '75px', backgroundColor: 'rgba(20,20,20,0.9)', backdropFilter: 'blur(30px)', borderRadius: '40px', border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', zIndex: 1000 }}>
                <button onClick={() => { setActiveTab("discover"); setViewedProfile(null); }} style={{ background: 'none', border: 'none', fontSize: '26px', opacity: activeTab === 'discover' ? 1 : 0.5 }}>🏠</button>
                <button onClick={() => { setActiveTab("search"); setViewedProfile(null); }} style={{ background: 'none', border: 'none', fontSize: '26px', opacity: activeTab === 'search' ? 1 : 0.5 }}>🔍</button>
                <button onClick={() => { setActiveTab("activity"); setViewedProfile(null); }} style={{ background: 'none', border: 'none', fontSize: '26px', opacity: activeTab === 'activity' ? 1 : 0.5, color: activeTab === 'activity' ? COLORS.accent : 'white' }}>⚡</button>
                <button onClick={() => { setActiveTab("account"); setViewedProfile(null); }} style={{ background: 'none', border: 'none', fontSize: '26px', opacity: activeTab === 'account' ? 1 : 0.5 }}>👤</button>
            </nav>
        </div>
    );
}