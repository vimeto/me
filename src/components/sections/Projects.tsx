import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

interface Project {
  year: string
  title: string
  role: string
  description: string
  impact: string
  link?: string
}

const projects: Project[] = [
  {
    year: '2025',
    title: 'Vibemetrics → Bondata acquisition',
    role: 'CTO → Head of AI',
    description:
      'Led the platform through acquisition (May 2025). Transitioned from CTO to Head of AI in July, shipping RAG-based survey agents and recommendations to production.',
    impact: 'Acquisition closed; AI roadmap and production systems delivered',
    link: 'https://www.bondata.fi',
  },
  {
    year: '2025',
    title: 'Padlo',
    role: 'Founder',
    description:
      'Founded padlo.co, a padel live scoreboard + coaching app. Sole coder across mobile, backend, and analytics for player/coach insights.',
    impact: 'Launched March 2025 to live tournaments',
    link: 'https://padlo.co',
  },
  {
    year: '2025',
    title: 'Collaborative Edge/Cloud Fine-Tuning',
    role: 'Lead Researcher',
    description:
      'Adapters that can skip transformer layers stay on-device while frozen LLM backbones run in the cloud. Privacy-preserving adaptation with latency/quality tradeoffs.',
    impact: 'ICDCS 2025 submission with reference pipeline',
  },
  {
    year: '2025',
    title: 'Measuring On-Device Agents',
    role: 'Lead Researcher',
    description:
      'Systematic evaluation of LLM agents on consumer hardware (iPhone, MacBook, edge servers) across 300 tasks and multiple models.',
    impact: 'PerCom 2026 submission with public measurements',
  },
  {
    year: '2025',
    title: 'Stanford CS336 Pretraining Competition',
    role: '1st Place',
    description:
      'Designed and trained a language model achieving the lowest perplexity on the OpenWebText dataset for the CS336 pretraining leaderboard.',
    impact: '1st place finish',
  },
  {
    year: '2019',
    title: 'Teknet',
    role: 'Founder',
    description:
      'Founded a metal manufacturing company. Led project delivery and operations while studying, building hands-on discipline for applied problem solving.',
    impact: 'Profitable services business',
  },
]

export function Projects() {
  return (
    <section id="projects" className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold mb-8">PROJECTS</h2>
          <Separator className="mb-8 bg-border" />

          <div className="space-y-8">
            {projects.map((project, index) => (
              <motion.div
                key={project.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex gap-8"
              >
                <div className="w-16 flex-shrink-0 text-sm text-muted-foreground font-bold">
                  {project.year}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold mb-1">
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
                  <p className="text-sm text-muted-foreground mb-2">{project.role}</p>
                  <p className="text-sm mb-2">{project.description}</p>
                  <p className="text-sm font-bold">{project.impact}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
