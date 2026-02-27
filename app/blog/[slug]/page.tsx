import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { mdxComponents } from '@/app/components/mdx/mdxComponents';
import Navbar from '@/app/components/Navbar';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  return {
    title: `${post.title} — Andrew Semchism`,
    description: post.description,
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  return (
    <div>
      <Navbar />
      <main className="pt-[84px]">
        <div className="container mx-auto px-4 max-w-2xl py-16">
          {/* Back link */}
          <Link
            href="/blog"
            className="text-[#7796cb] font-mono text-sm hover:text-[#fbfcff] transition-colors no-underline inline-block mb-8"
          >
            ← Blog
          </Link>

          {/* Post header */}
          <div className="mb-10">
            <p className="text-[#888e9e] font-mono text-sm mb-3">{post.date}</p>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[#7796cb] font-mono text-xs border border-[#7796cb]/40 px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h1 className="text-[#fbfcff] font-sans font-bold text-4xl mb-3">{post.title}</h1>
            <p className="text-[#888e9e] font-sans text-lg">{post.description}</p>
          </div>

          <hr className="border-[#7796cb]/20 mb-10" />

          {/* MDX content */}
          <div className="blog-prose">
            <MDXRemote source={post.content} components={mdxComponents} />
          </div>
        </div>
      </main>
    </div>
  );
}
