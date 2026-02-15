'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import TypeIt from 'typeit-react';
import WorkHistory, { Job } from './components/WorkHistory';
import ProjectCard from './components/ProjectCard';

const jobs: Job[] = [
  {
    company: 'Carta',
    title: 'Software Engineer II',
    description: 'Building beautiful frontend infrastructure.',
    startDate: 'July 2025',
    endDate: 'Present',
    logo: '/images/carta-logo.jpg',
  },
  {
    company: 'Gem',
    title: 'Software Engineer',
    description: "Building Gem's new ATS product!",
    startDate: 'Sept. 2024',
    endDate: 'Dec. 2024',
    logo: '/images/gem-logo.png',
  },
  {
    company: 'Carta',
    title: 'Frontend Engineer',
    description: 'Frontend development of <a href="https://carta.com" target="_blank">Carta.com</a>. Working on equity management solutions for LLCs.',
    startDate: 'May 2024',
    endDate: 'Aug. 2024',
    logo: '/images/carta-logo.jpg',
  },
  {
    company: 'Faire',
    title: 'Frontend Engineer',
    description: 'Frontend development of <a href="https://faire.com" target="_blank">Faire.com</a> on the Brand Growth team.',
    startDate: 'Sept. 2023',
    endDate: 'Dec. 2023',
    logo: '/images/faire-logo.jpg',
  },
  {
    company: 'Geotab',
    title: 'Software Developer',
    description: 'At Geotab, I worked on MyGeotab, a web application that allows users to manage their fleet of vehicles. I gained experience with React, TypeScript, C#, and SQL.',
    startDate: 'Jan. 2023',
    endDate: 'Apr. 2023',
    logo: '/images/geotab-logo.jpg',
  },
  {
    company: '1Password',
    title: 'Junior Developer',
    description: 'At 1Password, I honed my React skills and learned to write high-quality, unit-tested code with Jest. Read more about my experience in this <a href="https://blog.1password.com/internship-what-its-like/" target="_blank">1Password blog post.</a>',
    startDate: 'May 2022',
    endDate: 'Aug. 2022',
    logo: '/images/1password-logo.png',
  },
  {
    company: 'Rich Media',
    title: 'Web Developer',
    description: 'At Rich Media, I gained hands-on experience working with HTML, CSS, and JavaScript. I collaborated with designers to create polished, user-friendly web products.',
    startDate: 'May 2021',
    endDate: 'Aug. 2021',
    logo: '/images/richmedia-logo.jpg',
  },
];

export default function Home() {
  const [showNavbar, setShowNavbar] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPosition = window.pageYOffset;
      if (currentScrollPosition > 250) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
    };
    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div>
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 bg-[#274156] z-50 ${showNavbar ? 'navbar-show' : 'navbar-hide'}`}>
        <div className="flex items-center justify-between h-[84px] px-4">
          <div className="pl-6 pt-2">
            <Image
              src="/images/logo.svg"
              width={60}
              height={60}
              className="inline-block align-top"
              alt="Logo"
            />
          </div>
          <div className="flex gap-10 pr-8">
            <a href="#experience" className="text-[#7796cb] font-sans text-lg font-medium hover:text-[#fbfcff] no-underline">
              EXPERIENCE
            </a>
            <a href="#contact" className="text-[#7796cb] font-sans text-lg font-medium hover:text-[#fbfcff] no-underline">
              CONTACT
            </a>
          </div>
        </div>
      </nav>

      <main>
        {/* Title Section */}
        <section className="min-h-screen flex items-center">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-1"></div>
              <div className="lg:col-span-7 xl:col-span-7 mt-10 p-2.5">
                <h2 className="text-[#d0ccd0] font-mono text-xl">Hi, my name is</h2>
                <h1 className="text-[#fbfcff] font-sans font-bold text-[42px] sm:text-[60px]">
                  Andrew Semchism
                </h1>
                <h2 className="text-[#d0ccd0] font-mono text-2xl mb-2">
                  <TypeIt>I love software engineering.</TypeIt>
                </h2>
                <p className="text-[#888e9e] font-sans text-lg">
                  I'm currently on the Frontend Platform team at Carta, diving into frontend infrastructure: module federation, micro-frontends, build tools, monorepos, testing, CI, and whatever new Claude Code feature dropped this week.
                </p>
                <a href="#contact" className="inline-block mt-4">
                  <button className="font-mono text-[#888e9e] border border-[#888e9e] bg-transparent px-4 py-2 rounded hover:bg-[#888e9e]/10 transition-colors">
                    Contact Me
                  </button>
                </a>
                <div className="pt-5 text-[#888e9e]">
                  <a href="https://github.com/andrewsemchism" target="_blank" rel="noopener noreferrer" className="inline-block pr-3.5 hover:-translate-y-1 transition-transform">
                    <FontAwesomeIcon icon={faGithub} size="2xl" />
                  </a>
                  <a href="https://linkedin.com/in/andrew-semchism-11a56a1a4" target="_blank" rel="noopener noreferrer" className="inline-block hover:-translate-y-1 transition-transform">
                    <FontAwesomeIcon icon={faLinkedin} size="2xl" />
                  </a>
                </div>
              </div>
              <div className="hidden md:block lg:col-span-3">
                <Image
                  src="/images/andrew-cartoon.png"
                  alt="Cartoon of Andrew"
                  width={500}
                  height={500}
                />
              </div>
              <div className="lg:col-span-1"></div>
            </div>
          </div>
        </section>

        {/* Experience Section */}
        <section id="experience" className="min-h-[60vh]">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-1"></div>
              <div className="md:col-span-5">
                <h2 className="text-[#d0ccd0] font-mono mb-3.5 text-xl">Work Experience</h2>
                <WorkHistory jobs={jobs} />
              </div>
              <div className="md:col-span-5">
                <h2 className="text-[#d0ccd0] font-mono mb-3.5 text-xl">Featured Project</h2>
                <ProjectCard
                  imageUrl="/images/beerboss.png"
                  title="BeerBoss.ca"
                  description="Ontario Beer Store price optimization."
                  link="https://beerboss.ca/"
                />
              </div>
              <div className="md:col-span-1"></div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="min-h-[30vh] flex items-center py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-1"></div>
              <div className="md:col-span-5">
                <h2 className="text-[#d0ccd0] font-mono mb-3.5 text-xl">Get In Touch</h2>
                <p className="text-[#888e9e] font-sans text-lg">
                  Thank you for visiting my site. If you're interested in learning more about my experience as a software developer or UWaterloo Computer Science student, please don't hesitate to reach out to me via email at andrewsemchism@gmail.com.
                </p>
                <div className="pt-5 text-[#888e9e]">
                  <a href="https://linkedin.com/in/andrew-semchism-11a56a1a4" target="_blank" rel="noopener noreferrer" className="inline-block pr-3.5 hover:-translate-y-1 transition-transform">
                    <FontAwesomeIcon icon={faLinkedin} size="2xl" />
                  </a>
                  <a href="mailto:andrewsemchism@gmail.com" target="_blank" rel="noopener noreferrer" className="inline-block hover:-translate-y-1 transition-transform">
                    <FontAwesomeIcon icon={faEnvelope} size="2xl" />
                  </a>
                </div>
              </div>
              <div className="md:col-span-5"></div>
              <div className="md:col-span-1"></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
