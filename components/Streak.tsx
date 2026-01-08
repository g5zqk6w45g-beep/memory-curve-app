"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Streak() {
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStreak();
  }, []);

  const checkStreak = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. On récupère le profil de l'utilisateur
    let { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Si le profil n'existe pas encore (premier jour), on le crée
    if (!profile) {
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert([{ id: user.id, streak: 1, last_visit: new Date().toISOString() }])
        .select()
        .single();
      profile = newProfile;
    }

    if (profile) {
      const lastVisit = new Date(profile.last_visit);
      const today = new Date();
      
      // On remet les heures à zéro pour comparer juste les jours
      lastVisit.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(today.getTime() - lastVisit.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let newStreak = profile.streak;

      // SCÉNARIO 1 : C'est la première fois aujourd'hui
      if (diffDays === 0) {
        // Rien à faire, déjà compté
      } 
      // SCÉNARIO 2 : C'était hier
      else if (diffDays === 1) {
        newStreak += 1;
        await updateStreak(user.id, newStreak);
      } 
      // SCÉNARIO 3 : C'était il y a longtemps (> 1 jour)
      else {
        // Règle "assiduité" : on remet à 1 car tu es là aujourd'hui
        newStreak = 1; 
        await updateStreak(user.id, newStreak);
      }

      setStreak(newStreak);
      setLoading(false);
    }
  };

  const updateStreak = async (userId: string, newCount: number) => {
    await supabase.from("profiles").upsert({
      id: userId,
      streak: newCount,
      last_visit: new Date().toISOString(),
    });
  };

  if (loading) return <span className="text-xs">...</span>;

  return (
    <div className="flex items-center gap-2 bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-bold text-sm border border-orange-200 shadow-sm w-fit">
      <span>🔥</span>
      <span>{streak} {streak > 1 ? "jours" : "jour"}</span>
    </div>
  );
}