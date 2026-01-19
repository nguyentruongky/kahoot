import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center px-6">
      {/* Header */}
      <h1 className="text-5xl md:text-6xl font-extrabold text-white drop-shadow-lg mb-6 text-center">
        Quizza 🎯
      </h1>

      {/* Subtitle */}
      <p className="text-xl md:text-2xl text-white/90 font-light text-center max-w-2xl mb-10">
        Challenge yourself with fun, fast-paced quiz questions. Test your
        knowledge — compete, learn, and enjoy!
      </p>
    </div>
  );
}
