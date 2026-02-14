import { useState, useRef } from 'react'
import './index.css'

function App() {
  const projectsRef = useRef(null);

  const projects = [
    {
      title: 'Highlight Translator',
      synopsis: 'A published Chrome Extension for translating highlighted text.',
      url: 'https://github.com/jjalexander1/HighlightTranslator'
    },
    {
      title: 'Quiz Buzzer',
      synopsis: 'A Flask-SocketIO application for hosting Quiz buzzer rooms. (Currently not deployed)',
      url: 'https://github.com/jjalexander1/friday-buzzer'
    },
    {
      title: 'QLL Website Remake',
      synopsis: 'A community project I started to rewrite the QLL website with modern technology.',
      url: 'https://github.com/jjalexander1/QLLWebsiteRemake'
    },
    {
      title: 'More to Come',
      synopsis: 'I am constantly building and learning. Check back soon for new projects.',
      url: 'https://github.com/jjalexander1'
    }
  ];

  const linkedinUrl = "https://www.linkedin.com/in/jack-a-5290b1b4/";
  const githubUrl = "https://github.com/jjalexander1";

  const scrollToProjects = () => {
    projectsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="typing-container" id="title">=REDEEMER</h1>
        <h2 id="subtitle">Jack Alexander, Senior Software Engineer</h2>

        <div className="content">
          <div className="social-links">
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
              <img src="/linkedin-logo.png" alt="LinkedIn" className="icon" /> <span>LinkedIn</span>
            </a>
            <span style={{ color: '#fff', fontSize: '1.5rem' }}>|</span>
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              <img src="/github-logo.png" alt="GitHub" className="icon" /> <span>GitHub</span>
            </a>
          </div>
        </div>

        <div className="scroll-indicator" onClick={scrollToProjects}>
          <span>View Work</span>
          <div className="arrow-down"></div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="projects-section" ref={projectsRef}>
        <div className="projects-grid">
          {projects.map((project, index) => (
            <a
              key={index}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="project-card"
            >
              <h3>{project.title}</h3>
              <p>{project.synopsis}</p>
            </a>
          ))}
        </div>
        <hr className="divider" />
      </section>
    </>
  )
}

export default App
