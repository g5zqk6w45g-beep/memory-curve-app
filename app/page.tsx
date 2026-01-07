"use client";
import { useState, useEffect } from "react";

// 1. On met à jour la structure (On ajoute les liens)
type Topic = {
  id: number;
  title: string;
  stage: number;
  next_review: string;
  courseLink?: string;   // Nouveau : Lien vers le cours
  exerciseLink?: string; // Nouveau : Lien vers les exos
};

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [inputVal, setInputVal] = useState("");
  
  // Nouveaux états pour les liens
  const [courseLink, setCourseLink] = useState("");
  const [exoLink, setExoLink] = useState("");

  const [isLoaded, setIsLoaded] = useState(false);
  const [studyingTopic, setStudyingTopic] = useState<Topic | null>(null); // Le cours qu'on révise actuellement

  // Chargement
  useEffect(() => {
    const saved = localStorage.getItem("my-courses");
    if (saved) setTopics(JSON.parse(saved));
    setIsLoaded(true);
  }, []);

  // Sauvegarde
  useEffect(() => {
    if (isLoaded) localStorage.setItem("my-courses", JSON.stringify(topics));
  }, [topics, isLoaded]);

  const addCourse = () => {
    if (inputVal.trim() === "") return;
    
    const date = new Date();
    date.setDate(date.getDate() + 1);

    const newTopic: Topic = {
      id: Date.now(),
      title: inputVal,
      stage: 0,
      next_review: date.toISOString().split("T")[0],
      courseLink: courseLink, // On enregistre le lien cours
      exerciseLink: exoLink,  // On enregistre le lien exos
    };

    setTopics([newTopic, ...topics]);
    // Reset des champs
    setInputVal("");
    setCourseLink("");
    setExoLink("");
  };

  const reviewCourse = (id: number, difficulty: 'easy' | 'hard') => {
    setTopics(topics.map(topic => {
      if (topic.id === id) {
        let daysToAdd = 1;
        
        // Algorithme ajusté selon la difficulté
        if (difficulty === 'hard') {
           daysToAdd = 1; // Si c'était dur, on revoit demain
        } else {
           if (topic.stage === 0) daysToAdd = 3;
           if (topic.stage === 1) daysToAdd = 7;
           if (topic.stage === 2) daysToAdd = 14;
           if (topic.stage >= 3) daysToAdd = 30;
        }

        const newDate = new Date();
        newDate.setDate(newDate.getDate() + daysToAdd);

        return {
          ...topic,
          stage: topic.stage + 1,
          next_review: newDate.toISOString().split("T")[0]
        };
      }
      return topic;
    }));
    setStudyingTopic(null); // On ferme la fenêtre de révision
  };

  const sortedTopics = [...topics].sort((a, b) => a.next_review.localeCompare(b.next_review));

  if (!isLoaded) return <div className="p-10 text-center">Chargement...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800 relative">
      <div className="max-w-2xl mx-auto">
        
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-indigo-600 mb-2">🧠 Memory Curve</h1>
          <p className="text-gray-600">V2 : Avec documents</p>
        </header>

        {/* --- FORMULAIRE D'AJOUT AMÉLIORÉ --- */}
        <div className="bg-white p-4 rounded-2xl shadow-md mb-8 border border-gray-100">
          <h3 className="font-bold mb-3 text-gray-700">Nouveau sujet</h3>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Titre du cours (ex: Optique Géométrique)..."
              className="p-3 border-2 border-indigo-100 rounded-xl focus:outline-none focus:border-indigo-500"
            />
            
            <div className="flex gap-2">
              <input
                type="text"
                value={courseLink}
                onChange={(e) => setCourseLink(e.target.value)}
                placeholder="🔗 Lien vers le cours (Drive, PDF...)"
                className="flex-1 p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-300"
              />
              <input
                type="text"
                value={exoLink}
                onChange={(e) => setExoLink(e.target.value)}
                placeholder="🔗 Lien vers les exos"
                className="flex-1 p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-300"
              />
            </div>

            <button onClick={addCourse} className="bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition">
              Ajouter au planning
            </button>
          </div>
        </div>

        {/* --- LISTE DES COURS --- */}
        <div className="space-y-3">
          {sortedTopics.map((topic) => {
            const today = new Date().toISOString().split("T")[0];
            const isUrgent = topic.next_review <= today;

            return (
              <div key={topic.id} className={`flex justify-between items-center p-4 rounded-xl border ${isUrgent ? 'bg-white border-l-4 border-l-orange-500 shadow-md' : 'bg-gray-100 opacity-70'}`}>
                <div>
                  <h3 className="font-bold text-gray-800">{topic.title}</h3>
                  <p className="text-xs text-gray-500">
                     {isUrgent ? "🔥 À réviser aujourd'hui" : `📅 Prévu le ${topic.next_review}`}
                  </p>
                </div>
                
                {isUrgent ? (
                  <button 
                    onClick={() => setStudyingTopic(topic)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition"
                  >
                    🚀 Réviser
                  </button>
                ) : (
                  <span className="text-gray-400 text-sm">En attente</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- LE MODE RÉVISION (MODAL) --- */}
      {studyingTopic && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header du modal */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">📚 {studyingTopic.title}</h2>
              <button onClick={() => setStudyingTopic(null)} className="text-gray-400 hover:text-red-500">
                Fermer ✕
              </button>
            </div>

            {/* Corps du modal (Split View) */}
            <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x overflow-hidden">
              
              {/* PARTIE GAUCHE : LE COURS */}
              <div className="flex-1 p-6 overflow-y-auto bg-blue-50/30">
                <h3 className="font-bold text-blue-600 mb-4 flex items-center gap-2">📖 Le Cours</h3>
                {studyingTopic.courseLink ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-600">Document disponible :</p>
                    <a 
                      href={studyingTopic.courseLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block p-4 bg-white border border-blue-200 rounded-xl hover:shadow-md transition text-blue-600 font-medium text-center"
                    >
                      Voir le document de cours ↗
                    </a>
                    {/* Si c'est une image, on essaie de l'afficher */}
                    {(studyingTopic.courseLink.endsWith('.jpg') || studyingTopic.courseLink.endsWith('.png')) && (
                       <img src={studyingTopic.courseLink} alt="Cours" className="rounded-lg shadow-sm mt-2 max-h-60 object-cover" />
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 italic">Aucun lien de cours ajouté.</p>
                )}
              </div>

              {/* PARTIE DROITE : LES EXERCICES */}
              <div className="flex-1 p-6 overflow-y-auto bg-green-50/30">
                <h3 className="font-bold text-green-600 mb-4 flex items-center gap-2">✏️ Exercices</h3>
                {studyingTopic.exerciseLink ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-600">Exercices disponibles :</p>
                    <a 
                      href={studyingTopic.exerciseLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block p-4 bg-white border border-green-200 rounded-xl hover:shadow-md transition text-green-600 font-medium text-center"
                    >
                      Ouvrir la fiche d'exos ↗
                    </a>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">Aucun exercice lié.</p>
                )}
              </div>

            </div>

            {/* Footer : Validation */}
            <div className="p-4 border-t bg-gray-50 flex flex-col items-center gap-2">
              <p className="text-sm text-gray-500 font-medium">Comment s'est passée la révision ?</p>
              <div className="flex gap-3 w-full max-w-md">
                <button 
                  onClick={() => reviewCourse(studyingTopic.id, 'hard')}
                  className="flex-1 py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition"
                >
                  🥵 Difficile
                </button>
                <button 
                  onClick={() => reviewCourse(studyingTopic.id, 'easy')}
                  className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition"
                >
                  ✅ Validé
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}