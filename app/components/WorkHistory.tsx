'use client';

import React from 'react';
import Image from 'next/image';

export interface Job {
  company: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  logo: string;
}

interface WorkHistoryProps {
  jobs: Job[];
}

const WorkHistory: React.FC<WorkHistoryProps> = ({ jobs }) => {
  return (
    <div className="flex flex-col items-start">
      {jobs.map((job, index) => (
        <div className="flex mb-4 items-start font-sans" key={index}>
          <div className="flex flex-col items-center relative mr-4">
            <div className="w-[50px] h-[50px] rounded-full border-2 border-[#7796cb] overflow-hidden transition-transform hover:scale-110 hover:border-[#fbfcff]">
              <Image
                src={job.logo}
                alt={`${job.company} logo`}
                width={50}
                height={50}
                className="object-cover"
              />
            </div>
            {index !== jobs.length - 1 && (
              <div className="absolute left-[23px] top-1/2 h-[400%] flex items-center -z-10">
                <div className="h-full border-l-4 border-[#7796cb]" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-start text-base text-[#888e9e]">
            <h3 className="text-xl m-0">{job.title}</h3>
            <p className="m-0 font-bold">{job.startDate} - {job.endDate ?? "Present"}</p>
            <p className="m-0 italic">{job.company}</p>
            <p className="m-0" dangerouslySetInnerHTML={{ __html: job.description }}></p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WorkHistory;
