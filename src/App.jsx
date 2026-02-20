import { useState, useRef } from 'react'
import './index.css'

function App() {
  const projectsRef = useRef(null);

  const projects = [
    {
      title: 'Highlight Translator',
      synopsis: 'A published Chrome Extension for translating highlighted text instantly.',
      url: 'https://chromewebstore.google.com/detail/highlight-translator/cjlajekojgiipcikahogchndkbmiekon?pli=1'
    },
    {
      title: 'Fast Quiz',
      synopsis: 'A real-time trivia application for hosting fast-paced quizzes with live scoreboards.',
      url: 'https://fastquiz.localhost'
    },
    {
      title: 'Friday Buzzer',
      synopsis: 'A websocket-based buzzer system for hosting quiz rooms and tracking response times.',
      url: 'https://fridaybuzzer.localhost'
    },
    {
      title: 'QLL Website Remake',
      synopsis: 'A modern, full-stack remake of the Quiz League of London website using React and Python.',
      url: 'https://qll.localhost'
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
