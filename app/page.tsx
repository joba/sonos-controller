import Link from "next/link";
import Image from "next/image";
import { readConfig } from "@/lib/config";

export default function Home() {
  const { playlists } = readConfig();

  if (playlists.length === 0) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <div className="text-6xl mb-6">🎵</div>
        <h1 className="text-2xl font-bold text-gray-300 mb-2">No playlists yet</h1>
        <p className="text-gray-500">Ask a grown-up to add some music!</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">🎵 Music</h1>
      <div className="grid grid-cols-2 gap-5">
        {playlists.map((playlist) => (
          <Link
            key={playlist.id}
            href={`/playlist/${playlist.id}`}
            className="group block rounded-2xl overflow-hidden bg-gray-800 hover:bg-gray-700 transition-colors active:scale-95 transition-transform"
          >
            <div className="relative aspect-square">
              {playlist.imageUrl ? (
                <Image
                  src={playlist.imageUrl}
                  alt={playlist.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 300px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl bg-gray-700">
                  🎵
                </div>
              )}
            </div>
            <p className="p-3 font-semibold text-center text-sm leading-tight">
              {playlist.name}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
