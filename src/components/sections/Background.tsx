import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

const education = [
  {
    period: 'Current',
    institution: 'University of Helsinki',
    degree: 'Doctoral Researcher',
    department: 'Department of Computer Science',
    focus: 'Distributed LLM inference, cognitive core, edge/cloud RL',
  },
  {
    period: '2023-2024',
    institution: 'Aalto University',
    degree: 'M.Sc. Computer Science',
    department: 'Machine Learning, Data Science and Artificial Intelligence',
    focus: 'LLMs, systems, applied ML',
  },
  {
    period: '2021-2023',
    institution: 'Aalto University',
    degree: 'B.Sc. Mathematics and Operations Research',
    department: '',
    focus: 'Mathematics, statistical learning, optimization',
  },
]

const sports = [
  {
    sport: 'Cross-country Skiing',
    level: 'Competitive',
    club: 'Pirkkalan Hiihtäjät',
    achievements: 'Multiple regional podium finishes',
  },
  {
    sport: 'Orienteering',
    level: 'Club',
    club: 'Local events',
    achievements: 'Active participant in national competitions',
  },
]

export function Background() {
  return (
    <section id="background" className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold mb-8">BACKGROUND</h2>
          <Separator className="mb-8 bg-border" />

          <div className="mb-12">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Education</h3>
            <Separator className="mb-6 bg-border" />
            <div className="space-y-6">
              {education.map((edu, index) => (
                <motion.div
                  key={edu.institution}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex gap-8"
                >
                  <div className="w-20 flex-shrink-0 text-sm font-bold">{edu.period}</div>
                  <div className="flex-1">
                    <h4 className="font-bold">{edu.institution}</h4>
                    <p className="text-sm">{edu.degree}</p>
                    {edu.department && (
                      <p className="text-sm text-muted-foreground">{edu.department}</p>
                    )}
                    <p className="text-sm italic">{edu.focus}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Completed both B.Sc. and M.Sc. in roughly three years while working in industry roles.
            </p>
          </div>

          <div className="mb-12">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Applied / Embodied Work</h3>
            <Separator className="mb-6 bg-border" />
            <div className="space-y-4 text-sm">
              <p className="border border-border p-4">
                Built a go-kart from scratch (moped engine) — practical systems intuition for how parts
                interact under real constraints.
              </p>
              <p className="border border-border p-4">
                Ran a small construction company for three summers with one employee — renovations,
                painting, and small builds; learned end-to-end delivery and hands-on project management.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Competitive Sports</h3>
            <Separator className="mb-6 bg-border" />
            <div className="space-y-6">
              {sports.map((sport, index) => (
                <motion.div
                  key={sport.sport}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="border border-border p-4"
                >
                  <h4 className="font-bold mb-2">{sport.sport}</h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-bold">Level:</span> {sport.level}
                    </p>
                    <p>
                      <span className="font-bold">Club:</span> {sport.club}
                    </p>
                    <p>
                      <span className="font-bold">Achievements:</span> {sport.achievements}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
