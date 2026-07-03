import { motion } from 'framer-motion'
import { SectionHeader } from '@/components/ui/section-header'
import { fadeRise, staggerChildren, viewportOnce } from '@/lib/motion'

interface Project {
  year: string
  title: string
  role: string
  description: string
  impact: string
  link?: string
  flagship?: { figure: string; label: string }
}

const projects: Project[] = [
  {
    year: '2025–2026',
    title: 'Vibemetrics → Bondata acquisition',
    role: 'CTO → Head of AI → Consulting AI Architect',
    description:
      'Led the platform through acquisition (May 2025). Moved from CTO to Head of AI, shipping RAG-based survey agents and recommendations to production. Transitioned to Consulting AI Architect in 2026 to focus on PhD research while staying engaged with the AI roadmap.',
    impact: 'Acquisition closed; AI systems shipped; ongoing advisory role',
    link: 'https://www.bondata.fi',
    flagship: { figure: 'Acquired', label: 'May 2025' },
  },
  {
    year: '2026',
    title: 'BridgeLoRA: Skip-Layer Connectors at the Edge',
    role: 'Lead Researcher',
    description:
      'Privacy-preserving collaborative fine-tuning: adapters target specific transformer layers and stay on-device while frozen backbones run in the cloud. The TKDE extension adds systematic profiling, utility analysis, and honest privacy bounds.',
    impact: 'Accepted at ICDCS 2026; TKDE extension underway',
    flagship: { figure: 'ICDCS 2026', label: 'accepted · TKDE extension underway' },
  },
  {
    year: '2025',
    title: 'Stanford CS336 Pretraining Competition',
    role: '1st Place',
    description:
      'Designed and trained a language model achieving the lowest perplexity on the OpenWebText dataset for the CS336 pretraining leaderboard.',
    impact: '1st place finish',
    flagship: { figure: '1st / 125', label: 'teams · pretraining leaderboard' },
  },
  {
    year: '2025',
    title: 'Padlo',
    role: 'Co-founder',
    description:
      'Co-founded padlo.co, a padel live scoreboard + coaching app. Sole coder across mobile, backend, and analytics for player/coach insights.',
    impact: 'Launched March 2025 to live tournaments',
    link: 'https://padlo.co',
  },
  {
    year: '2025–2026',
    title: 'Where Should LLM Agents Run?',
    role: 'Lead Researcher',
    description:
      'Characterizing costs of mobile, edge, and cloud LLM-agent deployments: 5 devices, 7 models, an 8,400-trial trace, and an online-learning (bandit) placement algorithm on top.',
    impact: 'MobiHoc 2026 submission with public measurements',
  },
  {
    year: '2025–2026',
    title: 'Foundation Model Inference at the Edge (Survey)',
    role: 'First Author',
    description:
      '~240-reference survey covering serving stacks, hardware, and emerging methods for running language models on-device and at the edge.',
    impact: 'Submitted to ACM Computing Surveys, July 2026',
  },
  {
    year: '2019–',
    title: 'Teknet',
    role: 'Founder, sole operator → Co-owner with brother (2025–)',
    description:
      'Continued the company from my grandfather’s legacy. Sole worker for the first ~5 years: sales, manufacturing, packaging, marketing, customer service. Expanded in early 2025 by taking my brother as co-owner.',
    impact: 'Profitable services business across two generations',
  },
]

type FlagshipProject = Project & { flagship: NonNullable<Project['flagship']> }

const flagshipProjects = projects.filter((p): p is FlagshipProject => Boolean(p.flagship))
const compactProjects = projects.filter((p) => !p.flagship)

export function Projects() {
  return (
    <section id="projects" className="min-h-screen px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <SectionHeader number="02" title="PROJECTS" note="2019 – 2026" />

        <motion.div
          variants={staggerChildren(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <div>
            {flagshipProjects.map((project) => (
              <motion.div
                key={project.title}
                variants={fadeRise}
                className="border-t-2 border-foreground/80 py-8 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-10"
              >
                <div>
                  <div className="font-mono text-xs text-muted-foreground tabular-nums">
                    {project.year}
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl leading-tight mt-1">
                    {project.link ? (
                      <a
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-ink transition-colors"
                      >
                        {project.title} →
                      </a>
                    ) : (
                      project.title
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">{project.role}</p>
                  <p className="text-sm leading-relaxed max-w-2xl mt-2">{project.description}</p>
                </div>
                <div className="mt-6 md:mt-0 md:text-right">
                  <div className="h-[2px] w-10 bg-ink mb-3 md:ml-auto" />
                  <div className="font-mono text-3xl md:text-4xl tracking-tight tabular-nums whitespace-nowrap">
                    {project.flagship.figure}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground max-w-[180px] md:ml-auto mt-1">
                    {project.flagship.label}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div>
            {compactProjects.map((project) => (
              <motion.div
                key={project.title}
                variants={fadeRise}
                className="border-t border-border/25 py-5 sm:grid sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-x-6"
              >
                <div className="font-mono text-xs text-muted-foreground tabular-nums">
                  {project.year}
                </div>
                <div className="mt-1 sm:mt-0">
                  <h3 className="font-bold text-sm">
                    {project.link ? (
                      <a
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline underline-offset-4"
                      >
                        {project.title} →
                      </a>
                    ) : (
                      project.title
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">{project.role}</p>
                  <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                </div>
                <div className="font-mono text-xs text-muted-foreground max-w-[200px] mt-2 sm:mt-0 sm:text-right sm:ml-auto">
                  {project.impact}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
