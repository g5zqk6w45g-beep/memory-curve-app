"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type Flashcard = {
  id: number;
  question: string;
  answer: string;
};

type Topic = {
  id: number;
  title: string;
  subject?: string;
  courseLink?: string;
  exerciseLink?: string;
  isActive?: boolean;
  flashcards?: Flashcard[];
  stage: number;
  next_review: string;
};

const SUBJECTS = ["Tout", "Maths", "Méca", "Élec", "Physique", "CGE", "MHO", "Anglais", "Autre"];

export default function LibraryPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filterSubject, setFilterSubject] = useState("Tout");
  const [searchTerm, setSearchTerm] = useState("");

  // Formulaire Ajout Rapide
  const [inputVal, setInputVal] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Maths");
  const [courseLink, setCourseLink] = useState("");
  const [exoLink, setExoLink] = useState("");

  // ÉDITEUR DE FLASHCARDS
  const [flashcardTopic, setFlashcardTopic] = useState<Topic | null>(null);
  const [fcQuestion, setFcQuestion] = useState("");
  const [fcAnswer, setFcAnswer] = useState("");

  // --- MODE RÉVISION (Le Player) ---
  const [studyingTopic, setStudyingTopic] = useState<Topic | null>(null);
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [viewMode, setViewMode] = useState<'docs' | 'cards'>('docs');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("my-courses");
    if (saved) setTopics(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (topics.length > 0) localStorage.setItem("my-courses", JSON.stringify(topics));
  }, [topics]);

  // CHRONO LOGIC
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0) setIsTimerActive(false);
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  // RESET PLAYER AU LANCEMENT
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

  // ACTIONS COURS
  const addArchivedCourse = () => {
    if (inputVal.trim() === "") return;
    const newTopic: Topic = {
      id: Date.now(),
      title: inputVal,
      stage: 0,
      next_review: new Date().toISOString().split("T")[0],
      courseLink: courseLink,
      exerciseLink: exoLink,
      subject: selectedSubject,
      isActive: false,
      flashcards: []
    };
    setTopics([newTopic, ...topics]);
    setInputVal(""); setCourseLink(""); setExoLink("");
  };

  const updateSubject = (id: number, newSubject: string) => {
    setTopics(topics.map(t => t.id === id ? { ...t, subject: newSubject } : t));
  };

  const toggleActive = (id: number) => {
    setTopics(topics.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
  };

  const deleteCourse = (id: number) => {
    if (confirm("Supprimer définitivement ?")) {
      const updatedTopics = topics.filter(t => t.id !== id);
      setTopics(updatedTopics);
      if (updatedTopics.length === 0) localStorage.removeItem("my-courses");
      else localStorage.setItem("my-courses", JSON.stringify(updatedTopics));
    }
  };

  // ACTIONS REVIEW (Validation)
  const reviewCourse = (id: number, difficulty: 'easy' | 'hard') => {
    setTopics(topics.map(t => {
      if (t.id === id) {
        let daysToAdd = 1;
        if (difficulty === 'hard') daysToAdd = 1;
        else {
           if (t.stage === 0) daysToAdd = 2;       
           else if (t.stage === 1) daysToAdd = 7;  
           else if (t.stage === 2) daysToAdd = 14; 
           else daysToAdd = 30;                    
        }
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + daysToAdd);
        const newStage = difficulty === 'hard' ? 0 : t.stage + 1;
        return { ...t, stage: newStage, next_review: newDate.toISOString().split("T")[0] };
      }
      return t;
    }));
    setStudyingTopic(null);
  };

  // ACTIONS FLASHCARDS (Edition & Player)
  const addFlashcard = () => {
    if (!flashcardTopic || !fcQuestion || !fcAnswer) return;
    const newCard: Flashcard = { id: Date.now(), question: fcQuestion, answer: fcAnswer };
    const updatedTopic = { ...flashcardTopic, flashcards: [...(flashcardTopic.flashcards || []), newCard] };
    setTopics(topics.map(t => t.id === flashcardTopic.id ? updatedTopic : t));
    setFlashcardTopic(updatedTopic);
    setFcQuestion(""); setFcAnswer("");
  };

  const deleteFlashcard = (cardId: number) => {
    if (!flashcardTopic) return;
    const updatedTopic = { ...flashcardTopic, flashcards: flashcardTopic.flashcards?.filter(c => c.id !== cardId) };
    setTopics(topics.map(t => t.id === flashcardTopic.id ? updatedTopic : t));
    setFlashcardTopic(updatedTopic);
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

  const filteredTopics = topics.filter(t => {
    const matchesSubject = filterSubject === "Tout" || (t.subject || "Autre") === filterSubject;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col h-auto md:h-screen sticky top-0 z-10">
        <h1 className="text-2xl font-extrabold text-indigo-600 mb-6">🧠 Memory</h1>
        <nav className="space-y-2">
          <Link href="/" className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">🏠 Révisions</Link>
          <Link href="/exams" className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">🎓 Examens</Link>
          <Link href="/library" className="block p-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold transition">📚 Bibliothèque</Link>
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-10 max-w-6xl overflow-y-auto min-h-screen" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url('https://polelrsy.univ-nantes.fr/medias/photo/bu-travail_1669802335851-png')`, backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
        <h2 className="text-3xl font-bold mb-6 relative z-10">📚 Ta Bibliothèque</h2>

        <div className="bg-white/90 backdrop-blur p-5 rounded-2xl shadow-sm border border-gray-200 mb-8 relative z-10">
          <h3 className="font-bold mb-3 text-gray-700">📥 Ajouter un cours</h3>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="Titre..." className="flex-[2] p-3 bg-gray-50 border rounded-xl" />
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="flex-1 p-3 bg-gray-50 border rounded-xl font-bold text-gray-600 cursor-pointer">
                {SUBJECTS.filter(s=>s!=="Tout").map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input type="text" value={courseLink} onChange={(e) => setCourseLink(e.target.value)} placeholder="🔗 Lien Cours" className="flex-1 p-2 text-sm bg-gray-50 border rounded-lg" />
              <input type="text" value={exoLink} onChange={(e) => setExoLink(e.target.value)} placeholder="🔗 Lien Exos" className="flex-1 p-2 text-sm bg-gray-50 border rounded-lg" />
            </div>
            <button onClick={addArchivedCourse} className="bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-900 transition">Ajouter</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 relative z-10">
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(subj => (
              <button key={subj} onClick={() => setFilterSubject(subj)} className={`px-4 py-2 rounded-full text-sm font-bold transition shadow-sm ${filterSubject === subj ? "bg-black text-white" : "bg-white/90 backdrop-blur border border-gray-200 text-gray-600 hover:bg-white"}`}>{subj}</button>
            ))}
          </div>
          <input type="text" placeholder="🔍 Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-3 border rounded-xl w-full md:w-64 shadow-sm outline-none bg-white/90 backdrop-blur" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTopics.map(topic => {
            const isActive = topic.isActive !== false; 
            const flashcardCount = topic.flashcards ? topic.flashcards.length : 0;
            return (
              <div key={topic.id} className={`p-5 rounded-2xl shadow-sm border transition flex flex-col group relative ${isActive ? 'bg-white/95 border-gray-200' : 'bg-gray-100/90 border-gray-200 grayscale-[0.5]'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className={`text-xs font-bold px-2 py-1 rounded uppercase ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>{topic.subject || "Autre"}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(topic.id)} className={`p-1.5 rounded-lg font-bold text-xs transition border ${isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-200 text-gray-600 border-gray-300'}`}>{isActive ? "⚡️" : "💤"}</button>
                    <button onClick={() => setFlashcardTopic(topic)} className="bg-orange-50 hover:bg-orange-100 text-orange-600 p-1.5 rounded-lg border border-orange-200 transition" title="Gérer les Flashcards">
                      🃏 <span className="text-xs font-bold">{flashcardCount}</span>
                    </button>
                    <button onClick={() => deleteCourse(topic.id)} className="text-gray-300 hover:text-red-500 transition p-1">🗑</button>
                  </div>
                </div>
                
                <h3 className={`font-bold text-lg mb-2 flex-1 ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{topic.title}</h3>
                
                <select className="text-xs bg-transparent text-gray-400 outline-none cursor-pointer hover:text-indigo-600 mb-4 w-full" value={topic.subject || "Autre"} onChange={(e) => updateSubject(topic.id, e.target.value)}>
                    <option value="Autre">Changer matière...</option>
                    {SUBJECTS.filter(s => s !== "Tout").map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {/* BOUTON LANCER SESSION */}
                <button 
                  onClick={() => setStudyingTopic(topic)} 
                  className={`w-full py-2.5 rounded-xl font-bold text-sm mb-3 shadow-sm transition ${isActive ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-600 hover:bg-gray-400'}`}
                >
                  🚀 Lancer
                </button>

                <div className="flex gap-2 mt-auto">
                  {topic.courseLink ? <a href={topic.courseLink} target="_blank" className="flex-1 py-2 text-center bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition">📄 Cours</a> : <span className="flex-1 py-2 text-center bg-gray-50 text-gray-300 rounded-lg text-sm">Pas de doc</span>}
                  {topic.exerciseLink ? <a href={topic.exerciseLink} target="_blank" className="flex-1 py-2 text-center bg-green-50 text-green-600 rounded-lg text-sm font-bold hover:bg-green-100 transition">✏️ Exos</a> : <span className="flex-1 py-2 text-center bg-gray-50 text-gray-300 rounded-lg text-sm">Pas d'exos</span>}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL ÉDITEUR FLASHCARDS (Deck Builder) */}
      {flashcardTopic && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-xl font-bold">🃏 Flashcards : {flashcardTopic.title}</h3>
              <button onClick={() => setFlashcardTopic(null)} className="font-bold text-gray-400 hover:text-black">✕</button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
              <input type="text" value={fcQuestion} onChange={(e) => setFcQuestion(e.target.value)} placeholder="Recto : La Question ?" className="w-full p-2 mb-2 border rounded-lg" />
              <input type="text" value={fcAnswer} onChange={(e) => setFcAnswer(e.target.value)} placeholder="Verso : La Réponse..." className="w-full p-2 mb-2 border rounded-lg" />
              <button onClick={addFlashcard} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700">Ajouter la carte</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {flashcardTopic.flashcards && flashcardTopic.flashcards.length > 0 ? (
                flashcardTopic.flashcards.map((card, idx) => (
                  <div key={card.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-800">Q: {card.question}</p>
                      <p className="text-sm text-gray-500">R: {card.answer}</p>
                    </div>
                    <button onClick={() => deleteFlashcard(card.id)} className="text-red-300 hover:text-red-500 ml-2">🗑</button>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 italic mt-4">Aucune carte pour l'instant.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL SESSION DE RÉVISION (Player) */}
      {studyingTopic && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold truncate max-w-[150px]">{studyingTopic.title}</h2>
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
                    {studyingTopic.courseLink ? <iframe src={studyingTopic.courseLink.replace('/view', '/preview')} className="w-full h-full min-h-[400px] border rounded" /> : <p className="italic text-gray-400">Rien</p>}
                    {studyingTopic.courseLink && <a href={studyingTopic.courseLink} target="_blank" className="block text-center mt-2 text-blue-500 underline">Ouvrir lien</a>}
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto">
                     <h3 className="text-green-600 font-bold mb-4">✏️ Exos</h3>
                     {studyingTopic.exerciseLink ? <a href={studyingTopic.exerciseLink} target="_blank" className="block p-4 bg-green-50 border border-green-200 rounded text-green-700 font-bold text-center">Voir Exos</a> : <p className="italic text-gray-400">Rien</p>}
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