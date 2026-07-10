import { useEffect, useState } from 'react'
import './index.css'
import { InplayApp } from './inplay/InplayApp'

const PROJECTS = [
  {
    title: 'FastQuiz',
    synopsis: 'Free-to-use application for hosting and playing fast pub quizzes.',
    url: 'https://fastquiz.equalsredeemer.com',
    category: 'Web App',
    status: 'Live',
  },
  {
    title: 'QLL Website',
    synopsis: 'Full rewrite of the historic Quiz League of London website and stats platform.',
    url: 'https://quizleague.london',
    category: 'Website',
    status: 'In progress',
  },
  {
    title: 'Highlight Translator',
    synopsis: 'Chrome extension for instant translation of highlighted text.',
    url: 'https://chromewebstore.google.com/detail/highlight-translator/cjlajekojgiipcikahogchndkbmiekon?pli=1',
    category: 'Browser Extension',
    status: 'Live',
  },
  {
    title: 'Friday Buzzer',
    synopsis: 'WebSockets app for hosting and playing buzzer quizzes.',
    url: 'https://buzzer.equalsredeemer.com',
    category: 'Web App',
    status: 'Live',
  },
]

function PortfolioHome() {
  const linkedinUrl = 'https://www.linkedin.com/in/jack-a-5290b1b4/'
  const githubUrl = 'https://github.com/jjalexander1'
  const title = '=REDEEMER'
  const [typedTitle, setTypedTitle] = useState('')

  useEffect(() => {
    let index = 0

    const interval = window.setInterval(() => {
      index += 1
      setTypedTitle(title.slice(0, index))

      if (index >= title.length) {
        window.clearInterval(interval)
      }
    }, 95)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <main className="site-shell">
      <section className="intro-section" aria-label="EqualsRedeemer introduction">
        <div className="intro-inner">
          <h1 aria-label={title}>
            <span className="typed-title">{typedTitle}</span>
            <span className="typing-cursor" aria-hidden="true">
              |
            </span>
          </h1>
          <p className="intro-name">Jack Alexander</p>
          <p className="intro-role">Senior Software Engineer</p>

          <div className="intro-links">
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
              <img src="/linkedin-logo.png" alt="" aria-hidden="true" className="icon" />
            </a>
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              <img src="/github-logo.png" alt="" aria-hidden="true" className="icon" />
            </a>
          </div>
        </div>

        <a className="scroll-link" href="#projects" aria-label="Scroll to projects">
          ↓
        </a>
      </section>

      <section className="projects-section" id="projects" aria-label="Personal projects">
        <div className="projects-inner">
          <div className="projects-header">
            <p className="eyebrow eyebrow--light">Personal projects</p>
            <h2>Selected work</h2>
            <p className="projects-intro">
              Outside of my work with{' '}
              <a href="https://eit.org/" target="_blank" rel="noopener noreferrer">
                Ellison Institute of Technology
              </a>
              , here are some of the personal projects I&apos;ve built recently.
            </p>
          </div>

          <div className="projects-grid">
            {PROJECTS.map((project) => (
              <a
                key={project.title}
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="project-card"
              >
                <div className="project-card__meta">
                  <span>{project.category}</span>
                  <span>{project.status}</span>
                </div>

                <div className="project-card__body">
                  <h3>{project.title}</h3>
                  <p>{project.synopsis}</p>
                </div>

                <div className="project-card__footer">
                  <span aria-hidden="true">↗</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function App() {
  if (window.location.pathname.startsWith('/inplay')) {
    return <InplayApp />
  }

  return <PortfolioHome />
}

export default App
