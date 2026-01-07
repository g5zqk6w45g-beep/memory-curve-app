"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase"; // On importe la connexion
import { useRouter } from "next/navigation"; // Pour rediriger si pas connecté

// On aligne les types avec la Base de Données
type Flashcard = {
  id: number;
  question: string;
  answer: string;
};

type Topic = {
  id: number;
  title: string;
  stage: number;
  next_review: string;
  course_link?: string; // Attention : snake_case comme dans la DB
  exercise_link?: string;
  subject?: string;
  is_active?: boolean;
  flashcards?: Flashcard[];
};

const SUBJECTS = ["Maths", "Méca", "Élec", "Physique", "CGE", "MHO", "Anglais", "Autre"];

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null); // L'utilisateur connecté
  
  const [inputVal, setInputVal] = useState("");
  const [courseLink, setCourseLink] = useState("");
  const [exoLink, setExoLink] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Maths");

  const [studyingTopic, setStudyingTopic] = useState<Topic | null>(null);
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [viewMode, setViewMode] = useState<'docs' | 'cards'>('docs');

  // Flashcard Player State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const router = useRouter();

  // --- 1. VERIFICATION AUTH & CHARGEMENT DONNÉES ---
  useEffect(() => {
    const checkUserAndFetch = async () => {
      // Vérifier l'utilisateur
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login"); // Pas connecté ? Hop, dehors !
        return;
      }
      setUser(user);

      // Charger les données depuis Supabase
      // On ne prend que les cours ACTIFS (is_active = true)
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .eq("is_active", true);

      if (error) console.error("Erreur chargement:", error);
      else setTopics(data || []);
      
      setLoading(false);
    };

    checkUserAndFetch();
  }, [router]);

  // CHRONO LOGIC
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0) setIsTimerActive(false);
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  useEffect(() => {
    if (studyingTopic) { 
      setTimeLeft(20 * 60); 
      setIsTimerActive(false); 
      setViewMode('docs'); 
      setCurrentCardIndex(0);
      setIsFlipped(false);
    }
  }, [studyingTopic]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // --- 2. AJOUTER UN COURS (VERS SUPABASE) ---
  const addCourse = async () => {
    if (inputVal.trim() === "" || !user) return;
    
    const date = new Date();
    date.setDate(date.getDate() + 1);
    
    const newTopic = {
      user_id: user.id, // IMPORTANT : On lie le cours à toi
      title: inputVal,
      stage: 0,
      next_review: date.toISOString().split("T")[0],
      course_link: courseLink,
      exercise_link: exoLink,
      subject: selectedSubject,
      is_active: true, // Actif par défaut sur l'accueil
      flashcards: []
    };

    // Envoi à Supabase
    const { data, error } = await supabase.from("topics").insert([newTopic]).select();

    if (error) {
      alert("Erreur lors de l'ajout !");
      console.error(error);
    } else if (data) {
      // On met à jour l'affichage localement sans recharger la page
      setTopics([data[0], ...topics]);
      setInputVal(""); setCourseLink(""); setExoLink("");
    }
  };

  // --- 3. REVISION (UPDATE SUPABASE) ---
  const reviewCourse = async (id: number, difficulty: 'easy' | 'hard') => {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;

    let daysToAdd = 1;
    let newStage = topic.stage;

    if (difficulty === 'hard') {
       daysToAdd = 1;
       newStage = 0; // Reset si dur
    } else {
       if (topic.stage === 0) daysToAdd = 2;       
       else if (topic.stage === 1) daysToAdd = 7;  
       else if (topic.stage === 2) daysToAdd = 14; 
       else daysToAdd = 30;
       newStage = topic.stage + 1;
    }

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysToAdd);
    const nextReviewStr = newDate.toISOString().split("T")[0];

    // Mise à jour optimiste (Interface)
    setTopics(topics.map(t => t.id === id ? { ...t, stage: newStage, next_review: nextReviewStr } : t));
    setStudyingTopic(null);

    // Mise à jour Réelle (Supabase)
    const { error } = await supabase
      .from("topics")
      .update({ stage: newStage, next_review: nextReviewStr })
      .eq("id", id);

    if (error) console.error("Erreur sauvegarde révision", error);
  };

  const nextCard = () => {
    if (!studyingTopic?.flashcards) return;
    setIsFlipped(false);
    setTimeout(() => {
        if (currentCardIndex < studyingTopic.flashcards!.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
        } else {
            setCurrentCardIndex(0);
        }
    }, 200);
  };

  // Fonction Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const groupedTopics = topics.reduce((acc, t) => {
    if (!acc[t.next_review]) acc[t.next_review] = [];
    acc[t.next_review].push(t);
    return acc;
  }, {} as { [key: string]: Topic[] });
  const sortedDates = Object.keys(groupedTopics).sort();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-indigo-600 font-bold">Chargement de tes données...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col md:flex-row">
      
      <aside className="w-full md:w-80 bg-white border-r border-gray-200 p-6 flex flex-col h-auto md:h-screen sticky top-0 z-10">
        <h1 className="text-2xl font-extrabold text-indigo-600 mb-6">🧠 Memory</h1>
        <nav className="space-y-2 mb-6 border-b border-gray-100 pb-6">
          <Link href="/" className="block p-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold transition">🏠 Révisions</Link>
          <Link href="/exams" className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">🎓 Examens</Link>
          <Link href="/library" className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">📚 Bibliothèque</Link>
        </nav>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {sortedDates.map(date => (
            <div key={date} className={date === new Date().toISOString().split("T")[0] ? 'bg-indigo-50 -mx-4 px-4 py-3 rounded-xl' : ''}>
              <h3 className="font-bold capitalize mb-2">{new Date(date).toLocaleDateString("fr-FR", {weekday:'short', day:'numeric'})}</h3>
              <ul className="space-y-1 pl-3 border-l-2">
                {groupedTopics[date].map(t => (
                  <li key={t.id} onClick={() => setStudyingTopic(t)} className="cursor-pointer text-sm text-gray-500 hover:text-indigo-600 truncate">{t.title}</li>
                ))}
              </ul>
            </div>
          ))}
          {sortedDates.length === 0 && <p className="text-gray-400 text-sm italic">Aucune révision active.</p>}
        </div>
        
        {/* BOUTON DÉCONNEXION */}
        <div className="mt-4 pt-4 border-t">
           <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 text-xs py-3 rounded font-bold hover:bg-red-100 transition">
             Déconnexion
           </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-10 max-w-4xl overflow-y-auto min-h-screen" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url('https://images.unsplash.com/photo-1709496023433-96b349a55946?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE4fHx8ZW58MHx8fHx8')`, backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-gray-200 mb-8">
          <h3 className="font-bold mb-4">➕ Ajouter un sujet (Actif)</h3>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="Titre..." className="flex-[2] p-3 bg-gray-50/50 border rounded-xl" />
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="flex-1 p-3 bg-gray-50/50 border rounded-xl font-bold text-gray-600 cursor-pointer">
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input type="text" value={courseLink} onChange={(e) => setCourseLink(e.target.value)} placeholder="🔗 Lien Cours" className="flex-1 p-2 text-sm bg-gray-50/50 border rounded-lg" />
              <input type="text" value={exoLink} onChange={(e) => setExoLink(e.target.value)} placeholder="🔗 Lien Exos" className="flex-1 p-2 text-sm bg-gray-50/50 border rounded-lg" />
            </div>
            <button onClick={addCourse} className="bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition">Ajouter au planning</button>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">À faire aujourd'hui</h2>
        <div className="grid gap-4">
          {topics.filter(t => t.next_review <= new Date().toISOString().split("T")[0]).map((topic) => (
            <div key={topic.id} className="flex justify-between items-center p-5 bg-white/90 backdrop-blur rounded-xl border border-gray-100 shadow-sm">
              <div>
                <h3 className="font-bold text-lg">{topic.title}</h3>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 mr-2">{topic.subject || "Autre"}</span>
                <span className="text-xs text-orange-500 font-bold">🔥 Urgent</span>
              </div>
              <button onClick={() => setStudyingTopic(topic)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">🚀 GO</button>
            </div>
          ))}
          {topics.filter(t => t.next_review <= new Date().toISOString().split("T")[0]).length === 0 && <div className="text-center py-10 text-gray-500">Rien à faire !</div>}
        </div>
      </main>

      {/* --- MODAL DE RÉVISION --- */}
      {studyingTopic && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold truncate max-w-[150px] md:max-w-xs">{studyingTopic.title}</h2>
                <div className="flex bg-gray-200 p-1 rounded-lg gap-1">
                  <button onClick={() => setViewMode('docs')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${viewMode === 'docs' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}>📄 Docs</button>
                  {studyingTopic.flashcards && studyingTopic.flashcards.length > 0 && (
                    <button onClick={() => setViewMode('cards')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${viewMode === 'cards' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>🃏 Cartes</button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border shadow-sm">
                <span className={`font-mono text-2xl font-bold ${timeLeft < 60 ? 'text-red-500' : ''}`}>{formatTime(timeLeft)}</span>
                <button onClick={() => setIsTimerActive(!isTimerActive)}>{isTimerActive ? '⏸' : '▶'}</button>
              </div>
              <button onClick={() => setStudyingTopic(null)} className="font-bold text-xl px-2">✕</button>
            </div>

            <div className="flex-1 overflow-hidden bg-gray-100 relative">
              {viewMode === 'docs' && (
                <div className="absolute inset-0 flex flex-col md:flex-row divide-x">
                  <div className="flex-1 p-4 overflow-y-auto">
                    <h3 className="text-blue-600 font-bold mb-4">📖 Cours</h3>
                    {studyingTopic.course_link ? <iframe src={studyingTopic.course_link.replace('/view', '/preview')} className="w-full h-full min-h-[400px] border rounded" /> : <p className="italic text-gray-400">Rien</p>}
                    {studyingTopic.course_link && <a href={studyingTopic.course_link} target="_blank" className="block text-center mt-2 text-blue-500 underline">Ouvrir lien</a>}
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto">
                     <h3 className="text-green-600 font-bold mb-4">✏️ Exos</h3>
                     {studyingTopic.exercise_link ? <a href={studyingTopic.exercise_link} target="_blank" className="block p-4 bg-green-50 border border-green-200 rounded text-green-700 font-bold text-center">Voir Exos</a> : <p className="italic text-gray-400">Rien</p>}
                  </div>
                </div>
              )}

              {viewMode === 'cards' && studyingTopic.flashcards && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gray-100">
                  <div onClick={() => setIsFlipped(!isFlipped)} className="w-full max-w-2xl aspect-video bg-white rounded-3xl shadow-xl flex items-center justify-center cursor-pointer hover:shadow-2xl transition transform duration-500 relative" style={{ perspective: "1000px" }}>
                     <div className="text-center p-8">
                        <p className="text-sm text-gray-400 uppercase font-bold tracking-widest mb-4">{isFlipped ? "Verso (Réponse)" : "Recto (Question)"}</p>
                        <h3 className={`text-2xl md:text-4xl font-bold ${isFlipped ? 'text-indigo-600' : 'text-gray-800'}`}>{isFlipped ? studyingTopic.flashcards[currentCardIndex].answer : studyingTopic.flashcards[currentCardIndex].question}</h3>
                        <p className="mt-8 text-gray-400 text-sm animate-pulse">(Clique pour retourner)</p>
                     </div>
                  </div>
                  <div className="mt-8 flex items-center gap-6">
                    <span className="font-mono text-gray-500">Carte {currentCardIndex + 1} / {studyingTopic.flashcards.length}</span>
                    <button onClick={nextCard} className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition shadow-lg">Suivante ➔</button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-center gap-4 bg-white">
               <button onClick={() => reviewCourse(studyingTopic.id, 'hard')} className="px-6 py-3 bg-red-100 text-red-700 font-bold rounded-xl">😰 Dur</button>
               <button onClick={() => reviewCourse(studyingTopic.id, 'easy')} className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl">✅ Fait</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}