"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Basculer entre Connexion et Inscription
  const router = useRouter();

  const handleAuth = async () => {
    setLoading(true);
    let error = null;

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) error = signUpError;
      else alert("Compte créé ! Tu peux te connecter.");
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) error = signInError;
      else {
        // Connexion réussie -> On va sur l'accueil
        router.push("/");
      }
    }

    if (error) alert("Erreur : " + error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <h1 className="text-3xl font-extrabold text-indigo-600 mb-2 text-center">🧠 Memory</h1>
        <p className="text-gray-500 text-center mb-8">
          {isSignUp ? "Créer un compte pour sauvegarder" : "Connecte-toi pour accéder à tes cours"}
        </p>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 transition"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 transition"
          />

          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Chargement..." : isSignUp ? "S'inscrire" : "Se connecter"}
          </button>
        </div>

        <div className="mt-6 text-center text-sm">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-indigo-500 hover:underline"
          >
            {isSignUp ? "J'ai déjà un compte" : "Pas de compte ? S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  );
}