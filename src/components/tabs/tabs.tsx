import React from 'react';
import './styles.css';

export interface Job {
  company: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  logo: string;
}

interface TabsProps {
  jobs: Job[];
}

const Tabs: React.FC<TabsProps> = ({ jobs }) => {
  return (
    <div className="work-history">
      {jobs.map((job, index) => (
        <div className="job" key={index}>
          <div className="job-logo-container">
            <img src={job.logo} alt={`${job.company} logo`} className="job-logo" />
            {index !== jobs.length - 1 && <div className="job-line-container"><div className="job-line" /></div>}
          </div>
          <div className="job-details">
            <h3 className="job-title">{job.title}</h3>
            <p className="job-dates">{job.startDate} - {job.endDate ?? "Present"}</p>
            <p className="job-company">{job.company}</p>
            <p className="job-description" dangerouslySetInnerHTML={{ __html: job.description }}></p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Tabs;