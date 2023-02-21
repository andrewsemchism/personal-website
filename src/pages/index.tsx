import * as React from "react"
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Col from 'react-bootstrap/Col';
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import 'bootstrap/dist/css/bootstrap.css';
import '../styles/index.css';
import logo from '../images/logo.svg';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faLinkedin } from "@fortawesome/free-brands-svg-icons"
import { StaticImage } from "gatsby-plugin-image"
import type { HeadFC, PageProps } from "gatsby"


const IndexPage: React.FC<PageProps> = () => {
  return (
    <div id="bootstrap-overrides">
      <Navbar expand="lg" fixed="top">
        <Container fluid>
          <Navbar.Brand href="#home">
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
              <Nav.Link href="#projects">PROJECTS</Nav.Link>
              <Nav.Link href="#contact">CONTACT</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <main>
        <Container fluid className="title-content">
          <Row className="align-items-center">
            <Col xs={0} lg={1} xl={2}></Col>
            <Col lg={7} xl={6}>
              <div className="title-text">
                <h2>Hi, my name is</h2>
                <h1>Andrew Semchism</h1>
                <h2>I love software engineering.</h2>
                <p>I am a third year Computer Science student at the University of Waterloo. I am currently completing an internship a Geotab.</p>
                <Button variant="outline-secondary">Contact Me</Button>
                <div className="icons">
                  <a href="https://github.com/andrewsemchism" target="_blank"><FontAwesomeIcon icon={faGithub} size="2xl"/></a>
                  <a href="https://linkedin.com/in/andrew-semchism-11a56a1a4" target="_blank"><FontAwesomeIcon icon={faLinkedin} size="2xl"/></a>
                </div>
              </div>
            </Col>
            <Col xs={0} lg={3} xl={2}>
              <StaticImage alt="Cartoon of Andrew" src="../images/andrew-cartoon.jpg"/>
            </Col>
            <Col lg={1} xl={2}></Col>
          </Row>
        </Container>

        <Container fluid className="experience-content">
        
        </Container>
   
        
        
      </main>
    </div>
    /*
    <main style={pageStyles}>
      <h1 style={headingStyles}>
        Congratulations
        <br />
        <span style={headingAccentStyles}>— you just made a Gatsby site! 🎉🎉🎉</span>
      </h1>
      <p style={paragraphStyles}>
        Edit <code style={codeStyles}>src/pages/index.tsx</code> to see this page
        update in real-time. 😎
      </p>
      <ul style={doclistStyles}>
        {docLinks.map(doc => (
          <li key={doc.url} style={docLinkStyle}>
            <a
              style={linkStyle}
              href={`${doc.url}?utm_source=starter&utm_medium=ts-docs&utm_campaign=minimal-starter-ts`}
            >
              {doc.text}
            </a>
          </li>
        ))}
      </ul>
      <ul style={listStyles}>
        {links.map(link => (
          <li key={link.url} style={{ ...listItemStyles, color: link.color }}>
            <span>
              <a
                style={linkStyle}
                href={`${link.url}?utm_source=starter&utm_medium=start-page&utm_campaign=minimal-starter-ts`}
              >
                {link.text}
              </a>
              {link.badge && (
                <span style={badgeStyle} aria-label="New Badge">
                  NEW!
                </span>
              )}
              <p style={descriptionStyle}>{link.description}</p>
            </span>
          </li>
        ))}
      </ul>
      <img
        alt="Gatsby G Logo"
        src="data:image/svg+xml,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2a10 10 0 110 20 10 10 0 010-20zm0 2c-3.73 0-6.86 2.55-7.75 6L14 19.75c3.45-.89 6-4.02 6-7.75h-5.25v1.5h3.45a6.37 6.37 0 01-3.89 4.44L6.06 9.69C7 7.31 9.3 5.63 12 5.63c2.13 0 4 1.04 5.18 2.65l1.23-1.06A7.959 7.959 0 0012 4zm-8 8a8 8 0 008 8c.04 0 .09 0-8-8z' fill='%23639'/%3E%3C/svg%3E"
      />
    </main>
    */
  )
}

export default IndexPage

export const Head: HeadFC = () => <title>Home Page</title>
