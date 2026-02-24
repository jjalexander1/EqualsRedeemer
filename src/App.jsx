import { useRef } from 'react'
import './index.css'

function App() {
  const projectsRef = useRef(null);

  const projects = [
    {
      title: 'Highlight Translator',
      synopsis: 'Chrome extension for instant highlighted-text translation.',
      url: 'https://chromewebstore.google.com/detail/highlight-translator/cjlajekojgiipcikahogchndkbmiekon?pli=1',
      category: 'Chrome Extension',
      accent: 'publish'
    },
    {
      title: 'Fast Quiz',
      synopsis: 'Live quiz hosting with realtime rounds and scoreboards.',
      url: 'https://fastquiz.equalsredeemer.com',
      category: 'WebSocket App',
      accent: 'realtime'
    },
    {
      title: 'Buzzer',
      synopsis: 'WebSocket buzzer rooms with response timing for quiz nights.',
      url: 'https://buzzer.equalsredeemer.com',
      category: 'WebSocket App',
      accent: 'quiz'
    },
    {
      title: 'Quiz League of London website',
      synopsis: 'Full rewrite of the historic Quiz League of London website and stats platform, coming soon.',
      url: 'https://quizleague.london',
      category: 'Website Rewrite',
      accent: 'publish'
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
        <div className="hero-identity">
          <p className="hero-name">Jack Alexander</p>
          <h2 id="subtitle" className="hero-role">Senior Software Engineer</h2>
        </div>

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
        <div className="projects-header">
          <h2 className="projects-title">Things I’ve Built</h2>
          <p className="projects-intro">Web apps, sites and tools.</p>
        </div>
        <div className="projects-grid">
          {projects.map((project, index) => (
            <a
              key={index}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`project-card project-card-${project.accent}`}
            >
              <div className="project-card-top">
                <span className="project-category">{project.category}</span>
              </div>
              <div className="project-card-body">
                <h3>{project.title}</h3>
                <p>{project.synopsis}</p>
              </div>
            </a>
          ))}
        </div>
      </section>
      <div className="rainbow-rail" aria-hidden="true" />
    </>
  )
}

export default App
