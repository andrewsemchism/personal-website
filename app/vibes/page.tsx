import Link from 'next/link';

export default function Vibes() {
  return (
    <div className="min-h-screen pt-8">
      <div className="container mx-auto px-4">
        <p className="text-[#888e9e] font-sans text-lg mb-6">
          Playground for vibe coding and randomness
        </p>
        <div className="space-y-2">
          <div>
            <Link href="/vibes/whiteboard" className="text-[#7796cb] font-sans text-lg hover:text-[#fbfcff] no-underline">
              Whiteboard
            </Link>
          </div>
          <div>
            <Link href="/vibes/throw-dart-on-earth" className="text-[#7796cb] font-sans text-lg hover:text-[#fbfcff] no-underline">
              Throw Dart on Earth
            </Link>
          </div>
          <div>
            <Link href="/vibes/weber" className="text-[#7796cb] font-sans text-lg hover:text-[#fbfcff] no-underline">
              Weber Catcher
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
