import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'
import { SectionHeader } from '@/components/ui/section-header'
import { fadeRise, staggerChildren, viewportOnce } from '@/lib/motion'

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
    level: 'Competitive (regional)',
    club: 'Pirkkalan Hiihtäjät',
    achievements: 'Multiple regional podium finishes',
  },
  {
    sport: 'Orienteering',
    level: 'Club',
    club: 'Kangasala SK',
    achievements: 'Active participant in national competitions',
  },
]

export function Background() {
  return (
    <section id="background" className="px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <SectionHeader number="03" title="BACKGROUND" note="2018 – present" />

          <div className="md:grid md:grid-cols-2 md:gap-x-12">
            <div className="mb-12 md:mb-0">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Education</h3>
              <Separator className="mb-6 bg-border/60" />
              <motion.div
                variants={staggerChildren(0.08)}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                className="space-y-6"
              >
                {education.map((edu) => (
                  <motion.div
                    key={`${edu.institution}-${edu.degree}`}
                    variants={fadeRise}
                    className="sm:flex sm:gap-8"
                  >
                    <div className="font-mono text-xs text-muted-foreground tabular-nums sm:w-20 sm:flex-shrink-0 sm:pt-0.5">
                      {edu.period}
                    </div>
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
              </motion.div>
              <p className="mt-4 text-sm text-muted-foreground">
                Completed both B.Sc. and M.Sc. in roughly three years while working in industry
                roles.
              </p>
            </div>

            <div className="mb-12 md:mb-0">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-6">
                Applied / Embodied Work
              </h3>
              <Separator className="mb-6 bg-border/60" />
              <div className="space-y-4 text-sm">
                <p className="border border-border/25 p-4">
                  Built a go-kart from scratch (moped engine). Practical systems intuition for how
                  parts interact under real constraints.
                </p>
                <p className="border border-border/25 p-4">
                  Ran a small construction company for three summers with a coworker / shareholder:
                  renovations, painting, and small builds; learned end-to-end delivery and hands-on
                  project management of a two-person business.
                </p>
                <p className="border border-border/25 p-4">
                  With the same coworker, sold two products on Amazon US, a deliberate exercise in
                  learning sales, marketing, branding, and end-to-end product building from another
                  angle.
                </p>
                <p className="border border-border/25 p-4">
                  Built an outdoor sauna from scratch: frame, walls, stove, the lot. Same lesson the
                  go-kart taught about real-world constraints, at a different scale.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Competitive Sports</h3>
            <Separator className="mb-6 bg-border/60" />
            <motion.div
              variants={staggerChildren(0.08)}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4"
            >
              {sports.map((sport) => (
                <motion.div
                  key={sport.sport}
                  variants={fadeRise}
                  className="border border-border/25 p-4"
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
            </motion.div>
            <p className="mt-6 text-sm text-muted-foreground">
              Not the highest national or international level, but the working habits competitive
              sports demand (tight schedules, knowing limits, pushing through under pressure)
              translate directly to research and to high-velocity teams.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
