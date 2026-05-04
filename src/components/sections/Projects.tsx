import { motion } from 'framer-motion'
import { SectionHeader } from '@/components/ui/section-header'

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
    year: '2025–2026',
    title: 'Vibemetrics → Bondata acquisition',
    role: 'CTO → Head of AI → Consulting AI Architect',
    description:
      'Led the platform through acquisition (May 2025). Moved from CTO to Head of AI, shipping RAG-based survey agents and recommendations to production. Transitioned to Consulting AI Architect in 2026 to focus on PhD research while staying engaged with the AI roadmap.',
    impact: 'Acquisition closed; AI systems shipped; ongoing advisory role',
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
    year: '2026',
    title: 'BridgeLoRA: Skip-Layer Connectors at the Edge',
    role: 'Lead Researcher',
    description:
      'Privacy-preserving collaborative fine-tuning: adapters target specific transformer layers and stay on-device while frozen backbones run in the cloud. Mechanistic interpretability drives layer selection — knowing which layers, which adapters, and which datasets to bind.',
    impact: 'Accepted at ICDCS 2026; journal extension underway',
  },
  {
    year: '2025–2026',
    title: 'Measuring the True Cost of On-Device Agents',
    role: 'Lead Researcher',
    description:
      'Systematic evaluation of LLM agents on consumer hardware (iPhone, MacBook, edge servers) across 4 devices, 4 models, and 300 tasks.',
    impact: 'MobiHoc 2026 submission with public measurements',
  },
  {
    year: '2025–2026',
    title: 'LLM Inference on the Edge — Survey',
    role: 'First Author',
    description:
      '180-reference survey covering serving stacks, hardware, and emerging methods for running language models on-device and at the edge.',
    impact: 'In review since April 2026',
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
    year: '2019–',
    title: 'Teknet',
    role: 'Founder, sole operator → Co-owner with brother (2025–)',
    description:
      'Continued the company from my grandfather’s legacy. Sole worker for the first ~5 years — sales, manufacturing, packaging, marketing, customer service. Expanded in early 2025 by taking my brother as co-owner.',
    impact: 'Profitable services business across two generations',
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
          <SectionHeader number="02" title="PROJECTS" note="2019 – 2026" />

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
