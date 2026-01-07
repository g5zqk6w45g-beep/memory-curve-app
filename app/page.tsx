"use client";
import { useState, useEffect } from "react";

type Topic = {
  id: number;
  title: string;
  stage: number;
  next_review: string;
};

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Chargement depuis la mémoire du navigateur
  useEffect(() => {
    const saved = localStorage.getItem("my-courses");
    if (saved) {
      setTopics(JSON.parse(saved));
    }
    setIsLoaded(true);
  }, []);

  // Sauvegarde automatique
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("my-courses", JSON.stringify(topics));
    }
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
    };

    setTopics([newTopic, ...topics]);
    setInputVal("");
  };

  const reviewCourse = (id: number) => {
    setTopics(topics.map(topic => {
      if (topic.id === id) {
        let daysToAdd = 1;
        if (topic.stage === 0) daysToAdd = 3;
        if (topic.stage === 1) daysToAdd = 7;
        if (topic.stage === 2) daysToAdd = 14;
        if (topic.stage >= 3) daysToAdd = 30;
        
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addCourse();
  };

  // Tri par date
  const sortedTopics = [...topics].sort((a, b) => a.next_review.localeCompare(b.next_review));

  if (!isLoaded) return <div className="p-10 text-center">Chargement...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      <div className="max-w-xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-indigo-600 mb-2">🧠 Memory Curve</h1>
          <p className="text-gray-600">Version Locale</p>
        </header>

        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nouveau cours..."
            className="flex-1 p-3 border-2 border-indigo-100 rounded-xl focus:outline-none focus:border-indigo-500"
          />
          <button onClick={addCourse} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700">
            +
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-bold mb-4">📅 À réviser</h2>
          <ul className="space-y-3">
            {sortedTopics.map((topic) => {
              const today = new Date().toISOString().split("T")[0];
              const isUrgent = topic.next_review <= today;
              return (
                <li key={topic.id} className={`flex justify-between items-center p-4 rounded-xl border ${isUrgent ? 'bg-orange-50 border-orange-200' : 'bg-gray-50'}`}>
                  <div>
                    <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                    <p className="text-xs text-gray-500">Niveau {topic.stage} • {topic.next_review}</p>
                  </div>
                  {isUrgent && (
                    <button onClick={() => reviewCourse(topic.id)} className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-600 transition">
                      ✅
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {sortedTopics.length === 0 && <p className="text-center text-gray-400 mt-4">Rien à faire !</p>}
        </div>
      </div>
    </div>
  );
}