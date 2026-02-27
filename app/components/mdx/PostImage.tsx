import Image from 'next/image';

interface PostImageProps {
  src: string;
  alt: string;
  caption?: string;
}

export default function PostImage({ src, alt, caption }: PostImageProps) {
  return (
    <figure className="my-6">
      <div className="relative w-full">
        <Image
          src={src}
          alt={alt}
          width={800}
          height={450}
          className="w-full h-auto rounded"
          style={{ objectFit: 'contain' }}
        />
      </div>
      {caption && (
        <figcaption className="text-center text-[#888e9e] font-mono text-sm mt-2">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
