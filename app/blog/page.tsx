import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';
import Navbar from '@/app/components/Navbar';

export const metadata = {
  title: 'Blog — Andrew Semchism',
  description: 'Blog — Andrew Semchism',
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div>
      <Navbar />
      <main className="pt-[84px]">
        <div className="container mx-auto px-4 max-w-2xl py-16">
          <h1 className="text-[#fbfcff] font-sans font-bold text-3xl mb-10">Blog</h1>
          {posts.length === 0 ? (
            <p className="text-[#888e9e] font-mono text-sm">No posts yet. Check back soon.</p>
          ) : (
            <ul className="space-y-2">
              {posts.map((post) => (
                <li key={post.slug}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 pl-3 border-l-2 border-transparent hover:border-[#7796cb] transition-all py-2 no-underline"
                  >
                    <span className="text-[#888e9e] font-mono text-sm w-28 shrink-0 pt-0.5">
                      {post.date}
                    </span>
                    <div>
                      <p className="text-[#fbfcff] font-sans font-bold group-hover:text-[#7796cb] transition-colors">
                        {post.title}
                      </p>
                      <p className="text-[#888e9e] font-sans text-sm mt-0.5">{post.description}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
