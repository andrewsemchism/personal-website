'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface ProjectCardProps {
  imageUrl: string;
  title: string;
  description: string;
  link: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ imageUrl, title, description, link }) => {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <a href={link} target="_blank" rel="noopener noreferrer">
      <div
        className="relative overflow-hidden rounded-[10px] shadow-[0px_3px_10px_rgba(0,0,0,0.2)] mt-2.5"
        onMouseEnter={() => setShowOverlay(true)}
        onMouseLeave={() => setShowOverlay(false)}
      >
        <Image
          className={`w-full h-auto block transition-all duration-300 ${showOverlay ? 'brightness-75' : ''}`}
          src={imageUrl}
          alt={title}
          width={600}
          height={400}
        />
        {showOverlay && (
          <div className="absolute bottom-0 left-0 w-full h-1/2 px-5 py-2.5 bg-black/60 text-white transition-opacity duration-300">
            <h3 className="m-0 text-2xl font-medium">{title}</h3>
            <p className="mt-2.5 mb-0 text-base leading-snug">{description}</p>
          </div>
        )}
      </div>
    </a>
  );
};

export default ProjectCard;
