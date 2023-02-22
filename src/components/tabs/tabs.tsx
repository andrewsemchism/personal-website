import React from 'react';
import geotabLogo from './geotab-logo.jpg';
import onepasswordLogo from './1password-logo.png';
import richmediaLogo from './richmedia-logo.jpg';
import './styles.css';

interface Job {
  company: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  logo: string;
}

const jobs: Job[] = [
  {
    company: 'Geotab',
    title: 'Software Developer',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    startDate: 'January 2023',
    endDate: 'April 2023',
    logo: geotabLogo,
  },
  {
    company: '1Password',
    title: 'Junior Developer',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    startDate: 'May 2022',
    endDate: 'Aug. 2022',
    logo: onepasswordLogo,
  },
  {
    company: 'Rich Media',
    title: 'Web Developer',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    startDate: 'May 2021',
    endDate: 'Aug. 2021',
    logo: richmediaLogo,
  },
];

const TabsSelector: React.FC = () => {
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
            <p className="job-dates">{job.startDate} - {job.endDate}</p>
            <p className="job-company">{job.company}</p>
            <p className="job-description">{job.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TabsSelector;