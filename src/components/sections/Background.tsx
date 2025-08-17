import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

const education = [
  {
    period: 'Current',
    institution: 'University of Helsinki',
    degree: 'Doctoral Researcher',
    department: 'Department of Computer Science',
    focus: 'Distributed AI, Knowledge Transfer, AI Safety',
  },
  {
    period: '2021-2024',
    institution: 'Aalto University',
    degree: 'B.Sc. & M.Sc. Track',
    department: 'Computer Science',
    focus: 'Machine Learning, Systems',
  },
  {
    period: '2017-2020',
    institution: 'Tampereen Lyseon Lukio',
    degree: 'International Baccalaureate Diploma',
    department: '',
    focus: 'Mathematics, Physics, Computer Science',
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
