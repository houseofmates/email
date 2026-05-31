import { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onLogin?.({ email, password });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pkm-900 p-4">
      <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl text-gold lowercase tracking-wide">email</h1>
          <p className="mt-1 text-sm text-text-info lowercase">sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase"
          >
            sign in
          </button>
        </form>
      </div>
    </div>
  );
}
