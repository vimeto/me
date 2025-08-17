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
    title: 'Vibemetrics → Innolink acquisition',
    role: 'Senior Developer (post-acquisition)',
    description:
      'Worked on social analytics platform through its acquisition by Innolink. Continued as Senior Developer at Innolink, leading technical integration and platform scaling.',
    impact: 'Successful acquisition in May 2025',
    link: 'https://www.innolink.fi/innolink-vahvistaa-markkina-asemaansa-ostamalla-suomalaisen-tutkimusalusta-vibemetricsin',
  },
  {
    year: '2025',
    title: 'Padlo',
    role: 'Founder',
    description:
      'Founded and launched mobile application startup. Architected full-stack infrastructure and led product development from concept to market.',
    impact: 'Successfully launched to production',
    link: 'https://padlo.fi',
  },
  {
    year: '2024',
    title: 'GRPO Implementation',
    role: 'Primary Developer',
    description:
      'Implemented custom training pipeline for group relative policy optimization. Conducted 12 documented ablation studies to identify optimal hyperparameters.',
    impact: 'Open-sourced implementation with reproducible benchmarks',
  },
  {
    year: '2024',
    title: 'Small-Model Measurement Study',
    role: 'Lead Researcher',
    description:
      'Systematic evaluation of sub-7B parameter models on consumer hardware. Established baseline metrics and identified key failure modes for distillation targets.',
    impact: 'Published dataset of performance characteristics',
  },
  {
    year: '2023',
    title: 'Lossless Compression of DNNs',
    role: 'Presenter',
    description:
      'Aalto University topic presentation on neural network compression techniques. Analyzed theoretical limits and practical approaches to model size reduction.',
    impact: 'Academic presentation with published slides',
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
