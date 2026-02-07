"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

// --- CONFIGURATION ---
const COLORS = {
    bg: '#0a0c0f',
    surface: 'rgba(255, 255, 255, 0.03)',
    accent: '#f97316',
    textMuted: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.1)',
};
const DEFAULT_IMG = "https://via.placeholder.com/300/1b2228/f97316?text=No+Cover";
const GENRES = ["Rap", "Pop", "Rock", "Electro", "R&B", "Jazz", "Metal", "Classique", "Variété"];

export default function Home() {
    // --- ETATS ---
    const [session, setSession] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [authMode, setAuthMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [newUsername, setNewUsername] = useState("");
    const [loading, setLoading] = useState(false);

    const [activeTab, setActiveTab] = useState("discover");
    const [profileTab, setProfileTab] = useState("rated");
    const [subTabActivity, setSubTabActivity] = useState("friends");

    // DATA PRINCIPALE (Venant de la DB)
    const [library, setLibrary] = useState<any[]>([]); // Contient TOUT (Rated, Watchlist, Top4)

    // SOCIAL
    const [myFollows, setMyFollows] = useState<string[]>([]);
    const [followersCount, setFollowersCount] = useState(0);
    const [viewedProfile, setViewedProfile] = useState<any>(null);
    const [viewedLibrary, setViewedLibrary] = useState<any[]>([]); // La bibliothèque de l'ami qu'on regarde
    const [userQuery, setUserQuery] = useState("");
    const [userSearchResults, setUserSearchResults] = useState<any[]>([]);

    // APP DATA
    const [trending, setTrending] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [query, setQuery] = useState("");
    const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
    const [albumDetails, setAlbumDetails] = useState<any>(null);
    const [communityComments, setCommunityComments] = useState<any[]>([]);
    const [friendsActivity, setFriendsActivity] = useState<any[]>([]);

    // ACTIONS STATES
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState("");
    const [selectedGenre, setSelectedGenre] = useState("Pop");
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [replyText, setReplyText] = useState("");
    const [likedComments, setLikedComments] = useState<number[]>([]);

    const audioRef = useRef<HTMLAudioElement>(null);
    const [playingUri, setPlayingUri] = useState<string | null>(null);

    // --- INIT & AUTH ---
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) initUser(session.user.id, session.user.email);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) initUser(session.user.id, session.user.email);
            else { setProfile(null); setLibrary([]); setMyFollows([]); }
        });
        return () => subscription.unsubscribe();
    }, []);

    const initUser = async (userId: string, userEmail: string) => {
        // 1. Profil
        let { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!p) {
            const autoUsername = userEmail.split('@')[0] + Math.floor(Math.random() * 1000);
            const { data: newProfile } = await supabase.from('profiles').insert([
                { id: userId, username: autoUsername, avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${autoUsername}` }
            ]).select().single();
            if (newProfile) p = newProfile;
        }
        if (p) setProfile(p);

        // 2. Charger la Bibliothèque (Cloud Save)
        const { data: lib } = await supabase.from('library').select('*').eq('user_id', userId);
        if (lib) setLibrary(lib);

        // 3. Socials
        fetchMySocials(userId);
    };

    const fetchMySocials = async (userId: string) => {
        const { data: following } = await supabase.from('follows').select('following_username').eq('follower_id', userId);
        if (following) {
            const follows = following.map(f => f.following_username);
            setMyFollows(follows);
            fetchFriendsActivity(follows);
        }
    };

    // --- DERIVED STATE (Pour l'affichage facile) ---
    const myRated = useMemo(() => library.filter(x => x.rating > 0), [library]);
    const myWatchlist = useMemo(() => library.filter(x => x.is_watchlist), [library]);
    const myTop4 = useMemo(() => library.filter(x => x.is_top4).slice(0, 4), [library]);

    const viewedRated = useMemo(() => viewedLibrary.filter(x => x.rating > 0), [viewedLibrary]);
    const viewedWatchlist = useMemo(() => viewedLibrary.filter(x => x.is_watchlist), [viewedLibrary]);
    const viewedTop4 = useMemo(() => viewedLibrary.filter(x => x.is_top4).slice(0, 4), [viewedLibrary]);

    // --- ACTIONS SYSTEME (CLOUD SAVE) ---
    // Cette fonction gère TOUTES les sauvegardes (Rating, Watchlist, Top4)
    const updateLibraryItem = async (album: any, updates: any) => {
        if (!session || !profile) return alert("Connecte-toi !");

        const albumKey = `${album.artist} - ${album.title}`;

        // On cherche si l'item existe déjà dans le state local
        const existingItem = library.find(x => x.album_key === albumKey);

        const newItem = {
            user_id: session.user.id,
            album_key: albumKey,
            title: album.title,
            artist: album.artist,
            image: album.image || DEFAULT_IMG,
            genre: existingItem?.genre || "Pop", // Garde l'ancien genre si pas précisé
            rating: existingItem?.rating || 0,
            is_watchlist: existingItem?.is_watchlist || false,
            is_top4: existingItem?.is_top4 || false,
            ...updates // Ecrase avec les nouvelles valeurs
        };

        // Optimistic UI Update (Mise à jour immédiate à l'écran)
        if (existingItem) {
            setLibrary(library.map(x => x.album_key === albumKey ? { ...x, ...updates } : x));
        } else {
            setLibrary([...library, newItem]);
        }

        // Envoi à Supabase
        const { error } = await supabase.from('library').upsert(newItem, { onConflict: 'user_id, album_key' });
        if (error) console.error("Erreur sauvegarde", error);
    };

    const handleRate = async () => {
        await updateLibraryItem(selectedAlbum, { rating: rating, review: review, genre: selectedGenre });
        // En plus, on ajoute un commentaire public
        await supabase.from('comments').insert([{
            album_id: `${selectedAlbum.artist} - ${selectedAlbum.title}`,
            username: profile.username, content: review, rating, image: selectedAlbum.image || DEFAULT_IMG, likes: 0
        }]);
        fetchSupabaseComments(selectedAlbum);
        setReview("");
        alert("Note sauvegardée !");
    };

    const toggleWatchlist = (e: any, album: any) => {
        e.stopPropagation();
        const current = library.find(x => x.album_key === `${album.artist} - ${album.title}`);
        const isW = current?.is_watchlist || false;
        updateLibraryItem(album, { is_watchlist: !isW });
    };

    const toggleTopFour = (album: any) => {
        const current = library.find(x => x.album_key === `${album.artist} - ${album.title}`);
        const isT = current?.is_top4 || false;

        if (!isT && myTop4.length >= 4) return alert("Top 4 complet ! Retire un album d'abord.");
        updateLibraryItem(album, { is_top4: !isT });
    };

    // --- SOCIAL FETCHERS ---
    const loadUserProfile = async (targetUsername: string) => {
        if (profile && targetUsername === profile.username) { setViewedProfile(null); setActiveTab("account"); return; }

        // 1. Trouver l'ID du user grâce à son pseudo
        const { data: userProfile } = await supabase.from('profiles').select('id, username, avatar_url').eq('username', targetUsername).single();

        if (userProfile) {
            // 2. Charger SA bibliothèque
            const { data: lib } = await supabase.from('library').select('*').eq('user_id', userProfile.id);
            setViewedLibrary(lib || []);

            // 3. Charger ses followers
            const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_username', targetUsername);

            setViewedProfile({ ...userProfile, followers: count });
            setActiveTab("account");
        }
    };

    const fetchFriendsActivity = async (follows: string[]) => {
        if (follows.length === 0) { setFriendsActivity([]); return; }
        const { data } = await supabase.from('comments').select('*').in('username', follows).order('created_at', { ascending: false }).limit(30);
        if (data) setFriendsActivity(data);
    };

    useEffect(() => {
        if (activeTab === "activity" && subTabActivity === "friends" && myFollows.length > 0) {
            fetchFriendsActivity(myFollows);
        }
    }, [activeTab, subTabActivity, myFollows]);

    // --- OTHER EFFECTS ---
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (userQuery.length > 2) {
                const { data } = await supabase.from('profiles').select('*').ilike('username', `%${userQuery}%`).limit(5);
                if (data) setUserSearchResults(data);
            } else setUserSearchResults([]);
        }, 400);
        return () => clearTimeout(timer);
    }, [userQuery]);

    useEffect(() => {
        if (profile?.username) {
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_username', profile.username)
                .then(({ count }) => setFollowersCount(count || 0));
        }
    }, [profile]);

    useEffect(() => { fetch(`/api/search`).then(res => res.json()).then(data => setTrending(data.slice(0, 60))).catch(() => { }); }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 2) fetch(`/api/search?query=${encodeURIComponent(query)}`).then(r => r.json()).then(setSearchResults);
            else setSearchResults([]);
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    // Auth & Logout
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true);
        if (authMode === "login") {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) alert(error.message);
        } else {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) alert(error.message);
            else if (data.user) {
                await supabase.from('profiles').insert([{ id: data.user.id, username: newUsername, avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUsername}` }]);
                alert("Compte créé !"); setAuthMode("login");
            }
        }
        setLoading(false);
    };
    const handleLogout = async () => { await supabase.auth.signOut(); setLibrary([]); setMyFollows([]); };

    const toggleFollow = async (targetUsername: string) => {
        if (!session || !profile) return alert("Connecte-toi !");
        if (myFollows.includes(targetUsername)) {
            const { error } = await supabase.from('follows').delete().match({ follower_id: session.user.id, following_username: targetUsername });
            if (!error) setMyFollows(myFollows.filter(u => u !== targetUsername));
        } else {
            const { error } = await supabase.from('follows').insert([{ follower_id: session.user.id, following_username: targetUsername }]);
            if (!error) setMyFollows([...myFollows, targetUsername]);
        }
    };

    const saveReply = async (parent: any) => {
        if (!replyText.trim()) return;
        const { error } = await supabase.from('comments').insert([{ album_id: `${selectedAlbum.artist} - ${selectedAlbum.title}`, username: profile.username, content: replyText, rating: 0, parent_id: parent.id, image: selectedAlbum.image || DEFAULT_IMG, likes: 0 }]);
        if (!error) { setReplyTo(null); setReplyText(""); fetchSupabaseComments(selectedAlbum); }
    };

    const handleLike = async (id: number, currentLikes: number) => {
        if (!session) return alert("Connecte-toi !");
        if (likedComments.includes(id)) return;
        setCommunityComments(prev => prev.map(c => c.id === id ? { ...c, likes: (c.likes || 0) + 1 } : c));
        setLikedComments([...likedComments, id]);
        await supabase.from('comments').update({ likes: (currentLikes || 0) + 1 }).eq('id', id);
    };

    const fetchSupabaseComments = async (album: any) => {
        const { data } = await supabase.from('comments').select('*').eq('album_id', `${album.artist} - ${album.title}`).order('created_at', { ascending: false });
        if (data) setCommunityComments(data);
    };
    useEffect(() => { if (selectedAlbum) fetchSupabaseComments(selectedAlbum); }, [selectedAlbum]);

    const generateDna = (albums: any[]) => GENRES.map(g => ({ subject: g, A: albums.reduce((acc, a) => (a.genre === g ? acc + 1 : acc), 0) || 1, fullMark: albums.length || 1 }));
    const currentDna = useMemo(() => generateDna(viewedProfile ? viewedRated : myRated), [myRated, viewedRated, viewedProfile]);
    const dailyDrop = useMemo(() => trending.length > 0 ? trending[new Date().getDate() % trending.length] : null, [trending]);
    const badges = [{ name: "Novice", icon: "🎵", threshold: 1 }, { name: "Passionné", icon: "🔥", threshold: 10 }, { name: "Expert", icon: "💿", threshold: 25 }, { name: "Légende", icon: "👑", threshold: 50 }];
    const playPreview = (url: string) => { if (!url) return; if (playingUri === url) { audioRef.current?.pause(); setPlayingUri(null); } else { setPlayingUri(url); if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); } } };

    const albumStats = useMemo(() => {
        if (communityComments.length === 0) return { avg: "—", distribution: [0, 0, 0, 0, 0] };
        const ratings = communityComments.filter(c => c.rating > 0).map(c => c.rating);
        const total = ratings.length;
        if (total === 0) return { avg: "—", distribution: [0, 0, 0, 0, 0] };
        const sum = ratings.reduce((a, b) => a + b, 0);
        const avg = (sum / total).toFixed(1);
        const counts = [0, 0, 0, 0, 0];
        ratings.forEach(r => { if (r >= 1 && r <= 5) counts[r - 1]++; });
        const maxCount = Math.max(...counts);
        const distribution = counts.map(c => maxCount > 0 ? (c / maxCount) * 100 : 0);
        return { avg, distribution, total };
    }, [communityComments]);

    // --- RENDER ---
    return (
        <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>

            {!session && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ width: '80px', height: '80px', background: `linear-gradient(45deg, ${COLORS.accent}, #fb7185)`, borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white', fontWeight: 'bold', marginBottom: '30px' }}>MB</div>
                    <h1 style={{ color: 'white', marginBottom: '30px' }}>MUSICBOX</h1>
                    <form onSubmit={handleAuth} style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {authMode === 'signup' && <input placeholder="Pseudo" value={newUsername} onChange={e => setNewUsername(e.target.value)} style={{ padding: '15px', borderRadius: '8px' }} required />}
                        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '15px', borderRadius: '8px' }} required />
                        <input placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '15px', borderRadius: '8px' }} required />
                        <button type="submit" disabled={loading} style={{ padding: '15px', background: COLORS.accent, color: 'white', borderRadius: '8px', border: 'none' }}>{loading ? "..." : (authMode === 'login' ? "Connexion" : "Inscription")}</button>
                    </form>
                    <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} style={{ marginTop: '20px', background: 'none', border: 'none', color: COLORS.accent }}>{authMode === 'login' ? "Créer un compte" : "J'ai déjà un compte"}</button>
                </div>
            )}

            <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '60px', backgroundColor: 'rgba(10,12,15,0.9)', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <h1 style={{ color: 'white', fontSize: '16px', fontWeight: 'bold', letterSpacing: '4px' }}>MUSICBOX</h1>
            </header>

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 20px 120px' }}>

                {/* DISCOVER */}
                {activeTab === 'discover' && (
                    <div>
                        {dailyDrop && (
                            <div onClick={() => setSelectedAlbum(dailyDrop)} style={{ marginBottom: '30px', position: 'relative', height: '180px', borderRadius: '20px', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${COLORS.border}` }}>
                                <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${dailyDrop.image})`, backgroundSize: 'cover', filter: 'blur(20px) brightness(0.5)' }} />
                                <div style={{ position: 'absolute', inset: 0, padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <img src={dailyDrop.image} style={{ height: '140px', borderRadius: '10px' }} />
                                    <div><span style={{ background: COLORS.accent, color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '10px' }}>DAILY DROP</span><h2 style={{ color: 'white' }}>{dailyDrop.title}</h2></div>
                                </div>
                            </div>
                        )}
                        <h3>Tendances</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
                            {trending.map((a, i) => (
                                <div key={i} onClick={() => setSelectedAlbum(a)} style={{ cursor: 'pointer' }}>
                                    <img src={a.image || DEFAULT_IMG} style={{ width: '100%', borderRadius: '10px' }} />
                                    <p style={{ fontSize: '12px', color: 'white', marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ACTIVITY */}
                {activeTab === 'activity' && (
                    <div>
                        <div style={{ marginBottom: '30px' }}>
                            <h2 style={{ color: 'white', fontSize: '24px', marginBottom: '15px' }}>Activité</h2>
                            <input value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="🔍 Trouver un ami (pseudo)..." style={{ width: '100%', padding: '15px', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                            {userSearchResults.length > 0 && (
                                <div style={{ marginTop: '10px', background: COLORS.surface, borderRadius: '12px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                                    {userSearchResults.map(u => (
                                        <div key={u.id} style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <img src={u.avatar_url} style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
                                                <b style={{ color: 'white' }} onClick={() => loadUserProfile(u.username)}>@{u.username}</b>
                                            </div>
                                            {u.username !== profile?.username && (
                                                <button onClick={() => toggleFollow(u.username)} style={{ fontSize: '12px', padding: '5px 15px', borderRadius: '15px', background: myFollows.includes(u.username) ? 'transparent' : 'white', color: myFollows.includes(u.username) ? 'white' : 'black', border: myFollows.includes(u.username) ? `1px solid ${COLORS.border}` : 'none' }}>
                                                    {myFollows.includes(u.username) ? "Abonné" : "Suivre"}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: `1px solid ${COLORS.border}` }}>
                            <button onClick={() => setSubTabActivity('friends')} style={{ padding: '10px 0', background: 'none', border: 'none', color: subTabActivity === 'friends' ? 'white' : COLORS.textMuted, fontWeight: 'bold', borderBottom: subTabActivity === 'friends' ? `2px solid ${COLORS.accent}` : 'none', cursor: 'pointer' }}>AMIS</button>
                            <button onClick={() => setSubTabActivity('personal')} style={{ padding: '10px 0', background: 'none', border: 'none', color: subTabActivity === 'personal' ? 'white' : COLORS.textMuted, fontWeight: 'bold', borderBottom: subTabActivity === 'personal' ? `2px solid ${COLORS.accent}` : 'none', cursor: 'pointer' }}>MOI</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {subTabActivity === 'friends' ? (
                                friendsActivity.length > 0 ? friendsActivity.map((a, i) => (
                                    <div key={i} style={{ background: COLORS.surface, padding: '20px', borderRadius: '16px', border: `1px solid ${COLORS.border}`, display: 'flex', gap: '15px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>{a.username[0].toUpperCase()}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                <b onClick={() => loadUserProfile(a.username)} style={{ color: 'white', cursor: 'pointer', fontSize: '15px' }}>@{a.username}</b>
                                                <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: fr })}</span>
                                            </div>
                                            <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '0 0 10px 0' }}>a écouté <span style={{ color: 'white', fontWeight: 'bold' }}>{a.album_id.split(' - ')[1]}</span></p>
                                            {a.content && <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', borderLeft: `3px solid ${COLORS.accent}`, marginBottom: '10px' }}><p style={{ color: 'white', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>"{a.content}"</p></div>}
                                            <div style={{ fontSize: '14px', color: COLORS.accent }}>{"★".repeat(a.rating)}</div>
                                        </div>
                                        <img src={a.image || DEFAULT_IMG} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                                    </div>
                                )) : <p style={{ textAlign: 'center', color: COLORS.textMuted }}>Aucune activité récente.</p>
                            ) : (
                                myRated.length > 0 ? myRated.map((a, i) => (
                                    <div key={i} style={{ background: COLORS.surface, padding: '15px', borderRadius: '16px', border: `1px solid ${COLORS.border}`, display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <img src={a.image} style={{ width: '50px', height: '50px', borderRadius: '8px' }} />
                                        <div><b style={{ color: 'white', fontSize: '14px' }}>{a.title}</b><div style={{ color: COLORS.accent, fontSize: '12px' }}>{"★".repeat(a.rating)}</div></div>
                                    </div>
                                )) : <p style={{ textAlign: 'center', color: COLORS.textMuted }}>Tu n'as encore rien noté.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ACCOUNT */}
                {activeTab === 'account' && (viewedProfile || profile) && (
                    <div>
                        {viewedProfile && <button onClick={() => { setViewedProfile(null); setActiveTab("account"); }} style={{ color: COLORS.accent, background: 'none', border: 'none', marginBottom: '20px' }}>← Retour</button>}
                        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: COLORS.accent, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white', fontWeight: 'bold' }}>{(viewedProfile?.username || profile.username)[0].toUpperCase()}</div>
                            <h2 style={{ color: 'white' }}>@{viewedProfile?.username || profile.username}</h2>
                            {!viewedProfile && <button onClick={handleLogout} style={{ fontSize: '11px', color: COLORS.textMuted, background: 'none', border: 'none' }}>Se déconnecter</button>}
                            {viewedProfile && (
                                <button onClick={() => toggleFollow(viewedProfile.username)} style={{ marginTop: '10px', padding: '8px 20px', borderRadius: '20px', background: myFollows.includes(viewedProfile.username) ? 'transparent' : 'white', color: myFollows.includes(viewedProfile.username) ? 'white' : 'black', border: `1px solid ${myFollows.includes(viewedProfile.username) ? 'white' : 'transparent'}`, fontWeight: 'bold' }}>{myFollows.includes(viewedProfile.username) ? "Abonné" : "S'abonner"}</button>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '20px' }}>
                                <div><b style={{ color: 'white', fontSize: '18px' }}>{viewedProfile ? 0 : myFollows.length}</b><br /><span style={{ fontSize: '11px' }}>ABONNEMENTS</span></div>
                                <div><b style={{ color: 'white', fontSize: '18px' }}>{viewedProfile ? viewedProfile.followers : followersCount}</b><br /><span style={{ fontSize: '11px' }}>ABONNÉS</span></div>
                                <div><b style={{ color: 'white', fontSize: '18px' }}>{(viewedProfile ? viewedRated : myRated).length}</b><br /><span style={{ fontSize: '11px' }}>ALBUMS</span></div>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' }}>Top 4 Favoris</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '30px' }}>
                            {(viewedProfile ? viewedTop4 : myTop4).concat(Array(4).fill(null)).slice(0, 4).map((a, i) => (
                                <div key={i} style={{ aspectRatio: '1/1', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: `1px dashed ${COLORS.border}`, overflow: 'hidden' }}>
                                    {a && <img src={a.image} onClick={() => setSelectedAlbum(a)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />}
                                </div>
                            ))}
                        </div>

                        <div style={{ height: '250px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', marginBottom: '30px' }}>
                            <ResponsiveContainer width="100%" height="100%"><RadarChart cx="50%" cy="50%" outerRadius="70%" data={currentDna}><PolarGrid stroke="rgba(255,255,255,0.1)" /><PolarAngleAxis dataKey="subject" tick={{ fill: COLORS.textMuted, fontSize: 10 }} /><PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} /><Radar name="User" dataKey="A" stroke={COLORS.accent} strokeWidth={3} fill={COLORS.accent} fillOpacity={0.3} /></RadarChart></ResponsiveContainer>
                        </div>

                        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: `1px solid ${COLORS.border}` }}>
                            <button onClick={() => setProfileTab('rated')} style={{ padding: '10px', background: 'none', border: 'none', color: profileTab === 'rated' ? 'white' : COLORS.textMuted, borderBottom: profileTab === 'rated' ? `2px solid ${COLORS.accent}` : 'none' }}>Albums Notés</button>
                            {!viewedProfile && <button onClick={() => setProfileTab('watchlist')} style={{ padding: '10px', background: 'none', border: 'none', color: profileTab === 'watchlist' ? 'white' : COLORS.textMuted, borderBottom: profileTab === 'watchlist' ? `2px solid ${COLORS.accent}` : 'none' }}>Watchlist</button>}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
                            {(profileTab === 'watchlist' && !viewedProfile ? myWatchlist : (viewedProfile ? viewedRated : myRated)).map((a, i) => (
                                <div key={i} onClick={() => setSelectedAlbum(a)} style={{ cursor: 'pointer' }}>
                                    <img src={a.image || DEFAULT_IMG} style={{ width: '100%', borderRadius: '10px' }} />
                                    <p style={{ fontSize: '11px', color: 'white', marginTop: '5px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SEARCH */}
                {activeTab === 'search' && (
                    <div>
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un album..." style={{ width: '100%', padding: '20px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${COLORS.border}`, borderRadius: '15px', color: 'white', fontSize: '18px', outline: 'none' }} autoFocus />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '20px', marginTop: '20px' }}>
                            {searchResults.map((a, i) => (
                                <div key={i} onClick={() => setSelectedAlbum(a)} style={{ cursor: 'pointer' }}>
                                    <img src={a.image || DEFAULT_IMG} style={{ width: '100%', borderRadius: '10px' }} />
                                    <p style={{ fontSize: '12px', color: 'white', marginTop: '5px' }}>{a.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </main>

            {/* MODAL ALBUM */}
            {selectedAlbum && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#0a0c0f', overflowY: 'auto' }}>
                    <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${selectedAlbum.image})`, backgroundSize: 'cover', filter: 'blur(50px) brightness(0.2)', zIndex: -1 }} />
                    <audio ref={audioRef} onEnded={() => setPlayingUri(null)} />
                    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                        <button onClick={() => setSelectedAlbum(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginBottom: '20px' }}>✕ Fermer</button>
                        <div style={{ textAlign: 'center' }}>
                            <img src={selectedAlbum.image} style={{ width: '200px', borderRadius: '15px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} />
                            <h2 style={{ color: 'white', margin: '20px 0 5px' }}>{selectedAlbum.title}</h2>
                            <p style={{ color: COLORS.accent }}>{selectedAlbum.artist}</p>

                            {/* STATS LETTERBOXD */}
                            <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ fontSize: '30px', fontWeight: 'bold', color: 'white' }}>{albumStats.avg}</span>
                                    <br /><span style={{ fontSize: '10px', color: COLORS.textMuted }}>MOYENNE</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', height: '40px', gap: '5px' }}>
                                    {albumStats.distribution.map((h, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifySelf: 'flex-end' }}>
                                            <div style={{ width: '10px', height: `${h || 1}%`, background: COLORS.accent, borderRadius: '2px 2px 0 0', marginTop: 'auto' }}></div>
                                            <span style={{ fontSize: '8px', color: COLORS.textMuted, marginTop: '2px' }}>{i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0' }}>
                                <button onClick={(e) => toggleWatchlist(e, selectedAlbum)} style={{ padding: '8px 16px', borderRadius: '20px', background: myWatchlist.find(a => a.album_key === `${selectedAlbum.artist} - ${selectedAlbum.title}`) ? COLORS.accent : 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>Watchlist</button>
                                <button onClick={() => toggleTopFour(selectedAlbum)} style={{ padding: '8px 16px', borderRadius: '20px', background: myTop4.find(a => a.album_key === `${selectedAlbum.artist} - ${selectedAlbum.title}`) ? COLORS.accent : 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>Top 4</button>
                            </div>
                        </div>

                        {/* NOTE */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>{[1, 2, 3, 4, 5].map(s => <button key={s} onClick={() => setRating(s)} style={{ fontSize: '30px', background: 'none', border: 'none', color: rating >= s ? COLORS.accent : 'rgba(255,255,255,0.1)' }}>★</button>)}</div>
                            <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', marginBottom: '10px', background: 'black', color: 'white' }}>{GENRES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                            <textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Ton avis..." style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'black', color: 'white', border: 'none' }} />
                            <button onClick={handleRate} style={{ width: '100%', padding: '15px', background: COLORS.accent, border: 'none', borderRadius: '10px', color: 'white', marginTop: '10px', fontWeight: 'bold' }}>PUBLIER</button>
                        </div>

                        {/* COMMENTAIRES */}
                        <div>
                            {communityComments.filter(c => !c.parent_id).map((c, i) => (
                                <div key={i} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: `1px solid ${COLORS.border}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <b onClick={() => { setSelectedAlbum(null); loadUserProfile(c.username); }} style={{ color: COLORS.accent }}>@{c.username}</b>
                                        <span style={{ fontSize: '10px', color: COLORS.textMuted }}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}</span>
                                    </div>
                                    <p style={{ color: 'white', margin: '5px 0' }}>{c.content}</p>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => handleLike(c.id, c.likes)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '12px' }}>❤ {c.likes || 0}</button>
                                        <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: '12px' }}>Répondre</button>
                                    </div>
                                    {replyTo === c.id && <div style={{ marginTop: '10px' }}><input value={replyText} onChange={e => setReplyText(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: 'none', background: 'black', color: 'white' }} autoFocus /><button onClick={() => saveReply(c)} style={{ marginTop: '5px', padding: '5px 10px', background: COLORS.accent, border: 'none', borderRadius: '5px', color: 'white' }}>Envoyer</button></div>}
                                    {communityComments.filter(r => r.parent_id === c.id).map((r, j) => (
                                        <div key={j} style={{ marginLeft: '20px', marginTop: '10px', paddingLeft: '10px', borderLeft: `2px solid ${COLORS.border}` }}>
                                            <b style={{ color: COLORS.textMuted, fontSize: '12px' }}>@{r.username}</b>
                                            <p style={{ color: 'white', fontSize: '13px', margin: '2px 0' }}>{r.content}</p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* NAV BAR */}
            <nav style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', height: '70px', background: 'rgba(20,20,20,0.95)', border: `1px solid ${COLORS.border}`, borderRadius: '35px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 }}>
                <button onClick={() => setActiveTab('discover')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'discover' ? 1 : 0.5 }}>🏠</button>
                <button onClick={() => setActiveTab('search')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'search' ? 1 : 0.5 }}>🔍</button>
                <button onClick={() => setActiveTab('activity')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'activity' ? 1 : 0.5 }}>⚡</button>
                <button onClick={() => setActiveTab('account')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'account' ? 1 : 0.5 }}>👤</button>
            </nav>
        </div>
    );
}