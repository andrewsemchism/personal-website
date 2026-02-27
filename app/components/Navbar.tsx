'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface NavbarProps {
  scrollHide?: boolean;
}

export default function Navbar({ scrollHide = false }: NavbarProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!scrollHide) return;

    const handleScroll = () => {
      setVisible(window.pageYOffset <= 250);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollHide]);

  const navClass = scrollHide
    ? `fixed top-0 left-0 right-0 bg-[#274156] z-50 ${visible ? 'navbar-show' : 'navbar-hide'}`
    : 'fixed top-0 left-0 right-0 bg-[#274156] z-50';

  return (
    <nav className={navClass}>
      <div className="flex items-center justify-between h-[84px] px-4">
        <div className="pl-6 pt-2">
          <Link href="/">
            <Image
              src="/images/logo.svg"
              width={60}
              height={60}
              className="inline-block align-top"
              alt="Logo"
            />
          </Link>
        </div>
        <div className="flex gap-10 pr-8">
          <a href="/#experience" className="text-[#7796cb] font-sans text-lg font-medium hover:text-[#fbfcff] no-underline">
            EXPERIENCE
          </a>
          <Link href="/blog" className="text-[#7796cb] font-sans text-lg font-medium hover:text-[#fbfcff] no-underline">
            BLOG
          </Link>
          <a href="/#contact" className="text-[#7796cb] font-sans text-lg font-medium hover:text-[#fbfcff] no-underline">
            CONTACT
          </a>
        </div>
      </div>
    </nav>
  );
}
