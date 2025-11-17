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
            Distributed LLMs — cognitive core, edge deployment, and tool-using agents.
          </p>

          <p className="text-lg mb-8 text-muted-foreground">
            Doctoral Researcher (distributed LLM inference), University of Helsinki
            <br />
            Head of AI, Bondata (transitioning end of 2025 to focus on research)
            <br />
            Founder, Teknet (2019) • Co-founder, Padlo.co (2025)
          </p>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">
              CURRENT FOCUS <span className="font-normal text-muted-foreground ml-4">2024-25</span>
            </h2>
            <Separator className="bg-border" />
            <ul className="space-y-2 text-lg">
              <li>• Cognitive core: small, tool-using models with strong reasoning</li>
              <li>• Distributed inference: edge/cloud collaboration for LLMs</li>
              <li>• RL for agents: GRPO-style training with on-device rollouts</li>
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
