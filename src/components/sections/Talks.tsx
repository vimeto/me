import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

const talkTopics = [
  'Distillation safety: which behaviors persist through compression',
  'Attack transfer in model families',
  'Alignment reliability across languages',
  'From startup CTO to safety researcher: lessons in applied AI',
]

const mediaKit = {
  bios: {
    short:
      'Vilhelm Toivonen is a Doctoral Researcher at the University of Helsinki focusing on empirical AI safety. His work examines distillation robustness, attack transfer, and multilingual oversight in language models.',
    medium:
      'Vilhelm Toivonen is a Doctoral Researcher at the University of Helsinki Department of Computer Science, specializing in empirical AI safety research. With a background as a startup CTO and technical lead, he brings production experience to safety research. His current work focuses on understanding how safety properties transfer through model distillation, examining attack persistence across model sizes, and evaluating multilingual alignment reliability. He emphasizes reproducible research with public code and data.',
  },
  availability:
    'Available for talks on AI safety, distillation, and practical alignment challenges.',
}

export function Talks() {
  return (
    <section id="talks" className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold mb-8">TALKS & MEDIA</h2>
          <Separator className="mb-8 bg-border" />

          <div className="mb-12">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Talk Topics</h3>
            <Separator className="mb-6 bg-border" />
            <ul className="space-y-3">
              {talkTopics.map((topic, index) => (
                <motion.li
                  key={topic}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-start"
                >
                  <span className="mr-3">•</span>
                  <span>{topic}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Media Kit</h3>
            <Separator className="mb-6 bg-border" />

            <div className="space-y-6">
              <div>
                <h4 className="font-bold mb-2">Short Bio (60 words)</h4>
                <p className="text-sm border border-border p-4">{mediaKit.bios.short}</p>
              </div>

              <div>
                <h4 className="font-bold mb-2">Medium Bio (120 words)</h4>
                <p className="text-sm border border-border p-4">{mediaKit.bios.medium}</p>
              </div>

              <div>
                <h4 className="font-bold mb-2">Availability</h4>
                <p className="text-sm">{mediaKit.availability}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  For speaking inquiries, headshots, and additional materials, please contact via
                  email.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
