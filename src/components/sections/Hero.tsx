import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

export function Hero() {
  return (
    <section id="hero" className="min-h-screen flex items-center justify-center px-6 py-24">
      <div className="max-w-3xl w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-2">VILHELM TOIVONEN</h1>
          <Separator className="my-8 bg-border" />

          <p className="text-xl mb-4">
            Distributed AI — edge deployment, knowledge transfer, and safety.
          </p>

          <p className="text-lg mb-8 text-muted-foreground">
            Doctoral Researcher, University of Helsinki
            <br />
            Senior Developer at Innolink, Former Founder
          </p>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">
              CURRENT FOCUS <span className="font-normal text-muted-foreground ml-4">2024-25</span>
            </h2>
            <Separator className="bg-border" />
            <ul className="space-y-2 text-lg">
              <li>• Distributed AI: efficient deployment on edge devices</li>
              <li>• LLM Knowledge Transfer: methods for model-to-model learning</li>
              <li>• AI Safety: evaluation frameworks for production systems</li>
            </ul>
          </div>

          <div className="flex gap-6 mt-12">
            <a
              href="#research"
              className="underline underline-offset-4 hover:font-bold transition-all"
            >
              Research Agenda
            </a>
            <a
              href="mailto:vilhelm.toivonen@helsinki.fi"
              className="underline underline-offset-4 hover:font-bold transition-all"
            >
              Email
            </a>
            <a
              href="https://www.linkedin.com/in/vilhelm-toivonen-80405516a/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:font-bold transition-all"
            >
              LinkedIn
            </a>
            <a
              href="https://scholar.google.com/citations?user=QnHmHssAAAAJ"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:font-bold transition-all"
            >
              Scholar
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
