import * as React from "react"
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Col from 'react-bootstrap/Col';
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap/dist/js/bootstrap.js';
import '../styles/index.css';
import logo from '../images/logo.svg';
import beerBoss from '../images/beerboss.png';
import adGuesser from '../images/adguesser.png';
import piDashboard from '../images/pidashboard.png';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faLinkedin } from "@fortawesome/free-brands-svg-icons"
import { StaticImage } from "gatsby-plugin-image"
import type { HeadFC, PageProps } from "gatsby"
import TabSelector from "../components/tabs/tabs";
import ImageComponent from "../components/ImageComponent/ImageComponent";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";


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
                <h2>I love software engineering.</h2>
                <p>I'm a third year Computer Science student studying at the University of Waterloo. I am currently completing an internship a Geotab.</p>
                <Button variant="outline-secondary">Contact Me</Button>
                <div className="icons">
                  <a href="https://github.com/andrewsemchism" target="_blank"><FontAwesomeIcon icon={faGithub} size="2xl"/></a>
                  <a href="https://linkedin.com/in/andrew-semchism-11a56a1a4" target="_blank"><FontAwesomeIcon icon={faLinkedin} size="2xl"/></a>
                </div>
              </div>
            </Col>
            <Col xs={0} md={4} lg={3} xl={2} className="d-none d-md-block">
              <StaticImage alt="Cartoon of Andrew" src="../images/andrew-cartoon.jpg"/>
            </Col>
            <Col xs={0} md={0} lg={1} xl={2}></Col>
          </Row>
        </Container>
        <Container fluid id="experience" className="experience-content">
          <Row className="align-items-start">
            <Col xs={0} md={0} lg={1} xl={2}></Col>
            <Col xs={12} md={6} lg={5} xl={4}>
              <h2>Work Experience</h2>
              <TabSelector/>
            </Col>
            <Col xs={12} md={6} lg={5} xl={4}>
              <h2>Featured Projects</h2>
              <Container fluid>
                <Row>
                  <Col>
                    <ImageComponent
                    imageUrl={beerBoss}
                    title="BeerBoss.ca"
                    description="Ontario Beer Store price optimization."></ImageComponent>
                  </Col>
                </Row>
                <Row>
                <Col>
                  <ImageComponent
                  imageUrl={adGuesser}
                  title="Ad Guesser"
                  description="Guessing game build with React."></ImageComponent>
                </Col>
                <Col>
                  <ImageComponent
                  imageUrl={piDashboard}
                  title="Pi Dashboard"
                  description="3D Printed Pi dashboard."></ImageComponent>
                </Col>

                </Row>
              </Container>
            </Col>
            <Col xs={0} md={0} lg={1} xl={2}></Col>
          </Row>
        </Container>
        <Container fluid id="contact" className="contact-content">
        <Row className="align-items-start">
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

export const Head: HeadFC = () => <title>Home Page</title>
