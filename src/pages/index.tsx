import React, { useState, useEffect } from "react";
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Col from 'react-bootstrap/Col';
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import 'bootstrap/dist/css/bootstrap.css';
import '../styles/index.css';
import logo from '../images/logo.svg';
import beerBoss from '../images/beerboss.png';
import adGuesser from '../images/adguesser.png';
import piDashboard from '../images/pidashboard.png';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faLinkedin } from "@fortawesome/free-brands-svg-icons"
import { StaticImage } from "gatsby-plugin-image"
import type { HeadFC, PageProps } from "gatsby"
import Tabs from "../components/tabs/tabs";
import ImageComponent from "../components/ImageComponent/ImageComponent";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import TypeIt from "typeit-react";
import { Job } from "../components/tabs/tabs";
import faireLogo from "../images/faire-logo.jpg"
import geotabLogo from '../images/geotab-logo.jpg';
import onepasswordLogo from '../images/1password-logo.png';
import richmediaLogo from '../images/richmedia-logo.jpg';
import cartalogo from '../images/carta-logo.jpg';
import gemLogo from '../images/gem-logo.png';

// List of jobs
const jobs: Job[] = [
  {
    company: "Gem",
    title: "Software Engineer",
    description: "Building Gem's new ATS product!",
    startDate: "Sept. 2024",
    logo: gemLogo
  },
  {
    company: 'Carta',
    title: 'Frontend Engineer',
    description: 'Frontend development of <a href="https://carta.com" target="_blank">Carta.com</a>. Working on equity management solutions for LLCs.',
    startDate: 'May 2024',
    endDate: 'Aug. 2024',
    logo: cartalogo,
  },
  {
    company: 'Faire',
    title: 'Frontend Engineer',
    description: 'Frontend development of <a href="https://faire.com" target="_blank">Faire.com</a> on the Brand Growth team.',
    startDate: 'Sept. 2023',
    endDate: 'Dec. 2023',
    logo: faireLogo
  },
  {
    company: 'Geotab',
    title: 'Software Developer',
    description: 'At Geotab, I worked on MyGeotab, a web application that allows users to manage their fleet of vehicles. I gained experience with React, TypeScript, C#, and SQL.',
    startDate: 'Jan. 2023',
    endDate: 'Apr. 2023',
    logo: geotabLogo,
  },
  {
    company: '1Password',
    title: 'Junior Developer',
    description: 'At 1Password, I honed my React skills and learned to write high-quality, unit-tested code with Jest. Read more about my experience in this <a href="https://blog.1password.com/internship-what-its-like/" target="_blank">1Password blog post.</a>',
    startDate: 'May 2022',
    endDate: 'Aug. 2022',
    logo: onepasswordLogo,
  },
  {
    company: 'Rich Media',
    title: 'Web Developer',
    description: 'At Rich Media, I gained hands-on experience working with HTML, CSS, and JavaScript. I collaborated with designers to create polished, user-friendly web products.',
    startDate: 'May 2021',
    endDate: 'Aug. 2021',
    logo: richmediaLogo,
  },
];


const IndexPage: React.FC<PageProps> = () => {

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
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div id="bootstrap-overrides">
      <Navbar expand="lg" fixed="top" className={showNavbar ? "show" : "hide"}>
        <Container fluid>
          <Navbar.Brand>
            <img
              src={logo}
              width="60"
              height="60"
              className="d-inline-block align-top"
              alt="React Bootstrap logo"
            />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav"/>
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
              <Nav.Link href="#experience">EXPERIENCE</Nav.Link>
              <Nav.Link href="#contact">CONTACT</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <main>
        <Container fluid className="title-content">
          <Row className="align-items-center">
            <Col xs={0} md={0} lg={1} xl={2}></Col>
            <Col xs={12} md={8} lg={7} xl={6}>
              <div className="title-text">
                <h2>Hi, my name is</h2>
                <h1>Andrew Semchism</h1>
                <h2><TypeIt>I love software engineering.</TypeIt></h2>
                <p>I'm a fourth-year Computer Science student studying at the University of Waterloo.</p>
                <Button variant="outline-secondary" href="#contact">Contact Me</Button>
                <div className="icons">
                  <a href="https://github.com/andrewsemchism" target="_blank"><FontAwesomeIcon icon={faGithub} size="2xl"/></a>
                  <a href="https://linkedin.com/in/andrew-semchism-11a56a1a4" target="_blank"><FontAwesomeIcon icon={faLinkedin} size="2xl"/></a>
                </div>
              </div>
            </Col>
            <Col xs={0} md={4} lg={3} xl={2} className="d-none d-md-block">
              <StaticImage placeholder="blurred" alt="Cartoon of Andrew" src="../images/andrew-cartoon.png"/>
            </Col>
            <Col xs={0} md={0} lg={1} xl={2}></Col>
          </Row>
        </Container>
        <Container fluid id="experience" className="h-100 experience-content">
          <Row className="align-items-start">
            <Col xs={0} md={0} lg={1} xl={2}></Col>
            <Col xs={12} md={6} lg={5} xl={4}>
              <h2>Work Experience</h2>
              <Tabs jobs={jobs}/>
            </Col>
            <Col xs={12} md={6} lg={5} xl={4}>
              <h2>Featured Project</h2>
              <Container fluid>
                <Row>
                  <Col>
                    <ImageComponent
                    imageUrl={beerBoss}
                    title="BeerBoss.ca"
                    description="Ontario Beer Store price optimization."
                    link="https://beerboss.ca/"></ImageComponent>
                  </Col>
                </Row>
                { /* OLD PROJECTS
                <Row>
                <Col>
                  <ImageComponent
                  imageUrl={adGuesser}
                  title="Ad Guesser"
                  description="Guessing game build with React."
                  link="https://github.com/andrewsemchism/adguesser"></ImageComponent>
                </Col>
                <Col>
                  <ImageComponent
                  imageUrl={piDashboard}
                  title="Pi Dashboard"
                  description="3D Printed Pi dashboard."
                  link="https://github.com/andrewsemchism/pi-lcd-dashboard"></ImageComponent>
                </Col>
                </Row>
                */ }
              </Container>
            </Col>
            <Col xs={0} md={0} lg={1} xl={2}></Col>
          </Row>
        </Container>
        <Container fluid id="contact" className="contact-content">
        <Row className="align-items-center h-100">
            <Col xs={0} md={0} lg={1} xl={2}></Col>
            <Col xs={12} md={6} lg={5} xl={4}>
              <h2>Get In Touch</h2>
              <p>Thank you for visiting my site. If you're interested in learning more about my experience as a software developer or UWaterloo Computer Science student, please don't hesitate to reach out to me via email at andrewsemchism@gmail.com.</p>
              <div className="icons">
                <a href="https://linkedin.com/in/andrew-semchism-11a56a1a4" target="_blank"><FontAwesomeIcon icon={faLinkedin} size="2xl"/></a>
                <a href="mailto:andrewsemchism@gmail.com" target="_blank"><FontAwesomeIcon icon={faEnvelope} size="2xl"/></a>
              </div>
            </Col>
            <Col xs={12} md={6} lg={5} xl={4}>
            </Col>
            <Col xs={0} md={0} lg={1} xl={2}></Col>
          </Row>
        </Container>
   
        
        
      </main>
    </div>
  )
}

export default IndexPage

export const Head: HeadFC = () => <title>Andrew Semchism</title>
