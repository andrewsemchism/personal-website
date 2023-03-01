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
    description: 'At Geotab, I am working on MyGeotab, a web application that allows users to manage their fleet of vehicles.',
    startDate: 'January 2023',
    endDate: 'April 2023',
    logo: geotabLogo,
  },
  {
    company: '1Password',
    title: 'Junior Developer',
    description: 'At 1Password, I honed my React skills and learned to write high-quality, testable code with Jest. Read more about my experience in this <a href="https://blog.1password.com/internship-what-its-like/" target="_blank">1Password blog post.</a>',
    startDate: 'May 2022',
    endDate: 'Aug. 2022',
    logo: onepasswordLogo,
  },
  {
    company: 'Rich Media',
    title: 'Web Developer',
    description: 'At Rich Media, I gained hands-on experience working with HTML, CSS, and JavaScript, collaborating with designers to create polished, user-friendly web products.',
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
            <p className="job-description" dangerouslySetInnerHTML={{ __html: job.description }}></p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TabsSelector;